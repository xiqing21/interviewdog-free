import { createServer } from 'node:http';
import type { IncomingMessage } from 'node:http';
import WebSocket, { WebSocketServer } from 'ws';

const UPSTREAM_URL = 'wss://openspeech.bytedance.com/api/v3/sauc/bigmodel';
const DEFAULT_RESOURCE_ID = 'volc.bigasr.sauc.duration';

function getParam(request: IncomingMessage, key: string): string {
  const requestUrl = new URL(request.url ?? '/', 'https://localhost');
  return requestUrl.searchParams.get(key) ?? '';
}

function closePair(client: WebSocket, upstream?: WebSocket): void {
  if (client.readyState === WebSocket.OPEN || client.readyState === WebSocket.CONNECTING) {
    client.close();
  }
  if (upstream && (upstream.readyState === WebSocket.OPEN || upstream.readyState === WebSocket.CONNECTING)) {
    upstream.close();
  }
}

const server = createServer((_, response) => {
  response.writeHead(426, { 'Content-Type': 'text/plain; charset=utf-8' });
  response.end('WebSocket upgrade required');
});

const wss = new WebSocketServer({ server });

wss.on('connection', (client, request) => {
  const appId = getParam(request, 'appId');
  const accessToken = getParam(request, 'accessToken');
  const resourceId = getParam(request, 'resourceId') || DEFAULT_RESOURCE_ID;
  const connectId = getParam(request, 'connectId') || crypto.randomUUID();
  const pendingClientMessages: Array<{ data: WebSocket.RawData; isBinary: boolean }> = [];

  if (!appId || !accessToken) {
    client.close(1008, 'Missing Doubao ASR credentials');
    return;
  }

  const upstream = new WebSocket(UPSTREAM_URL, {
    headers: {
      'X-Api-App-Key': appId,
      'X-Api-Access-Key': accessToken,
      'X-Api-Resource-Id': resourceId,
      'X-Api-Connect-Id': connectId,
      'X-Api-Request-Id': connectId,
      'X-Api-Sequence': '-1',
    },
  });

  client.on('message', (data, isBinary) => {
    if (upstream.readyState === WebSocket.OPEN) {
      upstream.send(data, { binary: isBinary });
      return;
    }

    if (upstream.readyState === WebSocket.CONNECTING) {
      pendingClientMessages.push({ data, isBinary });
      if (pendingClientMessages.length > 200) {
        closePair(client, upstream);
      }
    }
  });

  upstream.on('open', () => {
    while (pendingClientMessages.length > 0 && upstream.readyState === WebSocket.OPEN) {
      const message = pendingClientMessages.shift();
      if (message) {
        upstream.send(message.data, { binary: message.isBinary });
      }
    }
  });

  upstream.on('message', (data, isBinary) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data, { binary: isBinary });
    }
  });

  upstream.on('unexpected-response', (_request, response) => {
    let body = '';
    response.setEncoding('utf8');
    response.on('data', (chunk: string) => {
      body += chunk;
    });
    response.on('end', () => {
      const message = `Upstream handshake failed ${response.statusCode}: ${body.slice(0, 180) || response.statusMessage || 'no response body'}`;
      if (client.readyState === WebSocket.OPEN || client.readyState === WebSocket.CONNECTING) {
        client.close(1011, message);
      }
    });
  });

  client.on('close', () => closePair(client, upstream));
  client.on('error', () => closePair(client, upstream));
  upstream.on('close', (code, reason) => {
    if (client.readyState === WebSocket.OPEN || client.readyState === WebSocket.CONNECTING) {
      client.close(code || 1011, reason.toString() || 'Doubao upstream closed');
    }
    closePair(client, upstream);
  });
  upstream.on('error', (error) => {
    if (client.readyState === WebSocket.OPEN || client.readyState === WebSocket.CONNECTING) {
      client.close(1011, error instanceof Error ? error.message : 'Doubao upstream error');
    }
    closePair(client, upstream);
  });
});

export default server;
