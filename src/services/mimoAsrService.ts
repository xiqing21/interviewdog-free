import type { MiMoASRConfig } from '../types';
import { deobfuscate } from './cryptoService';

interface MiMoAsrCallbacks {
  onResult: (text: string, isFinal: boolean) => void;
  onError: (error: string) => void;
  onEnd: () => void;
}

const SAMPLE_RATE = 16000;
const MIN_CHUNK_SAMPLES = SAMPLE_RATE;
const DEFAULT_CHUNK_MS = 2500;

let callbacksRef: MiMoAsrCallbacks | null = null;
let configRef: MiMoASRConfig | null = null;
let ownedStream: MediaStream | null = null;
let context: AudioContext | null = null;
let source: MediaStreamAudioSourceNode | null = null;
let processor: ScriptProcessorNode | null = null;
let silentGain: GainNode | null = null;
let pcmBuffer: Int16Array[] = [];
let bufferedSamples = 0;
let lastFlushAt = 0;
let processingCount = 0;
let stopped = true;

export function isSupported(): boolean {
  return typeof AudioContext !== 'undefined' && typeof fetch !== 'undefined';
}

export function isActive(): boolean {
  return !stopped;
}

export function start(config: MiMoASRConfig, callbacks: MiMoAsrCallbacks): boolean {
  const apiKey = deobfuscate(config.apiKey);
  if (!apiKey) {
    callbacks.onError('MiMo ASR 需要先配置 API Key。');
    return false;
  }
  stop();
  configRef = { ...config, apiKey };
  callbacksRef = callbacks;
  pcmBuffer = [];
  bufferedSamples = 0;
  lastFlushAt = Date.now();
  processingCount = 0;
  stopped = false;
  return true;
}

export async function startMicrophone(config: MiMoASRConfig, callbacks: MiMoAsrCallbacks): Promise<boolean> {
  if (!isSupported()) {
    callbacks.onError('当前浏览器不支持本地音频处理，无法使用 MiMo ASR。');
    return false;
  }
  if (!start(config, callbacks)) return false;
  try {
    ownedStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    startPcmFromStream(ownedStream);
    return true;
  } catch (error) {
    stop();
    callbacks.onError(`麦克风授权失败：${error instanceof Error ? error.message : '未知错误'}`);
    return false;
  }
}

export function sendAudio(pcm: Int16Array): void {
  if (stopped || !configRef || pcm.length === 0) return;
  pcmBuffer.push(pcm.slice());
  bufferedSamples += pcm.length;
  const chunkMs = Math.max(1000, configRef.chunkMs || DEFAULT_CHUNK_MS);
  const enoughAudio = bufferedSamples >= Math.floor((SAMPLE_RATE * chunkMs) / 1000);
  if (enoughAudio && Date.now() - lastFlushAt >= Math.min(chunkMs, 1200)) {
    void flush(false);
  }
}

export function stop(): void {
  const hadActiveSession = !stopped;
  stopped = true;
  cleanupAudioNodes();
  if (ownedStream) {
    ownedStream.getTracks().forEach((track) => track.stop());
    ownedStream = null;
  }
  if (bufferedSamples >= MIN_CHUNK_SAMPLES) void flush(true);
  if (hadActiveSession && processingCount === 0) callbacksRef?.onEnd();
  callbacksRef = null;
  configRef = null;
}

export async function testConnection(config: MiMoASRConfig): Promise<{ success: boolean; message: string }> {
  const apiKey = deobfuscate(config.apiKey);
  if (!apiKey) return { success: false, message: '请先填写 MiMo API Key。' };
  try {
    const silence = new Int16Array(SAMPLE_RATE / 2);
    const audioBase64 = arrayBufferToBase64(encodeWav(silence));
    const text = await callMiMo(config, audioBase64);
    return { success: true, message: `MiMo ASR 接口已连通${text ? `：${text}` : '。'}` };
  } catch (error) {
    return { success: false, message: `MiMo ASR 测试失败：${error instanceof Error ? error.message : '未知错误'}` };
  }
}

function startPcmFromStream(stream: MediaStream): void {
  context = new AudioContext({ sampleRate: SAMPLE_RATE });
  source = context.createMediaStreamSource(stream);
  processor = context.createScriptProcessor(1024, 1, 1);
  silentGain = context.createGain();
  silentGain.gain.value = 0;
  processor.onaudioprocess = (event) => {
    const input = event.inputBuffer.getChannelData(0);
    const pcm = new Int16Array(input.length);
    for (let i = 0; i < input.length; i += 1) {
      const s = Math.max(-1, Math.min(1, input[i]));
      pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    sendAudio(pcm);
  };
  source.connect(processor);
  processor.connect(silentGain);
  silentGain.connect(context.destination);
}

async function flush(force: boolean): Promise<void> {
  if (!configRef || processingCount > 2) return;
  if (bufferedSamples < MIN_CHUNK_SAMPLES && !force) return;
  const config = configRef;
  const samples = concatPcm(pcmBuffer, bufferedSamples);
  pcmBuffer = [];
  bufferedSamples = 0;
  lastFlushAt = Date.now();
  if (samples.length < MIN_CHUNK_SAMPLES && !force) return;

  processingCount += 1;
  try {
    const text = await callMiMo(config, arrayBufferToBase64(encodeWav(samples)));
    if (text) callbacksRef?.onResult(text, true);
  } catch (error) {
    callbacksRef?.onError(`MiMo ASR 分片识别错误：${error instanceof Error ? error.message : '未知错误'}`);
  } finally {
    processingCount -= 1;
    if (stopped && processingCount === 0) callbacksRef?.onEnd();
  }
}

async function callMiMo(config: MiMoASRConfig, audioBase64: string): Promise<string> {
  const response = await fetch('/api/mimo-asr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apiKey: deobfuscate(config.apiKey),
      baseUrl: config.baseUrl,
      model: config.model,
      language: config.language,
      audioBase64,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || `MiMo 代理返回 ${response.status}`);
  return typeof data?.text === 'string' ? data.text.trim() : '';
}

function concatPcm(chunks: Int16Array[], totalLength: number): Int16Array {
  const result = new Int16Array(totalLength);
  let offset = 0;
  chunks.forEach((chunk) => {
    result.set(chunk, offset);
    offset += chunk.length;
  });
  return result;
}

function encodeWav(samples: Int16Array): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, samples.length * 2, true);
  let offset = 44;
  for (let i = 0; i < samples.length; i += 1) {
    view.setInt16(offset, samples[i], true);
    offset += 2;
  }
  return buffer;
}

function writeString(view: DataView, offset: number, value: string): void {
  for (let i = 0; i < value.length; i += 1) {
    view.setUint8(offset + i, value.charCodeAt(i));
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const size = 0x8000;
  for (let i = 0; i < bytes.length; i += size) {
    binary += String.fromCharCode(...bytes.subarray(i, i + size));
  }
  return btoa(binary);
}

function cleanupAudioNodes(): void {
  try { processor?.disconnect(); } catch {}
  try { source?.disconnect(); } catch {}
  try { silentGain?.disconnect(); } catch {}
  processor = null;
  source = null;
  silentGain = null;
  if (context) {
    context.close().catch(() => {});
    context = null;
  }
}
