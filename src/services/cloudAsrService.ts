import type { CloudASRConfig, CloudASRProvider } from '../types';
import { deobfuscate } from './cryptoService';

interface CloudAsrCallbacks {
  onResult: (text: string, isFinal: boolean) => void;
  onError: (error: string) => void;
  onEnd: () => void;
}

const SAMPLE_RATE = 16000;
const MIN_CHUNK_SAMPLES = SAMPLE_RATE;

let activeProvider: CloudASRProvider | null = null;
let configRef: CloudASRConfig | null = null;
let callbacksRef: CloudAsrCallbacks | null = null;
let ownedStream: MediaStream | null = null;
let context: AudioContext | null = null;
let source: MediaStreamAudioSourceNode | null = null;
let processor: ScriptProcessorNode | null = null;
let silentGain: GainNode | null = null;
let chunks: Int16Array[] = [];
let totalSamples = 0;
let stopped = true;
let processingCount = 0;

export function isSupported(): boolean {
  return typeof AudioContext !== 'undefined' && typeof fetch !== 'undefined';
}

export function isActive(): boolean {
  return !stopped;
}

export function start(provider: CloudASRProvider, config: CloudASRConfig, callbacks: CloudAsrCallbacks): boolean {
  stop();
  activeProvider = provider;
  configRef = decodeConfig(config);
  callbacksRef = callbacks;
  chunks = [];
  totalSamples = 0;
  processingCount = 0;
  stopped = false;
  return true;
}

export async function startMicrophone(provider: CloudASRProvider, config: CloudASRConfig, callbacks: CloudAsrCallbacks): Promise<boolean> {
  if (!isSupported()) {
    callbacks.onError('当前浏览器不支持本地音频处理，无法使用云 ASR。');
    return false;
  }
  start(provider, config, callbacks);
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
  if (stopped || !activeProvider || !configRef) return;
  chunks.push(pcm.slice());
  totalSamples += pcm.length;
  const targetSamples = Math.floor((SAMPLE_RATE * Math.max(1000, configRef.chunkMs || 2500)) / 1000);
  if (totalSamples >= targetSamples) void flush(false);
}

export function stop(): void {
  const wasActive = !stopped;
  stopped = true;
  cleanupAudioNodes();
  if (ownedStream) {
    ownedStream.getTracks().forEach((track) => track.stop());
    ownedStream = null;
  }
  if (totalSamples >= MIN_CHUNK_SAMPLES) void flush(true);
  if (wasActive && processingCount === 0) callbacksRef?.onEnd();
  activeProvider = null;
  configRef = null;
  callbacksRef = null;
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
  if (!activeProvider || !configRef || processingCount > 2) return;
  if (totalSamples < MIN_CHUNK_SAMPLES && !force) return;
  const provider = activeProvider;
  const config = configRef;
  const pcm = concatPcm(chunks, totalSamples);
  chunks = [];
  totalSamples = 0;
  processingCount += 1;
  try {
    const wav = encodeWav(pcm);
    const data = await callCloudAsr(provider, config, wav, pcm);
    if (data) callbacksRef?.onResult(data, true);
  } catch (error) {
    callbacksRef?.onError(`${providerLabel(provider)} 分片识别错误：${error instanceof Error ? error.message : '未知错误'}`);
  } finally {
    processingCount -= 1;
    if (stopped && processingCount === 0) callbacksRef?.onEnd();
  }
}

async function callCloudAsr(provider: CloudASRProvider, config: CloudASRConfig, wav: ArrayBuffer, pcm: Int16Array): Promise<string> {
  const response = await fetch('/api/cloud-asr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider,
      config,
      wavBase64: arrayBufferToBase64(wav),
      wavBytes: wav.byteLength,
      pcmBase64: bytesToBase64(new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength)),
      pcmBytes: pcm.byteLength,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || `云 ASR 代理返回 ${response.status}`);
  return typeof data?.text === 'string' ? data.text.trim() : '';
}

function decodeConfig(config: CloudASRConfig): CloudASRConfig {
  return {
    ...config,
    baiduApiKey: deobfuscate(config.baiduApiKey),
    baiduSecretKey: deobfuscate(config.baiduSecretKey),
    googleApiKey: deobfuscate(config.googleApiKey),
    alibabaToken: deobfuscate(config.alibabaToken),
    iflytekApiKey: deobfuscate(config.iflytekApiKey),
    iflytekApiSecret: deobfuscate(config.iflytekApiSecret),
    glmApiKey: deobfuscate(config.glmApiKey),
  };
}

function concatPcm(parts: Int16Array[], total: number): Int16Array {
  const result = new Int16Array(total);
  let offset = 0;
  parts.forEach((part) => {
    result.set(part, offset);
    offset += part.length;
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
  for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i));
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  return bytesToBase64(new Uint8Array(buffer));
}

function bytesToBase64(bytes: Uint8Array): string {
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

function providerLabel(provider: CloudASRProvider): string {
  const labels: Record<CloudASRProvider, string> = {
    baidu: '百度 ASR',
    google: 'Google ASR',
    alibaba: '阿里云 ASR',
    iflytek: '讯飞 ASR',
    glm: 'GLM ASR',
  };
  return labels[provider];
}
