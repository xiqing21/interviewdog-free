type MiMoAsrBody = {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  language?: string;
  audioBase64?: string;
};

export default async function handler(request: any, response: any) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    response.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const body = request.body as MiMoAsrBody;
  const apiKey = body.apiKey?.trim();
  const audioBase64 = body.audioBase64?.trim();
  if (!apiKey || !audioBase64) {
    response.status(400).json({ error: 'Missing MiMo API key or audio data' });
    return;
  }

  try {
    const result = await callMiMoAsr(body);
    response.status(200).json({ text: result });
  } catch (error) {
    response.status(500).json({
      error: error instanceof Error ? error.message : 'MiMo ASR failed',
    });
  }
}

export async function callMiMoAsr(body: MiMoAsrBody): Promise<string> {
  const baseUrl = (body.baseUrl || 'https://api.xiaomimimo.com/v1').replace(/\/+$/, '');
  const model = body.model || 'mimo-v2.5-asr';
  const language = body.language || 'auto';
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${body.apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'input_audio',
              input_audio: {
                data: `data:audio/wav;base64,${body.audioBase64}`,
              },
            },
          ],
        },
      ],
      language,
      stream: false,
    }),
  });

  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data?.error?.message || data?.message || `MiMo API 返回 ${res.status}`;
    throw new Error(message);
  }

  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((item) => item?.text || item?.content || '')
      .filter(Boolean)
      .join('')
      .trim();
  }
  throw new Error('MiMo API 返回了无效的响应格式。');
}
