/**
 * 全局常量定义 — 面试猪 v2
 */

import type {
  AISettings,
  AppSettings,
  ExamTypeConfig,
  ProviderDefault,
  AIProvider,
  DoubaoASRConfig,
  MiMoASRConfig,
  CloudASRConfig,
  ThemeMode,
} from '../types';

// ===== localStorage 存储键名 =====
export const STORAGE_KEYS = {
  AI_SETTINGS: 'interviewdog_ai_settings',
  APP_SETTINGS: 'interviewdog_app_settings',
  QA_LIST: 'interviewdog_qa_list',
  EXAM_RECORDS: 'interviewdog_exam_records',
  DOUBAO_ASR_CONFIG: 'interviewdog_doubao_asr',
  LOCAL_QWEN_ASR_CONFIG: 'interviewdog_local_qwen_asr',
  MIMO_ASR_CONFIG: 'interviewdog_mimo_asr',
  CLOUD_ASR_CONFIG: 'interviewdog_cloud_asr',
  SESSIONS: 'interviewdog_sessions',
  ACTIVE_SESSION_ID: 'interviewdog_active_session',
  RESUME_JD: 'interviewdog_resume_jd',
  KNOWLEDGE_PROFILE: 'interviewdog_knowledge_profile',
  LAST_AUTH_EMAIL: 'interviewdog_last_auth_email',
} as const;

// ===== 系统提示词 =====

/** 面试辅助默认提示词 — 简洁模式 */
export const DEFAULT_INTERVIEW_PROMPT_CONCISE =
  '你是一位资深面试助手。请用面试口吻回答，默认控制在 4-6 个要点或 60-90 秒表达内。不要只给一句话。必须先回答面试官当前问题，再按岗位 JD 的技术栈和职责组织口径；简历只用来举真实例子，不能把简历高频词套到无关问题上。即使是简洁模式，也要覆盖开场结论、关键依据、项目例子、量化结果，以及一个贴合 JD 的亮点。若简历缺少 JD 要求的技能，用相邻经验迁移，不要说“我没做过”。';

/** 面试辅助默认提示词 — 详细模式 */
export const DEFAULT_INTERVIEW_PROMPT_DETAILED =
  '你是一位资深技术面试助手。请给出可直接口述的完整回答。必须先锁定面试官当前问题，再按 JD 口径展开，简历只提供证据。通常按「开场结论 → 背景/项目经历 → 技术细节 → 量化结果 → 面试官可能追问」组织。开放题输出 1.5-3 分钟版本。技术题必须落到原理、数据流、关键 API/伪代码、复杂度/权衡和异常处理，不要只堆概念词。主题切换后禁止沿用上一题的技术点。简历缺 JD 技能时做能力迁移，不要直接否认。';

/** 笔试辅助默认提示词 — 专为混杂桌面截图优化，极速先出核心答案 */
export const DEFAULT_EXAM_PROMPT = `
你是一位顶级技术笔试辅助专家。你的输入是一张屏幕截图（画面中可能混杂有桌面图标、系统任务栏、时间、浏览器标签栏、其他软件窗口等非题目干扰信息）。

【核心原则：智能抗干扰、去伪存真】
1. 忽略干扰：严格忽略桌面壁纸、状态栏时间、任务栏、应用弹窗、浏览器外部边框等一切与试题无关的背景内容。
2. 精准定位：自动锁定屏幕中央或活动窗口中的试题主体（包含题目描述、代码输入输出样例、选择题选项以及图表等）。

【输出格式铁律：必须先给出最终结果/可运行代码，后给分析思路】
为了让考生争分夺秒完成笔试，回答必须严格遵循以下结构顺序：
1. 【最终答案 / 最优解代码】：
   - 选择题：第一行必须直接给出答案，如【正确答案】：B
   - 编程算法题：第一部分直接给出完整、无占位符、可直接复制运行的最优解代码块（附带核心时间/空间复杂度短评）
2. 【核心思路与细节解析】：
   - 选择题在答案下方逐一简析各选项正误原因
   - 算法题在代码下方简明扼要说明解题逻辑、边界条件处理与关键数据结构选择
3. 【读图/系统设计题】：
   - 先直接给出拓扑关系、关键结论或核心架构设计，再展开详述。
`.trim();

// v2 兼容旧常量
export const DEFAULT_INTERVIEW_PROMPT = DEFAULT_INTERVIEW_PROMPT_CONCISE;

/** 每道题都会注入的优先级铁律：JD 高于简历，当前问题高于历史问答。 */
export const ANSWER_PRIORITY_RULES = `
## 答题铁律（按优先级，不可颠倒）
1. 面试官当前问题：问什么答什么。禁止用简历或上一题的高频词替换本题主题。
2. 岗位 JD：第一权重。技术口径、用词、深度和考察方向必须对齐 JD，而不是对齐简历自我介绍。
3. 简历：第二权重。只提供可口述的真实经历、项目名和量化结果；不是选题依据。
4. 历史问答和转写：只用于判断这是不是追问。一旦主题切换，立即丢掉上一题的技术点。
5. 能力迁移：JD 要求但简历没有直接经验时，用相邻项目迁移并补齐落地细节；禁止说“我没做过/没用过”。
`.trim();

// ===== 简历+JD 注入模板（JD 在前，简历只做证据） =====
export const RESUME_JD_PROMPT_TEMPLATE = `
## 应聘岗位（JD，第一权重）
岗位描述：
{jd}

JD 职责/要求短句：
{jdRequirements}

岗位必考信号（答题必须对齐这些，而不是简历里出现次数最多的词）：
{jdSignals}

简历缺口（JD 有、简历几乎没有；不要回避，用相邻经验迁移）：
{jdGaps}

## 求职者简历（证据，第二权重）
{resume}

组织回答时：先用 JD 定口径，再用简历举例子。行为/动机类问题优先依据 JD 的业务方向、技术栈和岗位职责；不要编造 JD 中没有的公司信息，也不要把 Checkpoint、Watermark 等简历高频词硬套到 DataStream、高并发等 JD 题上。
`.trim();

// ===== 题型配置 =====
export const EXAM_TYPES: ExamTypeConfig[] = [
  { key: 'coding', label: '代码题', icon: 'Code', prompt: '请直接第一部分先给出最优解法的完整可运行代码（第一行给出时间与空间复杂度），之后再简要分析核心算法逻辑。', color: '#6c63ff' },
  { key: 'choice', label: '选择题', icon: 'CheckCircle', prompt: '第一行必须直接给出最终答案（如【正确答案】：B），之后再逐项简要说明选项正误原因。', color: '#00d4ff' },
  { key: 'chart', label: '读图题', icon: 'BarChart', prompt: '请先直接给出图表的核心结论/拓扑关系/关键计算结果，之后再逐步展开细节分析。', color: '#4caf50' },
  { key: 'logic', label: '逻辑推理', icon: 'Psychology', prompt: '第一行直接给出最终结论或数字答案，之后再简述推理步骤。', color: '#ff9800' },
  { key: 'english', label: '英语题', icon: 'Translate', prompt: '第一行直接给出正确选项或译文答案，之后再附带词汇语法解析。', color: '#e91e63' },
];

// ===== 服务商默认配置（v2 扩展国内厂商） =====
export const PROVIDER_DEFAULTS: Record<AIProvider, ProviderDefault> = {
  openai:    { baseUrl: 'https://api.openai.com/v1',            textModel: 'gpt-4o',              visionModel: 'gpt-4o',              label: 'OpenAI' },
  anthropic: { baseUrl: 'https://api.anthropic.com/v1',         textModel: 'claude-sonnet-4-20250514', visionModel: 'claude-sonnet-4-20250514', label: 'Anthropic' },
  doubao:    { baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', textModel: 'doubao-pro-32k', visionModel: 'doubao-vision-pro-32k', label: '豆包 (火山引擎)' },
  // V4 Flash is text-only. Screenshot questions are locally OCRed first.
  deepseek:  { baseUrl: 'https://api.deepseek.com/v1',         textModel: 'deepseek-v4-flash',   visionModel: 'deepseek-v4-flash',    label: 'DeepSeek' },
  zhipu:     { baseUrl: 'https://open.bigmodel.cn/api/paas/v4', textModel: 'glm-4-plus',        visionModel: 'glm-4v-plus',          label: '智谱 GLM' },
  moonshot:  { baseUrl: 'https://api.moonshot.cn/v1',          textModel: 'moonshot-v1-8k',      visionModel: 'moonshot-v1-8k-vision', label: 'Moonshot' },
  qwen:      { baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', textModel: 'qwen-plus', visionModel: 'qwen-vl-max', label: '通义千问' },
  custom:    { baseUrl: '',                                    textModel: '',                    visionModel: '',                     label: '自定义' },
};

// ===== 服务商排序（国内优先） =====
export const PROVIDER_ORDER: AIProvider[] = [
  'doubao', 'deepseek', 'zhipu', 'moonshot', 'qwen', 'openai', 'anthropic', 'custom',
];

// ===== 回答模式配置 =====
export const ANSWER_MODES = [
  { key: 'concise' as const, label: '简洁模式', desc: '4-6个口述要点', prompt: DEFAULT_INTERVIEW_PROMPT_CONCISE },
  { key: 'detailed' as const, label: '详细模式', desc: '展开项目、细节和追问', prompt: DEFAULT_INTERVIEW_PROMPT_DETAILED },
];

// ===== 面试准备预设 =====
export const INTERVIEW_ROLE_PRESETS = [
  {
    key: 'bigdata',
    label: '大数据开发',
    jd: '岗位方向：大数据开发。重点关注 SQL、Hive、Spark、Flink DataStream API、状态管理、反压、Checkpoint、实时/离线数仓、数据治理、任务调度、高并发优化、JVM 调优和业务指标理解。',
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
  'DataStream',
  'JVM/性能',
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
  hotwords: '',
};

export const DEFAULT_MIMO_ASR_CONFIG: MiMoASRConfig = {
  apiKey: '',
  baseUrl: 'https://api.xiaomimimo.com/v1',
  model: 'mimo-v2.5-asr',
  language: 'auto',
  chunkMs: 2500,
};

export const DEFAULT_CLOUD_ASR_CONFIG: CloudASRConfig = {
  chunkMs: 2500,
  language: 'zh-CN',
  hotwords: '',
  baiduApiKey: '',
  baiduSecretKey: '',
  googleApiKey: '',
  alibabaAppKey: '',
  alibabaToken: '',
  alibabaEndpoint: 'https://nls-gateway-cn-shanghai.aliyuncs.com/stream/v1/asr',
  iflytekAppId: '',
  iflytekApiKey: '',
  iflytekApiSecret: '',
  glmApiKey: '',
  glmBaseUrl: 'https://open.bigmodel.cn/api/paas/v4',
  glmModel: 'glm-asr-2512',
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
  interviewSystemPrompt: DEFAULT_INTERVIEW_PROMPT_DETAILED,
  examSystemPrompt: DEFAULT_EXAM_PROMPT,
  contextWindowSize: 5,
};

// ===== 默认应用设置 =====
export const DEFAULT_APP_SETTINGS: AppSettings = {
  theme: 'light',
  language: 'zh',
  privacyAcknowledged: false,
  asrProvider: 'gateway-doubao',
  audioSource: 'both',
  myAudioSource: 'microphone',
  interviewerAudioSource: 'system',
  defaultAnswerMode: 'detailed',
  mergeTimeoutMs: 2500,
  webSearchEnabled: false,
  asrHotwords: 'Fluss、Flink、StarRocks',
};

// ===== 默认简历JD数据 =====
export const DEFAULT_RESUME_JD = { resume: '', jd: '' };
export const DEFAULT_KNOWLEDGE_PROFILE = { resumes: [], expertKnowledgeItems: [], expertKnowledge: '' };

export const THEME_OPTIONS: Array<{ key: ThemeMode; label: string; desc: string }> = [
  { key: 'dark', label: '深色工作台', desc: '默认深色，高对比，适合长时间面试。' },
  { key: 'light', label: '清爽浅色', desc: '浅色背景，白天使用更轻。' },
  { key: 'clay', label: '粘土拟态', desc: '柔和立体控件，视觉更轻松。' },
  { key: 'midnight', label: '午夜蓝', desc: '更沉稳的蓝黑界面，突出转写和答案。' },
  { key: 'forest', label: '森林绿', desc: '低饱和绿色，适合复盘和阅读。' },
  { key: 'mono', label: '黑白极简', desc: '减少色彩干扰，偏工具感。' },
];

// ===== 业务常量 =====
export const MAX_EXAM_RECORDS = 50;
export const STREAM_TIMEOUT_MS = 120_000;
export const API_TIMEOUT_MS = 30_000;
// Project history is lightweight and is also persisted remotely. Keep enough
// room for repeated interview practice instead of silently refusing a new one.
export const MAX_SESSIONS = 100;
export const MERGE_TIMEOUT_DEFAULT = 2500;

// ===== 左侧导航菜单项 =====
export const NAV_ITEMS = [
  { path: '/interview', label: '面试辅助', icon: 'RecordVoiceOver' },
  { path: '/knowledge', label: '简历与知识库', icon: 'LibraryBooks' },
  { path: '/exam', label: '笔试辅助', icon: 'EditNote' },
  { path: '/billing', label: '套餐与时长', icon: 'WorkspacePremium' },
  { path: '/settings', label: '设置', icon: 'Settings' },
  { path: '/admin', label: '运营后台', icon: 'AdminPanelSettings', adminOnly: true },
] as const;
