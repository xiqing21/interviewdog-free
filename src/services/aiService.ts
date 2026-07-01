/**
 * AI 服务层 — 统一使用 OpenAI 兼容格式调用 AI API
 *
 * 核心功能：
 * 1. chat() — 文本对话，支持流式 SSE 响应
 * 2. visionChat() — 视觉对话（截图解题），发送图片+提示词
 * 3. testConnection() — 连接测试，验证 API Key 和 Base URL 是否有效
 *
 * 支持任何兼容 OpenAI Chat Completions 格式的服务商（OpenAI / Anthropic / 自定义中转）。
 */

import type {
  AISettings,
  ChatMessage,
  ChatMessageContentPart,
  ConnectionTestResult,
  ExamType,
} from '../types';
import { EXAM_TYPES } from '../constants';
import { deobfuscate } from './cryptoService';
import { API_TIMEOUT_MS, STREAM_TIMEOUT_MS } from '../constants';
import { COMMERCIAL_MODE } from '../config/commercial';

/**
 * 从设置中解混淆 API Key
 */
function getApiKey(settings: AISettings): string {
  return deobfuscate(settings.apiKey);
}

/**
 * 构建 API 请求头
 */
function buildHeaders(apiKey: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };
}

/**
 * 构建完整的 API 端点 URL（拼接 /chat/completions）
 */
function buildEndpoint(baseUrl: string): string {
  const normalized = baseUrl.replace(/\/+$/, ''); // 去除尾部斜杠
  return `${normalized}/chat/completions`;
}

/**
 * 解析 SSE 流，逐行提取 AI 返回的内容增量
 * @param body - fetch 响应的 ReadableStream
 * @param onChunk - 每收到一段文本时的回调函数
 */
async function parseSSEStream(
  body: ReadableStream<Uint8Array>,
  onChunk: (text: string) => void,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // 按换行符分割，处理完整的行
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? ''; // 最后一行可能不完整，留到下次处理

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;

        const data = trimmed.slice(5).trim();
        if (data === '[DONE]') return; // 流结束标记

        try {
          const json = JSON.parse(data);
          // 提取增量内容
          const delta = json?.choices?.[0]?.delta?.content;
          if (typeof delta === 'string' && delta.length > 0) {
            onChunk(delta);
          }
        } catch {
          // 忽略格式错误的 JSON 行（流式传输中可能出现）
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * 文本对话 — 用于面试辅助模式
 * @param messages - 聊天消息数组（system/user/assistant）
 * @param settings - AI 配置（含 API Key、模型等）
 * @param onChunk - 流式回调，若提供且 settings.streaming 为 true 则启用流式
 * @returns 完整的回答文本
 * @throws 请求失败时抛出中文友好错误
 */
export async function chat(
  messages: ChatMessage[],
  settings: AISettings,
  onChunk?: (text: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  if (COMMERCIAL_MODE) {
    return serverManagedChat(messages, settings.streaming, 'text', onChunk, signal);
  }

  const apiKey = getApiKey(settings);
  if (!apiKey) {
    throw new Error('请先在设置中配置 API Key。');
  }

  const endpoint = buildEndpoint(settings.baseUrl);
  const headers = buildHeaders(apiKey);
  const useStreaming = settings.streaming && typeof onChunk === 'function';
  const model = settings.textModel || 'gpt-4o';

  const requestBody = {
    model,
    messages,
    stream: useStreaming,
  };

  // 发起请求
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
      signal: signal ?? AbortSignal.timeout(
        useStreaming ? STREAM_TIMEOUT_MS : API_TIMEOUT_MS,
      ),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new Error('请求超时，请检查网络连接或稍后重试。');
    }
    throw new Error(
      `网络请求失败：${error instanceof Error ? error.message : '未知错误'}`,
    );
  }

  // 处理错误响应
  if (!response.ok) {
    let errorMsg = `API 返回错误 (${response.status})`;
    try {
      const errorBody = await response.json();
      if (errorBody?.error?.message) {
        errorMsg = `API 错误：${errorBody.error.message}`;
      }
    } catch {
      // 响应体不是 JSON，使用通用错误信息
    }
    throw new Error(errorMsg);
  }

  // 流式响应处理
  if (useStreaming && response.body) {
    let fullText = '';
    await parseSSEStream(response.body, (chunk) => {
      fullText += chunk;
      onChunk!(chunk);
    });
    return fullText;
  }

  // 非流式响应处理
  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') {
    throw new Error('API 返回了无效的响应格式。');
  }

  if (onChunk) {
    onChunk(content);
  }
  return content;
}

/**
 * 视觉对话 — 用于笔试辅助模式，发送截图让 AI 识别并解答
 * @param imageBase64 - Base64 编码的图片（不含 data URI 前缀）
 * @param examType - 题型（代码题/选择题/读图题/逻辑推理/英语题）
 * @param settings - AI 配置
 * @param onChunk - 流式回调
 * @returns 完整的解答文本
 * @throws 请求失败时抛出中文友好错误
 */
export async function visionChat(
  imageBase64: string,
  examType: ExamType,
  settings: AISettings,
  onChunk?: (text: string) => void,
): Promise<string> {
  if (COMMERCIAL_MODE) {
    const examConfig = EXAM_TYPES.find((e) => e.key === examType);
    if (!examConfig) {
      throw new Error(`未知的题型：${examType}`);
    }
    const userPrompt = `${settings.examSystemPrompt}\n\n${examConfig.prompt}`;
    const dataUrl = `data:image/png;base64,${imageBase64}`;
    return serverManagedChat([
      {
        role: 'user',
        content: [
          { type: 'text', text: userPrompt },
          { type: 'image_url', image_url: { url: dataUrl } },
        ] as ChatMessageContentPart[],
      },
    ], settings.streaming, 'vision', onChunk);
  }

  const apiKey = getApiKey(settings);
  if (!apiKey) {
    throw new Error('请先在设置中配置 API Key。');
  }

  // 根据题型获取对应的提示词
  const examConfig = EXAM_TYPES.find((e) => e.key === examType);
  if (!examConfig) {
    throw new Error(`未知的题型：${examType}`);
  }

  // 构建用户消息：系统提示词 + 题型提示词 + 图片
  const userPrompt = `${settings.examSystemPrompt}\n\n${examConfig.prompt}`;
  const dataUrl = `data:image/png;base64,${imageBase64}`;

  const messages: ChatMessage[] = [
    {
      role: 'user',
      content: [
        { type: 'text', text: userPrompt },
        { type: 'image_url', image_url: { url: dataUrl } },
      ] as ChatMessageContentPart[],
    },
  ];

  const endpoint = buildEndpoint(settings.baseUrl);
  const headers = buildHeaders(apiKey);
  const useStreaming = settings.streaming && typeof onChunk === 'function';
  const model = settings.visionModel || settings.textModel || 'gpt-4o';

  const requestBody = {
    model,
    messages,
    stream: useStreaming,
    max_tokens: 4096,
  };

  // 发起请求
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(
        useStreaming ? STREAM_TIMEOUT_MS : API_TIMEOUT_MS,
      ),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new Error('请求超时，请检查网络连接或稍后重试。');
    }
    throw new Error(
      `网络请求失败：${error instanceof Error ? error.message : '未知错误'}`,
    );
  }

  // 处理错误响应
  if (!response.ok) {
    let errorMsg = `API 返回错误 (${response.status})`;
    try {
      const errorBody = await response.json();
      if (errorBody?.error?.message) {
        errorMsg = `API 错误：${errorBody.error.message}`;
      }
    } catch {
      // 响应体不是 JSON
    }
    throw new Error(errorMsg);
  }

  // 流式响应处理
  if (useStreaming && response.body) {
    let fullText = '';
    await parseSSEStream(response.body, (chunk) => {
      fullText += chunk;
      onChunk!(chunk);
    });
    return fullText;
  }

  // 非流式响应处理
  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') {
    throw new Error('API 返回了无效的响应格式。');
  }

  if (onChunk) {
    onChunk(content);
  }
  return content;
}

async function serverManagedChat(
  messages: ChatMessage[],
  stream: boolean,
  modelType: 'text' | 'vision',
  onChunk?: (text: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const useStreaming = stream && typeof onChunk === 'function';
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, stream: useStreaming, modelType }),
    signal: signal ?? AbortSignal.timeout(useStreaming ? STREAM_TIMEOUT_MS : API_TIMEOUT_MS),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error ?? `AI 服务暂时不可用 (${response.status})`);
  }

  if (useStreaming && response.body) {
    let fullText = '';
    await parseSSEStream(response.body, (chunk) => {
      fullText += chunk;
      onChunk?.(chunk);
    });
    return fullText;
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') {
    throw new Error('AI 服务返回了无效响应。');
  }
  onChunk?.(content);
  return content;
}

/**
 * 连接测试 — 发送一个最小请求验证 API 配置是否正确
 * @param settings - AI 配置
 * @returns 测试结果（成功/失败 + 延迟 + 消息）
 */
export async function testConnection(
  settings: AISettings,
): Promise<ConnectionTestResult> {
  const apiKey = getApiKey(settings);
  if (!apiKey) {
    return {
      success: false,
      message: '未配置 API Key，请先填写。',
    };
  }

  const endpoint = buildEndpoint(settings.baseUrl);
  const headers = buildHeaders(apiKey);
  const model = settings.textModel || 'gpt-4o';

  // 发送一个最简请求（"Hi"，最多 5 token）
  const requestBody = {
    model,
    messages: [{ role: 'user', content: 'Hi' }] as ChatMessage[],
    max_tokens: 5,
    stream: false,
  };

  const startTime = performance.now();

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });

    const latency = Math.round(performance.now() - startTime);

    if (response.ok) {
      return {
        success: true,
        message: `连接成功！延迟 ${latency}ms`,
        latency,
      };
    }

    let errorMsg = `HTTP ${response.status}`;
    try {
      const errorBody = await response.json();
      if (errorBody?.error?.message) {
        errorMsg = errorBody.error.message;
      }
    } catch {
      // 非 JSON 响应
    }

    return {
      success: false,
      message: `连接失败：${errorMsg}`,
      latency,
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      return {
        success: false,
        message: '连接超时，请检查网络或 Base URL 是否正确。',
      };
    }
    return {
      success: false,
      message: `连接失败：${error instanceof Error ? error.message : '未知错误'}`,
    };
  }
}
