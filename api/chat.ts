import { firstNonEmpty, loadAdminConfig } from './_admin-config';

type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: unknown;
};

type ApiRequest = {
  method?: string;
  body?: unknown;
};

type ApiResponse = {
  status: (code: number) => ApiResponse;
  json: (body: unknown) => void;
  writeHead: (statusCode: number, headers: Record<string, string>) => void;
  write: (chunk: Buffer) => void;
  end: () => void;
};

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== 'POST') {
    response.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const config = await loadAdminConfig<{ apiKey: string; baseUrl: string; textModel: string; visionModel: string }>('ai');
  const apiKey = firstNonEmpty(config.apiKey, process.env.AI_API_KEY);
  const baseUrl = firstNonEmpty(config.baseUrl, process.env.AI_BASE_URL, 'https://api.deepseek.com/v1').replace(/\/+$/, '');
  const textModel = firstNonEmpty(config.textModel, process.env.AI_TEXT_MODEL, 'deepseek-chat');
  const visionModel = firstNonEmpty(config.visionModel, process.env.AI_VISION_MODEL, textModel);
  if (!apiKey) {
    response.status(500).json({ error: 'Server AI API key is not configured.' });
    return;
  }

  const body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
  const messages = body?.messages as ChatMessage[] | undefined;
  const stream = Boolean(body?.stream);
  const modelType = body?.modelType === 'vision' ? 'vision' : 'text';
  if (!Array.isArray(messages) || messages.length === 0) {
    response.status(400).json({ error: 'messages is required.' });
    return;
  }

  const upstream = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelType === 'vision' ? visionModel : textModel,
      messages,
      stream,
      max_tokens: modelType === 'vision' ? 4096 : undefined,
    }),
  });

  if (!upstream.ok) {
    const text = await upstream.text().catch(() => '');
    response.status(upstream.status).json({ error: text || `AI upstream error ${upstream.status}` });
    return;
  }

  if (stream && upstream.body) {
    response.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    });
    const reader = upstream.body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        response.write(Buffer.from(value));
      }
    } finally {
      reader.releaseLock();
      response.end();
    }
    return;
  }

  const data = await upstream.json();
  response.status(200).json(data);
}
