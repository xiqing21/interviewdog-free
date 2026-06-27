import type { IncomingMessage, ServerResponse } from 'node:http';

interface SearchPayload {
  query?: string;
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  try {
    const payload = await readJson(req);
    const query = payload.query?.trim();
    if (!query) {
      sendJson(res, 400, { error: '缺少搜索关键词。' });
      return;
    }

    const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const upstream = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 InterviewDog Search Bot',
        Accept: 'text/html',
      },
      signal: AbortSignal.timeout(10000),
    });
    const html = await upstream.text();
    if (!upstream.ok) {
      sendJson(res, upstream.status, { error: `搜索服务返回 ${upstream.status}` });
      return;
    }

    sendJson(res, 200, { results: parseDuckDuckGo(html).slice(0, 5) });
  } catch (error) {
    sendJson(res, 500, { error: error instanceof Error ? error.message : '联网搜索失败' });
  }
}

function parseDuckDuckGo(html: string): Array<{ title: string; url: string; snippet: string }> {
  const results: Array<{ title: string; url: string; snippet: string }> = [];
  const blocks = html.split('result__body').slice(1);
  for (const block of blocks) {
    const titleMatch = block.match(/class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/s);
    const snippetMatch = block.match(/class="result__snippet"[^>]*>(.*?)<\/a>|class="result__snippet"[^>]*>(.*?)<\/div>/s);
    if (!titleMatch) continue;
    results.push({
      title: decodeHtml(stripTags(titleMatch[2] ?? '')),
      url: decodeDuckUrl(decodeHtml(titleMatch[1] ?? '')),
      snippet: decodeHtml(stripTags(snippetMatch?.[1] || snippetMatch?.[2] || '')),
    });
  }
  return results.filter((item) => item.title && item.url);
}

function decodeDuckUrl(value: string): string {
  try {
    const url = new URL(value, 'https://duckduckgo.com');
    return url.searchParams.get('uddg') || url.href;
  } catch {
    return value;
  }
}

function stripTags(value: string): string {
  return value.replace(/<[^>]*>/g, ' ').replace(/\\s+/g, ' ').trim();
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function readJson(req: IncomingMessage): Promise<SearchPayload> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk: string) => {
      body += chunk;
      if (body.length > 20_000) {
        reject(new Error('请求体过大。'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body) as SearchPayload);
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
