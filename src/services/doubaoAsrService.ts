/**
 * DoubaoAsrService — 豆包（火山引擎）大模型流式语音识别服务。
 *
 * 前端通过本地 Vite WebSocket 代理连接官方 v3 接口；代理负责在握手时
 * 注入浏览器无法设置的 X-Api-* 鉴权 Header。
 */

import type { DoubaoASRConfig } from '../types';
import { DOUBAO_ASR_WS_PATH } from '../constants';
import { gzip } from 'pako';

const SAMPLE_RATE = 16000;
const PCM_CHUNK_SAMPLES = 320; // 20ms at 16kHz, recommended by the streaming ASR docs.

const MESSAGE_TYPE = {
  FULL_CLIENT_REQUEST: 0x01,
  AUDIO_ONLY_REQUEST: 0x02,
  FULL_SERVER_RESPONSE: 0x09,
  ERROR_RESPONSE: 0x0f,
} as const;

const MESSAGE_FLAGS = {
  NONE: 0x00,
  HAS_SEQUENCE: 0x01,
  LAST_PACKET: 0x02,
} as const;

const SERIALIZATION = {
  NONE: 0x00,
  JSON: 0x01,
} as const;

const COMPRESSION = {
  NONE: 0x00,
  GZIP: 0x01,
} as const;

export interface DoubaoAsrCallbacks {
  onResult: (text: string, isFinal: boolean) => void;
  onError: (error: string) => void;
  onEnd: () => void;
  onReady?: () => void;
}

export interface DoubaoAsrTestResult {
  success: boolean;
  message: string;
}

let ws: WebSocket | null = null;
let isConnected = false;
let canSendAudio = false;
let audioQueue: Int16Array[] = [];

export function isSupported(): boolean {
  return typeof WebSocket !== 'undefined';
}

export function start(
  config: DoubaoASRConfig,
  callbacks: DoubaoAsrCallbacks,
): void {
  if (ws) {
    stop();
  }
  canSendAudio = false;
  audioQueue = [];

  ws = new WebSocket(buildProxyUrl(config));
  ws.binaryType = 'arraybuffer';

  ws.onopen = () => {
    isConnected = true;
    ws?.send(buildFullClientRequest());
  };

  ws.onmessage = (event) => {
    if (!(event.data instanceof ArrayBuffer)) return;
    if (!canSendAudio) {
      canSendAudio = true;
      flushAudioQueue();
      callbacks.onReady?.();
    }
    parseServerFrame(event.data)
      .then((frame) => {
        if (frame.type === 'error') {
          callbacks.onError(`豆包语音识别错误 ${frame.code}：${frame.message}`);
          return;
        }
        handleResultPayload(frame.payload, callbacks, frame.isLast);
      })
      .catch((error) => {
        callbacks.onError(error instanceof Error ? error.message : '豆包语音识别返回解析失败。');
      });
  };

  ws.onerror = () => {
    callbacks.onError('豆包语音识别连接失败，请检查 App ID、Access Token、Resource ID 和服务是否已开通。');
  };

  ws.onclose = (event) => {
    isConnected = false;
    canSendAudio = false;
    audioQueue = [];
    ws = null;
    if (event.code !== 1000) {
      if (event.reason) {
        callbacks.onError(`豆包语音识别连接关闭 ${event.code}：${event.reason}`);
      }
      callbacks.onEnd();
    }
  };
}

export function sendAudio(pcm: Int16Array): void {
  if (!ws || !isConnected) return;
  if (!canSendAudio) {
    audioQueue.push(pcm.slice());
    audioQueue = audioQueue.slice(-40);
    return;
  }

  for (let offset = 0; offset < pcm.length; offset += PCM_CHUNK_SAMPLES) {
    const chunk = pcm.subarray(offset, offset + PCM_CHUNK_SAMPLES);
    ws.send(buildAudioFrame(chunk, false));
  }
}

function flushAudioQueue(): void {
  const pending = audioQueue;
  audioQueue = [];
  for (const pcm of pending) {
    sendAudio(pcm);
  }
}

export function stop(): void {
  if (ws) {
    try {
      ws.send(buildAudioFrame(new Int16Array(), true));
    } catch {}
    ws.close(1000, 'user stop');
    ws = null;
  }
  isConnected = false;
  canSendAudio = false;
  audioQueue = [];
}

export function isActive(): boolean {
  return ws !== null && isConnected;
}

export function testConnection(config: DoubaoASRConfig): Promise<DoubaoAsrTestResult> {
  return new Promise((resolve) => {
    if (!config.appId || !config.accessToken) {
      resolve({ success: false, message: '请先填写 App ID 和 Access Token。' });
      return;
    }

    const testWs = new WebSocket(buildProxyUrl(config));
    testWs.binaryType = 'arraybuffer';
    let responseCount = 0;
    let settled = false;
    const timer = window.setTimeout(() => {
      finish(false, '豆包 ASR 测试超时：已连接但未收到完整响应。');
    }, 8000);

    const finish = (success: boolean, message: string) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      try {
        testWs.close(1000, 'test done');
      } catch {}
      resolve({ success, message });
    };

    testWs.onopen = () => {
      testWs.send(buildFullClientRequest());
    };

    testWs.onmessage = (event) => {
      if (!(event.data instanceof ArrayBuffer)) return;
      parseServerFrame(event.data)
        .then((frame) => {
          if (frame.type === 'error') {
            finish(false, `豆包返回错误 ${frame.code}：${frame.message}`);
            return;
          }
          responseCount += 1;
          if (responseCount === 1) {
            testWs.send(buildAudioFrame(new Int16Array(3200), false));
            window.setTimeout(() => {
              if (!settled && testWs.readyState === WebSocket.OPEN) {
                testWs.send(buildAudioFrame(new Int16Array(), true));
              }
            }, 250);
            return;
          }
          finish(true, '豆包 ASR 协议测试通过：握手、初始化 request、音频包均正常。');
        })
        .catch((error) => {
          finish(false, error instanceof Error ? error.message : '豆包测试响应解析失败。');
        });
    };

    testWs.onerror = () => {
      finish(false, '豆包 ASR WebSocket 连接失败，请检查凭证、Resource ID 和服务开通状态。');
    };

    testWs.onclose = (event) => {
      if (!settled && event.code !== 1000) {
        finish(false, event.reason ? `连接关闭 ${event.code}：${event.reason}` : `连接异常关闭：${event.code}`);
      }
    };
  });
}

function buildProxyUrl(config: DoubaoASRConfig): string {
  const params = new URLSearchParams({
    appId: config.appId.trim(),
    accessToken: config.accessToken.trim(),
    resourceId: (config.resourceId || 'volc.bigasr.sauc.duration').trim(),
    connectId: crypto.randomUUID(),
  });
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}${DOUBAO_ASR_WS_PATH}?${params.toString()}`;
}

function buildFullClientRequest(): ArrayBuffer {
  const payload = gzip(new TextEncoder().encode(JSON.stringify({
    user: { uid: 'interviewdog-free' },
    audio: {
      format: 'pcm',
      rate: SAMPLE_RATE,
      bits: 16,
      channel: 1,
      language: 'zh-CN',
    },
    request: {
      model_name: 'bigmodel',
      enable_itn: true,
      enable_ddc: false,
      enable_punc: true,
      show_utterances: true,
      result_type: 'full',
    },
  })));

  return buildFrame(
    MESSAGE_TYPE.FULL_CLIENT_REQUEST,
    MESSAGE_FLAGS.NONE,
    SERIALIZATION.JSON,
    COMPRESSION.GZIP,
    payload,
  );
}

function buildAudioFrame(pcm: Int16Array, isLast: boolean): ArrayBuffer {
  const payload = gzip(new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength));
  return buildFrame(
    MESSAGE_TYPE.AUDIO_ONLY_REQUEST,
    isLast ? MESSAGE_FLAGS.LAST_PACKET : MESSAGE_FLAGS.NONE,
    SERIALIZATION.NONE,
    COMPRESSION.GZIP,
    payload,
  );
}

function buildFrame(
  messageType: number,
  flags: number,
  serialization: number,
  compression: number,
  payload: Uint8Array,
): ArrayBuffer {
  const headerSize = 4;
  const frame = new ArrayBuffer(headerSize + 4 + payload.byteLength);
  const view = new DataView(frame);
  const bytes = new Uint8Array(frame);

  view.setUint8(0, 0x11); // protocol v1, 4-byte base header.
  view.setUint8(1, (messageType << 4) | flags);
  view.setUint8(2, (serialization << 4) | compression);
  view.setUint8(3, 0x00);
  view.setUint32(4, payload.byteLength, false);
  bytes.set(payload, 8);

  return frame;
}

type ServerFrame =
  | { type: 'result'; payload: unknown; isLast: boolean }
  | { type: 'error'; code: number; message: string };

async function parseServerFrame(buffer: ArrayBuffer): Promise<ServerFrame> {
  if (buffer.byteLength < 8) {
    throw new Error('豆包语音识别返回帧过短。');
  }

  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const version = view.getUint8(0) >> 4;
  const headerSize = (view.getUint8(0) & 0x0f) * 4;
  const messageType = view.getUint8(1) >> 4;
  const flags = view.getUint8(1) & 0x0f;
  const serialization = view.getUint8(2) >> 4;
  const compression = view.getUint8(2) & 0x0f;

  if (version !== 1) {
    throw new Error(`不支持的豆包语音识别协议版本：${version}`);
  }

  let offset = headerSize;
  if ((flags & MESSAGE_FLAGS.HAS_SEQUENCE) === MESSAGE_FLAGS.HAS_SEQUENCE) {
    offset += 4;
  }

  if (messageType === MESSAGE_TYPE.ERROR_RESPONSE) {
    const code = view.getUint32(offset, false);
    offset += 4;
    const messageSize = view.getUint32(offset, false);
    offset += 4;
    const message = new TextDecoder().decode(bytes.slice(offset, offset + messageSize));
    return { type: 'error', code, message };
  }

  if (messageType !== MESSAGE_TYPE.FULL_SERVER_RESPONSE) {
    throw new Error(`未知的豆包语音识别返回类型：${messageType}`);
  }

  const payloadSize = view.getUint32(offset, false);
  offset += 4;
  let payloadBytes = copyBytes(bytes.slice(offset, offset + payloadSize));

  if (compression === COMPRESSION.GZIP) {
    payloadBytes = await gunzip(payloadBytes);
  }

  let payload: unknown = {};
  if (payloadBytes.byteLength > 0 && serialization === SERIALIZATION.JSON) {
    payload = JSON.parse(new TextDecoder().decode(payloadBytes));
  }

  return {
    type: 'result',
    payload,
    isLast: (flags & MESSAGE_FLAGS.LAST_PACKET) === MESSAGE_FLAGS.LAST_PACKET,
  };
}

async function gunzip(bytes: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('当前浏览器不支持解压豆包 ASR 响应，请使用最新版 Chrome。');
  }
  const stream = new Blob([bytes.buffer]).stream().pipeThrough(new DecompressionStream('gzip'));
  return copyBytes(new Uint8Array(await new Response(stream).arrayBuffer()));
}

function copyBytes(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy;
}

function handleResultPayload(
  payload: unknown,
  callbacks: DoubaoAsrCallbacks,
  isLastFrame: boolean,
): void {
  const text = collectText(payload);
  if (text) {
    callbacks.onResult(text.trim(), isFinalPayload(payload) || isLastFrame);
  }
}

function collectText(value: unknown): string {
  if (!value || typeof value !== 'object') return '';

  const record = value as Record<string, unknown>;
  if (typeof record.text === 'string') return record.text;

  const result = record.result;
  if (Array.isArray(result)) {
    return result.map(collectText).join('');
  }
  if (result && typeof result === 'object') {
    return collectText(result);
  }

  const utterances = record.utterances;
  if (Array.isArray(utterances)) {
    return utterances.map(collectText).join('');
  }

  return '';
}

function isFinalPayload(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  if (record.is_final === true || record.definite === true) return true;
  if (Array.isArray(record.result)) return record.result.some(isFinalPayload);
  if (Array.isArray(record.utterances)) return record.utterances.some(isFinalPayload);
  return false;
}
