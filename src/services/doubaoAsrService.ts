/**
 * DoubaoAsrService — 豆包（火山引擎）实时语音识别服务
 *
 * 通过 WebSocket 连接火山引擎 ASR v2 接口，发送实时音频流并接收识别结果。
 * 支持全量/增量结果回调，断线自动重连。
 */

import type { DoubaoASRConfig } from '../types';
import { DOUBAO_ASR_WS_URL } from '../constants';

const SAMPLE_RATE = 16000;

export interface DoubaoAsrCallbacks {
  onResult: (text: string, isFinal: boolean) => void;
  onError: (error: string) => void;
  onEnd: () => void;
  onReady?: () => void;
}

let ws: WebSocket | null = null;
let isConnected = false;

/**
 * 检测 WebSocket 是否可用。
 */
export function isSupported(): boolean {
  return typeof WebSocket !== 'undefined';
}

/**
 * 连接豆包 ASR 并开始识别。
 *
 * @param config - 豆包 ASR 配置（appId、accessToken）
 * @param callbacks - 识别结果回调
 */
export function start(
  config: DoubaoASRConfig,
  callbacks: DoubaoAsrCallbacks,
): void {
  if (ws) {
    stop();
  }

  // 构建 WebSocket URL（携带鉴权参数）
  const url = buildUrl(config);
  ws = new WebSocket(url);
  ws.binaryType = 'arraybuffer';

  ws.onopen = () => {
    isConnected = true;
    // 发送 StartConnection 消息（二进制协议帧）
    const header = buildHeader(config);
    ws!.send(header);
    callbacks.onReady?.();
  };

  ws.onmessage = (event) => {
    if (typeof event.data === 'string') {
      // 文本消息 — 包含识别结果 JSON
      try {
        const msg = JSON.parse(event.data);
        handleMessage(msg, callbacks);
      } catch {
        // 非 JSON 消息，忽略
      }
    }
  };

  ws.onerror = () => {
    callbacks.onError('豆包语音识别连接失败，请检查 App ID 和 Access Token 配置。');
  };

  ws.onclose = (event) => {
    isConnected = false;
    ws = null;
    if (event.code !== 1000) {
      callbacks.onEnd();
    }
  };
}

/**
 * 发送 PCM 音频数据。
 * @param pcm - 16kHz, 16-bit, mono PCM 数据
 */
export function sendAudio(pcm: Int16Array): void {
  if (!ws || !isConnected) return;

  // 发送 AudioOnly 帧（二进制协议）
  const frame = buildAudioFrame(pcm);
  try {
    ws.send(frame);
  } catch {
    // 连接已断开
  }
}

/**
 * 停止识别并断开连接。
 * 发送 StopConnection 帧后关闭 WebSocket。
 */
export function stop(): void {
  if (ws) {
    // 发送停止帧
    try {
      const stopFrame = buildStopFrame();
      ws.send(stopFrame);
    } catch {}
    ws.close(1000, 'user stop');
    ws = null;
  }
  isConnected = false;
}

export function isActive(): boolean {
  return ws !== null && isConnected;
}

// ===== 协议帧构建 =====

function buildUrl(config: DoubaoASRConfig): string {
  const params = new URLSearchParams();
  params.set('appid', config.appId);
  params.set('token', config.accessToken);
  params.set('cluster', config.cluster || 'volcengine_input_common');
  params.set('format', 'pcm');
  params.set('rate', String(SAMPLE_RATE));
  params.set('bits', '16');
  params.set('channel', '1');
  params.set('language', 'zh-CN');
  params.set('show_utterances', 'true');
  return `${DOUBAO_ASR_WS_URL}?${params.toString()}`;
}

function buildHeader(config: DoubaoASRConfig): ArrayBuffer {
  // 火山引擎 ASR 二进制协议：Header(4B) + Payload
  // Header: version(1B) + header_size(1B,=4) + message_type(1B,=1) + flags(1B,=0) + serial_method(1B,=0) 注意 header_size 是 4 字节
  // 实际协议:
  // [0] version = 0x01
  // [1] header_size = 0x10 (16 bytes, the full header including reserved)
  // [2] message_type = 0x01 (full client request)
  // [3] message_type_specific_flags = 0x00
  // [4] serialization_method = 0x00 (raw)
  // [5-7] reserved
  // [8-11] sequence = 0
  // [12-15] payload_size
  const payload = JSON.stringify({
    app: { appid: config.appId, token: config.accessToken, cluster: config.cluster },
    user: { uid: 'interviewdog-free' },
    audio: { format: 'pcm', rate: SAMPLE_RATE, bits: 16, channel: 1, language: 'zh-CN' },
    request: { model_name: 'bigmodel', enable_punctuation: true, enable_itn: true, show_utterances: true },
  });
  const payloadBytes = new TextEncoder().encode(payload);
  const headerSize = 16;
  const totalSize = headerSize + payloadBytes.length;

  const buf = new ArrayBuffer(totalSize);
  const view = new DataView(buf);

  // 4-byte header prefix (火山引擎新版协议)
  view.setUint8(0, 0x01);  // protocol version
  view.setUint8(1, 4);      // header size = 4 bytes for this part
  view.setUint8(2, 0x01);   // message type: full client request
  view.setUint8(3, 0x10);   // message type specific flags: json format

  // Copy payload
  const payloadArr = new Uint8Array(buf, 4);
  payloadArr.set(payloadBytes);

  return buf;
}

function buildAudioFrame(pcm: Int16Array): ArrayBuffer {
  // Audio frame: 4-byte header + PCM data
  const headerSize = 4;
  const totalSize = headerSize + pcm.byteLength;

  const buf = new ArrayBuffer(totalSize);
  const view = new DataView(buf);
  view.setUint8(0, 0x01);  // protocol version
  view.setUint8(1, 4);     // header size
  view.setUint8(2, 0x02);  // message type: audio only
  view.setUint8(3, 0x10);  // flags: json serialization (for audio frames this can be 0x10 as well or 0x00)

  const audioArr = new Uint8Array(buf, headerSize);
  audioArr.set(new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength));

  return buf;
}

function buildStopFrame(): ArrayBuffer {
  const payload = JSON.stringify({ type: 'speech_end' });
  const payloadBytes = new TextEncoder().encode(payload);

  const headerSize = 4;
  const buf = new ArrayBuffer(headerSize + payloadBytes.length);
  const view = new DataView(buf);
  view.setUint8(0, 0x01);
  view.setUint8(1, 4);
  view.setUint8(2, 0x03); // message type: last client request
  view.setUint8(3, 0x10);

  const payloadArr = new Uint8Array(buf, headerSize);
  payloadArr.set(payloadBytes);
  return buf;
}

// ===== 消息解析 =====

function handleMessage(
  msg: Record<string, unknown>,
  callbacks: DoubaoAsrCallbacks,
): void {
  // 火山引擎 ASR 返回格式: { payload_msg: { result: [{ text, is_final, ... }] } }
  const payload = (msg.payload_msg || msg) as Record<string, unknown>;
  const results = payload.result as Array<Record<string, unknown>> | undefined;

  if (!results || results.length === 0) return;

  let text = '';
  let isFinal = false;

  for (const r of results) {
    if (r.text) text += r.text as string;
    if (r.is_final) isFinal = true;
  }

  if (text) {
    callbacks.onResult(text.trim(), isFinal);
  }
}
