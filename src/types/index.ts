/**
 * 全局 TypeScript 类型定义 — 面试狗免费版
 *
 * 定义了 AI 配置、面试记录、笔试记录、聊天消息等核心数据结构。
 */

// ===== AI 服务商类型 =====
export type AIProvider = 'openai' | 'anthropic' | 'custom';

// ===== 笔试题型类型 =====
export type ExamType = 'coding' | 'choice' | 'chart' | 'logic' | 'english';

// ===== 主题模式类型 =====
export type ThemeMode = 'dark' | 'light';

// ===== 语言类型 =====
export type Language = 'zh' | 'en';

// ===== AI 配置接口 =====
export interface AISettings {
  /** AI 服务商（openai / anthropic / 自定义） */
  provider: AIProvider;
  /** API 密钥（存储时经过混淆处理） */
  apiKey: string;
  /** API 请求的基础 URL */
  baseUrl: string;
  /** 文本模型标识符（用于面试辅助） */
  textModel: string;
  /** 视觉模型标识符（用于笔试辅助截图识别） */
  visionModel: string;
  /** 是否启用流式响应（SSE） */
  streaming: boolean;
  /** 面试模式的系统提示词 */
  interviewSystemPrompt: string;
  /** 笔试模式的系统提示词 */
  examSystemPrompt: string;
  /** 上下文窗口大小：携带最近 N 轮问答作为上下文 */
  contextWindowSize: number;
}

// ===== 应用设置接口 =====
export interface AppSettings {
  /** UI 主题模式（暗色/亮色） */
  theme: ThemeMode;
  /** 界面语言 */
  language: Language;
  /** 用户是否已确认隐私声明 */
  privacyAcknowledged: boolean;
}

// ===== 问答条目（面试辅助） =====
export interface QAItem {
  /** 唯一标识符 */
  id: string;
  /** 问题文本 */
  question: string;
  /** 回答文本（流式输出时可能是不完整的） */
  answer: string;
  /** Unix 时间戳（毫秒） */
  timestamp: number;
  /** 回答是否正在流式输出中 */
  isStreaming: boolean;
  /** 请求失败时的错误信息 */
  error?: string;
}

// ===== 笔试记录条目 =====
export interface ExamRecord {
  /** 唯一标识符 */
  id: string;
  /** Base64 编码的图片数据（不含 data URI 前缀） */
  imageBase64: string;
  /** 题型 */
  examType: ExamType;
  /** 解答文本（流式输出时可能是不完整的） */
  answer: string;
  /** Unix 时间戳（毫秒） */
  timestamp: number;
  /** 解答是否正在流式输出中 */
  isStreaming: boolean;
  /** 请求失败时的错误信息 */
  error?: string;
}

// ===== 聊天消息（兼容 OpenAI 格式） =====
export interface ChatMessageContentPart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string };
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | ChatMessageContentPart[];
}

// ===== 连接测试结果 =====
export interface ConnectionTestResult {
  success: boolean;
  message: string;
  latency?: number;
}

// ===== 题型配置 =====
export interface ExamTypeConfig {
  key: ExamType;
  label: string;
  icon: string;
  prompt: string;
  color: string;
}

// ===== 服务商默认配置 =====
export interface ProviderDefault {
  baseUrl: string;
  textModel: string;
  visionModel: string;
}

// ===== 语音识别类型（Web Speech API） =====
export interface SpeechRecognitionResultlike {
  isFinal: boolean;
  0: { transcript: string };
}

export interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultlike;
  };
}

export interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

// 扩展 Window 接口，声明 Web Speech API 构造函数
declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  }
}
