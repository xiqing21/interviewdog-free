/**
 * 全局常量定义 — 面试狗免费版
 *
 * 包含 localStorage 键名、默认系统提示词、题型配置、服务商默认配置、
 * 默认 AI/应用设置、导航菜单项等常量。
 */

import type {
  AISettings,
  AppSettings,
  ExamTypeConfig,
  ProviderDefault,
  AIProvider,
} from '../types';

// ===== localStorage 存储键名 =====
export const STORAGE_KEYS = {
  AI_SETTINGS: 'interviewdog_ai_settings',   // AI 配置
  APP_SETTINGS: 'interviewdog_app_settings', // 应用设置
  QA_LIST: 'interviewdog_qa_list',           // 面试问答历史
  EXAM_RECORDS: 'interviewdog_exam_records', // 笔试记录历史
} as const;

// ===== 默认系统提示词 =====

/** 面试辅助默认提示词 */
export const DEFAULT_INTERVIEW_PROMPT =
  '你是一位资深技术面试助手。请简洁、准确地回答面试官的问题。回答要条理清晰，重点突出，适当给出代码示例。';

/** 笔试辅助默认提示词 */
export const DEFAULT_EXAM_PROMPT =
  '你是一位笔试解题专家。请仔细分析图片中的题目，给出准确的解答。对于代码题，给出完整可运行的代码；对于选择题，给出答案和解析；对于逻辑推理题，给出推理过程。';

// ===== 题型配置（每种题型的提示词和颜色） =====
export const EXAM_TYPES: ExamTypeConfig[] = [
  {
    key: 'coding',
    label: '代码题',
    icon: 'Code',
    prompt: '请分析这道编程题，给出最优解法的完整代码，附带时间复杂度和空间复杂度分析。',
    color: '#6c63ff',
  },
  {
    key: 'choice',
    label: '选择题',
    icon: 'CheckCircle',
    prompt: '请分析这道选择题，给出正确答案并解释每个选项的对错原因。',
    color: '#00d4ff',
  },
  {
    key: 'chart',
    label: '读图题',
    icon: 'BarChart',
    prompt: '请仔细分析图片中的图表或图形，描述其内容并回答相关问题。',
    color: '#4caf50',
  },
  {
    key: 'logic',
    label: '逻辑推理',
    icon: 'Psychology',
    prompt: '请逐步分析这道逻辑推理题，给出推理过程和最终答案。',
    color: '#ff9800',
  },
  {
    key: 'english',
    label: '英语题',
    icon: 'Translate',
    prompt: '请分析这道英语题目，给出答案和详细解析。',
    color: '#e91e63',
  },
];

// ===== 各服务商的默认配置（切换 Provider 时自动填充） =====
export const PROVIDER_DEFAULTS: Record<AIProvider, ProviderDefault> = {
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    textModel: 'gpt-4o',
    visionModel: 'gpt-4o',
  },
  anthropic: {
    baseUrl: 'https://api.anthropic.com/v1',
    textModel: 'claude-sonnet-4-20250514',
    visionModel: 'claude-sonnet-4-20250514',
  },
  custom: {
    baseUrl: '',
    textModel: '',
    visionModel: '',
  },
};

// ===== 默认 AI 配置 =====
export const DEFAULT_AI_SETTINGS: AISettings = {
  provider: 'openai',
  apiKey: '',
  baseUrl: 'https://api.openai.com/v1',
  textModel: 'gpt-4o',
  visionModel: 'gpt-4o',
  streaming: true,
  interviewSystemPrompt: DEFAULT_INTERVIEW_PROMPT,
  examSystemPrompt: DEFAULT_EXAM_PROMPT,
  contextWindowSize: 5, // 默认携带最近 5 轮问答作为上下文
};

// ===== 默认应用设置 =====
export const DEFAULT_APP_SETTINGS: AppSettings = {
  theme: 'dark',
  language: 'zh',
  privacyAcknowledged: false,
};

// ===== 业务常量 =====
export const MAX_EXAM_RECORDS = 50;       // 笔试历史最大保存条数
export const STREAM_TIMEOUT_MS = 120_000; // 流式请求超时时间（2分钟）
export const API_TIMEOUT_MS = 30_000;     // 普通请求超时时间（30秒）

// ===== 左侧导航菜单项 =====
export const NAV_ITEMS = [
  { path: '/interview', label: '面试辅助', icon: 'RecordVoiceOver' },
  { path: '/exam', label: '笔试辅助', icon: 'EditNote' },
  { path: '/settings', label: '设置', icon: 'Settings' },
] as const;
