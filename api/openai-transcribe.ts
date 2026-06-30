import type { IncomingMessage, ServerResponse } from 'node:http';

interface TranscribePayload {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  mimeType?: string;
  audioBase64?: string;
}

const MAX_AUDIO_BYTES = 12 * 1024 * 1024;

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  try {
    const payload = await readJson(req);
    const apiKey = payload.apiKey?.trim();
    if (!apiKey) {
      sendJson(res, 400, { error: '缺少 OpenAI API Key。' });
      return;
    }

    if (!payload.audioBase64) {
      sendJson(res, 400, { error: '缺少音频数据。' });
      return;
    }

    const audio = Buffer.from(payload.audioBase64, 'base64');
    if (audio.byteLength === 0) {
      sendJson(res, 400, { error: '音频数据为空。' });
      return;
    }
    if (audio.byteLength > MAX_AUDIO_BYTES) {
      sendJson(res, 413, { error: '音频分片过大，请缩短分片时长。' });
      return;
    }

    const baseUrl = normalizeBaseUrl(payload.baseUrl);
    const form = new FormData();
    const mimeType = payload.mimeType || 'audio/webm';
    form.append('file', new Blob([audio], { type: mimeType }), fileNameForMime(mimeType));
    form.append('model', payload.model || 'whisper-1');
    form.append('language', 'zh');
    form.append('response_format', 'json');

    const upstream = await fetch(`${baseUrl}/audio/transcriptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: AbortSignal.timeout(45000),
    });

    const text = await upstream.text();
    let body: Record<string, unknown> = {};
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text };
    }

    if (!upstream.ok) {
      const message = typeof body?.error === 'object' && body.error && 'message' in body.error
        ? String((body.error as { message?: unknown }).message)
        : text.slice(0, 240) || upstream.statusText;
      if (upstream.status === 404) {
        sendJson(res, 404, {
          error: `当前 API Base URL 不支持 /audio/transcriptions。请在设置里选择 OpenAI 服务商，或使用真正兼容 OpenAI 音频转写的中转地址。原始错误：${message}`,
        });
        return;
      }
      sendJson(res, upstream.status, { error: `转写失败：${message}` });
      return;
    }

    sendJson(res, 200, { text: typeof body.text === 'string' ? body.text : '' });
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误';
    sendJson(res, 500, { error: `转写代理错误：${message}` });
  }
}

function normalizeBaseUrl(baseUrl?: string): string {
  const value = (baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
  if (value.endsWith('/audio/transcriptions')) {
    return value.slice(0, -'/audio/transcriptions'.length);
  }
  return value;
}

function fileNameForMime(mimeType: string): string {
  if (mimeType.includes('mp4')) return 'chunk.mp4';
  if (mimeType.includes('mpeg')) return 'chunk.mp3';
  if (mimeType.includes('wav')) return 'chunk.wav';
  return 'chunk.webm';
}

function readJson(req: IncomingMessage): Promise<TranscribePayload> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk: string) => {
      body += chunk;
      if (body.length > MAX_AUDIO_BYTES * 2) {
        reject(new Error('请求体过大。'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body) as TranscribePayload);
      } catch {
        reject(new Error('请求 JSON 格式错误。'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}
