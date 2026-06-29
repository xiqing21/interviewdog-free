import type { ASRGatewayProvider, CloudASRConfig, DoubaoASRConfig } from '../types';
import { deobfuscate } from './cryptoService';

interface GatewayCallbacks {
  onResult: (text: string, isFinal: boolean) => void;
  onError: (error: string) => void;
  onEnd: () => void;
  onReady?: () => void;
}

type GatewayConfig = {
  doubaoConfig: DoubaoASRConfig;
  cloudAsrConfig: CloudASRConfig;
  asrEndWindowSize: number;
};

let ws: WebSocket | null = null;
let callbacksRef: GatewayCallbacks | null = null;
let ready = false;
let queued: Int16Array[] = [];
let ownedStream: MediaStream | null = null;
let context: AudioContext | null = null;
let source: MediaStreamAudioSourceNode | null = null;
let processor: ScriptProcessorNode | null = null;
let silentGain: GainNode | null = null;

export function isSupported(): boolean {
  return typeof WebSocket !== 'undefined';
}

export function isActive(): boolean {
  return ws !== null && ws.readyState === WebSocket.OPEN;
}

export function start(
  provider: ASRGatewayProvider,
  speaker: 'interviewer' | 'me',
  config: GatewayConfig,
  callbacks: GatewayCallbacks,
): boolean {
  stop();
  callbacksRef = callbacks;
  ready = false;
  queued = [];

  ws = new WebSocket(buildGatewayUrl());
  ws.onopen = () => {
    ws?.send(JSON.stringify({
      type: 'start',
      provider,
      speaker,
      asrEndWindowSize: config.asrEndWindowSize,
      config: buildProviderConfig(provider, config),
    }));
  };
  ws.onmessage = (event) => {
    const data = JSON.parse(String(event.data || '{}'));
    if (data.type === 'ready') {
      ready = true;
      callbacks.onReady?.();
      flushQueue();
      return;
    }
    if (data.type === 'VoiceMessage' && typeof data.text === 'string') {
      callbacks.onResult(data.text.trim(), Boolean(data.isFinal));
      return;
    }
    if (data.type === 'error') {
      callbacks.onError(data.message || 'ASR Gateway 错误');
      return;
    }
    if (data.type === 'end') {
      callbacks.onEnd();
    }
  };
  ws.onerror = () => callbacks.onError('ASR Gateway 连接失败。');
  ws.onclose = () => {
    ready = false;
    ws = null;
    callbacksRef?.onEnd();
  };
  return true;
}

export async function startMicrophone(
  provider: ASRGatewayProvider,
  speaker: 'interviewer' | 'me',
  config: GatewayConfig,
  callbacks: GatewayCallbacks,
): Promise<boolean> {
  if (typeof AudioContext === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    callbacks.onError('当前浏览器不支持麦克风音频采集，无法使用 ASR Gateway。');
    return false;
  }
  let stream: MediaStream | null = null;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    start(provider, speaker, config, {
      ...callbacks,
      onReady: () => {
        callbacks.onReady?.();
        if (stream) startPcmFromStream(stream);
      },
    });
    ownedStream = stream;
    return true;
  } catch (error) {
    stream?.getTracks().forEach((track) => track.stop());
    stop();
    callbacks.onError(`麦克风授权失败：${error instanceof Error ? error.message : '未知错误'}`);
    return false;
  }
}

export function sendAudio(pcm: Int16Array): void {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  if (!ready) {
    queued.push(pcm.slice());
    queued = queued.slice(-80);
    return;
  }
  ws.send(JSON.stringify({
    type: 'audio',
    voiceRecBase64: pcmToBase64(pcm),
  }));
}

export function stop(): void {
  cleanupAudioNodes();
  if (ownedStream) {
    ownedStream.getTracks().forEach((track) => track.stop());
    ownedStream = null;
  }
  if (ws) {
    try { ws.send(JSON.stringify({ type: 'stop' })); } catch {}
    ws.close(1000, 'user stop');
  }
  ws = null;
  ready = false;
  queued = [];
  callbacksRef = null;
}

function flushQueue(): void {
  const pending = queued;
  queued = [];
  pending.forEach(sendAudio);
}

function buildGatewayUrl(): string {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'wss://interviewdog-free.vercel.app/api/asr-gateway';
  }
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/api/asr-gateway`;
}

function startPcmFromStream(stream: MediaStream): void {
  cleanupAudioNodes();
  context = new AudioContext({ sampleRate: 16000 });
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

function buildProviderConfig(provider: ASRGatewayProvider, config: GatewayConfig): Record<string, string | number> {
  if (provider === 'gateway-doubao') {
    return {
      appId: config.doubaoConfig.appId,
      accessToken: deobfuscate(config.doubaoConfig.accessToken),
      resourceId: config.doubaoConfig.resourceId,
    };
  }
  if (provider === 'gateway-iflytek') {
    return {
      iflytekAppId: config.cloudAsrConfig.iflytekAppId,
      iflytekApiKey: deobfuscate(config.cloudAsrConfig.iflytekApiKey),
      iflytekApiSecret: deobfuscate(config.cloudAsrConfig.iflytekApiSecret),
    };
  }
  return {
    alibabaAppKey: config.cloudAsrConfig.alibabaAppKey,
    alibabaToken: deobfuscate(config.cloudAsrConfig.alibabaToken),
    alibabaEndpoint: config.cloudAsrConfig.alibabaEndpoint,
  };
}

function pcmToBase64(pcm: Int16Array): string {
  const bytes = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  let binary = '';
  const size = 0x8000;
  for (let i = 0; i < bytes.length; i += size) {
    binary += String.fromCharCode(...bytes.subarray(i, i + size));
  }
  return btoa(binary);
}
