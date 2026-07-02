import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// https://vitejs.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  plugins: [
    react(),
    {
      name: 'local-mimo-asr-api',
      configureServer(server) {
        server.middlewares.use('/api/mimo-asr', async (req, res) => {
          if (req.method !== 'POST') {
            res.statusCode = 405;
            res.end(JSON.stringify({ error: 'Method not allowed' }));
            return;
          }

          try {
            const body = await readJsonBody(req);
            const result = await callMiMoAsr(body);
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ text: result }));
          } catch (error) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'MiMo ASR failed' }));
          }
        });
        server.middlewares.use('/api/cloud-asr', async (req, res) => {
          if (req.method !== 'POST') {
            res.statusCode = 405;
            res.end(JSON.stringify({ error: 'Method not allowed' }));
            return;
          }

          try {
            const body = await readJsonBody(req);
            const { transcribeCloudAsr } = await import('./api/cloud-asr');
            const result = await transcribeCloudAsr(body);
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ text: result }));
          } catch (error) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Cloud ASR failed' }));
          }
        });
      },
    },
  ],
  server: {
    port: 5173,
    open: true,
    proxy: {
      '/api/doubao-asr': {
        target: 'wss://openspeech.bytedance.com',
        changeOrigin: true,
        secure: true,
        ws: true,
        rewrite: (path) => path.replace(/^\/api\/doubao-asr/, '/api/v3/sauc/bigmodel'),
        configure: (proxy) => {
          proxy.on('proxyReqWs', (proxyReq, req) => {
            const requestUrl = new URL(req.url ?? '', 'http://localhost');
            const appId = requestUrl.searchParams.get('appId') ?? '';
            const accessToken = requestUrl.searchParams.get('accessToken') ?? '';
            const resourceId = requestUrl.searchParams.get('resourceId') ?? 'volc.bigasr.sauc.duration';
            const connectId = requestUrl.searchParams.get('connectId') ?? crypto.randomUUID();

            proxyReq.setHeader('X-Api-App-Key', appId);
            proxyReq.setHeader('X-Api-Access-Key', accessToken);
            proxyReq.setHeader('X-Api-Resource-Id', resourceId);
            proxyReq.setHeader('X-Api-Connect-Id', connectId);
            proxyReq.path = '/api/v3/sauc/bigmodel';
          });
        },
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});

async function readJsonBody(req: NodeJS.ReadableStream): Promise<any> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

async function callMiMoAsr(body: any): Promise<string> {
  const apiKey = String(body.apiKey || '').trim();
  const audioBase64 = String(body.audioBase64 || '').trim();
  if (!apiKey || !audioBase64) throw new Error('Missing MiMo API key or audio data');
  const baseUrl = String(body.baseUrl || 'https://api.xiaomimimo.com/v1').replace(/\/+$/, '');
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: body.model || 'mimo-v2.5-asr',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'input_audio',
              input_audio: {
                data: `data:audio/wav;base64,${audioBase64}`,
              },
            },
          ],
        },
      ],
      language: body.language || 'auto',
      stream: false,
    }),
  });
  const data: any = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || data?.message || `MiMo API 返回 ${response.status}`);
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    return content.map((item) => item?.text || item?.content || '').filter(Boolean).join('').trim();
  }
  return '';
}
