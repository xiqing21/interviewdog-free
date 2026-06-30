/**
 * 全局 TypeScript 类型定义 — 面试猪 v2
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
export type CloudASRProvider = 'baidu' | 'google' | 'alibaba' | 'iflytek' | 'glm';
export type ASRGatewayProvider = 'gateway-doubao' | 'gateway-iflytek' | 'gateway-alibaba';
export type ASRProvider = 'browser' | 'doubao' | 'openai' | 'local-qwen' | 'mimo' | CloudASRProvider | ASRGatewayProvider;

// ===== 音频源类型 =====
export type AudioSource = 'both' | 'system' | 'microphone';
export type SpeakerAudioSource = 'microphone' | 'system' | 'muted';

// ===== 面试回答模式 =====
export type AnswerMode = 'concise' | 'detailed';

// ===== 笔试题型类型 =====
export type ExamType = 'coding' | 'choice' | 'chart' | 'logic' | 'english';

// ===== 主题模式类型 =====
export type ThemeMode = 'dark' | 'light' | 'clay' | 'midnight' | 'forest' | 'mono';

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
  resourceId: string;
}

export interface LocalQwenASRConfig {
  endpoint: string;
  model: string;
  hotwords: string;
}

export interface MiMoASRConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  language: 'auto' | 'zh' | 'en';
  chunkMs: number;
}

export interface CloudASRConfig {
  chunkMs: number;
  language: string;
  hotwords: string;
  baiduApiKey: string;
  baiduSecretKey: string;
  googleApiKey: string;
  alibabaAppKey: string;
  alibabaToken: string;
  alibabaEndpoint: string;
  iflytekAppId: string;
  iflytekApiKey: string;
  iflytekApiSecret: string;
  glmApiKey: string;
  glmBaseUrl: string;
  glmModel: string;
}

// ===== 应用设置接口（v2 扩展） =====
export interface AppSettings {
  theme: ThemeMode;
  language: Language;
  privacyAcknowledged: boolean;
  asrProvider: ASRProvider;
  audioSource: AudioSource;
  myAudioSource: SpeakerAudioSource;
  interviewerAudioSource: SpeakerAudioSource;
  defaultAnswerMode: AnswerMode;
  mergeTimeoutMs: number;
  webSearchEnabled: boolean;
  asrHotwords: string;
}

// ===== 简历与JD数据 =====
export interface ResumeJDData {
  resume: string;
  jd: string;
}

export interface ResumeLibraryItem {
  id: string;
  name: string;
  content: string;
  tags?: string[];
  createdAt: number;
  updatedAt: number;
}

export interface KnowledgeLibraryItem {
  id: string;
  name: string;
  content: string;
  type?: KnowledgeSourceType;
  sourceUrl?: string;
  qaPairs?: KnowledgeQAPair[];
  tags?: string[];
  createdAt: number;
  updatedAt: number;
}

export type KnowledgeSourceType = 'qa' | 'document' | 'text' | 'webpage';

export interface KnowledgeQAPair {
  id: string;
  question: string;
  answer: string;
}

export interface KnowledgeProfile {
  resumes: ResumeLibraryItem[];
  expertKnowledgeItems: KnowledgeLibraryItem[];
  /** @deprecated Legacy single text knowledge field kept for migration compatibility. */
  expertKnowledge: string;
  updatedAt?: number;
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
  updatedAt?: number;
  archivedAt?: number;
  qaList: QAItem[];
  transcriptLines?: TranscriptLine[];
  review?: InterviewReview;
  answerMode: AnswerMode;
  resume?: string;
  resumeIds?: string[];
  jd?: string;
  targetRole?: string;
  focusAreas?: string[];
  expertKnowledge?: string;
  expertKnowledgeIds?: string[];
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
  searchResults?: WebSearchResult[];
  generationMode?: AnswerGenerationMode;
}

export type AnswerGenerationMode = 'normal' | 'concise' | 'detailed' | 'star' | 'star-no-context';

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface TranscriptLine {
  id: string;
  speaker: 'interviewer' | 'me';
  text: string;
  timestamp: number;
}

export interface InterviewReview {
  summary: string;
  strengths: string[];
  risks: string[];
  followUps: string[];
  generatedAt: number;
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
