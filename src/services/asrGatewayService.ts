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
  hotwords?: string;
};

type GatewaySession = {
  provider: ASRGatewayProvider;
  speaker: 'interviewer' | 'me';
  config: GatewayConfig;
  callbacks: GatewayCallbacks;
};

const MAX_RECONNECT_ATTEMPTS = 8;
const CLIENT_HEARTBEAT_INTERVAL_MS = 20_000;
const NON_RETRYABLE_ERROR_PATTERNS = [
  /quota exceeded/i,
  /concurrency/i,
  /45000292/,
];

let ws: WebSocket | null = null;
let callbacksRef: GatewayCallbacks | null = null;
let currentSession: GatewaySession | null = null;
let ready = false;
let queued: Int16Array[] = [];
let reconnectTimer: number | null = null;
let reconnectAttempts = 0;
let manuallyStopped = false;
let clientHeartbeatTimer: number | null = null;
let ownedStream: MediaStream | null = null;
let context: AudioContext | null = null;
let source: MediaStreamAudioSourceNode | null = null;
let processor: ScriptProcessorNode | null = null;
let silentGain: GainNode | null = null;

export function isSupported(): boolean {
  return typeof WebSocket !== 'undefined';
}

export function isActive(): boolean {
  return Boolean(currentSession && !manuallyStopped)
    || (ws !== null && ws.readyState === WebSocket.OPEN);
}

export function start(
  provider: ASRGatewayProvider,
  speaker: 'interviewer' | 'me',
  config: GatewayConfig,
  callbacks: GatewayCallbacks,
): boolean {
  stop();
  callbacksRef = callbacks;
  currentSession = { provider, speaker, config, callbacks };
  manuallyStopped = false;
  reconnectAttempts = 0;
  ready = false;
  queued = [];
  connectGateway(currentSession);
  return true;
}

function connectGateway(session: GatewaySession): void {
  ready = false;
  const previousSocket = ws;
  if (previousSocket) {
    ws = null;
    try { previousSocket.close(1000, 'reconnecting'); } catch {}
  }
  const socket = new WebSocket(buildGatewayUrl());
  ws = socket;
  socket.onopen = () => {
    startClientHeartbeat(socket);
    socket.send(JSON.stringify({
      type: 'start',
      provider: session.provider,
      speaker: session.speaker,
      asrEndWindowSize: session.config.asrEndWindowSize,
      config: {
        ...buildProviderConfig(session.provider, session.config),
        hotwords: session.config.hotwords ?? '',
      },
    }));
  };
  socket.onmessage = (event) => {
    if (ws !== socket || !currentSession) return;
    let data: { type?: string; message?: string; text?: string; isFinal?: boolean };
    try {
      data = JSON.parse(String(event.data || '{}'));
    } catch {
      session.callbacks.onError('ASR Gateway 返回了无法解析的数据。');
      scheduleReconnect('invalid gateway message');
      return;
    }
    if (data.type === 'ready') {
      ready = true;
      reconnectAttempts = 0;
      console.info('[ASR Gateway] connected');
      session.callbacks.onReady?.();
      flushQueue();
      return;
    }
    if (data.type === 'pong') return;
    if (data.type === 'VoiceMessage' && typeof data.text === 'string') {
      session.callbacks.onResult(data.text.trim(), Boolean(data.isFinal));
      return;
    }
    if (data.type === 'error') {
      const message = data.message || 'ASR Gateway 错误';
      if (isNonRetryableError(message)) {
        stopAfterRemoteError(session, normalizeNonRetryableError(message));
      } else {
        session.callbacks.onError(message);
      }
      return;
    }
    if (data.type === 'end') {
      if (manuallyStopped) {
        session.callbacks.onEnd();
      } else {
        scheduleReconnect('gateway end');
      }
    }
  };
  socket.onerror = () => {
    if (ws !== socket) return;
    if (!manuallyStopped) scheduleReconnect('gateway error');
  };
  socket.onclose = () => {
    if (ws !== socket) return;
    stopClientHeartbeat();
    ready = false;
    ws = null;
    if (manuallyStopped || !currentSession) {
      callbacksRef?.onEnd();
      return;
    }
    scheduleReconnect('gateway close');
  };
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
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    if (currentSession && !manuallyStopped) {
      queueAudio(pcm);
      scheduleReconnect('audio while closed');
    }
    return;
  }
  if (!ready) {
    queueAudio(pcm);
    return;
  }
  try {
    ws.send(JSON.stringify({
      type: 'audio',
      voiceRecBase64: pcmToBase64(pcm),
    }));
  } catch {
    queueAudio(pcm);
    scheduleReconnect('audio send failed');
  }
}

export function stop(): void {
  manuallyStopped = true;
  if (reconnectTimer !== null) {
    window.clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  stopClientHeartbeat();
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
  currentSession = null;
  ready = false;
  queued = [];
  reconnectAttempts = 0;
  callbacksRef = null;
}

function queueAudio(pcm: Int16Array): void {
  queued.push(pcm.slice());
  queued = queued.slice(-160);
}

function scheduleReconnect(reason: string): void {
  if (!currentSession || manuallyStopped || reconnectTimer !== null) return;

  reconnectAttempts += 1;
  if (reconnectAttempts > MAX_RECONNECT_ATTEMPTS) {
    const callbacks = currentSession.callbacks;
    currentSession = null;
    ready = false;
    callbacks.onError('ASR Gateway 连接已中断，请重新开始录音。');
    callbacks.onEnd();
    return;
  }

  const delay = Math.min(2500, 250 * reconnectAttempts);
  if (reconnectAttempts === 1) {
    currentSession.callbacks.onError('识别连接暂时中断，正在自动恢复。');
  }
  console.warn('[ASR Gateway] reconnect scheduled', {
    reason,
    attempt: reconnectAttempts,
    delay,
  });
  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = null;
    if (!currentSession || manuallyStopped) return;
    connectGateway(currentSession);
  }, delay);
}

function startClientHeartbeat(socket: WebSocket): void {
  stopClientHeartbeat();
  clientHeartbeatTimer = window.setInterval(() => {
    if (ws !== socket || socket.readyState !== WebSocket.OPEN) return;
    try {
      socket.send(JSON.stringify({ type: 'keepalive' }));
    } catch {
      scheduleReconnect('keepalive send failed');
    }
  }, CLIENT_HEARTBEAT_INTERVAL_MS);
}

function stopClientHeartbeat(): void {
  if (clientHeartbeatTimer !== null) {
    window.clearInterval(clientHeartbeatTimer);
    clientHeartbeatTimer = null;
  }
}

function stopAfterRemoteError(session: GatewaySession, message: string): void {
  manuallyStopped = true;
  if (reconnectTimer !== null) {
    window.clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  cleanupAudioNodes();
  if (ownedStream) {
    ownedStream.getTracks().forEach((track) => track.stop());
    ownedStream = null;
  }
  const socket = ws;
  ws = null;
  currentSession = null;
  ready = false;
  queued = [];
  reconnectAttempts = 0;
  callbacksRef = null;
  if (socket) {
    try { socket.send(JSON.stringify({ type: 'stop' })); } catch {}
    try { socket.close(1000, 'non retryable asr error'); } catch {}
  }
  session.callbacks.onError(message);
  session.callbacks.onEnd();
}

function isNonRetryableError(message: string): boolean {
  return NON_RETRYABLE_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

function normalizeNonRetryableError(message: string): string {
  if (/quota exceeded/i.test(message) && /concurrency/i.test(message)) {
    return '豆包 ASR 并发额度已满：已停止本次听音并释放连接，请稍等几十秒后再开始，或检查是否有其他窗口/设备正在使用同一套豆包凭证。';
  }
  return message;
}

function flushQueue(): void {
  const pending = queued;
  queued = [];
  pending.forEach(sendAudio);
}

function buildGatewayUrl(): string {
  const configuredUrl = import.meta.env.VITE_ASR_GATEWAY_URL?.trim();
  if (configuredUrl) return configuredUrl.replace(/\/$/, '');
  if (
    typeof window !== 'undefined' &&
    (window.location.protocol === 'file:' ||
      window.desktopWindow?.isDesktop ||
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1')
  ) {
    return 'wss://bwg.yihan.me/api/asr-gateway';
  }
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/api/asr-gateway`;
}

function startPcmFromStream(stream: MediaStream): void {
  cleanupAudioNodes();
  context = new AudioContext({ sampleRate: 16000 });
  void context.resume().catch(() => {});
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
