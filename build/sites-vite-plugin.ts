import { mkdir, rm, writeFile, access, cp } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/** Adds the Sites metadata and a Cloudflare static-assets Worker entrypoint. */
export function sites(): Plugin {
  let root = process.cwd();
  return {
    name: 'sites-static-assets',
    apply: 'build',
    configResolved(config) {
      root = config.root;
    },
    async closeBundle() {
      const serverDirectory = resolve(root, 'dist/server');
      const openaiDirectory = resolve(root, 'dist/.openai');
      await rm(serverDirectory, { recursive: true, force: true });
      await rm(openaiDirectory, { recursive: true, force: true });
      await mkdir(serverDirectory, { recursive: true });
      await mkdir(openaiDirectory, { recursive: true });
      await writeFile(
        resolve(serverDirectory, 'index.js'),
        `export default {\n  async fetch(request, env) {\n    const url = new URL(request.url);\n    const upgrade = request.headers.get('Upgrade');\n    if (url.pathname === '/api/asr-gateway' && upgrade?.toLowerCase() === 'websocket') {\n      const gatewayUrl = new URL('https://bwg.yihan.me/api/asr-gateway');\n      return fetch(new Request(gatewayUrl, request));\n    }\n    if (url.pathname.startsWith('/api/')) {\n      const backendUrl = new URL(request.url);\n      backendUrl.protocol = 'https:';\n      backendUrl.hostname = 'mianshizhu.xyz';\n      backendUrl.port = '';\n      return fetch(new Request(backendUrl, request));\n    }\n    const response = await env.ASSETS.fetch(request);\n    if (response.status !== 404 || request.method !== 'GET') return response;\n    const fallbackUrl = new URL('/index.html', request.url);\n    return env.ASSETS.fetch(new Request(fallbackUrl, request));\n  },\n};\n`,
        'utf8',
      );
      const hostingConfig = resolve(root, '.openai/hosting.json');
      if (await exists(hostingConfig)) await cp(hostingConfig, resolve(openaiDirectory, 'hosting.json'));
      const drizzle = resolve(root, 'drizzle');
      if (await exists(drizzle)) await cp(drizzle, resolve(openaiDirectory, 'drizzle'), { recursive: true });
    },
  };
}
