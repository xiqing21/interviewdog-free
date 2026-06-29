import type { WebSearchResult } from '../types';

export async function webSearch(query: string, signal?: AbortSignal): Promise<WebSearchResult[]> {
  const response = await fetch('/api/web-search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
    signal: signal ?? AbortSignal.timeout(12000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || `联网搜索失败：${response.status}`);
  }
  return Array.isArray(data?.results) ? data.results : [];
}
