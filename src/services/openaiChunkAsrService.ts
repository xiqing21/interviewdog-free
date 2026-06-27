/**
 * OpenAIChunkAsrService — 分片语音识别备用通道
 *
 * 用 MediaRecorder 录制任意 MediaStream（系统音频或麦克风），每隔几秒交给
 * 后端 OpenAI-compatible 转写接口。它不是实时逐字流式，但能识别 Chrome 共享音频。
 */

import type { AISettings } from '../types';
import { deobfuscate } from './cryptoService';

interface ChunkAsrCallbacks {
  onResult: (text: string, isFinal: boolean) => void;
  onError: (error: string) => void;
  onEnd: () => void;
}

const CHUNK_MS = 4500;
const MIN_CHUNK_BYTES = 1200;

let recorder: MediaRecorder | null = null;
let ownedStream: MediaStream | null = null;
let callbacksRef: ChunkAsrCallbacks | null = null;
let processingCount = 0;
let stopped = true;

export function isSupported(): boolean {
  return typeof MediaRecorder !== 'undefined';
}

export function isActive(): boolean {
  return recorder !== null && recorder.state !== 'inactive';
}

export async function startFromStream(
  stream: MediaStream,
  settings: AISettings,
  callbacks: ChunkAsrCallbacks,
): Promise<boolean> {
  if (!isSupported()) {
    callbacks.onError('当前浏览器不支持 MediaRecorder，无法使用 OpenAI 分片识别。');
    return false;
  }

  const apiKey = deobfuscate(settings.apiKey);
  if (!apiKey) {
    callbacks.onError('OpenAI 分片识别需要先在设置中配置 API Key。');
    return false;
  }

  const audioTracks = stream.getAudioTracks().filter((track) => track.readyState === 'live');
  if (audioTracks.length === 0) {
    callbacks.onError('没有可用的音频轨道，请重新共享系统音频并勾选共享音频。');
    return false;
  }

  stop();
  callbacksRef = callbacks;
  stopped = false;

  const mimeType = pickMimeType();
  try {
    recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  } catch (error) {
    callbacks.onError(`无法启动分片录音：${error instanceof Error ? error.message : '未知错误'}`);
    return false;
  }

  recorder.ondataavailable = (event) => {
    if (stopped || event.data.size < MIN_CHUNK_BYTES) return;
    void transcribeChunk(event.data, settings);
  };

  recorder.onerror = () => {
    callbacksRef?.onError('OpenAI 分片识别录音失败，请重新开始面试。');
  };

  recorder.onstop = () => {
    if (processingCount === 0) callbacksRef?.onEnd();
  };

  recorder.start(CHUNK_MS);
  return true;
}

export async function startMicrophone(
  settings: AISettings,
  callbacks: ChunkAsrCallbacks,
): Promise<boolean> {
  try {
    ownedStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    return startFromStream(ownedStream, settings, callbacks);
  } catch (error) {
    callbacks.onError(`麦克风授权失败：${error instanceof Error ? error.message : '未知错误'}`);
    return false;
  }
}

export function stop(): void {
  stopped = true;
  if (recorder && recorder.state !== 'inactive') {
    recorder.stop();
  }
  recorder = null;
  if (ownedStream) {
    ownedStream.getTracks().forEach((track) => track.stop());
    ownedStream = null;
  }
  callbacksRef = null;
  processingCount = 0;
}

function pickMimeType(): string {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? '';
}

async function transcribeChunk(blob: Blob, settings: AISettings): Promise<void> {
  processingCount += 1;
  try {
    const audioBase64 = await blobToBase64(blob);
    const response = await fetch('/api/openai-transcribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey: deobfuscate(settings.apiKey),
        baseUrl: settings.provider === 'openai' ? settings.baseUrl : 'https://api.openai.com/v1',
        model: 'whisper-1',
        mimeType: blob.type || 'audio/webm',
        audioBase64,
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.error || `转写接口返回 ${response.status}`);
    }

    const text = typeof data?.text === 'string' ? data.text.trim() : '';
    if (text) callbacksRef?.onResult(text, true);
  } catch (error) {
    callbacksRef?.onError(`OpenAI 分片识别错误：${error instanceof Error ? error.message : '未知错误'}`);
  } finally {
    processingCount -= 1;
    if (stopped && processingCount === 0) callbacksRef?.onEnd();
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? '');
      resolve(result.includes(',') ? result.split(',')[1] : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error('读取音频分片失败'));
    reader.readAsDataURL(blob);
  });
}
