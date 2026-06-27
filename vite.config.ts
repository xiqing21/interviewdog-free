import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
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
