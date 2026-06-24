/**
 * 全局常量定义 — 面试狗免费版 v2
 */

import type {
  AISettings,
  AppSettings,
  ExamTypeConfig,
  ProviderDefault,
  AIProvider,
  DoubaoASRConfig,
} from '../types';

// ===== localStorage 存储键名 =====
export const STORAGE_KEYS = {
  AI_SETTINGS: 'interviewdog_ai_settings',
  APP_SETTINGS: 'interviewdog_app_settings',
  QA_LIST: 'interviewdog_qa_list',
  EXAM_RECORDS: 'interviewdog_exam_records',
  DOUBAO_ASR_CONFIG: 'interviewdog_doubao_asr',
  SESSIONS: 'interviewdog_sessions',
  ACTIVE_SESSION_ID: 'interviewdog_active_session',
  RESUME_JD: 'interviewdog_resume_jd',
} as const;

// ===== 系统提示词 =====

/** 面试辅助默认提示词 — 简洁模式 */
export const DEFAULT_INTERVIEW_PROMPT_CONCISE =
  '你是一位资深面试助手。请用1-2句话简洁有力地回答面试官的问题，直击要点。';

/** 面试辅助默认提示词 — 详细模式 */
export const DEFAULT_INTERVIEW_PROMPT_DETAILED =
  '你是一位资深技术面试助手。请详细、准确、条理清晰地回答面试官的问题，适当给出代码示例或实践案例。';

/** 笔试辅助默认提示词 */
export const DEFAULT_EXAM_PROMPT =
  '你是一位笔试解题专家。请仔细分析图片中的题目，给出准确的解答。对于代码题，给出完整可运行的代码；对于选择题，给出答案和解析；对于逻辑推理题，给出推理过程。';

// v2 兼容旧常量
export const DEFAULT_INTERVIEW_PROMPT = DEFAULT_INTERVIEW_PROMPT_CONCISE;

// ===== 简历+JD 注入模板 =====
export const RESUME_JD_PROMPT_TEMPLATE = `
## 求职者背景
简历内容：
{resume}

## 应聘岗位
岗位描述(JD)：
{jd}

请根据以上求职者的简历背景和岗位要求，结合面试官的问题，给出有针对性的回答。
`.trim();

// ===== 题型配置 =====
export const EXAM_TYPES: ExamTypeConfig[] = [
  { key: 'coding', label: '代码题', icon: 'Code', prompt: '请分析这道编程题，给出最优解法的完整代码，附带时间复杂度和空间复杂度分析。', color: '#6c63ff' },
  { key: 'choice', label: '选择题', icon: 'CheckCircle', prompt: '请分析这道选择题，给出正确答案并解释每个选项的对错原因。', color: '#00d4ff' },
  { key: 'chart', label: '读图题', icon: 'BarChart', prompt: '请仔细分析图片中的图表或图形，描述其内容并回答相关问题。', color: '#4caf50' },
  { key: 'logic', label: '逻辑推理', icon: 'Psychology', prompt: '请逐步分析这道逻辑推理题，给出推理过程和最终答案。', color: '#ff9800' },
  { key: 'english', label: '英语题', icon: 'Translate', prompt: '请分析这道英语题目，给出答案和详细解析。', color: '#e91e63' },
];

// ===== 服务商默认配置（v2 扩展国内厂商） =====
export const PROVIDER_DEFAULTS: Record<AIProvider, ProviderDefault> = {
  openai:    { baseUrl: 'https://api.openai.com/v1',            textModel: 'gpt-4o',              visionModel: 'gpt-4o',              label: 'OpenAI' },
  anthropic: { baseUrl: 'https://api.anthropic.com/v1',         textModel: 'claude-sonnet-4-20250514', visionModel: 'claude-sonnet-4-20250514', label: 'Anthropic' },
  doubao:    { baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', textModel: 'doubao-pro-32k', visionModel: 'doubao-vision-pro-32k', label: '豆包 (火山引擎)' },
  deepseek:  { baseUrl: 'https://api.deepseek.com/v1',         textModel: 'deepseek-chat',       visionModel: 'deepseek-chat',        label: 'DeepSeek' },
  zhipu:     { baseUrl: 'https://open.bigmodel.cn/api/paas/v4', textModel: 'glm-4-plus',        visionModel: 'glm-4v-plus',          label: '智谱 GLM' },
  moonshot:  { baseUrl: 'https://api.moonshot.cn/v1',          textModel: 'moonshot-v1-8k',      visionModel: 'moonshot-v1-8k-vision', label: 'Moonshot' },
  qwen:      { baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', textModel: 'qwen-plus', visionModel: 'qwen-vl-plus', label: '通义千问' },
  custom:    { baseUrl: '',                                    textModel: '',                    visionModel: '',                     label: '自定义' },
};

// ===== 服务商排序（国内优先） =====
export const PROVIDER_ORDER: AIProvider[] = [
  'doubao', 'deepseek', 'zhipu', 'moonshot', 'qwen', 'openai', 'anthropic', 'custom',
];

// ===== 回答模式配置 =====
export const ANSWER_MODES = [
  { key: 'concise' as const, label: '简洁模式', desc: '1-2句话，直击要点', prompt: DEFAULT_INTERVIEW_PROMPT_CONCISE },
  { key: 'detailed' as const, label: '详细模式', desc: '完整分析 + 代码示例', prompt: DEFAULT_INTERVIEW_PROMPT_DETAILED },
];

// ===== 音频源配置 =====
export const AUDIO_SOURCES = [
  { key: 'system' as const, label: '系统音频', desc: '捕获会议软件中面试官的声音（需 Chrome 分享标签页音频）' },
  { key: 'microphone' as const, label: '麦克风', desc: '捕获麦克风输入的语音' },
];

// ===== 豆包 ASR 默认配置 =====
export const DEFAULT_DOUBAO_ASR_CONFIG: DoubaoASRConfig = {
  appId: '',
  accessToken: '',
  cluster: 'volcengine_input_common',
};

// 豆包 ASR WebSocket 地址
export const DOUBAO_ASR_WS_URL = 'wss://openspeech.bytedance.com/api/v2/asr';

// ===== 默认 AI 配置 =====
export const DEFAULT_AI_SETTINGS: AISettings = {
  provider: 'openai',
  apiKey: '',
  baseUrl: 'https://api.openai.com/v1',
  textModel: 'gpt-4o',
  visionModel: 'gpt-4o',
  streaming: true,
  interviewSystemPrompt: DEFAULT_INTERVIEW_PROMPT_CONCISE,
  examSystemPrompt: DEFAULT_EXAM_PROMPT,
  contextWindowSize: 5,
};

// ===== 默认应用设置 =====
export const DEFAULT_APP_SETTINGS: AppSettings = {
  theme: 'dark',
  language: 'zh',
  privacyAcknowledged: false,
  asrProvider: 'browser',
  audioSource: 'system',
  defaultAnswerMode: 'concise',
  mergeTimeoutMs: 1500,
};

// ===== 默认简历JD数据 =====
export const DEFAULT_RESUME_JD = { resume: '', jd: '' };

// ===== 业务常量 =====
export const MAX_EXAM_RECORDS = 50;
export const STREAM_TIMEOUT_MS = 120_000;
export const API_TIMEOUT_MS = 30_000;
export const MAX_SESSIONS = 20;
export const MERGE_TIMEOUT_DEFAULT = 1500;

// ===== 左侧导航菜单项 =====
export const NAV_ITEMS = [
  { path: '/interview', label: '面试辅助', icon: 'RecordVoiceOver' },
  { path: '/exam', label: '笔试辅助', icon: 'EditNote' },
  { path: '/settings', label: '设置', icon: 'Settings' },
] as const;
