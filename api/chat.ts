import { createClient } from '@supabase/supabase-js';

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

  const config = await loadAdminConfig<{
    apiKey?: string;
    baseUrl?: string;
    textApiKey?: string;
    textBaseUrl?: string;
    textModel?: string;
    visionApiKey?: string;
    visionBaseUrl?: string;
    visionModel?: string;
  }>('ai');

  const body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
  const messages = body?.messages as ChatMessage[] | undefined;
  const stream = Boolean(body?.stream);
  const modelType = body?.modelType === 'vision' ? 'vision' : 'text';

  // 区分通道获取配置：视觉通道与文本通道完全解耦
  const isVision = modelType === 'vision';
  const apiKey = isVision
    ? firstNonEmpty(config.visionApiKey, config.apiKey, process.env.AI_VISION_API_KEY, process.env.AI_API_KEY)
    : firstNonEmpty(config.textApiKey, config.apiKey, process.env.AI_TEXT_API_KEY, process.env.AI_API_KEY);

  const baseUrl = (isVision
    ? firstNonEmpty(config.visionBaseUrl, config.baseUrl, process.env.AI_VISION_BASE_URL, process.env.AI_BASE_URL, 'https://dashscope.aliyuncs.com/compatible-mode/v1')
    : firstNonEmpty(config.textBaseUrl, config.baseUrl, process.env.AI_TEXT_BASE_URL, process.env.AI_BASE_URL, 'https://api.deepseek.com/v1')
  ).replace(/\/+$/, '');

  const textModel = firstNonEmpty(config.textModel, process.env.AI_TEXT_MODEL, 'deepseek-chat');
  const visionModel = firstNonEmpty(config.visionModel, process.env.AI_VISION_MODEL, 'qwen-vl-max');
  const activeModel = isVision ? visionModel : textModel;

  if (!apiKey) {
    response.status(500).json({
      error: isVision ? '笔试识图视觉模型 (Vision) 的 API Key 尚未配置。' : '面试文本大模型 (DeepSeek) 的 API Key 尚未配置。',
    });
    return;
  }

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
      model: activeModel,
      messages,
      stream,
      max_tokens: isVision ? 4096 : undefined,
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

async function loadAdminConfig<T extends Record<string, unknown>>(key: string): Promise<Partial<T>> {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return {};
  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data } = await supabase
      .from('admin_app_config')
      .select('value')
      .eq('key', key)
      .maybeSingle();
    return (data?.value ?? {}) as Partial<T>;
  } catch {
    return {};
  }
}

function firstNonEmpty(...values: Array<unknown>): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim() && value.trim() !== '********') return value.trim();
  }
  return '';
}
