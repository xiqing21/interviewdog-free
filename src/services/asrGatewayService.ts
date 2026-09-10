import type { ASRGatewayProvider, CloudASRConfig, DoubaoASRConfig } from '../types';
import { deobfuscate } from './cryptoService';
import { PcmResampler } from './pcmResampler';

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

const MAX_RECONNECT_ATTEMPTS = 20;
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

let desktopGatewayUnsubs: Array<() => void> = [];
let isDesktopGatewayActive = false;
let isResettingStream = false;
let lastRawText = '';
let baselineRawText = '';

function cleanupDesktopGateway(): void {
  desktopGatewayUnsubs.forEach((unsub) => {
    try { unsub(); } catch {}
  });
  desktopGatewayUnsubs = [];
  isDesktopGatewayActive = false;
}

export function isSupported(): boolean {
  return typeof WebSocket !== 'undefined' || Boolean(typeof window !== 'undefined' && window.desktopWindow?.asrGateway);
}

export function isActive(): boolean {
  return Boolean(currentSession && !manuallyStopped)
    || (ws !== null && ws.readyState === WebSocket.OPEN)
    || isDesktopGatewayActive;
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
  lastRawText = '';
  baselineRawText = '';
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
  cleanupDesktopGateway();

  const url = buildGatewayUrl();
  console.info('[ASR Gateway] connecting to:', url, 'provider:', session.provider);

  const startPayload = {
    type: 'start',
    provider: session.provider,
    speaker: session.speaker,
    asrEndWindowSize: session.config.asrEndWindowSize,
    config: {
      ...buildProviderConfig(session.provider, session.config),
      hotwords: session.config.hotwords ?? '',
    },
  };

  // Electron 桌面客户端环境下，优先使用主进程 Node.js 原生 WebSocket（彻底规避 Chromium file:// Origin 保护拦截）
  if (typeof window !== 'undefined' && window.desktopWindow?.asrGateway) {
    console.info('[ASR Gateway] Using desktop native ASR bridge for:', url, 'provider:', session.provider);
    isDesktopGatewayActive = true;
    const bridge = window.desktopWindow.asrGateway;

    const unsubs = [
      bridge.onOpen(() => {
        console.info('[ASR Gateway Bridge] socket open');
        startClientHeartbeatBridge();
      }),
      bridge.onMessage((raw) => {
        if (!currentSession) return;
        let data: { type?: string; message?: string; text?: string; isFinal?: boolean };
        try {
          data = JSON.parse(String(raw || '{}'));
        } catch {
          session.callbacks.onError('ASR Gateway 返回了无法解析的数据。');
          scheduleReconnect('invalid gateway message');
          return;
        }
        if (data.type === 'ready') {
          ready = true;
          isResettingStream = false;
          reconnectAttempts = 0;
          console.info('[ASR Gateway Bridge] ready received from gateway');
          session.callbacks.onReady?.();
          session.callbacks.onError('');
          flushQueue();
          return;
        }
        if (data.type === 'pong') return;
        if (data.type === 'VoiceMessage' && typeof data.text === 'string') {
          if (isResettingStream) return;
          const raw = data.text.trim();
          lastRawText = raw;
          const incremental = stripHistoricalBaseline(raw, baselineRawText);
          if (!incremental) return;
          console.info('[ASR Gateway Bridge] VoiceMessage:', incremental, 'isFinal:', data.isFinal);
          session.callbacks.onResult(incremental, Boolean(data.isFinal));
          return;
        }
        if (data.type === 'error') {
          const message = data.message || 'ASR Gateway 错误';
          console.error('[ASR Gateway Bridge] received error:', message);
          if (isNonRetryableError(message)) {
            stopAfterRemoteError(session, normalizeNonRetryableError(message));
          } else {
            session.callbacks.onError(message);
          }
          return;
        }
        if (data.type === 'end') {
          console.info('[ASR Gateway Bridge] received end, manuallyStopped:', manuallyStopped, 'isResettingStream:', isResettingStream);
          if (manuallyStopped) {
            session.callbacks.onEnd();
          } else if (isResettingStream) {
            // resetStream 导致旧 upstream 正常关闭，正在等待新 upstream 的 ready 包，切勿重连
            return;
          } else {
            scheduleReconnect('gateway end');
          }
        }
      }),
      bridge.onError((err) => {
        console.warn('[ASR Gateway Bridge] socket error:', err);
        if (!manuallyStopped) scheduleReconnect('gateway error');
      }),
      bridge.onClose((info) => {
        console.warn('[ASR Gateway Bridge] closed', info);
        stopClientHeartbeat();
        ready = false;
        cleanupDesktopGateway();
        if (manuallyStopped || !currentSession) {
          callbacksRef?.onEnd();
          return;
        }
        const closeDetail = info.reason
          ? `关闭码 ${info.code}：${info.reason}`
          : `关闭码 ${info.code}`;
        if (info.code === 1008) {
          stopAfterRemoteError(session, `实时识别服务拒绝了此来源（${closeDetail}）。`);
          return;
        }
        if (info.code === 1013) {
          scheduleReconnect('gateway at capacity', `实时识别服务当前繁忙（${closeDetail}）`);
          return;
        }
        scheduleReconnect('gateway close', `实时识别连接已断开（${closeDetail}）`);
      }),
    ];
    desktopGatewayUnsubs = unsubs;

    bridge.connect(url, startPayload).catch((err) => {
      console.warn('[ASR Gateway Bridge] connect failed:', err);
      scheduleReconnect('bridge connect failed');
    });
    return;
  }

  const socket = new WebSocket(url);
  ws = socket;
  socket.onopen = () => {
    console.info('[ASR Gateway] connected to WebSocket, sending start');
    startClientHeartbeat(socket);
    socket.send(JSON.stringify(startPayload));
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
      isResettingStream = false;
      reconnectAttempts = 0;
      console.info('[ASR Gateway] ready received from gateway');
      session.callbacks.onReady?.();
      session.callbacks.onError('');
      flushQueue();
      return;
    }
    if (data.type === 'pong') return;
    if (data.type === 'VoiceMessage' && typeof data.text === 'string') {
      if (isResettingStream) return;
      const raw = data.text.trim();
      lastRawText = raw;
      const incremental = stripHistoricalBaseline(raw, baselineRawText);
      if (!incremental) return;
      console.info('[ASR Gateway] VoiceMessage:', incremental, 'isFinal:', data.isFinal);
      session.callbacks.onResult(incremental, Boolean(data.isFinal));
      return;
    }
    if (data.type === 'error') {
      const message = data.message || 'ASR Gateway 错误';
      console.error('[ASR Gateway] received error:', message);
      if (isNonRetryableError(message)) {
        stopAfterRemoteError(session, normalizeNonRetryableError(message));
      } else {
        session.callbacks.onError(message);
      }
      return;
    }
    if (data.type === 'end') {
      console.info('[ASR Gateway] received end, manuallyStopped:', manuallyStopped, 'isResettingStream:', isResettingStream);
      if (manuallyStopped) {
        session.callbacks.onEnd();
      } else if (isResettingStream) {
        return;
      } else {
        scheduleReconnect('gateway end');
      }
    }
  };
  socket.onerror = (err) => {
    if (ws !== socket) return;
    console.warn('[ASR Gateway] socket error:', err);
    if (!manuallyStopped) scheduleReconnect('gateway error');
  };
  socket.onclose = (event) => {
    if (ws !== socket) return;
    console.warn('[ASR Gateway] socket closed', { code: event.code, reason: event.reason });
    stopClientHeartbeat();
    ready = false;
    ws = null;
    if (manuallyStopped || !currentSession) {
      callbacksRef?.onEnd();
      return;
    }
    const closeDetail = event.reason
      ? `关闭码 ${event.code}：${event.reason}`
      : `关闭码 ${event.code}`;
    if (event.code === 1008) {
      stopAfterRemoteError(session, `实时识别服务拒绝了此网页来源（${closeDetail}）。`);
      return;
    }
    if (event.code === 1013) {
      scheduleReconnect('gateway at capacity', `实时识别服务当前繁忙（${closeDetail}）`);
      return;
    }
    scheduleReconnect('gateway close', `实时识别连接已断开（${closeDetail}）`);
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
  if (isDesktopGatewayActive && typeof window !== 'undefined' && window.desktopWindow?.asrGateway) {
    if (!ready) {
      queueAudio(pcm);
      return;
    }
    try {
      window.desktopWindow.asrGateway.send(JSON.stringify({
        type: 'audio',
        voiceRecBase64: pcmToBase64(pcm),
      }));
    } catch {
      queueAudio(pcm);
      scheduleReconnect('audio send failed');
    }
    return;
  }

  if (!ws) {
    if (currentSession && !manuallyStopped) {
      queueAudio(pcm);
      scheduleReconnect('audio while closed');
    }
    return;
  }
  // System audio starts producing PCM before the gateway's upstream ASR
  // handshake finishes. CONNECTING is expected, not a disconnect: reconnecting
  // here repeatedly tears down the socket before it can ever become ready.
  if (ws.readyState === WebSocket.CONNECTING) {
    queueAudio(pcm);
    return;
  }
  if (ws.readyState !== WebSocket.OPEN) {
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

export function resetStream(): void {
  if (!currentSession || manuallyStopped) return;
  // 核心突破：将当前已识别出的全部累积文本锁定为历史基线。
  // 后续服务端返回的累积文本中，会自动剥离掉该基线部分，
  // 彻底消除多轮面试“下一题包含上一题”的上下文滑动窗口，同时 100% 保持 WebSocket 长连接常驻不断！
  if (lastRawText) {
    baselineRawText = lastRawText;
    console.info('[ASR Gateway] resetStream: baseline locked to length', baselineRawText.length);
  }
  queued = [];
}

export function stop(): void {
  manuallyStopped = true;
  isResettingStream = false;
  lastRawText = '';
  baselineRawText = '';
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
  if (isDesktopGatewayActive && typeof window !== 'undefined' && window.desktopWindow?.asrGateway) {
    try { window.desktopWindow.asrGateway.close(); } catch {}
  }
  cleanupDesktopGateway();
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

function scheduleReconnect(reason: string, messagePrefix?: string): void {
  if (!currentSession || manuallyStopped || reconnectTimer !== null) return;

  const isNormalSlice = reason === 'gateway end';
  if (!isNormalSlice) {
    reconnectAttempts += 1;
  }
  if (reconnectAttempts > MAX_RECONNECT_ATTEMPTS) {
    const callbacks = currentSession.callbacks;
    currentSession = null;
    ready = false;
    callbacks.onError('ASR Gateway 连接已中断，请点击重新开始听音。');
    callbacks.onEnd();
    return;
  }

  const delay = isNormalSlice ? 100 : Math.min(2500, 250 * reconnectAttempts);
  if (reconnectAttempts === 1 && !isNormalSlice) {
    currentSession.callbacks.onError(`${messagePrefix ?? '识别服务连接微弱'}，正在自动重连恢复中...`);
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

function startClientHeartbeatBridge(): void {
  stopClientHeartbeat();
  clientHeartbeatTimer = window.setInterval(() => {
    if (!isDesktopGatewayActive || typeof window === 'undefined' || !window.desktopWindow?.asrGateway) return;
    try {
      window.desktopWindow.asrGateway.send(JSON.stringify({ type: 'keepalive' }));
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
  if (isDesktopGatewayActive && typeof window !== 'undefined' && window.desktopWindow?.asrGateway) {
    try { window.desktopWindow.asrGateway.close(); } catch {}
  }
  cleanupDesktopGateway();
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
  const resampler = new PcmResampler(context.sampleRate);
  silentGain = context.createGain();
  silentGain.gain.value = 0;
  processor.onaudioprocess = (event) => {
    const input = event.inputBuffer.getChannelData(0);
    const pcm = resampler.toPcm(input);
    if (pcm.length > 0) sendAudio(pcm);
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
      result_type: 'single',
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

/**
 * 规整字符串：移除标点符号、空格和控制字符，转小写，用于稳健前缀对齐匹配
 */
export function normalizeForComparison(text: string): string {
  return text.replace(/[\s\p{P}\p{S}]+/gu, '').toLowerCase();
}

/**
 * 从 rawText 开头剔除已提交的历史基线文本。
 * 支持标点容错、语气助词容错与字词对齐，确保每一题仅包含当前提问内容。
 */
export function stripHistoricalBaseline(rawText: string, baseline: string): string {
  if (!rawText) return '';
  if (!baseline) return rawText.trim();

  // 1. 快速完全前缀匹配
  if (rawText.startsWith(baseline)) {
    return rawText.slice(baseline.length).replace(/^[\s\p{P}\p{S}]+/gu, '').trim();
  }

  // 2. 基于汉字/英文字符的标点与空格容错前缀对齐（彻底消除大模型后端修正标点引起的微小差异）
  const normBase = normalizeForComparison(baseline);
  if (!normBase) return rawText.trim();

  let baseIdx = 0;
  let cutIdx = 0;

  for (let i = 0; i < rawText.length; i++) {
    const char = rawText[i];
    // 跳过标点、空格与修饰符号
    if (/[\s\p{P}\p{S}]/u.test(char)) {
      continue;
    }
    const normChar = char.toLowerCase();
    if (baseIdx < normBase.length && normChar === normBase[baseIdx]) {
      baseIdx++;
      cutIdx = i + 1;
      if (baseIdx >= normBase.length) {
        break;
      }
    } else {
      // 尾部语气词/细微同音字容错：若剩余未匹配字符数 <= 2 且前面已经对齐了绝大部分（>= 80%）
      if (baseIdx >= Math.max(2, Math.floor(normBase.length * 0.8)) && normBase.length - baseIdx <= 2) {
        let skip = normBase.length - baseIdx;
        let j = i;
        while (j < rawText.length && skip > 0) {
          if (!/[\s\p{P}\p{S}]/u.test(rawText[j])) skip--;
          j++;
        }
        cutIdx = j;
        baseIdx = normBase.length;
        break;
      }
      // 不匹配且对齐长度不足，说明 rawText 并非以该基线开头（例如 ASR 产生了完全独立的分句）
      return rawText.trim();
    }
  }

  if (baseIdx >= Math.max(2, Math.floor(normBase.length * 0.8))) {
    return rawText.slice(cutIdx).replace(/^[\s\p{P}\p{S}]+/gu, '').trim();
  }

  return rawText.trim();
}
