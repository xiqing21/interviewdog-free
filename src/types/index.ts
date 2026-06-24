/**
 * 全局 TypeScript 类型定义 — 面试狗免费版 v2
 */

// ===== AI 服务商类型（v2 扩展国内厂商） =====
export type AIProvider =
  | 'openai'
  | 'anthropic'
  | 'doubao'
  | 'deepseek'
  | 'zhipu'
  | 'moonshot'
  | 'qwen'
  | 'custom';

// ===== 语音识别服务商 =====
export type ASRProvider = 'browser' | 'doubao';

// ===== 音频源类型 =====
export type AudioSource = 'system' | 'microphone';

// ===== 面试回答模式 =====
export type AnswerMode = 'concise' | 'detailed';

// ===== 笔试题型类型 =====
export type ExamType = 'coding' | 'choice' | 'chart' | 'logic' | 'english';

// ===== 主题模式类型 =====
export type ThemeMode = 'dark' | 'light';

// ===== 语言类型 =====
export type Language = 'zh' | 'en';

// ===== AI 配置接口（v2 扩展） =====
export interface AISettings {
  provider: AIProvider;
  apiKey: string;
  baseUrl: string;
  textModel: string;
  visionModel: string;
  streaming: boolean;
  interviewSystemPrompt: string;
  examSystemPrompt: string;
  contextWindowSize: number;
}

// ===== 豆包语音识别配置 =====
export interface DoubaoASRConfig {
  appId: string;
  accessToken: string;
  cluster: string;
}

// ===== 应用设置接口（v2 扩展） =====
export interface AppSettings {
  theme: ThemeMode;
  language: Language;
  privacyAcknowledged: boolean;
  asrProvider: ASRProvider;
  audioSource: AudioSource;
  defaultAnswerMode: AnswerMode;
  mergeTimeoutMs: number;
}

// ===== 简历与JD数据 =====
export interface ResumeJDData {
  resume: string;
  jd: string;
}

// ===== 模型信息（来自 /v1/models API） =====
export interface ModelInfo {
  id: string;
  object: string;
  created: number;
  owned_by: string;
}

// ===== 面试项目（Session） =====
export interface InterviewSession {
  id: string;
  name: string;
  createdAt: number;
  qaList: QAItem[];
  answerMode: AnswerMode;
  resume?: string;
  jd?: string;
}

// ===== 面试项目摘要（列表用） =====
export interface SessionSummary {
  id: string;
  name: string;
  createdAt: number;
  qaCount: number;
}

// ===== 问答条目 =====
export interface QAItem {
  id: string;
  question: string;
  answer: string;
  timestamp: number;
  isStreaming: boolean;
  error?: string;
}

// ===== 笔试记录条目 =====
export interface ExamRecord {
  id: string;
  imageBase64: string;
  examType: ExamType;
  answer: string;
  timestamp: number;
  isStreaming: boolean;
  error?: string;
}

// ===== 聊天消息 =====
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

// ===== 模型发现结果 =====
export interface ModelDiscoveryResult {
  success: boolean;
  models: ModelInfo[];
  error?: string;
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
  label: string;
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

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  }
}
