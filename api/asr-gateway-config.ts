import { loadAdminConfig } from './_admin-config';

type ApiRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
};

type ApiResponse = {
  status: (code: number) => ApiResponse;
  setHeader: (name: string, value: string) => void;
  json: (body: unknown) => void;
};

function firstHeader(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== 'GET') {
    response.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const expectedSecret = process.env.ASR_GATEWAY_SYNC_SECRET?.trim();
  const receivedSecret = firstHeader(request.headers['x-asr-gateway-secret']).trim();
  if (!expectedSecret || receivedSecret !== expectedSecret) {
    response.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const config = await loadAdminConfig<Record<string, string>>('asr');
  response.setHeader('Cache-Control', 'no-store');
  response.json({ config });
}
