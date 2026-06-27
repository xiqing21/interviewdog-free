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
  LOCAL_QWEN_ASR_CONFIG: 'interviewdog_local_qwen_asr',
  SESSIONS: 'interviewdog_sessions',
  ACTIVE_SESSION_ID: 'interviewdog_active_session',
  RESUME_JD: 'interviewdog_resume_jd',
  KNOWLEDGE_PROFILE: 'interviewdog_knowledge_profile',
  LAST_AUTH_EMAIL: 'interviewdog_last_auth_email',
} as const;

// ===== 系统提示词 =====

/** 面试辅助默认提示词 — 简洁模式 */
export const DEFAULT_INTERVIEW_PROMPT_CONCISE =
  '你是一位资深面试助手。请用面试口吻回答，默认控制在 3-5 个要点或 30-60 秒表达内。不要只给一句话；即使是简洁模式，也要完整覆盖结论、关键依据和一个贴合简历/岗位的亮点。';

/** 面试辅助默认提示词 — 详细模式 */
export const DEFAULT_INTERVIEW_PROMPT_DETAILED =
  '你是一位资深技术面试助手。请给出可直接口述的完整回答，通常按「开场结论 → 背景/项目经历 → 技术细节 → 量化结果 → 面试官可能追问」组织。遇到自我介绍、项目介绍、职业规划等开放题时，输出 1.5-3 分钟版本，必须结合简历、岗位方向和考察方向，不要过短。遇到技术题时给出原理、步骤、例子、复杂度/权衡和可追问点。';

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
  { key: 'concise' as const, label: '简洁模式', desc: '3-5个口述要点', prompt: DEFAULT_INTERVIEW_PROMPT_CONCISE },
  { key: 'detailed' as const, label: '详细模式', desc: '展开项目、细节和追问', prompt: DEFAULT_INTERVIEW_PROMPT_DETAILED },
];

// ===== 面试准备预设 =====
export const INTERVIEW_ROLE_PRESETS = [
  {
    key: 'bigdata',
    label: '大数据开发',
    jd: '岗位方向：大数据开发。重点关注 SQL、Hive、Spark、Flink、数据仓库、离线/实时数仓、数据治理、任务调度、性能优化和业务指标理解。',
  },
  {
    key: 'web3',
    label: 'Web3 开发',
    jd: '岗位方向：Web3 开发。重点关注 Solidity、智能合约安全、EVM、钱包连接、链上数据、DeFi、合约事件、RPC、viem/ethers、前后端与链上交互。',
  },
  {
    key: 'backend',
    label: '后端开发',
    jd: '岗位方向：后端开发。重点关注系统设计、数据库、缓存、消息队列、并发、可观测性、稳定性、接口设计和工程实践。',
  },
  {
    key: 'frontend',
    label: '前端开发',
    jd: '岗位方向：前端开发。重点关注 React、TypeScript、性能优化、工程化、状态管理、浏览器原理、组件设计和前端系统设计。',
  },
] as const;

export const INTERVIEW_FOCUS_OPTIONS = [
  'SQL',
  '算法',
  '系统设计',
  '项目深挖',
  '八股基础',
  '业务场景',
  'Web3',
  '大数据',
] as const;

// ===== 音频源配置 =====
export const AUDIO_SOURCES = [
  { key: 'both' as const, label: '双路识别（我 + 面试官）', desc: '同时识别你的麦克风声音和腾讯会议等应用里的系统音频；系统音频会调用 Chrome 的屏幕/窗口/标签页共享音频能力' },
  { key: 'system' as const, label: '系统音频（面试官）', desc: '捕获腾讯会议等会议软件里的面试官声音（需 Chrome 分享标签页/屏幕音频）' },
  { key: 'microphone' as const, label: '麦克风（我的声音）', desc: '捕获你自己的麦克风输入，适合练习或手动口述问题' },
];

export const SPEAKER_AUDIO_SOURCES = [
  { key: 'microphone' as const, label: '麦克风', desc: '使用浏览器麦克风权限，适合识别你自己的声音' },
  { key: 'system' as const, label: '系统音频', desc: '调用 Chrome 屏幕/窗口共享音频，适合识别腾讯会议等软件里的声音' },
  { key: 'muted' as const, label: '静音', desc: '不识别这一侧声音' },
] as const;

// ===== 豆包 ASR 默认配置 =====
export const DEFAULT_DOUBAO_ASR_CONFIG: DoubaoASRConfig = {
  appId: '',
  accessToken: '',
  resourceId: 'volc.bigasr.sauc.duration',
};

export const DEFAULT_LOCAL_QWEN_ASR_CONFIG = {
  endpoint: 'ws://127.0.0.1:8766/ws',
  model: '.models/Qwen3-ASR-1.7B-8bit',
  hotwords: '大数据开发、StarRocks、Flink、Fluss、MLX、量化、湖仓一体',
};

// 豆包 ASR WebSocket 地址
export const DOUBAO_ASR_WS_PATH = '/api/doubao-asr';

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
  audioSource: 'both',
  myAudioSource: 'microphone',
  interviewerAudioSource: 'system',
  defaultAnswerMode: 'concise',
  mergeTimeoutMs: 1500,
  webSearchEnabled: false,
};

// ===== 默认简历JD数据 =====
export const DEFAULT_RESUME_JD = { resume: '', jd: '' };
export const DEFAULT_KNOWLEDGE_PROFILE = { resumes: [], expertKnowledge: '' };

// ===== 业务常量 =====
export const MAX_EXAM_RECORDS = 50;
export const STREAM_TIMEOUT_MS = 120_000;
export const API_TIMEOUT_MS = 30_000;
export const MAX_SESSIONS = 20;
export const MERGE_TIMEOUT_DEFAULT = 1500;

// ===== 左侧导航菜单项 =====
export const NAV_ITEMS = [
  { path: '/interview', label: '面试辅助', icon: 'RecordVoiceOver' },
  { path: '/knowledge', label: '简历与知识库', icon: 'LibraryBooks' },
  { path: '/exam', label: '笔试辅助', icon: 'EditNote' },
  { path: '/settings', label: '设置', icon: 'Settings' },
] as const;
