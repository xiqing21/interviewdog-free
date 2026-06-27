import type { LocalQwenASRConfig } from '../types';

export interface LocalQwenCallbacks {
  onResult: (text: string, isFinal: boolean) => void;
  onError: (error: string) => void;
  onEnd: () => void;
  onReady?: () => void;
}

let ws: WebSocket | null = null;
let connected = false;
let audioQueue: Int16Array[] = [];

export function isSupported(): boolean {
  return typeof WebSocket !== 'undefined';
}

export function isActive(): boolean {
  return ws !== null && connected;
}

export function start(config: LocalQwenASRConfig, callbacks: LocalQwenCallbacks): void {
  stop();
  audioQueue = [];
  const endpoint = config.endpoint.trim();
  if (!endpoint) {
    callbacks.onError('请先配置本地 Qwen3-ASR WebSocket 地址。');
    return;
  }

  ws = new WebSocket(endpoint);
  ws.binaryType = 'arraybuffer';

  ws.onopen = () => {
    connected = true;
    ws?.send(JSON.stringify({
      type: 'start',
      sampleRate: 16000,
      format: 'pcm_s16le',
      model: config.model,
      hotwords: parseHotwords(config.hotwords),
    }));
    callbacks.onReady?.();
    flushAudioQueue();
  };

  ws.onmessage = (event) => {
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
      if (typeof data.text === 'string' && data.text.trim()) {
        callbacks.onResult(data.text.trim(), Boolean(data.isFinal ?? data.final));
      }
    } catch {
      callbacks.onError('本地 Qwen3-ASR 返回了无法解析的消息。');
    }
  };

  ws.onerror = () => {
    callbacks.onError('本地 Qwen3-ASR 连接失败，请确认本地服务已启动。');
  };

  ws.onclose = (event) => {
    connected = false;
    audioQueue = [];
    ws = null;
    if (event.code !== 1000 && event.reason) {
      callbacks.onError(`本地 Qwen3-ASR 连接关闭 ${event.code}：${event.reason}`);
    }
    callbacks.onEnd();
  };
}

export function sendAudio(pcm: Int16Array): void {
  if (!pcm.byteLength) return;
  if (!ws || !connected || ws.readyState !== WebSocket.OPEN) {
    audioQueue.push(pcm.slice());
    audioQueue = audioQueue.slice(-80);
    return;
  }
  ws.send(copyPcmBuffer(pcm));
}

export function stop(): void {
  if (ws) {
    try {
      ws.send(JSON.stringify({ type: 'stop' }));
    } catch {}
    ws.close(1000, 'user stop');
  }
  ws = null;
  connected = false;
  audioQueue = [];
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

function flushAudioQueue(): void {
  const pending = audioQueue;
  audioQueue = [];
  for (const pcm of pending) sendAudio(pcm);
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
