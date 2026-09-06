/**
 * InterviewContext v2 — 面试辅助状态管理
 *
 * 支持：Session 化管理、系统音频/麦克风切换、豆包ASR/浏览器ASR路由、
 * 问题智能合并、回答模式（简洁/详细）、简历JD注入、手动触发
 */

import {
  createContext,
  useReducer,
  useCallback,
  useRef,
  useEffect,
  type ReactNode,
} from 'react';
import type {
  AnswerGenerationMode,
  QAItem,
  ChatMessage,
  TranscriptLine,
  InterviewReview,
  SpeakerAudioSource,
  CloudASRProvider,
  ASRGatewayProvider,
  ASRProvider,
  KnowledgeLibraryItem,
  WebSearchResult,
} from '../types';
import {
  STORAGE_KEYS,
  MERGE_TIMEOUT_DEFAULT,
  ANSWER_PRIORITY_RULES,
  ANSWER_MODES,
} from '../constants';
import * as storageService from '../services/storageService';
import * as speechService from '../services/speechService';
import * as systemAudioService from '../services/systemAudioService';
import * as doubaoAsrService from '../services/doubaoAsrService';
import * as openaiChunkAsrService from '../services/openaiChunkAsrService';
import * as localQwenAsrService from '../services/localQwenAsrService';
import * as mimoAsrService from '../services/mimoAsrService';
import * as cloudAsrService from '../services/cloudAsrService';
import * as asrGatewayService from '../services/asrGatewayService';
import * as billingService from '../services/billingService';
import type { LocalQwenSession } from '../services/localQwenAsrService';
import { chat } from '../services/aiService';
import { webSearch } from '../services/webSearchService';
import {
  buildKnowledgeCatalog,
  formatRetrievedKnowledge,
  retrieveKnowledgeSnippets,
} from '../services/knowledgeRetrievalService';
import { useSettings } from '../hooks/useSettings';
import { useSession } from '../hooks/useSession';
import { useKnowledge } from '../hooks/useKnowledge';
import { useBilling } from '../hooks/useBilling';
import { COMMERCIAL_MODE } from '../config/commercial';
import { buildResumeJdPrompt } from '../services/jdAlignmentService';

// ===== State =====
export interface InterviewState {
  currentQuestion: string;
  interimText: string;
  transcriptLines: TranscriptLine[];
  isListening: boolean;
  isProcessing: boolean;
  isMerging: boolean;
  speechSupported: boolean;
  systemAudioReady: boolean;
  isGenerationPaused: boolean;
  error: string | null;
}

type InterviewAction =
  | { type: 'SET_CURRENT_QUESTION'; payload: string }
  | { type: 'SET_INTERIM'; payload: string }
  | { type: 'SET_TRANSCRIPT'; payload: TranscriptLine[] }
  | { type: 'ADD_TRANSCRIPT'; payload: TranscriptLine }
  | { type: 'CLEAR_TRANSCRIPT' }
  | { type: 'SET_LISTENING'; payload: boolean }
  | { type: 'SET_PROCESSING'; payload: boolean }
  | { type: 'SET_MERGING'; payload: boolean }
  | { type: 'SET_SYSTEM_AUDIO_READY'; payload: boolean }
  | { type: 'SET_GENERATION_PAUSED'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null };

function getInitialState(): InterviewState {
  return {
    currentQuestion: '',
    interimText: '',
    transcriptLines: [],
    isListening: false,
    isProcessing: false,
    isMerging: false,
    speechSupported: speechService.isSupported() || doubaoAsrService.isSupported(),
    systemAudioReady: systemAudioService.isActive(),
    isGenerationPaused: storageService.get<boolean>(STORAGE_KEYS.GENERATION_PAUSED, false),
    error: null,
  };
}

function interviewReducer(state: InterviewState, action: InterviewAction): InterviewState {
  switch (action.type) {
    case 'SET_CURRENT_QUESTION': return { ...state, currentQuestion: action.payload };
    case 'SET_INTERIM': return { ...state, interimText: action.payload };
    case 'SET_TRANSCRIPT': return { ...state, transcriptLines: action.payload };
    case 'ADD_TRANSCRIPT': return { ...state, transcriptLines: [...state.transcriptLines.slice(-39), action.payload] };
    case 'CLEAR_TRANSCRIPT': return { ...state, transcriptLines: [] };
    case 'SET_LISTENING': return { ...state, isListening: action.payload };
    case 'SET_PROCESSING': return { ...state, isProcessing: action.payload };
    case 'SET_MERGING': return { ...state, isMerging: action.payload };
    case 'SET_SYSTEM_AUDIO_READY': return { ...state, systemAudioReady: action.payload };
    case 'SET_GENERATION_PAUSED': return { ...state, isGenerationPaused: action.payload };
    case 'SET_ERROR': return { ...state, error: action.payload };
    default: return state;
  }
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

// ===== Context Value =====
export interface InterviewContextValue extends InterviewState {
  qaList: QAItem[];
  startListening: () => void;
  stopListening: () => void;
  sendQuestion: (question: string) => Promise<void>;
  regenerateAnswer: (id: string, options?: RegenerateAnswerOptions) => Promise<void>;
  stopGeneration: () => void;
  editQuestion: (id: string, question: string) => void;
  deleteQuestion: (id: string) => void;
  addManualQuestion: (question: string) => Promise<void>;
  triggerLatestTranscriptQuestion: () => Promise<void>;
  prepareSystemAudioShare: () => Promise<boolean>;
  generateReview: () => Promise<void>;
  endInterview: () => Promise<void>;
  toggleGenerationPause: () => boolean;
  setGenerationPaused: (paused: boolean) => void;
  clearHistory: () => void;
}

export interface RegenerateAnswerOptions {
  question?: string;
  mode?: AnswerGenerationMode;
}

type AnswerGenerationJob = {
  id: string;
  question: string;
  mode: AnswerGenerationMode;
};

export const InterviewContext = createContext<InterviewContextValue | null>(null);

// ===== Provider =====
export function InterviewProvider({ children }: { children: ReactNode }) {
  const { aiSettings, appSettings, doubaoConfig, localQwenConfig, mimoConfig, cloudAsrConfig } = useSettings();
  const { profile: knowledgeProfile } = useKnowledge();
  const { remainingSeconds, refreshBilling, consumeSeconds } = useBilling();
  const {
    activeSession,
    updateSessionQAList,
    updateSessionTranscriptLines,
    archiveActiveSession,
    updateSessionReview,
    resume,
    jd,
  } = useSession();
  const [state, dispatch] = useReducer(interviewReducer, undefined, getInitialState);

  const stateRef = useRef(state); stateRef.current = state;
  const aiRef = useRef(aiSettings); aiRef.current = aiSettings;
  const appRef = useRef(appSettings); appRef.current = appSettings;
  const doubaoRef = useRef(doubaoConfig); doubaoRef.current = doubaoConfig;
  const localQwenRef = useRef(localQwenConfig); localQwenRef.current = localQwenConfig;
  const mimoRef = useRef(mimoConfig); mimoRef.current = mimoConfig;
  const cloudAsrRef = useRef(cloudAsrConfig); cloudAsrRef.current = cloudAsrConfig;
  const sessionRef = useRef(activeSession); sessionRef.current = activeSession;
  const resumeRef = useRef(resume); resumeRef.current = resume;
  const jdRef = useRef(jd); jdRef.current = jd;
  const knowledgeRef = useRef(knowledgeProfile); knowledgeRef.current = knowledgeProfile;
  const transcriptRef = useRef<TranscriptLine[]>([]);
  transcriptRef.current = state.transcriptLines;
  const lastSessionId = useRef<string | null>(null);

  // 合并缓冲区
  const mergeBuffer = useRef<string[]>([]);
  const mergeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const interimCommitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingInterimQuestion = useRef('');
  const pendingInterimNormalized = useRef('');
  const committedInterviewerQuestions = useRef<string[]>([]);
  const qwenMicrophoneSession = useRef<LocalQwenSession | null>(null);
  const qwenSystemAudioSession = useRef<LocalQwenSession | null>(null);
  const billingTickStartedAt = useRef<number | null>(null);
  const generationControllers = useRef(new Map<string, AbortController>());
  const generationRunIds = useRef(new Map<string, number>());

  // 持久化当前 session 的 qaList
  const qaList = activeSession?.qaList ?? [];
  useEffect(() => {
    if (activeSession?.id === lastSessionId.current) return;
    speechService.stop();
    systemAudioService.stop();
    doubaoAsrService.stop();
    openaiChunkAsrService.stop();
    localQwenAsrService.stop();
    mimoAsrService.stop();
    cloudAsrService.stop();
    asrGatewayService.stop();
    qwenMicrophoneSession.current = null;
    qwenSystemAudioSession.current = null;
    if (mergeTimer.current) {
      clearTimeout(mergeTimer.current);
      mergeTimer.current = null;
    }
    if (interimCommitTimer.current) {
      clearTimeout(interimCommitTimer.current);
      interimCommitTimer.current = null;
    }
    mergeBuffer.current = [];
    pendingInterimQuestion.current = '';
    pendingInterimNormalized.current = '';
    stopAllGenerations();
    lastSessionId.current = activeSession?.id ?? null;
    const lines = activeSession?.transcriptLines ?? [];
    committedInterviewerQuestions.current = lines
      .filter((line) => line.speaker === 'interviewer')
      .map((line) => line.text)
      .slice(-8);
    transcriptRef.current = lines;
    dispatch({ type: 'SET_TRANSCRIPT', payload: lines });
    dispatch({ type: 'SET_INTERIM', payload: '' });
    dispatch({ type: 'SET_CURRENT_QUESTION', payload: '' });
    dispatch({ type: 'SET_MERGING', payload: false });
    dispatch({ type: 'SET_LISTENING', payload: false });
    dispatch({ type: 'SET_ERROR', payload: null });
  }, [activeSession?.id, activeSession?.transcriptLines]);

  useEffect(() => {
    storageService.set(STORAGE_KEYS.QA_LIST, qaList);
  }, [qaList]);

  useEffect(() => {
    if (!COMMERCIAL_MODE || !state.isListening) {
      billingTickStartedAt.current = null;
      return undefined;
    }
    billingTickStartedAt.current = Date.now();
    const timer = window.setInterval(() => {
      if (!billingTickStartedAt.current) return;
      const elapsed = Math.max(1, Math.floor((Date.now() - billingTickStartedAt.current) / 1000));
      billingTickStartedAt.current = Date.now();
      void consumeSeconds(elapsed);
    }, 15_000);
    return () => {
      window.clearInterval(timer);
      if (billingTickStartedAt.current) {
        const elapsed = Math.max(1, Math.floor((Date.now() - billingTickStartedAt.current) / 1000));
        billingTickStartedAt.current = null;
        void consumeSeconds(elapsed);
      }
    };
  }, [consumeSeconds, state.isListening]);

  useEffect(() => {
    if (COMMERCIAL_MODE && state.isListening && remainingSeconds <= 0) {
      stopListening();
      dispatch({ type: 'SET_ERROR', payload: '免费试用或购买时长已用完，请购买后继续使用。' });
    }
  }, [remainingSeconds, state.isListening]);

  // ===== 构建系统提示词 =====
  function buildSystemPrompt(modeOverride?: 'concise' | 'detailed', options: { includeProfileContext?: boolean } = {}): string {
    const includeProfileContext = options.includeProfileContext ?? true;
    const mode = modeOverride
      ?? activeSession?.answerMode
      ?? appRef.current.defaultAnswerMode
      ?? 'detailed';
    const modePrompt = ANSWER_MODES.find((m) => m.key === mode)?.prompt ?? '';
    let prompt = modePrompt;
    prompt += mode === 'detailed'
      ? '\n\n当前选择：详细。请明显展开，不要压缩成短答；开放题至少给 4-6 个段落或结构化要点。'
      : '\n\n当前选择：简洁。请保持口语化但不要敷衍；通常给 3-5 个可直接说出口的要点。';
    prompt += `\n\n${ANSWER_PRIORITY_RULES}`;
    const session = sessionRef.current;

    if (session?.targetRole || session?.focusAreas?.length) {
      prompt += '\n\n## 当前面试项目';
      if (session.targetRole) {
        prompt += `\n岗位方向：${session.targetRole}`;
      }
      if (session.focusAreas?.length) {
        prompt += `\n重点考察：${session.focusAreas.join('、')}`;
      }
      prompt += '\n岗位方向和考察标签是补充，不能压过 JD 原文和当前问题。';
    }

    if (includeProfileContext) {
      const currentResume = session ? session.resume ?? '' : resumeRef.current;
      const currentJd = session ? session.jd ?? '' : jdRef.current;
      if (currentResume || currentJd) {
        prompt += `\n\n${buildResumeJdPrompt(currentResume, currentJd)}`;
      }

      const knowledgeCatalog = buildMountedKnowledgeCatalog();
      if (knowledgeCatalog) {
        prompt += `\n\n## 当前项目挂载的专家知识库\n${knowledgeCatalog}`;
        prompt += '\n\n只使用本题检索到的知识库片段和简历中的真实经历；没有出现的细节不要编造。QA 命中内容优先级最高，但仍不能把无关知识硬套到当前问题上。';
      }
    }

    prompt += '\n\n## 结束提醒\n先对齐本题和 JD，再用简历举例。不要把简历高频词套到无关问题上。';
    return prompt;
  }

  function selectedKnowledgeItems(): KnowledgeLibraryItem[] {
    const session = sessionRef.current;
    const knowledge = knowledgeRef.current;
    const ids = session?.expertKnowledgeIds ?? [];
    if (ids.length > 0) {
      return ids
        .map((id) => knowledge.expertKnowledgeItems.find((item) => item.id === id))
        .filter((item): item is KnowledgeLibraryItem => Boolean(item));
    }
    return [];
  }

  function knowledgeItemsForRetrieval(): { items: KnowledgeLibraryItem[]; manual: string } {
    const session = sessionRef.current;
    const selected = selectedKnowledgeItems();
    const manual = session?.expertKnowledge?.trim() ?? '';
    if (selected.length > 0 || manual) {
      return { items: selected, manual };
    }
    if (session) return { items: [], manual: '' };
    return {
      items: knowledgeRef.current.expertKnowledgeItems ?? [],
      manual: knowledgeRef.current.expertKnowledge?.trim() ?? '',
    };
  }

  function buildMountedKnowledgeCatalog(): string {
    const { items, manual } = knowledgeItemsForRetrieval();
    return buildKnowledgeCatalog(items, manual);
  }

  function buildRetrievedKnowledgeContext(question: string): string {
    const { items, manual } = knowledgeItemsForRetrieval();
    if (items.length === 0 && !manual) return '';
    const { qaHits, docHits } = retrieveKnowledgeSnippets(question, items, manual);
    return formatRetrievedKnowledge(qaHits, docHits);
  }

  function formatSearchResults(results: Awaited<ReturnType<typeof webSearch>>): string {
    if (results.length === 0) return '（未搜索到可用结果）';
    return results
      .map((item, index) => `${index + 1}. ${item.title}\n${item.snippet}\n${item.url}`)
      .join('\n\n');
  }

  function parseHotwords(text: string): string[] {
    return text
      .split(/[,，、\n]/)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 30);
  }

  function withGlobalHotwords(config: typeof cloudAsrRef.current): typeof cloudAsrRef.current {
    const hotwords = appRef.current.asrHotwords?.trim();
    return hotwords ? { ...config, hotwords } : config;
  }

  function withGlobalQwenHotwords(config: typeof localQwenRef.current): typeof localQwenRef.current {
    const hotwords = appRef.current.asrHotwords?.trim();
    return hotwords ? { ...config, hotwords } : config;
  }

  function modeInstruction(mode: AnswerGenerationMode): string {
    if (mode === 'concise') {
      return '请用简洁模式重新生成：控制在 4-6 个口述要点内，但必须覆盖结论、依据、项目例子和落地结果。口径对齐 JD，不要被简历高频词带跑。';
    }
    if (mode === 'detailed') {
      return '请用详细模式重新生成：明显展开，按背景、方案、技术细节、结果、可追问点组织，适合 1.5-3 分钟口述。技术细节必须对齐 JD 考察点。';
    }
    if (mode === 'star') {
      return '请用 STAR 结构生成：Situation 背景、Task 任务、Action 行动、Result 结果。每一段都要自然口语化，突出我做了什么、为什么这么做、结果如何。Task/Action 优先用 JD 的职责语言来包装简历经历。';
    }
    if (mode === 'exam') {
      return '请按笔试/机试题解答，不要引用简历、专家知识库、历史问答、转写或面试口述风格。SQL 题给出可运行 SQL 并标明语言；代码题给完整代码和关键思路；选择题先给答案再解析选项；简答题直接给要点。代码必须放在 markdown 代码块里并写上语言（sql、python、java 等）。不要编造项目经历或业务数据。';
    }
    if (mode === 'no-context') {
      return '请清除上下文重新生成：不要引用简历、专家知识库、历史问答、最近转写或联网搜索结果，只基于面试官当前问题回答。回答仍要完整，给出可直接口述的结构化答案。';
    }
    if (mode === 'star-no-context') {
      return '请清除上下文并用 STAR 结构重新生成：不要引用简历、专家知识库、历史问答、最近转写或联网搜索结果，只基于问题本身，按 Situation、Task、Action、Result 输出通用但可信的回答。';
    }
    if (mode === 'jd-align') {
      return '请强制按 JD 口径重新生成：先用岗位 JD 的技术栈和职责定义答题口径，再用简历举可说的证据。若本题主题与上一题不同，彻底丢掉上一题关键词。简历缺 JD 技能时做能力迁移，明确“我在相近场景里怎么落地、如果做这个岗位会怎么做”，不要说没做过。';
    }
    if (mode === 'deep-dive') {
      return '请按技术深挖重新生成，必须包含：1) 底层原理（为什么这样设计）；2) 数据流向/调用链；3) 关键 API 或伪代码（技术岗必须落到代码级，不要只堆 Barrier、两阶段提交等概念词）；4) 失败、延迟、反压、状态过大等边界怎么处理；5) 面试官可能追问的 2-3 个问题及一句答法。场景题优先给 DataStream/API 实现路径，而不是只给 SQL。口径仍对齐 JD。';
    }
    return '请生成可直接口述的面试答案。问什么答什么，JD 口径优先于简历关键词。';
  }

  function buildPromptForMode(mode: AnswerGenerationMode): string {
    if (mode === 'no-context' || mode === 'star-no-context' || mode === 'exam') {
      return modeInstruction(mode);
    }
    const forcedMode = mode === 'concise' ? 'concise' : (mode === 'detailed' || mode === 'deep-dive') ? 'detailed' : undefined;
    return `${buildSystemPrompt(forcedMode)}\n\n${modeInstruction(mode)}`;
  }

  function generationPolicy(mode: AnswerGenerationMode) {
    const clearContext = mode === 'no-context' || mode === 'star-no-context' || mode === 'exam';
    return {
      includeHistory: !clearContext,
      includeTranscript: !clearContext,
      includeProfileKnowledge: !clearContext,
      includeSearch: !clearContext && appRef.current.webSearchEnabled,
      includeHotwords: !clearContext,
    };
  }

  function isAbortError(error: unknown): boolean {
    return error instanceof DOMException && error.name === 'AbortError';
  }

  function stopGenerationFor(id: string): void {
    generationControllers.current.get(id)?.abort();
    generationControllers.current.delete(id);
    generationRunIds.current.set(id, (generationRunIds.current.get(id) ?? 0) + 1);
  }

  function stopAllGenerations(): void {
    for (const [id, controller] of generationControllers.current) {
      controller.abort();
      generationRunIds.current.set(id, (generationRunIds.current.get(id) ?? 0) + 1);
    }
    generationControllers.current.clear();
  }

  function updateQA(id: string, patch: Partial<QAItem>): void {
    const sess = sessionRef.current;
    if (!sess) return;
    const exists = sess.qaList.some((qa) => qa.id === id);
    const fallback: QAItem = {
      id,
      question: patch.question ?? '',
      answer: patch.answer ?? '',
      timestamp: patch.timestamp ?? Date.now(),
      isStreaming: patch.isStreaming ?? false,
      error: patch.error,
      searchResults: patch.searchResults,
      generationMode: patch.generationMode,
    };
    updateSessionQAList(
      exists
        ? sess.qaList.map((qa) => qa.id === id ? { ...qa, ...patch } : qa)
        : [...sess.qaList, fallback],
    );
  }

  function addTranscriptLine(line: TranscriptLine): void {
    if (transcriptRef.current.some((existing) => isRecentDuplicate(existing, line, line.speaker))) {
      return;
    }

    if (line.speaker === 'me' && hasRecentDuplicate(line, 'interviewer')) {
      return;
    }

    let nextLines = transcriptRef.current;
    if (line.speaker === 'interviewer') {
      nextLines = nextLines.filter((existing) => !isRecentDuplicate(existing, line, 'me'));
    }

    transcriptRef.current = [...nextLines.slice(-79), line];
    if (line.speaker === 'interviewer') {
      committedInterviewerQuestions.current = [
        ...committedInterviewerQuestions.current,
        line.text,
      ].slice(-8);
    }
    dispatch({ type: 'SET_TRANSCRIPT', payload: transcriptRef.current });
    updateSessionTranscriptLines(transcriptRef.current);
  }

  function hasRecentDuplicate(line: TranscriptLine, speaker: TranscriptLine['speaker']): boolean {
    return transcriptRef.current.some((existing) => isRecentDuplicate(existing, line, speaker));
  }

  function isRecentDuplicate(
    existing: TranscriptLine,
    incoming: TranscriptLine,
    speaker: TranscriptLine['speaker'],
  ): boolean {
    if (existing.speaker !== speaker) return false;
    if (Math.abs(existing.timestamp - incoming.timestamp) > 8000) return false;
    return textSimilarity(existing.text, incoming.text) >= 0.72;
  }

  function normalizeTranscriptText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[，。！？、,.!?;；:\s]/g, '')
      .replace(/[啊呀呢吧吗嘛]/g, '')
      .trim();
  }

  function cleanupInterimText(text: string): string {
    let current = text.trim();
    current = current.replace(/(?:热词|关键词)[：:][\s\S]*$/g, '').trim();
    for (const previous of [...committedInterviewerQuestions.current].reverse()) {
      const normalizedCurrent = normalizeTranscriptText(current);
      const normalizedPrevious = normalizeTranscriptText(previous);
      if (!normalizedCurrent || !normalizedPrevious) continue;

      if (normalizedCurrent === normalizedPrevious) {
        return '';
      }

      if (current.startsWith(previous)) {
        current = current.slice(previous.length).trim();
        continue;
      }

      const previousIndex = current.indexOf(previous);
      if (previousIndex >= 0) {
        current = current.slice(previousIndex + previous.length).trim();
        continue;
      }

      if (normalizedCurrent.startsWith(normalizedPrevious) && normalizedPrevious.length > 8) {
        const ratio = normalizedPrevious.length / normalizedCurrent.length;
        if (ratio > 0.35) {
          return current.slice(Math.min(previous.length, current.length)).trim();
        }
      }
    }
    return current.replace(/^[，。！？、,.!?;；:\s]+/, '').trim();
  }

  function textSimilarity(a: string, b: string): number {
    const left = normalizeTranscriptText(a);
    const right = normalizeTranscriptText(b);
    if (!left || !right) return 0;
    if (left.includes(right) || right.includes(left)) {
      return Math.min(left.length, right.length) / Math.max(left.length, right.length);
    }

    const bigrams = (value: string) => {
      const set = new Set<string>();
      for (let i = 0; i < value.length - 1; i += 1) {
        set.add(value.slice(i, i + 2));
      }
      return set;
    };
    const leftSet = bigrams(left);
    const rightSet = bigrams(right);
    if (leftSet.size === 0 || rightSet.size === 0) return left === right ? 1 : 0;
    let overlap = 0;
    for (const item of leftSet) {
      if (rightSet.has(item)) overlap += 1;
    }
    return (2 * overlap) / (leftSet.size + rightSet.size);
  }

  /**
   * 面试官弱反馈/无意义短语气词黑名单
   * 面试官说“嗯、好、可以、ok、不错”等仅作日常应答，不应作为面试提问触发 AI 生成答案
   */
  const WEAK_FEEDBACK_WORDS = new Set([
    '嗯', '嗯嗯', '嗯嗯嗯', '噢', '哦', '哦哦', '好', '好的', '行', '行的',
    '不错', '可以', '可以的', 'ok', 'okay', '对', '对的', '是的', '没错',
    '没问题', '收到', '明白', '理解', '清楚', '原来如此', '这样啊', '好的好的',
    '行行行', '了解', '了解了', '行吧', '好嘞', '得嘞',
  ]);

  /**
   * 判断文本是否为弱反馈/简短语气词（非提问）
   */
  function isWeakFeedback(text: string): boolean {
    const cleaned = text.trim().toLowerCase().replace(/[，。！？、,.!?;；:\s~～]/g, '');
    if (!cleaned) return true;
    if (WEAK_FEEDBACK_WORDS.has(cleaned)) return true;
    // 字符极短 (< 5 字) 且由语气词、肯定词拼合
    if (cleaned.length <= 4) {
      const isAllFeedbackChars = /^[嗯噢哦好行对是不错可以ok呀呢吧嘛哈]+$/i.test(cleaned);
      if (isAllFeedbackChars) return true;
    }
    return false;
  }

  /**
   * 判定是否具备明确的提问特征
   */
  function hasExplicitQuestionSignal(text: string): boolean {
    return /(吗|呢|么|什么|为什么|怎么|如何|介绍|讲讲|说说|讲一下|说一下|简述|谈谈|聊聊|项目|架构|实现|区别|原理|经历|方案|问题|请问|请问您|你觉得|对于|结合|深入|优化)/.test(text)
      || /[?？]/.test(text);
  }

  function isLikelyQuestionText(text: string): boolean {
    // 优先过滤语气应答与反馈短语
    if (isWeakFeedback(text)) {
      return false;
    }

    const normalized = normalizeTranscriptText(text);
    // 如果有明确的提问疑问词/句式，短句（如“说说这个项目？”、“为什么？”）也能识别为问题
    if (hasExplicitQuestionSignal(text)) {
      return normalized.length >= 3;
    }

    // 没有明显疑问词时，要求字数达到充实阈值（>= 9 个有效字），避免零散的句子碎片误触发
    return normalized.length >= 9;
  }

  function buildTranscriptContext(): string {
    // 裁剪转写上下文为最近 6 句，足够理解追问，同时防止 prompt 过长影响响应延迟
    const lines = transcriptRef.current.slice(-6);
    if (lines.length === 0) return '';
    return lines
      .map((line) => `${line.speaker === 'interviewer' ? '面试官' : '我'}：${line.text}`)
      .join('\n');
  }

  function latestInterviewerText(): string {
    return [...transcriptRef.current].reverse().find((line) => line.speaker === 'interviewer')?.text ?? '';
  }

  // ===== 发送问题给 AI =====
  const sendQuestion = useCallback(async (question: string) => {
    const trimmed = question.trim();
    if (!trimmed) return;

    const id = generateId();
    const qaItem: QAItem = { id, question: trimmed, answer: '', timestamp: Date.now(), isStreaming: true, generationMode: 'normal' };

    // 添加到 session
    const sess = sessionRef.current;
    if (sess) {
      const newQaList = [...sess.qaList, qaItem];
      updateSessionQAList(newQaList);
    }

    // Each question owns an independent request. A fast follow-up question must
    // start immediately without aborting an earlier answer that is still streaming.
    await runAnswerGeneration({ id, question: trimmed, mode: 'normal' });
  }, [updateSessionQAList]);

  // ===== 重新生成答案 =====
  const regenerateAnswer = useCallback(async (id: string, options: RegenerateAnswerOptions = {}) => {
    const sess = sessionRef.current;
    if (!sess) return;
    const qaItem = sess.qaList.find((q) => q.id === id);
    if (!qaItem) return;

    const question = options.question ?? qaItem.question;
    // Regeneration intentionally replaces only this card's request; other
    // questions continue streaming independently.
    stopGenerationFor(id);
    await runAnswerGeneration({ id, question, mode: options.mode ?? 'normal' });
  }, [updateSessionQAList]);

  async function runAnswerGeneration(
    job: AnswerGenerationJob,
  ): Promise<void> {
    const { id, question, mode } = job;
    const controller = new AbortController();
    const runId = (generationRunIds.current.get(id) ?? 0) + 1;
    generationRunIds.current.set(id, runId);
    generationControllers.current.set(id, controller);
    const isCurrentRun = () => generationRunIds.current.get(id) === runId;
    dispatch({ type: 'SET_PROCESSING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });
    updateQA(id, {
      question,
      answer: '',
      error: undefined,
      isStreaming: true,
      generationMode: mode,
      searchResults: undefined,
    });

    const settings = aiRef.current;
    const policy = generationPolicy(mode);
    const messages: ChatMessage[] = [
      { role: 'system', content: buildPromptForMode(mode) },
    ];
    if (policy.includeHistory) {
      const allQA = sessionRef.current?.qaList ?? [];
      const itemIndex = allQA.findIndex((q) => q.id === id);
      // 控制滑动窗口大小：最多只给最近 3 轮有效问答（且单轮回答裁剪），防止大模型上下文膨胀变慢
      const maxHistoryCount = mode === 'jd-align' ? 1 : Math.min(3, settings.contextWindowSize || 3);
      const recentQA = allQA.slice(Math.max(0, itemIndex - maxHistoryCount), itemIndex);
      for (const qa of recentQA) {
        messages.push({ role: 'user', content: qa.question });
        if (qa.answer) {
          // 对历史长文本进行轻量压缩，只保留核心前 300 字符，杜绝越聊越慢
          const compactedAnswer = qa.answer.length > 300 ? `${qa.answer.slice(0, 300)}...` : qa.answer;
          messages.push({ role: 'assistant', content: compactedAnswer });
        }
      }
    }
    // 最近对话只给最近 4-6 句关键转写，保证轻快响应
    const transcriptContext = policy.includeTranscript ? buildTranscriptContext() : '';
    let searchResults: WebSearchResult[] = [];
    if (policy.includeSearch) {
      try {
        searchResults = await webSearch(question, controller.signal);
        if (isCurrentRun() && searchResults.length) {
          updateQA(id, { searchResults });
        }
      } catch (searchError) {
        if (!isAbortError(searchError)) {
          updateQA(id, { searchResults: [] });
        }
      }
    }

    const searchContext = searchResults.length
      ? `\n\n联网搜索结果：\n${formatSearchResults(searchResults)}\n\n请把搜索结果作为补充资料使用；如与 JD/简历冲突，以 JD 口径和候选人真实经历优先。`
      : '';
    const retrievedKnowledge = policy.includeProfileKnowledge ? buildRetrievedKnowledgeContext(question) : '';
    const qaKnowledgeContext = retrievedKnowledge ? `\n\n${retrievedKnowledge}` : '';
    const hotwords = policy.includeHotwords ? parseHotwords(appRef.current.asrHotwords) : [];
    const hotwordContext = hotwords.length
      ? `\n\n语音识别热词仅用于纠正听写，不要当作本题必须展开的主题：${hotwords.join('、')}`
      : '';
    const modeContext = `\n\n本次生成要求：${modeInstruction(mode)}`;
    const transcriptBlock = transcriptContext
      ? `\n\n最近双路转写（只用于理解追问；主题切换时不要沿用上一题）：\n${transcriptContext}`
      : '';
    messages.push({
      role: 'user',
      content: `【本题锁定】${question}${transcriptBlock}${qaKnowledgeContext}${searchContext}${hotwordContext}${modeContext}\n\n请只回答【本题锁定】中的问题。历史问答和转写仅用于判断是否为追问；若本题主题已切换，禁止继续围绕上一题或简历高频词展开。`,
    });

    let accumulated = '';
    const generationTimeout = window.setTimeout(() => {
      controller.abort();
    }, 75_000);
    try {
      await chat(messages, settings, (chunk: string) => {
        if (!isCurrentRun()) return;
        accumulated += chunk;
        updateQA(id, { answer: accumulated, isStreaming: true, error: undefined });
      }, controller.signal);
      if (isCurrentRun()) {
        updateQA(id, { answer: accumulated, isStreaming: false, error: undefined });
      }
    } catch (error) {
      if (isAbortError(error)) {
        if (isCurrentRun()) {
          updateQA(id, { isStreaming: false, error: accumulated ? undefined : '生成超时或已被打断，请点“重新生成/简洁/详细”再试。' });
        }
        return;
      }
      const errMsg = error instanceof Error ? error.message : '未知错误';
      updateQA(id, { error: errMsg, isStreaming: false });
      dispatch({ type: 'SET_ERROR', payload: errMsg });
    } finally {
      window.clearTimeout(generationTimeout);
      if (isCurrentRun()) {
        generationControllers.current.delete(id);
        dispatch({ type: 'SET_PROCESSING', payload: generationControllers.current.size > 0 });
      }
    }
  }

  const isGenerationPausedRef = useRef(state.isGenerationPaused);
  isGenerationPausedRef.current = state.isGenerationPaused;

  const setGenerationPaused = useCallback((paused: boolean) => {
    storageService.set(STORAGE_KEYS.GENERATION_PAUSED, paused);
    dispatch({ type: 'SET_GENERATION_PAUSED', payload: paused });
  }, []);

  const toggleGenerationPause = useCallback(() => {
    const next = !isGenerationPausedRef.current;
    setGenerationPaused(next);
    return next;
  }, [setGenerationPaused]);

  // ===== 问题合并逻辑 =====
  function flushMergeBuffer() {
    if (mergeBuffer.current.length > 0) {
      const merged = mergeBuffer.current.join(' ');
      mergeBuffer.current = [];
      dispatch({ type: 'SET_MERGING', payload: false });
      dispatch({ type: 'SET_CURRENT_QUESTION', payload: merged });
      // 如果用户开启了“暂停应答”（快捷键或按钮），仅落库文字，拦截大模型触发
      if (isGenerationPausedRef.current) {
        console.info('[flushMergeBuffer] 自动应答已暂停，拦截 AI 生成，文字已落库:', merged);
        return;
      }
      void sendQuestion(merged);
    }
  }

  function clearInterimCommitTimer(): void {
    if (interimCommitTimer.current) {
      clearTimeout(interimCommitTimer.current);
      interimCommitTimer.current = null;
    }
  }

  function commitInterimQuestion(): string {
    const question = cleanupInterimText(pendingInterimQuestion.current);
    if (!question || !isLikelyQuestionText(question)) return '';
    pendingInterimQuestion.current = '';
    pendingInterimNormalized.current = '';
    clearInterimCommitTimer();
    dispatch({ type: 'SET_INTERIM', payload: '' });
    addTranscriptLine({ id: generateId(), speaker: 'interviewer', text: question, timestamp: Date.now() });
    dispatch({ type: 'SET_MERGING', payload: false });
    // 如果用户开启了“暂停应答”（快捷键或按钮），仅落库文字，拦截大模型触发
    if (isGenerationPausedRef.current) {
      console.info('[commitInterimQuestion] 自动应答已暂停，拦截 AI 生成，文字已落库:', question);
      return question;
    }
    void sendQuestion(question);
    return question;
  }

  function scheduleInterimQuestionCommit(text: string): void {
    const cleaned = cleanupInterimText(text);
    const normalized = normalizeTranscriptText(cleaned);
    if (!cleaned || !normalized || !isLikelyQuestionText(cleaned)) return;

    pendingInterimQuestion.current = cleaned;
    pendingInterimNormalized.current = normalized;
    // 持续收到增量语音文字时，立即重置静默倒计时；只有连续 1.5s 无新输入才触发
    clearInterimCommitTimer();
    interimCommitTimer.current = setTimeout(() => {
      commitInterimQuestion();
    }, getQuestionCommitTimeout());
  }

  function getQuestionCommitTimeout(): number {
    const app = appRef.current;
    return app.mergeTimeoutMs || MERGE_TIMEOUT_DEFAULT;
  }

  function extractInterimQuestion(): string {
    const pending = pendingInterimQuestion.current.trim();
    if (pending) return pending;
    const current = stateRef.current.interimText.trim();
    return cleanupInterimText(current.replace(/^面试官[：:]\s*/, '').trim());
  }

  const triggerLatestTranscriptQuestion = useCallback(async () => {
    const interimQuestion = extractInterimQuestion();
    const question = interimQuestion || latestInterviewerText();
    if (!question) {
      dispatch({ type: 'SET_ERROR', payload: '还没有识别到面试官问题，无法手动触发。' });
      return;
    }
    if (interimQuestion) {
      pendingInterimQuestion.current = '';
      clearInterimCommitTimer();
      dispatch({ type: 'SET_INTERIM', payload: '' });
      addTranscriptLine({ id: generateId(), speaker: 'interviewer', text: interimQuestion, timestamp: Date.now() });
      await sendQuestion(interimQuestion);
      return;
    }
    await sendQuestion(question);
  }, [sendQuestion]);

  function handleRecognitionResult(
    text: string,
    isFinal: boolean,
    speaker: 'interviewer' | 'me' = 'interviewer',
  ) {
    const labeledText = `${speaker === 'interviewer' ? '面试官' : '我'}：${text}`;
    if (isFinal) {
      if (speaker === 'interviewer') {
        pendingInterimQuestion.current = '';
        pendingInterimNormalized.current = '';
        clearInterimCommitTimer();
      }
      if (speaker === 'me') {
        addTranscriptLine({ id: generateId(), speaker, text, timestamp: Date.now() });
        dispatch({ type: 'SET_INTERIM', payload: '' });
        return;
      }
      const timeout = getQuestionCommitTimeout();
      const questionText = cleanupInterimText(text);
      if (!questionText) {
        dispatch({ type: 'SET_INTERIM', payload: '' });
        return;
      }
      if (!isLikelyQuestionText(questionText)) {
        addTranscriptLine({ id: generateId(), speaker, text: questionText, timestamp: Date.now() });
        dispatch({ type: 'SET_INTERIM', payload: '' });
        return;
      }
      addTranscriptLine({ id: generateId(), speaker, text: questionText, timestamp: Date.now() });
      mergeBuffer.current.push(questionText);
      dispatch({ type: 'SET_MERGING', payload: true });
      dispatch({ type: 'SET_INTERIM', payload: '' });

      // 清除旧定时器，重新计时
      if (mergeTimer.current) clearTimeout(mergeTimer.current);
      mergeTimer.current = setTimeout(() => {
        flushMergeBuffer();
        mergeTimer.current = null;
      }, timeout);
    } else {
      if (speaker === 'interviewer') {
        const cleaned = cleanupInterimText(text);
        if (!cleaned) return;
        dispatch({ type: 'SET_INTERIM', payload: `面试官：${cleaned}` });
        scheduleInterimQuestionCommit(cleaned);
      } else {
        dispatch({ type: 'SET_INTERIM', payload: labeledText });
      }
    }
  }

  function setListeningFromActiveSources(): void {
    dispatch({
      type: 'SET_LISTENING',
      payload:
        speechService.isListening() ||
        systemAudioService.isProcessing() ||
        doubaoAsrService.isActive() ||
        openaiChunkAsrService.isActive() ||
        localQwenAsrService.isActive() ||
        mimoAsrService.isActive() ||
        cloudAsrService.isActive() ||
        asrGatewayService.isActive(),
    });
    dispatch({ type: 'SET_SYSTEM_AUDIO_READY', payload: systemAudioService.isActive() });
  }

  function isFatalDoubaoAsrError(message: string): boolean {
    return /45000292|quota exceeded|concurrency/i.test(message);
  }

  function handleAsrError(message: string, options: { stopSystemAudio?: boolean } = {}): void {
    dispatch({ type: 'SET_ERROR', payload: message });
    if (isFatalDoubaoAsrError(message)) {
      asrGatewayService.stop();
      doubaoAsrService.stop();
      if (options.stopSystemAudio) {
        systemAudioService.stop();
        dispatch({ type: 'SET_SYSTEM_AUDIO_READY', payload: false });
      }
    }
    setListeningFromActiveSources();
  }

  function startMicrophoneRecognition(speaker: 'interviewer' | 'me'): boolean {
    if (!speechService.isSupported()) {
      dispatch({ type: 'SET_ERROR', payload: '当前浏览器不支持麦克风语音识别。请使用 Chrome，或只开启系统音频 + 豆包 ASR。' });
      return false;
    }
    speechService.start({
      onResult: (text, isFinal) => handleRecognitionResult(text, isFinal, speaker),
      onError: (e) => { dispatch({ type: 'SET_ERROR', payload: e }); setListeningFromActiveSources(); },
      onEnd: () => setListeningFromActiveSources(),
    });
    return true;
  }

  async function startOpenAIMicrophoneRecognition(speaker: 'interviewer' | 'me'): Promise<boolean> {
    const ok = await openaiChunkAsrService.startMicrophone(aiRef.current, {
      onResult: (text, isFinal) => handleRecognitionResult(text, isFinal, speaker),
      onError: (e) => { dispatch({ type: 'SET_ERROR', payload: e }); setListeningFromActiveSources(); },
      onEnd: () => setListeningFromActiveSources(),
    });
    setListeningFromActiveSources();
    return ok;
  }

  async function startMiMoMicrophoneRecognition(speaker: 'interviewer' | 'me'): Promise<boolean> {
    const ok = await mimoAsrService.startMicrophone(mimoRef.current, {
      onResult: (text, isFinal) => handleRecognitionResult(text, isFinal, speaker),
      onError: (e) => { dispatch({ type: 'SET_ERROR', payload: e }); setListeningFromActiveSources(); },
      onEnd: () => setListeningFromActiveSources(),
    });
    setListeningFromActiveSources();
    return ok;
  }

  async function startCloudMicrophoneRecognition(provider: CloudASRProvider, speaker: 'interviewer' | 'me'): Promise<boolean> {
    const ok = await cloudAsrService.startMicrophone(provider, withGlobalHotwords(cloudAsrRef.current), {
      onResult: (text, isFinal) => handleRecognitionResult(text, isFinal, speaker),
      onError: (e) => { dispatch({ type: 'SET_ERROR', payload: e }); setListeningFromActiveSources(); },
      onEnd: () => setListeningFromActiveSources(),
    });
    setListeningFromActiveSources();
    return ok;
  }

  async function startGatewayMicrophoneRecognition(provider: ASRGatewayProvider, speaker: 'interviewer' | 'me'): Promise<boolean> {
    const ok = await asrGatewayService.startMicrophone(provider, speaker, {
      doubaoConfig: doubaoRef.current,
      cloudAsrConfig: cloudAsrRef.current,
      asrEndWindowSize: appRef.current.mergeTimeoutMs,
      hotwords: appRef.current.asrHotwords,
    }, {
      onResult: (text, isFinal) => handleRecognitionResult(text, isFinal, speaker),
      onError: (e) => handleAsrError(e),
      onEnd: () => setListeningFromActiveSources(),
    });
    setListeningFromActiveSources();
    return ok;
  }

  async function startLocalQwenMicrophoneRecognition(speaker: 'interviewer' | 'me'): Promise<boolean> {
    if (!localQwenAsrService.isSupported()) {
      dispatch({ type: 'SET_ERROR', payload: '当前浏览器不支持 WebSocket，无法连接本地 Qwen3-ASR。' });
      return false;
    }
    try {
      qwenMicrophoneSession.current?.stop();
      const session = localQwenAsrService.createSession();
      qwenMicrophoneSession.current = session;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      let context: AudioContext | null = null;
      let source: MediaStreamAudioSourceNode | null = null;
      let processor: ScriptProcessorNode | null = null;
      let silentGain: GainNode | null = null;
      const cleanupStream = () => {
        try { processor?.disconnect(); } catch {}
        try { source?.disconnect(); } catch {}
        try { silentGain?.disconnect(); } catch {}
        processor = null;
        source = null;
        silentGain = null;
        if (context) {
          context.close().catch(() => {});
          context = null;
        }
        stream.getTracks().forEach((track) => track.stop());
      };
      session.start(withGlobalQwenHotwords(localQwenRef.current), {
        onResult: (text, isFinal) => handleRecognitionResult(text, isFinal, speaker),
        onError: (e) => { cleanupStream(); dispatch({ type: 'SET_ERROR', payload: e }); setListeningFromActiveSources(); },
        onEnd: () => {
          cleanupStream();
          if (qwenMicrophoneSession.current === session) qwenMicrophoneSession.current = null;
          setListeningFromActiveSources();
        },
        onReady: () => {
          context = new AudioContext({ sampleRate: 16000 });
          source = context.createMediaStreamSource(stream);
          processor = context.createScriptProcessor(1024, 1, 1);
          silentGain = context.createGain();
          silentGain.gain.value = 0;
          processor.onaudioprocess = (event) => {
            const input = event.inputBuffer.getChannelData(0);
            const pcm = new Int16Array(input.length);
            for (let i = 0; i < input.length; i += 1) {
              const s = Math.max(-1, Math.min(1, input[i]));
              pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
            }
            session.sendAudio(pcm);
          };
          source.connect(processor);
          processor.connect(silentGain);
          silentGain.connect(context.destination);
        },
      });
      setListeningFromActiveSources();
      return true;
    } catch (error) {
      qwenMicrophoneSession.current?.stop();
      qwenMicrophoneSession.current = null;
      dispatch({ type: 'SET_ERROR', payload: `麦克风授权失败：${error instanceof Error ? error.message : '未知错误'}` });
      return false;
    }
  }

  const prepareSystemAudioShare = useCallback(async (): Promise<boolean> => {
    if (!systemAudioService.isSupported()) {
      dispatch({ type: 'SET_ERROR', payload: '当前浏览器不支持系统音频捕获。请使用 Chrome，并在弹窗中选择共享音频。' });
      dispatch({ type: 'SET_SYSTEM_AUDIO_READY', payload: false });
      return false;
    }
    dispatch({ type: 'SET_ERROR', payload: null });
    const ok = await systemAudioService.prepare({
      onError: (e) => {
        dispatch({ type: 'SET_ERROR', payload: e });
        dispatch({ type: 'SET_SYSTEM_AUDIO_READY', payload: false });
      },
      onEnd: () => {
        dispatch({ type: 'SET_ERROR', payload: '系统音频捕获已结束，听音已停止。请重新选择面试窗口后再开始。' });
        doubaoAsrService.stop();
        openaiChunkAsrService.stop();
        localQwenAsrService.stop();
        mimoAsrService.stop();
        cloudAsrService.stop();
        asrGatewayService.stop();
        dispatch({ type: 'SET_SYSTEM_AUDIO_READY', payload: false });
        setListeningFromActiveSources();
      },
    });
    dispatch({ type: 'SET_SYSTEM_AUDIO_READY', payload: ok });
    return ok;
  }, []);

  async function startSystemAudioRecognition(speaker: 'interviewer' | 'me'): Promise<boolean> {
    if (appRef.current.asrProvider === 'local-qwen') {
      if (!systemAudioService.isSupported()) {
        dispatch({ type: 'SET_ERROR', payload: '当前浏览器不支持系统音频捕获。请使用 Chrome，并在弹窗中选择共享音频。' });
        return false;
      }

      if (!systemAudioService.isActive()) {
        const prepared = await prepareSystemAudioShare();
        if (!prepared) return false;
      }

      qwenSystemAudioSession.current?.stop();
      const session = localQwenAsrService.createSession();
      qwenSystemAudioSession.current = session;
      session.start(withGlobalQwenHotwords(localQwenRef.current), {
        onResult: (text, isFinal) => handleRecognitionResult(text, isFinal, speaker),
        onError: (e) => { dispatch({ type: 'SET_ERROR', payload: e }); setListeningFromActiveSources(); },
        onEnd: () => {
          if (qwenSystemAudioSession.current === session) qwenSystemAudioSession.current = null;
          setListeningFromActiveSources();
        },
        onReady: () => {
          void systemAudioService.start({
            onPcmData: (pcm) => session.sendAudio(pcm),
            onError: (e) => { dispatch({ type: 'SET_ERROR', payload: e }); session.stop(); setListeningFromActiveSources(); },
            onEnd: () => { session.stop(); setListeningFromActiveSources(); },
          });
        },
      });
      setListeningFromActiveSources();
      return true;
    }

    if (appRef.current.asrProvider === 'openai') {
      if (!systemAudioService.isSupported()) {
        dispatch({ type: 'SET_ERROR', payload: '当前浏览器不支持系统音频捕获。请使用 Chrome，并在弹窗中选择共享音频。' });
        return false;
      }

      if (!systemAudioService.isActive()) {
        const prepared = await prepareSystemAudioShare();
        if (!prepared) return false;
      }

      const stream = systemAudioService.getStream();
      if (!stream) {
        dispatch({ type: 'SET_ERROR', payload: '系统音频流不可用，请重新点击“先共享系统音频”，并勾选共享音频。' });
        return false;
      }

      const ok = await openaiChunkAsrService.startFromStream(stream, aiRef.current, {
        onResult: (text, isFinal) => handleRecognitionResult(text, isFinal, speaker),
        onError: (e) => { dispatch({ type: 'SET_ERROR', payload: e }); setListeningFromActiveSources(); },
        onEnd: () => setListeningFromActiveSources(),
      });
      setListeningFromActiveSources();
      return ok;
    }

    if (appRef.current.asrProvider === 'mimo') {
      if (!systemAudioService.isSupported()) {
        dispatch({ type: 'SET_ERROR', payload: '当前浏览器不支持系统音频捕获。请使用 Chrome，并在弹窗中选择共享音频。' });
        return false;
      }

      if (!systemAudioService.isActive()) {
        const prepared = await prepareSystemAudioShare();
        if (!prepared) return false;
      }

      const ok = mimoAsrService.start(mimoRef.current, {
        onResult: (text, isFinal) => handleRecognitionResult(text, isFinal, speaker),
        onError: (e) => { dispatch({ type: 'SET_ERROR', payload: e }); setListeningFromActiveSources(); },
        onEnd: () => setListeningFromActiveSources(),
      });
      if (!ok) {
        setListeningFromActiveSources();
        return false;
      }

      void systemAudioService.start({
        onPcmData: (pcm) => mimoAsrService.sendAudio(pcm),
        onError: (e) => { dispatch({ type: 'SET_ERROR', payload: e }); mimoAsrService.stop(); setListeningFromActiveSources(); },
        onEnd: () => { mimoAsrService.stop(); setListeningFromActiveSources(); },
      });
      setListeningFromActiveSources();
      return true;
    }

    if (isCloudAsrProvider(appRef.current.asrProvider)) {
      if (!systemAudioService.isSupported()) {
        dispatch({ type: 'SET_ERROR', payload: '当前浏览器不支持系统音频捕获。请使用 Chrome，并在弹窗中选择共享音频。' });
        return false;
      }

      if (!systemAudioService.isActive()) {
        const prepared = await prepareSystemAudioShare();
        if (!prepared) return false;
      }

      const provider = appRef.current.asrProvider;
      cloudAsrService.start(provider, withGlobalHotwords(cloudAsrRef.current), {
        onResult: (text, isFinal) => handleRecognitionResult(text, isFinal, speaker),
        onError: (e) => { dispatch({ type: 'SET_ERROR', payload: e }); setListeningFromActiveSources(); },
        onEnd: () => setListeningFromActiveSources(),
      });
      void systemAudioService.start({
        onPcmData: (pcm) => cloudAsrService.sendAudio(pcm),
        onError: (e) => { dispatch({ type: 'SET_ERROR', payload: e }); cloudAsrService.stop(); setListeningFromActiveSources(); },
        onEnd: () => { cloudAsrService.stop(); setListeningFromActiveSources(); },
      });
      setListeningFromActiveSources();
      return true;
    }

    if (isGatewayAsrProvider(appRef.current.asrProvider)) {
      if (!asrGatewayService.isSupported() || !systemAudioService.isSupported()) {
        dispatch({ type: 'SET_ERROR', payload: '当前浏览器不支持系统音频捕获或 WebSocket。请使用 Chrome，并在弹窗中选择共享音频。' });
        return false;
      }

      if (!systemAudioService.isActive()) {
        const prepared = await prepareSystemAudioShare();
        if (!prepared) return false;
      }

      const provider = appRef.current.asrProvider;
      asrGatewayService.start(provider, speaker, {
        doubaoConfig: doubaoRef.current,
        cloudAsrConfig: withGlobalHotwords(cloudAsrRef.current),
        asrEndWindowSize: appRef.current.mergeTimeoutMs,
        hotwords: appRef.current.asrHotwords,
      }, {
        onResult: (text, isFinal) => handleRecognitionResult(text, isFinal, speaker),
        onError: (e) => handleAsrError(e, { stopSystemAudio: true }),
        onEnd: () => setListeningFromActiveSources(),
        onReady: () => {
          dispatch({ type: 'SET_ERROR', payload: null });
        },
      });
      // Mac 原生采集不依赖 Gateway 先握手成功；连接恢复后，Gateway 会发送队列中的 PCM。
      void systemAudioService.start({
        onPcmData: (pcm) => asrGatewayService.sendAudio(pcm),
        onError: (e) => { dispatch({ type: 'SET_ERROR', payload: e }); asrGatewayService.stop(); setListeningFromActiveSources(); },
        onEnd: () => {
          dispatch({ type: 'SET_ERROR', payload: '系统音频捕获已结束，听音已停止。' });
          asrGatewayService.stop();
          setListeningFromActiveSources();
        },
      });
      setListeningFromActiveSources();
      return true;
    }

    const config = doubaoRef.current;
    if (!config.appId || !config.accessToken) {
      dispatch({ type: 'SET_ERROR', payload: '系统音频识别需要先在设置中配置豆包 ASR 的 App ID 和 Access Token。' });
      return false;
    }
    if (!doubaoAsrService.isSupported() || !systemAudioService.isSupported()) {
      dispatch({ type: 'SET_ERROR', payload: '当前浏览器不支持系统音频捕获。请使用 Chrome，并在弹窗中选择共享音频。' });
      return false;
    }

    if (!systemAudioService.isActive()) {
      const prepared = await prepareSystemAudioShare();
      if (!prepared) return false;
    }

    doubaoAsrService.start(config, {
      onResult: (text, isFinal) => handleRecognitionResult(text, isFinal, speaker),
      onError: (e) => handleAsrError(e, { stopSystemAudio: true }),
      onEnd: () => setListeningFromActiveSources(),
      onReady: () => {
        dispatch({ type: 'SET_ERROR', payload: null });
        void systemAudioService.start({
          onPcmData: (pcm) => doubaoAsrService.sendAudio(pcm),
          onError: (e) => { dispatch({ type: 'SET_ERROR', payload: e }); doubaoAsrService.stop(); setListeningFromActiveSources(); },
          onEnd: () => {
            dispatch({ type: 'SET_ERROR', payload: '系统音频捕获已结束，听音已停止。请重新选择面试窗口后再开始。' });
            doubaoAsrService.stop();
            setListeningFromActiveSources();
          },
        });
      },
    });
    return true;
  }

  // ===== 语音监听：支持麦克风、系统音频、双路同时识别 =====
  const startListening = useCallback(async () => {
    if (COMMERCIAL_MODE) {
      const latestEntitlement = await refreshBilling();
      const latestRemainingSeconds = billingService.remainingSeconds(latestEntitlement);
      if (!latestEntitlement || latestRemainingSeconds <= 0) {
        dispatch({ type: 'SET_ERROR', payload: '免费试用或购买时长已用完，请购买后继续使用。' });
        return;
      }
    }
    const app = appRef.current;
    dispatch({ type: 'SET_ERROR', payload: null });

    const desktopSystemAudioOnly = Boolean(window.desktopWindow?.isDesktop);
    const mySource = desktopSystemAudioOnly
      ? 'muted'
      : (app.myAudioSource ?? (app.audioSource === 'microphone' || app.audioSource === 'both' ? 'microphone' : 'muted'));
    const interviewerSource = desktopSystemAudioOnly
      ? 'system'
      : (app.interviewerAudioSource ?? (app.audioSource === 'system' || app.audioSource === 'both' ? 'system' : 'muted'));
    let started = false;

    const microphoneSpeaker = resolveMicrophoneSpeaker(mySource, interviewerSource);
    const systemSpeaker = resolveSystemSpeaker(mySource, interviewerSource);

    if (systemSpeaker && app.asrProvider === 'browser') {
      dispatch({
        type: 'SET_ERROR',
        payload: '浏览器识别引擎只能识别麦克风，不能识别 Chrome 共享出来的系统音频。要识别微信/腾讯会议等系统音频，请把识别引擎切到 Gateway 豆包/讯飞、豆包 ASR、本地 Qwen3-ASR、MiMo/云厂商 ASR 或 OpenAI 分片识别；或者把面试官声音改成麦克风。',
      });
      dispatch({ type: 'SET_LISTENING', payload: false });
      return;
    }

    if (systemSpeaker) {
      started = (await startSystemAudioRecognition(systemSpeaker)) || started;
    }

    if (microphoneSpeaker) {
      if (app.asrProvider === 'local-qwen') {
        started = (await startLocalQwenMicrophoneRecognition(microphoneSpeaker)) || started;
      } else if (app.asrProvider === 'mimo') {
        started = (await startMiMoMicrophoneRecognition(microphoneSpeaker)) || started;
      } else if (isCloudAsrProvider(app.asrProvider)) {
        started = (await startCloudMicrophoneRecognition(app.asrProvider, microphoneSpeaker)) || started;
      } else if (isGatewayAsrProvider(app.asrProvider)) {
        started = systemSpeaker
          ? startMicrophoneRecognition(microphoneSpeaker) || started
          : (await startGatewayMicrophoneRecognition(app.asrProvider, microphoneSpeaker)) || started;
      } else if (app.asrProvider === 'openai' && !systemSpeaker) {
        started = (await startOpenAIMicrophoneRecognition(microphoneSpeaker)) || started;
      } else {
        started = startMicrophoneRecognition(microphoneSpeaker) || started;
      }
    }

    if (mySource === 'muted' && interviewerSource === 'muted') {
      dispatch({ type: 'SET_ERROR', payload: '你和面试官都设置为静音，请至少开启一路音频。' });
    } else if (mySource === interviewerSource && mySource !== 'muted') {
      const sourceName = mySource === 'microphone' ? '麦克风' : '系统音频';
      dispatch({
        type: 'SET_ERROR',
        payload: `${sourceName} 不能同时精准区分“我”和“面试官”，当前会优先按“面试官”处理。`,
      });
    }

    dispatch({ type: 'SET_LISTENING', payload: started });
  }, [refreshBilling, sendQuestion]);

  function isCloudAsrProvider(provider: ASRProvider): provider is CloudASRProvider {
    return provider === 'baidu' || provider === 'google' || provider === 'alibaba' || provider === 'iflytek' || provider === 'glm';
  }

  function isGatewayAsrProvider(provider: ASRProvider): provider is ASRGatewayProvider {
    return provider === 'gateway-doubao' || provider === 'gateway-iflytek' || provider === 'gateway-alibaba';
  }

  function resolveMicrophoneSpeaker(
    mySource: SpeakerAudioSource,
    interviewerSource: SpeakerAudioSource,
  ): 'interviewer' | 'me' | null {
    if (interviewerSource === 'microphone') return 'interviewer';
    if (mySource === 'microphone') return 'me';
    return null;
  }

  function resolveSystemSpeaker(
    mySource: SpeakerAudioSource,
    interviewerSource: SpeakerAudioSource,
  ): 'interviewer' | 'me' | null {
    if (interviewerSource === 'system') return 'interviewer';
    if (mySource === 'system') return 'me';
    return null;
  }

  async function generateInterviewReview(): Promise<InterviewReview | undefined> {
    const sess = sessionRef.current;
    if (!sess) return undefined;
    // Commercial builds route chat through the server-managed AI gateway. A
    // personal provider key is only required by the free/self-hosted build.
    if (!COMMERCIAL_MODE && !aiRef.current.apiKey) {
      return {
        summary: '已结束并归档。本次未配置 AI Key，因此没有生成 AI 复盘。',
        strengths: [],
        risks: [],
        followUps: [],
        generatedAt: Date.now(),
      };
    }

    const transcript = buildTranscriptContext();
    const qaText = (sess.qaList ?? [])
      .map((qa, index) => `第 ${index + 1} 题：${qa.question}\n回答建议：${qa.answer || '（未生成）'}`)
      .join('\n\n');

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: '你是一位面试复盘教练。请基于面试转写和 AI 答案，输出中文复盘，格式固定为：总结、表现亮点、风险点、后续准备。每部分简洁但具体。',
      },
      {
        role: 'user',
        content: `面试项目：${sess.name}\n岗位：${sess.targetRole ?? '未设置'}\n\n双方转写：\n${transcript || '（无）'}\n\n问题和答案：\n${qaText || '（无）'}`,
      },
    ];

    let content = '';
    await chat(messages, aiRef.current, (chunk) => {
      content += chunk;
    });

    return {
      summary: content.trim() || '已结束并归档。',
      strengths: [],
      risks: [],
      followUps: [],
      generatedAt: Date.now(),
    };
  }

  const endInterview = useCallback(async () => {
    speechService.stop();
    systemAudioService.stop();
    doubaoAsrService.stop();
    openaiChunkAsrService.stop();
    localQwenAsrService.stop();
    mimoAsrService.stop();
    cloudAsrService.stop();
    asrGatewayService.stop();
    dispatch({ type: 'SET_LISTENING', payload: false });
    dispatch({ type: 'SET_SYSTEM_AUDIO_READY', payload: false });
    commitInterimQuestion();
    flushMergeBuffer();
    dispatch({ type: 'SET_PROCESSING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });
    try {
      const review = await generateInterviewReview();
      archiveActiveSession(review);
    } catch (error) {
      archiveActiveSession({
        summary: `已结束并归档，但复盘生成失败：${error instanceof Error ? error.message : '未知错误'}`,
        strengths: [],
        risks: [],
        followUps: [],
        generatedAt: Date.now(),
      });
    } finally {
      dispatch({ type: 'SET_PROCESSING', payload: false });
      dispatch({ type: 'SET_INTERIM', payload: '' });
    }
  }, [archiveActiveSession, sendQuestion]);

  const stopListening = useCallback(() => {
    speechService.stop();
    systemAudioService.stop();
    doubaoAsrService.stop();
    openaiChunkAsrService.stop();
    localQwenAsrService.stop();
    mimoAsrService.stop();
    cloudAsrService.stop();
    asrGatewayService.stop();
    dispatch({ type: 'SET_LISTENING', payload: false });
    // 立即 flush 合并缓冲区
    commitInterimQuestion();
    flushMergeBuffer();
  }, [sendQuestion]);

  // ===== 其余方法 =====
  const addManualQuestion = useCallback((q: string) => sendQuestion(q), [sendQuestion]);

  const editQuestion = useCallback((id: string, q: string) => { void regenerateAnswer(id, { question: q }); }, [regenerateAnswer]);

  const deleteQuestion = useCallback((id: string) => {
    const sess = sessionRef.current;
    if (!sess) return;
    updateSessionQAList(sess.qaList.filter((qa) => qa.id !== id));
  }, [updateSessionQAList]);

  const generateReview = useCallback(async () => {
    dispatch({ type: 'SET_PROCESSING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });
    try {
      const review = await generateInterviewReview();
      if (review) updateSessionReview(review);
    } catch (error) {
      dispatch({
        type: 'SET_ERROR',
        payload: `复盘生成失败：${error instanceof Error ? error.message : '未知错误'}`,
      });
    } finally {
      dispatch({ type: 'SET_PROCESSING', payload: false });
    }
  }, [updateSessionReview]);

  const clearHistory = useCallback(() => {
    updateSessionQAList([]);
    updateSessionTranscriptLines([]);
    dispatch({ type: 'CLEAR_TRANSCRIPT' });
    dispatch({ type: 'SET_ERROR', payload: null });
  }, [updateSessionQAList, updateSessionTranscriptLines]);

  const stopGeneration = useCallback(() => {
    stopAllGenerations();
    dispatch({ type: 'SET_PROCESSING', payload: false });
    const sess = sessionRef.current;
    if (sess) {
      updateSessionQAList(sess.qaList.map((qa) => (
        qa.isStreaming ? { ...qa, isStreaming: false, error: '已手动停止生成。' } : qa
      )));
    }
  }, [updateSessionQAList]);

  const value: InterviewContextValue = {
    ...state,
    qaList,
    startListening,
    stopListening,
    sendQuestion,
    regenerateAnswer,
    stopGeneration,
    editQuestion,
    deleteQuestion,
    addManualQuestion,
    triggerLatestTranscriptQuestion,
    prepareSystemAudioShare,
    generateReview,
    endInterview,
    toggleGenerationPause,
    setGenerationPaused,
    clearHistory,
  };

  return <InterviewContext.Provider value={value}>{children}</InterviewContext.Provider>;
}
