import type { LocalQwenASRConfig } from '../types';

export interface LocalQwenCallbacks {
  onResult: (text: string, isFinal: boolean) => void;
  onError: (error: string) => void;
  onEnd: () => void;
  onReady?: () => void;
}

export interface LocalQwenSession {
  start: (config: LocalQwenASRConfig, callbacks: LocalQwenCallbacks) => void;
  sendAudio: (pcm: Int16Array) => void;
  stop: () => void;
  isActive: () => boolean;
}

const activeSessions = new Set<LocalQwenSessionImpl>();
let defaultSession: LocalQwenSessionImpl | null = null;

export function isSupported(): boolean {
  return typeof WebSocket !== 'undefined';
}

export function createSession(): LocalQwenSession {
  const session = new LocalQwenSessionImpl();
  activeSessions.add(session);
  return session;
}

export function isActive(): boolean {
  return Array.from(activeSessions).some((session) => session.isActive());
}

export function start(config: LocalQwenASRConfig, callbacks: LocalQwenCallbacks): void {
  if (!defaultSession) defaultSession = new LocalQwenSessionImpl();
  activeSessions.add(defaultSession);
  defaultSession.start(config, callbacks);
}

export function sendAudio(pcm: Int16Array): void {
  defaultSession?.sendAudio(pcm);
}

export function stop(): void {
  for (const session of Array.from(activeSessions)) {
    session.stop();
  }
  activeSessions.clear();
  defaultSession = null;
}

export function testConnection(config: LocalQwenASRConfig): Promise<{ success: boolean; message: string }> {
  return new Promise((resolve) => {
    const endpoint = config.endpoint.trim();
    if (!endpoint) {
      resolve({ success: false, message: '请先填写本地 Qwen3-ASR 地址。' });
      return;
    }

    const testWs = new WebSocket(endpoint);
    let settled = false;
    const timer = window.setTimeout(() => finish(false, '本地 Qwen3-ASR 测试超时。'), 4000);
    const finish = (success: boolean, message: string) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      try { testWs.close(1000, 'test done'); } catch {}
      resolve({ success, message });
    };

    testWs.onopen = () => {
      testWs.send(JSON.stringify({
        type: 'start',
        sampleRate: 16000,
        format: 'pcm_s16le',
        model: config.model,
        hotwords: parseHotwords(config.hotwords),
      }));
      finish(true, '本地 Qwen3-ASR WebSocket 已连通。');
    };
    testWs.onerror = () => finish(false, '连接失败，请确认本地服务已启动。');
    testWs.onclose = (event) => {
      if (!settled && event.code !== 1000) {
        finish(false, event.reason || `连接关闭：${event.code}`);
      }
    };
  });
}

class LocalQwenSessionImpl implements LocalQwenSession {
  private ws: WebSocket | null = null;
  private connected = false;
  private ready = false;
  private audioQueue: Int16Array[] = [];

  start(config: LocalQwenASRConfig, callbacks: LocalQwenCallbacks): void {
    this.stop();
    this.audioQueue = [];
    this.ready = false;
    const endpoint = config.endpoint.trim();
    if (!endpoint) {
      callbacks.onError('请先配置本地 Qwen3-ASR WebSocket 地址。');
      return;
    }

    const socket = new WebSocket(endpoint);
    this.ws = socket;
    socket.binaryType = 'arraybuffer';

    socket.onopen = () => {
      if (this.ws !== socket) return;
      this.connected = true;
      socket.send(JSON.stringify({
        type: 'start',
        sampleRate: 16000,
        format: 'pcm_s16le',
        model: config.model,
        hotwords: parseHotwords(config.hotwords),
      }));
    };

    socket.onmessage = (event) => {
      if (typeof event.data !== 'string') return;
      try {
        const data = JSON.parse(event.data) as {
          type?: string;
          text?: string;
          isFinal?: boolean;
          final?: boolean;
          error?: string;
        };
        if (data.type === 'error' || data.error) {
          callbacks.onError(data.error || '本地 Qwen3-ASR 返回错误。');
          return;
        }
        if (data.type === 'ready') {
          this.ready = true;
          callbacks.onReady?.();
          this.flushAudioQueue();
          return;
        }
        if (typeof data.text === 'string' && data.text.trim()) {
          callbacks.onResult(data.text.trim(), Boolean(data.isFinal ?? data.final));
        }
      } catch {
        callbacks.onError('本地 Qwen3-ASR 返回了无法解析的消息。');
      }
    };

    socket.onerror = () => {
      callbacks.onError('本地 Qwen3-ASR 连接失败，请确认本地服务已启动。');
    };

    socket.onclose = (event) => {
      if (this.ws === socket) {
        this.connected = false;
        this.ready = false;
        this.audioQueue = [];
        this.ws = null;
      }
      if (event.code !== 1000 && event.reason) {
        callbacks.onError(`本地 Qwen3-ASR 连接关闭 ${event.code}：${event.reason}`);
      }
      callbacks.onEnd();
    };
  }

  sendAudio(pcm: Int16Array): void {
    if (!pcm.byteLength) return;
    if (!this.ws || !this.connected || !this.ready || this.ws.readyState !== WebSocket.OPEN) {
      this.audioQueue.push(pcm.slice());
      this.audioQueue = this.audioQueue.slice(-80);
      return;
    }
    this.ws.send(copyPcmBuffer(pcm));
  }

  stop(): void {
    if (this.ws) {
      try {
        this.ws.send(JSON.stringify({ type: 'stop' }));
      } catch {}
      this.ws.close(1000, 'user stop');
    }
    this.ws = null;
    this.connected = false;
    this.ready = false;
    this.audioQueue = [];
  }

  isActive(): boolean {
    return this.ws !== null && this.connected;
  }

  private flushAudioQueue(): void {
    const pending = this.audioQueue;
    this.audioQueue = [];
    for (const pcm of pending) this.sendAudio(pcm);
  }
}

function copyPcmBuffer(pcm: Int16Array): ArrayBuffer {
  const bytes = new Uint8Array(pcm.byteLength);
  bytes.set(new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength));
  return bytes.buffer;
}

function parseHotwords(value: string): string[] {
  return value
    .split(/[,\n，、]/)
    .map((item) => item.trim())
    .filter(Boolean);
}
