import type { IncomingMessage, ServerResponse } from 'node:http';

type ReadUrlPayload = {
  url?: string;
};

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    response.statusCode = 405;
    response.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  try {
    const payload = await readJson(request);
    const url = normalizeUrl(payload.url);
    const upstream = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 InterviewCopilot/1.0',
        Accept: 'text/html,text/plain,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(12000),
    });
    const contentType = upstream.headers.get('content-type') ?? '';
    if (!upstream.ok) throw new Error(`网页读取失败：${upstream.status}`);
    if (!/text|html|xml|json/i.test(contentType)) {
      throw new Error('暂不支持读取该网页类型，请换成普通网页或手动粘贴内容。');
    }
    const html = await upstream.text();
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.end(JSON.stringify({ text: extractReadableText(html).slice(0, 30000) }));
  } catch (error) {
    response.statusCode = 500;
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.end(JSON.stringify({ error: error instanceof Error ? error.message : '网页读取失败' }));
  }
}

function normalizeUrl(value?: string): string {
  const raw = value?.trim();
  if (!raw) throw new Error('请先填写网页 URL。');
  const url = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('仅支持 http/https 网页。');
  return url.toString();
}

function extractReadableText(html: string): string {
  return decodeHtml(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|section|article|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function readJson(req: IncomingMessage): Promise<ReadUrlPayload> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}
