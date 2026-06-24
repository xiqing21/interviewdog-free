/**
 * ModelDiscoveryService — 模型列表自动发现服务
 *
 * 调用兼容 OpenAI 格式的 /v1/models（或 /models）接口，
 * 获取用户配置的 API 端点可用的模型列表。
 */

import type { ModelDiscoveryResult, ModelInfo } from '../types';

/**
 * 从指定的 Base URL 拉取可用模型列表。
 * @param baseUrl - API 基础 URL（如 https://api.openai.com/v1）
 * @param apiKey - API 密钥
 * @returns 模型发现结果
 */
export async function discoverModels(
  baseUrl: string,
  apiKey: string,
): Promise<ModelDiscoveryResult> {
  if (!baseUrl || !apiKey) {
    return { success: false, models: [], error: '请先填写 Base URL 和 API Key。' };
  }

  const url = `${baseUrl.replace(/\/$/, '')}/models`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return {
        success: false,
        models: [],
        error: `请求失败：HTTP ${response.status} ${response.statusText}`,
      };
    }

    const data = await response.json();

    // 兼容不同 API 的返回格式
    let modelList: ModelInfo[];
    if (Array.isArray(data.data)) {
      // OpenAI 格式: { data: [...] }
      modelList = data.data;
    } else if (Array.isArray(data)) {
      // 直接返回数组
      modelList = data;
    } else if (Array.isArray(data.models)) {
      // 部分 API 返回 { models: [...] }
      modelList = data.models;
    } else {
      return { success: false, models: [], error: '无法解析模型列表，返回格式不兼容。' };
    }

    // 排序：优先显示 chat/llm/gpt/claude 等模型
    const chatKeywords = ['chat', 'gpt', 'claude', 'llm', 'qwen', 'glm', 'deepseek', 'doubao', 'moonshot'];
    modelList.sort((a, b) => {
      const aScore = chatKeywords.some((k) => a.id.toLowerCase().includes(k)) ? 1 : 0;
      const bScore = chatKeywords.some((k) => b.id.toLowerCase().includes(k)) ? 1 : 0;
      return bScore - aScore || a.id.localeCompare(b.id);
    });

    return { success: true, models: modelList };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return { success: false, models: [], error: '请求超时，请检查 Base URL 是否正确。' };
    }
    const msg = error instanceof Error ? error.message : '未知错误';
    return { success: false, models: [], error: `获取模型列表失败：${msg}` };
  }
}
