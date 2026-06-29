import { createServer } from 'node:http';
import WebSocket, { WebSocketServer } from 'ws';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { transcribeCloudAsr } from './cloud-asr';

type GatewayProvider = 'gateway-doubao' | 'gateway-iflytek' | 'gateway-alibaba';

type StartMessage = {
  type: 'start';
  provider: GatewayProvider;
  speaker?: 'interviewer' | 'me';
  asrEndWindowSize?: number;
  config?: Record<string, string | number>;
};

type AudioMessage = {
  type: 'audio';
  voiceRecBase64: string;
};

type ClientMessage = StartMessage | AudioMessage | { type: 'stop' };

const SAMPLE_RATE = 16000;
const DOUBAO_UPSTREAM_URL = 'wss://openspeech.bytedance.com/api/v3/sauc/bigmodel';

const MESSAGE_TYPE = {
  FULL_CLIENT_REQUEST: 0x01,
  AUDIO_ONLY_REQUEST: 0x02,
  FULL_SERVER_RESPONSE: 0x09,
  ERROR_RESPONSE: 0x0f,
} as const;

const MESSAGE_FLAGS = { NONE: 0x00, HAS_SEQUENCE: 0x01, LAST_PACKET: 0x02 } as const;
const SERIALIZATION = { NONE: 0x00, JSON: 0x01 } as const;
const COMPRESSION = { NONE: 0x00, GZIP: 0x01 } as const;

const server = createServer((_, response) => {
  response.writeHead(426, { 'Content-Type': 'text/plain; charset=utf-8' });
  response.end('WebSocket upgrade required');
});

const wss = new WebSocketServer({ server });

wss.on('connection', (client) => {
  let provider: GatewayProvider | null = null;
  let speaker: 'interviewer' | 'me' = 'interviewer';
  let upstream: WebSocket | null = null;
  let started = false;
  let iflytekFirstFrame = true;
  let alibabaPcmChunks: Buffer[] = [];
  let alibabaBytes = 0;
  let config: Record<string, string | number> = {};

  const closeUpstream = () => {
    if (upstream && (upstream.readyState === WebSocket.OPEN || upstream.readyState === WebSocket.CONNECTING)) {
      upstream.close();
    }
    upstream = null;
  };

  const send = (payload: unknown) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(payload));
    }
  };

  client.on('message', (raw) => {
    let message: ClientMessage;
    try {
      message = JSON.parse(raw.toString());
    } catch {
      send({ type: 'error', message: 'Invalid JSON message' });
      return;
    }

    if (message.type === 'start') {
      provider = message.provider;
      speaker = message.speaker ?? 'interviewer';
      config = { ...(message.config ?? {}), asrEndWindowSize: message.asrEndWindowSize ?? 1500 };
      started = true;
      if (provider === 'gateway-doubao') startDoubao(config, send, (ws) => { upstream = ws; }, speaker);
      if (provider === 'gateway-iflytek') startIflytek(config, send, (ws) => { upstream = ws; }, speaker);
      if (provider === 'gateway-alibaba') send({ type: 'ready', provider, mode: 'chunk-fallback' });
      return;
    }

    if (!started || !provider) {
      send({ type: 'error', message: 'ASR Gateway not started' });
      return;
    }

    if (message.type === 'audio') {
      const pcm = Buffer.from(message.voiceRecBase64, 'base64');
      if (provider === 'gateway-doubao') {
        if (upstream?.readyState === WebSocket.OPEN) upstream.send(buildDoubaoAudioFrame(pcm, false));
      } else if (provider === 'gateway-iflytek') {
        if (upstream?.readyState === WebSocket.OPEN) {
          upstream.send(JSON.stringify({
            ...(iflytekFirstFrame ? {
              common: { app_id: str(config.iflytekAppId) },
              business: {
                language: 'zh_cn',
                domain: 'iat',
                accent: 'mandarin',
                dwa: 'wpgs',
                vad_eos: Number(config.asrEndWindowSize) || 1500,
              },
            } : {}),
            data: {
              status: iflytekFirstFrame ? 0 : 1,
              format: 'audio/L16;rate=16000',
              encoding: 'raw',
              audio: message.voiceRecBase64,
            },
          }));
          iflytekFirstFrame = false;
        }
      } else if (provider === 'gateway-alibaba') {
        alibabaPcmChunks.push(pcm);
        alibabaBytes += pcm.byteLength;
        if (alibabaBytes >= SAMPLE_RATE * 2 * 3) {
          void flushAlibaba(config, alibabaPcmChunks, speaker, send);
          alibabaPcmChunks = [];
          alibabaBytes = 0;
        }
      }
      return;
    }

    if (message.type === 'stop') {
      if (provider === 'gateway-doubao' && upstream?.readyState === WebSocket.OPEN) upstream.send(buildDoubaoAudioFrame(Buffer.alloc(0), true));
      if (provider === 'gateway-iflytek' && upstream?.readyState === WebSocket.OPEN) {
        upstream.send(JSON.stringify({ data: { status: 2, format: 'audio/L16;rate=16000', encoding: 'raw', audio: '' } }));
      }
      if (provider === 'gateway-alibaba' && alibabaBytes > 0) void flushAlibaba(config, alibabaPcmChunks, speaker, send);
      closeUpstream();
      send({ type: 'end' });
    }
  });

  client.on('close', closeUpstream);
  client.on('error', closeUpstream);
});

function startDoubao(
  config: Record<string, string | number>,
  send: (payload: unknown) => void,
  setUpstream: (ws: WebSocket) => void,
  speaker: 'interviewer' | 'me',
): void {
  const appId = str(config.appId);
  const accessToken = str(config.accessToken);
  const resourceId = str(config.resourceId) || 'volc.bigasr.sauc.duration';
  const connectId = crypto.randomUUID();
  if (!appId || !accessToken) {
    send({ type: 'error', message: 'Missing Doubao App ID or Access Token' });
    return;
  }
  const upstream = new WebSocket(DOUBAO_UPSTREAM_URL, {
    headers: {
      'X-Api-App-Key': appId,
      'X-Api-Access-Key': accessToken,
      'X-Api-Resource-Id': resourceId,
      'X-Api-Connect-Id': connectId,
      'X-Api-Request-Id': connectId,
      'X-Api-Sequence': '-1',
    },
  });
  setUpstream(upstream);
  upstream.on('open', () => {
    upstream.send(buildDoubaoFullRequest());
    send({ type: 'ready', provider: 'gateway-doubao' });
  });
  upstream.on('message', (data) => {
    try {
      const frame = parseDoubaoFrame(toArrayBuffer(data));
      if (frame.type === 'error') {
        send({ type: 'error', message: `豆包 ${frame.code}: ${frame.message}` });
        return;
      }
      const text = extractDoubaoText(frame.payload);
      if (text) send({ type: 'VoiceMessage', provider: 'gateway-doubao', speaker, text, isFinal: frame.isLast });
    } catch (error) {
      send({ type: 'error', message: error instanceof Error ? error.message : 'Doubao response parse failed' });
    }
  });
  upstream.on('error', (error) => send({ type: 'error', message: error instanceof Error ? error.message : 'Doubao upstream error' }));
  upstream.on('close', () => send({ type: 'end' }));
}

function startIflytek(
  config: Record<string, string | number>,
  send: (payload: unknown) => void,
  setUpstream: (ws: WebSocket) => void,
  speaker: 'interviewer' | 'me',
): void {
  const appId = str(config.iflytekAppId);
  const apiKey = str(config.iflytekApiKey);
  const apiSecret = str(config.iflytekApiSecret);
  if (!appId || !apiKey || !apiSecret) {
    send({ type: 'error', message: 'Missing iFlytek AppID/API Key/API Secret' });
    return;
  }
  const upstream = new WebSocket(buildIflytekUrl(apiKey, apiSecret));
  setUpstream(upstream);
  upstream.on('open', () => {
    send({ type: 'ready', provider: 'gateway-iflytek' });
  });
  upstream.on('message', (raw) => {
    const data = JSON.parse(raw.toString());
    if (data.code) {
      send({ type: 'error', message: data.message || `讯飞 ${data.code}` });
      return;
    }
    const text = (data?.data?.result?.ws || []).map((w: any) => w.cw?.[0]?.w || '').join('');
    if (text) send({ type: 'VoiceMessage', provider: 'gateway-iflytek', speaker, text, isFinal: data?.data?.status === 2 });
  });
  upstream.on('error', (error) => send({ type: 'error', message: error instanceof Error ? error.message : 'iFlytek upstream error' }));
  upstream.on('close', () => send({ type: 'end' }));
}

async function flushAlibaba(
  config: Record<string, string | number>,
  chunks: Buffer[],
  speaker: 'interviewer' | 'me',
  send: (payload: unknown) => void,
): Promise<void> {
  const pcm = Buffer.concat(chunks);
  if (pcm.byteLength === 0) return;
  const wav = encodeWav(pcm);
  const text = await transcribeCloudAsr({
    provider: 'alibaba',
    config,
    pcmBase64: pcm.toString('base64'),
    pcmBytes: pcm.byteLength,
    wavBase64: wav.toString('base64'),
    wavBytes: wav.byteLength,
  });
  if (text) send({ type: 'VoiceMessage', provider: 'gateway-alibaba', speaker, text, isFinal: true });
}

function buildDoubaoFullRequest(): Buffer {
  const payload = zlib.gzipSync(Buffer.from(JSON.stringify({
    user: { uid: 'interview-copilot-gateway' },
    audio: { format: 'pcm', rate: SAMPLE_RATE, bits: 16, channel: 1, language: 'zh-CN' },
    request: { model_name: 'bigmodel', enable_itn: true, enable_ddc: false, enable_punc: true, show_utterances: true, result_type: 'full' },
  })));
  return buildDoubaoFrame(MESSAGE_TYPE.FULL_CLIENT_REQUEST, MESSAGE_FLAGS.NONE, SERIALIZATION.JSON, COMPRESSION.GZIP, payload);
}

function buildDoubaoAudioFrame(pcm: Buffer, isLast: boolean): Buffer {
  return buildDoubaoFrame(
    MESSAGE_TYPE.AUDIO_ONLY_REQUEST,
    isLast ? MESSAGE_FLAGS.LAST_PACKET : MESSAGE_FLAGS.NONE,
    SERIALIZATION.NONE,
    COMPRESSION.GZIP,
    zlib.gzipSync(pcm),
  );
}

function buildDoubaoFrame(messageType: number, flags: number, serialization: number, compression: number, payload: Buffer): Buffer {
  const frame = Buffer.alloc(8 + payload.byteLength);
  frame[0] = 0x11;
  frame[1] = (messageType << 4) | flags;
  frame[2] = (serialization << 4) | compression;
  frame[3] = 0x00;
  frame.writeUInt32BE(payload.byteLength, 4);
  payload.copy(frame, 8);
  return frame;
}

function parseDoubaoFrame(buffer: ArrayBuffer): any {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const messageType = view.getUint8(1) >> 4;
  const flags = view.getUint8(1) & 0x0f;
  const serialization = view.getUint8(2) >> 4;
  const compression = view.getUint8(2) & 0x0f;
  let offset = (view.getUint8(0) & 0x0f) * 4;
  if ((flags & MESSAGE_FLAGS.HAS_SEQUENCE) === MESSAGE_FLAGS.HAS_SEQUENCE) offset += 4;
  if (messageType === MESSAGE_TYPE.ERROR_RESPONSE) {
    const code = view.getUint32(offset, false); offset += 4;
    const size = view.getUint32(offset, false); offset += 4;
    return { type: 'error', code, message: Buffer.from(bytes.slice(offset, offset + size)).toString('utf8') };
  }
  const payloadSize = view.getUint32(offset, false); offset += 4;
  let payload = Buffer.from(bytes.slice(offset, offset + payloadSize));
  if (compression === COMPRESSION.GZIP) payload = zlib.gunzipSync(payload);
  return {
    type: 'result',
    payload: payload.byteLength && serialization === SERIALIZATION.JSON ? JSON.parse(payload.toString('utf8')) : {},
    isLast: (flags & MESSAGE_FLAGS.LAST_PACKET) === MESSAGE_FLAGS.LAST_PACKET,
  };
}

function extractDoubaoText(payload: any): string {
  if (typeof payload?.result?.text === 'string') return payload.result.text.trim();
  if (typeof payload?.text === 'string') return payload.text.trim();
  return '';
}

function buildIflytekUrl(apiKey: string, apiSecret: string): string {
  const host = 'iat-api.xfyun.cn';
  const path = '/v2/iat';
  const date = new Date().toUTCString();
  const signatureOrigin = `host: ${host}\ndate: ${date}\nGET ${path} HTTP/1.1`;
  const signature = crypto.createHmac('sha256', apiSecret).update(signatureOrigin).digest('base64');
  const authorizationOrigin = `api_key="${apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`;
  const params = new URLSearchParams({ authorization: Buffer.from(authorizationOrigin).toString('base64'), date, host });
  return `wss://${host}${path}?${params.toString()}`;
}

function encodeWav(pcm: Buffer): Buffer {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.byteLength, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.byteLength, 40);
  return Buffer.concat([header, pcm]);
}

function toArrayBuffer(data: WebSocket.RawData): ArrayBuffer {
  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data as any);
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export default server;
