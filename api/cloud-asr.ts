import WebSocket from 'ws';
import crypto from 'node:crypto';

type Provider = 'baidu' | 'google' | 'alibaba' | 'iflytek' | 'glm';

type CloudAsrBody = {
  provider?: Provider;
  config?: Record<string, string | number>;
  wavBase64?: string;
  wavBytes?: number;
  pcmBase64?: string;
  pcmBytes?: number;
};

export default async function handler(request: any, response: any) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    response.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    response.status(200).json({ text: await transcribeCloudAsr(request.body as CloudAsrBody) });
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'Cloud ASR failed' });
  }
}

export async function transcribeCloudAsr(body: CloudAsrBody): Promise<string> {
  switch (body.provider) {
    case 'baidu': return baiduAsr(body);
    case 'google': return googleAsr(body);
    case 'alibaba': return alibabaAsr(body);
    case 'iflytek': return iflytekAsr(body);
    case 'glm': return glmAsr(body);
    default: throw new Error('Unsupported ASR provider');
  }
}

async function baiduAsr(body: CloudAsrBody): Promise<string> {
  const apiKey = str(body.config?.baiduApiKey);
  const secretKey = str(body.config?.baiduSecretKey);
  if (!apiKey || !secretKey) throw new Error('请填写百度 API Key 和 Secret Key');
  const tokenRes = await fetch(`https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${encodeURIComponent(apiKey)}&client_secret=${encodeURIComponent(secretKey)}`);
  const tokenData: any = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || !tokenData.access_token) throw new Error(tokenData.error_description || '百度 Token 获取失败');
  const res = await fetch('https://vop.baidu.com/server_api', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      format: 'wav',
      rate: 16000,
      channel: 1,
      cuid: 'interview-copilot',
      token: tokenData.access_token,
      speech: body.wavBase64,
      len: body.wavBytes,
    }),
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok || data.err_no !== 0) throw new Error(data.err_msg || `百度 ASR 返回 ${res.status}`);
  return Array.isArray(data.result) ? data.result.join('') : '';
}

async function googleAsr(body: CloudAsrBody): Promise<string> {
  const apiKey = str(body.config?.googleApiKey);
  if (!apiKey) throw new Error('请填写 Google API Key');
  const res = await fetch(`https://speech.googleapis.com/v1/speech:recognize?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      config: {
        encoding: 'LINEAR16',
        sampleRateHertz: 16000,
        languageCode: str(body.config?.language) || 'zh-CN',
        enableAutomaticPunctuation: true,
        ...(parseHotwords(body.config?.hotwords).length
          ? { speechContexts: [{ phrases: parseHotwords(body.config?.hotwords) }] }
          : {}),
      },
      audio: { content: body.pcmBase64 },
    }),
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `Google ASR 返回 ${res.status}`);
  return (data.results || []).map((r: any) => r.alternatives?.[0]?.transcript || '').join('');
}

async function alibabaAsr(body: CloudAsrBody): Promise<string> {
  const appKey = str(body.config?.alibabaAppKey);
  const token = str(body.config?.alibabaToken);
  const endpoint = str(body.config?.alibabaEndpoint) || 'https://nls-gateway-cn-shanghai.aliyuncs.com/stream/v1/asr';
  if (!appKey || !token) throw new Error('请填写阿里云 AppKey 和 Token');
  const url = new URL(endpoint);
  url.searchParams.set('appkey', appKey);
  url.searchParams.set('format', 'pcm');
  url.searchParams.set('sample_rate', '16000');
  url.searchParams.set('enable_punctuation_prediction', 'true');
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream', 'X-NLS-Token': token },
    body: Buffer.from(body.pcmBase64 || '', 'base64'),
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok || (data.status && data.status !== 20000000)) throw new Error(data.message || `阿里 ASR 返回 ${res.status}`);
  return data.result || '';
}

async function iflytekAsr(body: CloudAsrBody): Promise<string> {
  const appId = str(body.config?.iflytekAppId);
  const apiKey = str(body.config?.iflytekApiKey);
  const apiSecret = str(body.config?.iflytekApiSecret);
  if (!appId || !apiKey || !apiSecret) throw new Error('请填写讯飞 AppID、API Key 和 API Secret');
  const url = buildIflytekUrl(apiKey, apiSecret);
  const audio = body.pcmBase64 || '';
  return new Promise((resolve, reject) => {
    let text = '';
    const ws = new WebSocket(url);
    const timer = setTimeout(() => { ws.close(); reject(new Error('讯飞 ASR 超时')); }, 15000);
    ws.on('open', () => {
      ws.send(JSON.stringify({
        common: { app_id: appId },
        business: { language: 'zh_cn', domain: 'iat', accent: 'mandarin', vad_eos: 2000 },
        data: { status: 0, format: 'audio/L16;rate=16000', encoding: 'raw', audio },
      }));
      ws.send(JSON.stringify({ data: { status: 2, format: 'audio/L16;rate=16000', encoding: 'raw', audio: '' } }));
    });
    ws.on('message', (raw) => {
      const data = JSON.parse(raw.toString());
      if (data.code) {
        clearTimeout(timer);
        ws.close();
        reject(new Error(data.message || `讯飞 ASR 错误 ${data.code}`));
        return;
      }
      const words = data?.data?.result?.ws || [];
      text += words.map((w: any) => w.cw?.[0]?.w || '').join('');
      if (data?.data?.status === 2) {
        clearTimeout(timer);
        ws.close();
        resolve(text.trim());
      }
    });
    ws.on('error', (error) => { clearTimeout(timer); reject(error); });
  });
}

async function glmAsr(body: CloudAsrBody): Promise<string> {
  const apiKey = str(body.config?.glmApiKey);
  const baseUrl = (str(body.config?.glmBaseUrl) || 'https://open.bigmodel.cn/api/paas/v4').replace(/\/+$/, '');
  const model = str(body.config?.glmModel) || 'glm-asr-2512';
  if (!apiKey) throw new Error('请填写 GLM / Z.AI API Key');
  const form = new FormData();
  form.set('model', model);
  form.set('file', new Blob([Buffer.from(body.wavBase64 || '', 'base64')], { type: 'audio/wav' }), 'audio.wav');
  const hotwords = str(body.config?.hotwords);
  if (hotwords) form.set('hotword', hotwords);
  const res = await fetch(`${baseUrl}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || data?.message || `GLM ASR 返回 ${res.status}`);
  return data.text || data.result || '';
}

function buildIflytekUrl(apiKey: string, apiSecret: string): string {
  const host = 'iat-api.xfyun.cn';
  const path = '/v2/iat';
  const date = new Date().toUTCString();
  const signatureOrigin = `host: ${host}\ndate: ${date}\nGET ${path} HTTP/1.1`;
  const signature = crypto.createHmac('sha256', apiSecret).update(signatureOrigin).digest('base64');
  const authorizationOrigin = `api_key="${apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`;
  const params = new URLSearchParams({
    authorization: Buffer.from(authorizationOrigin).toString('base64'),
    date,
    host,
  });
  return `wss://${host}${path}?${params.toString()}`;
}

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function parseHotwords(value: unknown): string[] {
  if (typeof value !== 'string') return [];
  return value
    .split(/[,，、\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 50);
}
