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
  KnowledgeQAPair,
  WebSearchResult,
} from '../types';
import {
  STORAGE_KEYS,
  MERGE_TIMEOUT_DEFAULT,
  RESUME_JD_PROMPT_TEMPLATE,
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
import type { LocalQwenSession } from '../services/localQwenAsrService';
import { chat } from '../services/aiService';
import { webSearch } from '../services/webSearchService';
import { useSettings } from '../hooks/useSettings';
import { useSession } from '../hooks/useSession';
import { useKnowledge } from '../hooks/useKnowledge';

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
  clearHistory: () => void;
}

export interface RegenerateAnswerOptions {
  question?: string;
  mode?: AnswerGenerationMode;
}

export const InterviewContext = createContext<InterviewContextValue | null>(null);

// ===== Provider =====
export function InterviewProvider({ children }: { children: ReactNode }) {
  const { aiSettings, appSettings, doubaoConfig, localQwenConfig, mimoConfig, cloudAsrConfig } = useSettings();
  const { profile: knowledgeProfile } = useKnowledge();
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
  const isProcessingRef = useRef(false); isProcessingRef.current = state.isProcessing;
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
  const queuedQuestions = useRef<string[]>([]);
  const qwenMicrophoneSession = useRef<LocalQwenSession | null>(null);
  const qwenSystemAudioSession = useRef<LocalQwenSession | null>(null);
  const generationAbortController = useRef<AbortController | null>(null);
  const generationRunId = useRef(0);

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
    queuedQuestions.current = [];
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

  // ===== 构建系统提示词 =====
  function buildSystemPrompt(modeOverride?: 'concise' | 'detailed', options: { includeProfileContext?: boolean } = {}): string {
    const includeProfileContext = options.includeProfileContext ?? true;
    const mode = modeOverride ?? activeSession?.answerMode ?? 'concise';
    const modePrompt = ANSWER_MODES.find((m) => m.key === mode)?.prompt ?? '';
    let prompt = modePrompt;
    prompt += mode === 'detailed'
      ? '\n\n当前选择：详细。请明显展开，不要压缩成短答；开放题至少给 4-6 个段落或结构化要点。'
      : '\n\n当前选择：简洁。请保持口语化但不要敷衍；通常给 3-5 个可直接说出口的要点。';
    const session = sessionRef.current;

    if (session?.targetRole || session?.focusAreas?.length) {
      prompt += '\n\n## 当前面试项目';
      if (session.targetRole) {
        prompt += `\n岗位方向：${session.targetRole}`;
      }
      if (session.focusAreas?.length) {
        prompt += `\n重点考察：${session.focusAreas.join('、')}`;
      }
      prompt += '\n回答时请优先贴合以上岗位和考察方向。';
    }

    if (includeProfileContext) {
      // 注入简历+JD
      const currentResume = session ? session.resume ?? '' : resumeRef.current;
      const currentJd = session ? session.jd ?? '' : jdRef.current;
      if (currentResume || currentJd) {
        const rj = RESUME_JD_PROMPT_TEMPLATE
          .replace('{resume}', currentResume || '（未设置）')
          .replace('{jd}', currentJd || '（未设置）');
        prompt += '\n\n' + rj;
      }

      const generalKnowledge = buildGeneralKnowledgeContext();
      if (generalKnowledge) {
        prompt += `\n\n## 当前项目挂载的专家知识库摘要\n${generalKnowledge}`;
        prompt += '\n\n回答时请优先结合相关材料，提炼成自然口述，不要机械照抄；QA 命中内容优先级最高。';
      }
    }

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

  function buildGeneralKnowledgeContext(): string {
    const session = sessionRef.current;
    const parts: string[] = [];
    const manual = session?.expertKnowledge?.trim();
    if (manual) {
      parts.push(`### 本项目临时补充\n${manual.slice(0, 2500)}`);
    }

    const items = selectedKnowledgeItems();
    if (items.length === 0 && !manual) {
      if (session) return '';
      const legacy = knowledgeRef.current.expertKnowledge?.trim();
      if (legacy) return legacy.slice(0, 3000);
    }

    let budget = 6500;
    for (const item of items) {
      if (budget <= 0) break;
      const type = knowledgeTypeLabel(item);
      const content = item.type === 'qa' && item.qaPairs?.length
        ? item.qaPairs.slice(0, 8).map((pair) => `Q: ${pair.question}\nA: ${pair.answer}`).join('\n\n')
        : item.content;
      const chunk = `### ${item.name}（${type}）\n${content.slice(0, Math.min(1600, budget))}`;
      parts.push(chunk);
      budget -= chunk.length;
    }
    return parts.join('\n\n').slice(0, 8000);
  }

  function buildMatchedQAContext(question: string): string {
    const pairs = selectedKnowledgeItems()
      .filter((item) => item.type === 'qa' && item.qaPairs?.length)
      .flatMap((item) => (item.qaPairs ?? []).map((pair) => ({ item, pair, score: qaMatchScore(question, pair) })))
      .filter((entry) => entry.score >= 0.16)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    if (pairs.length === 0) return '';
    return pairs
      .map((entry, index) => `${index + 1}. 来源：${entry.item.name}\nQ: ${entry.pair.question}\nA: ${entry.pair.answer}`)
      .join('\n\n')
      .slice(0, 4500);
  }

  function qaMatchScore(question: string, pair: KnowledgeQAPair): number {
    const q = normalizeTranscriptText(question);
    const target = normalizeTranscriptText(`${pair.question}${pair.answer}`);
    if (!q || !target) return 0;
    if (target.includes(q) || q.includes(normalizeTranscriptText(pair.question))) return 1;
    return textSimilarity(q, target);
  }

  function knowledgeTypeLabel(item: KnowledgeLibraryItem): string {
    if (item.type === 'qa') return 'QA';
    if (item.type === 'webpage') return '网页';
    if (item.type === 'text') return '文本';
    return '文档';
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
      return '请用简洁模式重新生成：控制在 4-6 个口述要点内，但必须覆盖结论、依据、项目例子和落地结果。';
    }
    if (mode === 'detailed') {
      return '请用详细模式重新生成：明显展开，按背景、方案、技术细节、结果、可追问点组织，适合 1.5-3 分钟口述。';
    }
    if (mode === 'star') {
      return '请用 STAR 结构生成：Situation 背景、Task 任务、Action 行动、Result 结果。每一段都要自然口语化，突出我做了什么、为什么这么做、结果如何。';
    }
    if (mode === 'no-context') {
      return '请清除上下文重新生成：不要引用简历、专家知识库、历史问答、最近转写或联网搜索结果，只基于面试官当前问题回答。回答仍要完整，给出可直接口述的结构化答案。';
    }
    if (mode === 'star-no-context') {
      return '请清除上下文并用 STAR 结构重新生成：不要引用简历、专家知识库、历史问答、最近转写或联网搜索结果，只基于问题本身，按 Situation、Task、Action、Result 输出通用但可信的回答。';
    }
    return '请生成可直接口述的面试答案。';
  }

  function buildPromptForMode(mode: AnswerGenerationMode): string {
    if (mode === 'no-context' || mode === 'star-no-context') {
      return modeInstruction(mode);
    }
    const forcedMode = mode === 'concise' ? 'concise' : mode === 'detailed' ? 'detailed' : undefined;
    return `${buildSystemPrompt(forcedMode)}\n\n${modeInstruction(mode)}`;
  }

  function generationPolicy(mode: AnswerGenerationMode) {
    const clearContext = mode === 'no-context' || mode === 'star-no-context';
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

  function stopActiveGeneration(): void {
    generationAbortController.current?.abort();
    generationAbortController.current = null;
    generationRunId.current += 1;
  }

  function interruptStreamingAnswers(message = '已被新的问题打断。'): void {
    const sess = sessionRef.current;
    if (!sess) return;
    updateSessionQAList(sess.qaList.map((qa) => (
      qa.isStreaming ? { ...qa, isStreaming: false, error: qa.answer ? undefined : message } : qa
    )));
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

  function isLikelyQuestionText(text: string): boolean {
    const normalized = normalizeTranscriptText(text);
    if (normalized.length >= 8) return true;
    return /(吗|呢|么|什么|为什么|怎么|如何|介绍|讲|说|项目|架构|实现|区别|原理|经历|方案|问题|请)/.test(text);
  }

  function buildTranscriptContext(): string {
    const lines = transcriptRef.current.slice(-12);
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
    if (isProcessingRef.current) {
      stopActiveGeneration();
      interruptStreamingAnswers();
      dispatch({ type: 'SET_PROCESSING', payload: false });
    }

    const id = generateId();
    const qaItem: QAItem = { id, question: trimmed, answer: '', timestamp: Date.now(), isStreaming: true, generationMode: 'normal' };

    // 添加到 session
    const sess = sessionRef.current;
    if (sess) {
      const newQaList = [...sess.qaList, qaItem];
      updateSessionQAList(newQaList);
    }

    await runAnswerGeneration(id, trimmed, 'normal', { queueNext: true });
  }, [updateSessionQAList]);

  // ===== 重新生成答案 =====
  const regenerateAnswer = useCallback(async (id: string, options: RegenerateAnswerOptions = {}) => {
    stopActiveGeneration();
    const sess = sessionRef.current;
    if (!sess) return;
    const qaItem = sess.qaList.find((q) => q.id === id);
    if (!qaItem) return;

    const question = options.question ?? qaItem.question;
    await runAnswerGeneration(id, question, options.mode ?? 'normal');
  }, [updateSessionQAList]);

  async function runAnswerGeneration(
    id: string,
    question: string,
    mode: AnswerGenerationMode,
    options: { queueNext?: boolean } = {},
  ): Promise<void> {
    stopActiveGeneration();
    const controller = new AbortController();
    generationAbortController.current = controller;
    const runId = generationRunId.current;
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
      const recentQA = allQA.slice(Math.max(0, itemIndex - settings.contextWindowSize), itemIndex);
      for (const qa of recentQA) {
        messages.push({ role: 'user', content: qa.question });
        if (qa.answer) messages.push({ role: 'assistant', content: qa.answer });
      }
    }
    const transcriptContext = policy.includeTranscript ? buildTranscriptContext() : '';
    let searchResults: WebSearchResult[] = [];
    if (policy.includeSearch) {
      try {
        searchResults = await webSearch(question, controller.signal);
        if (runId === generationRunId.current && searchResults.length) {
          updateQA(id, { searchResults });
        }
      } catch (searchError) {
        if (!isAbortError(searchError)) {
          updateQA(id, { searchResults: [] });
        }
      }
    }

    const searchContext = searchResults.length
      ? `\n\n联网搜索结果：\n${formatSearchResults(searchResults)}\n\n请把搜索结果作为补充资料使用；如与简历/专家库冲突，以候选人真实经历优先。`
      : '';
    const matchedQA = policy.includeProfileKnowledge ? buildMatchedQAContext(question) : '';
    const qaKnowledgeContext = matchedQA
      ? `\n\n命中的专家库 QA（优先参考）：\n${matchedQA}`
      : '';
    const hotwords = policy.includeHotwords ? parseHotwords(appRef.current.asrHotwords) : [];
    const hotwordContext = hotwords.length ? `\n\n语音识别热词/专业词：${hotwords.join('、')}` : '';
    const modeContext = `\n\n本次重新生成要求：${modeInstruction(mode)}`;
    messages.push({
      role: 'user',
      content: transcriptContext
        ? `以下是最近的双路语音转写上下文，请结合“我”的回答和“面试官”的问题生成答案。\n\n${transcriptContext}${qaKnowledgeContext}${searchContext}${hotwordContext}${modeContext}\n\n请回答面试官问题：${question}`
        : `面试官问题：${question}${qaKnowledgeContext}${searchContext}${hotwordContext}${modeContext}`,
    });

    let accumulated = '';
    const generationTimeout = window.setTimeout(() => {
      controller.abort();
    }, 75_000);
    try {
      await chat(messages, settings, (chunk: string) => {
        if (runId !== generationRunId.current) return;
        accumulated += chunk;
        updateQA(id, { answer: accumulated, isStreaming: true, error: undefined });
      }, controller.signal);
      if (runId === generationRunId.current) {
        updateQA(id, { answer: accumulated, isStreaming: false, error: undefined });
      }
    } catch (error) {
      if (isAbortError(error)) {
        if (runId === generationRunId.current) {
          updateQA(id, { isStreaming: false, error: accumulated ? undefined : '生成超时或已被打断，请点“重新生成/简洁/详细”再试。' });
        }
        return;
      }
      const errMsg = error instanceof Error ? error.message : '未知错误';
      updateQA(id, { error: errMsg, isStreaming: false });
      dispatch({ type: 'SET_ERROR', payload: errMsg });
    } finally {
      window.clearTimeout(generationTimeout);
      if (runId === generationRunId.current) {
        generationAbortController.current = null;
        dispatch({ type: 'SET_PROCESSING', payload: false });
        if (options.queueNext) {
          const nextQuestion = queuedQuestions.current.shift();
          if (nextQuestion) {
            window.setTimeout(() => {
              void sendQuestion(nextQuestion);
            }, 0);
          }
        }
      }
    }
  }

  // ===== 问题合并逻辑 =====
  function flushMergeBuffer() {
    if (mergeBuffer.current.length > 0) {
      const merged = mergeBuffer.current.join(' ');
      mergeBuffer.current = [];
      dispatch({ type: 'SET_MERGING', payload: false });
      dispatch({ type: 'SET_CURRENT_QUESTION', payload: merged });
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
    void sendQuestion(question);
    return question;
  }

  function scheduleInterimQuestionCommit(text: string): void {
    const cleaned = cleanupInterimText(text);
    const normalized = normalizeTranscriptText(cleaned);
    if (!cleaned || !normalized || !isLikelyQuestionText(cleaned)) return;

    if (normalized === pendingInterimNormalized.current) {
      pendingInterimQuestion.current = cleaned;
      return;
    }

    pendingInterimQuestion.current = cleaned;
    pendingInterimNormalized.current = normalized;
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
      onError: (e) => { dispatch({ type: 'SET_ERROR', payload: e }); setListeningFromActiveSources(); },
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
        onError: (e) => { dispatch({ type: 'SET_ERROR', payload: e }); setListeningFromActiveSources(); },
        onEnd: () => setListeningFromActiveSources(),
        onReady: () => {
          if (systemAudioService.isActive()) return;
          void systemAudioService.start({
            onPcmData: (pcm) => asrGatewayService.sendAudio(pcm),
            onError: (e) => { dispatch({ type: 'SET_ERROR', payload: e }); asrGatewayService.stop(); setListeningFromActiveSources(); },
            onEnd: () => { asrGatewayService.stop(); setListeningFromActiveSources(); },
          });
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
      onError: (e) => { dispatch({ type: 'SET_ERROR', payload: e }); setListeningFromActiveSources(); },
      onEnd: () => setListeningFromActiveSources(),
      onReady: () => {
        void systemAudioService.start({
          onPcmData: (pcm) => doubaoAsrService.sendAudio(pcm),
          onError: (e) => { dispatch({ type: 'SET_ERROR', payload: e }); doubaoAsrService.stop(); setListeningFromActiveSources(); },
          onEnd: () => { doubaoAsrService.stop(); setListeningFromActiveSources(); },
        });
      },
    });
    return true;
  }

  // ===== 语音监听：支持麦克风、系统音频、双路同时识别 =====
  const startListening = useCallback(async () => {
    const app = appRef.current;
    dispatch({ type: 'SET_ERROR', payload: null });

    const mySource = app.myAudioSource ?? (app.audioSource === 'microphone' || app.audioSource === 'both' ? 'microphone' : 'muted');
    const interviewerSource = app.interviewerAudioSource ?? (app.audioSource === 'system' || app.audioSource === 'both' ? 'system' : 'muted');
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
  }, [sendQuestion]);

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
    if (!aiRef.current.apiKey) {
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
    stopActiveGeneration();
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
    clearHistory,
  };

  return <InterviewContext.Provider value={value}>{children}</InterviewContext.Provider>;
}
