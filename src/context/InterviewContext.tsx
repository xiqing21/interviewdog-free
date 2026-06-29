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
import type { QAItem, ChatMessage, TranscriptLine, InterviewReview, SpeakerAudioSource } from '../types';
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
  regenerateAnswer: (id: string, newQuestion?: string) => Promise<void>;
  editQuestion: (id: string, question: string) => void;
  deleteQuestion: (id: string) => void;
  addManualQuestion: (question: string) => Promise<void>;
  triggerLatestTranscriptQuestion: () => Promise<void>;
  prepareSystemAudioShare: () => Promise<boolean>;
  generateReview: () => Promise<void>;
  endInterview: () => Promise<void>;
  clearHistory: () => void;
}

export const InterviewContext = createContext<InterviewContextValue | null>(null);

// ===== Provider =====
export function InterviewProvider({ children }: { children: ReactNode }) {
  const { aiSettings, appSettings, doubaoConfig, localQwenConfig } = useSettings();
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

  // 持久化当前 session 的 qaList
  const qaList = activeSession?.qaList ?? [];
  useEffect(() => {
    if (activeSession?.id === lastSessionId.current) return;
    speechService.stop();
    systemAudioService.stop();
    doubaoAsrService.stop();
    openaiChunkAsrService.stop();
    localQwenAsrService.stop();
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
  function buildSystemPrompt(): string {
    const mode = activeSession?.answerMode ?? 'concise';
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

    // 注入简历+JD
    const currentResume = session?.resume ?? resumeRef.current;
    const currentJd = session?.jd ?? jdRef.current;
    if (currentResume || currentJd) {
      const rj = RESUME_JD_PROMPT_TEMPLATE
        .replace('{resume}', currentResume || '（未设置）')
        .replace('{jd}', currentJd || '（未设置）');
      prompt += '\n\n' + rj;
    }

    const knowledge = knowledgeRef.current;
    const resumeLibrary = knowledge.resumes
      .filter((item) => item.content.trim())
      .slice(-5)
      .map((item) => `### ${item.name}\n${item.content.slice(0, 6000)}`)
      .join('\n\n');
    if (resumeLibrary || knowledge.expertKnowledge.trim()) {
      prompt += '\n\n## 全局简历库与专家知识库';
      if (resumeLibrary) {
        prompt += `\n${resumeLibrary}`;
      }
      if (knowledge.expertKnowledge.trim()) {
        prompt += `\n\n### 专家知识库\n${knowledge.expertKnowledge.slice(0, 10000)}`;
      }
      prompt += '\n\n回答时请优先结合这些材料，提炼成自然口述，不要机械照抄。';
    }

    return prompt;
  }

  function formatSearchResults(results: Awaited<ReturnType<typeof webSearch>>): string {
    if (results.length === 0) return '（未搜索到可用结果）';
    return results
      .map((item, index) => `${index + 1}. ${item.title}\n${item.snippet}\n${item.url}`)
      .join('\n\n');
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
      const normalized = normalizeTranscriptText(trimmed);
      const alreadyQueued = queuedQuestions.current.some((item) => normalizeTranscriptText(item) === normalized);
      const alreadyAnswered = sessionRef.current?.qaList.some((qa) => normalizeTranscriptText(qa.question) === normalized);
      if (!alreadyQueued && !alreadyAnswered) {
        queuedQuestions.current.push(trimmed);
      }
      return;
    }

    const id = generateId();
    const qaItem: QAItem = { id, question: trimmed, answer: '', timestamp: Date.now(), isStreaming: true };

    // 添加到 session
    const sess = sessionRef.current;
    if (sess) {
      const newQaList = [...sess.qaList, qaItem];
      updateSessionQAList(newQaList);
    }

    dispatch({ type: 'SET_PROCESSING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });

    const settings = aiRef.current;
    const messages: ChatMessage[] = [
      { role: 'system', content: buildSystemPrompt() },
    ];

    const contextSize = settings.contextWindowSize;
    const currentQA = sessionRef.current?.qaList ?? [];
    const recentQA = currentQA.slice(-contextSize);
    for (const qa of recentQA) {
      if (qa.id === id) continue;
      messages.push({ role: 'user', content: qa.question });
      if (qa.answer) messages.push({ role: 'assistant', content: qa.answer });
    }
    const transcriptContext = buildTranscriptContext();
    messages.push({
      role: 'user',
      content: transcriptContext
        ? `以下是最近的双路语音转写上下文，请结合“我”的回答和“面试官”的问题生成答案。\n\n${transcriptContext}\n\n请回答面试官最新问题：${trimmed}`
        : trimmed,
    });

    let accumulated = '';
    try {
      const runChat = async (chatMessages: ChatMessage[]) => chat(chatMessages, settings, (chunk: string) => {
        accumulated += chunk;
        const sess2 = sessionRef.current;
        if (sess2) {
          updateSessionQAList(
            sess2.qaList.map((qa) =>
              qa.id === id ? { ...qa, answer: accumulated, isStreaming: true } : qa,
            ),
          );
        }
      });
      await runChat(messages);
      const sess3 = sessionRef.current;
      if (sess3) {
        updateSessionQAList(
          sess3.qaList.map((qa) =>
            qa.id === id ? { ...qa, answer: accumulated, isStreaming: false } : qa,
          ),
        );
      }
    } catch (error) {
      if (appRef.current.webSearchEnabled) {
        try {
          const results = await webSearch(trimmed);
          accumulated = '';
          const retryMessages: ChatMessage[] = [
            { role: 'system', content: `${buildSystemPrompt()}\n\n已启用联网搜索补充。请结合搜索摘要回答；如果搜索结果质量一般，请明确以简历/知识库为主。` },
            {
              role: 'user',
              content: `面试官问题：${trimmed}\n\n联网搜索摘要：\n${formatSearchResults(results)}\n\n请生成可直接口述的面试答案。`,
            },
          ];
          await chat(retryMessages, settings, (chunk: string) => {
            accumulated += chunk;
            const sessRetry = sessionRef.current;
            if (sessRetry) {
              updateSessionQAList(
                sessRetry.qaList.map((qa) =>
                  qa.id === id ? { ...qa, answer: accumulated, isStreaming: true, error: undefined } : qa,
                ),
              );
            }
          });
          const sessRetryDone = sessionRef.current;
          if (sessRetryDone) {
            updateSessionQAList(
              sessRetryDone.qaList.map((qa) =>
                qa.id === id ? { ...qa, answer: accumulated, isStreaming: false, error: undefined } : qa,
              ),
            );
          }
          return;
        } catch (searchError) {
          const errMsg = `生成回答失败，联网搜索补充也失败：${searchError instanceof Error ? searchError.message : '未知错误'}`;
          const sess4 = sessionRef.current;
          if (sess4) {
            updateSessionQAList(
              sess4.qaList.map((qa) =>
                qa.id === id ? { ...qa, error: errMsg, isStreaming: false } : qa,
              ),
            );
          }
          dispatch({ type: 'SET_ERROR', payload: errMsg });
          return;
        }
      }
      const errMsg = error instanceof Error ? error.message : '生成回答时发生未知错误';
      const sess4 = sessionRef.current;
      if (sess4) {
        updateSessionQAList(
          sess4.qaList.map((qa) =>
            qa.id === id ? { ...qa, error: errMsg, isStreaming: false } : qa,
          ),
        );
      }
      dispatch({ type: 'SET_ERROR', payload: errMsg });
    } finally {
      dispatch({ type: 'SET_PROCESSING', payload: false });
      const nextQuestion = queuedQuestions.current.shift();
      if (nextQuestion) {
        window.setTimeout(() => {
          void sendQuestion(nextQuestion);
        }, 0);
      }
    }
  }, [updateSessionQAList]);

  // ===== 重新生成答案 =====
  const regenerateAnswer = useCallback(async (id: string, newQuestion?: string) => {
    if (isProcessingRef.current) return;
    const sess = sessionRef.current;
    if (!sess) return;
    const qaItem = sess.qaList.find((q) => q.id === id);
    if (!qaItem) return;

    const question = newQuestion ?? qaItem.question;
    dispatch({ type: 'SET_PROCESSING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });

    const settings = aiRef.current;
    const messages: ChatMessage[] = [
      { role: 'system', content: buildSystemPrompt() },
    ];
    const allQA = sessionRef.current?.qaList ?? [];
    const itemIndex = allQA.findIndex((q) => q.id === id);
    const recentQA = allQA.slice(Math.max(0, itemIndex - settings.contextWindowSize), itemIndex);
    for (const qa of recentQA) {
      messages.push({ role: 'user', content: qa.question });
      if (qa.answer) messages.push({ role: 'assistant', content: qa.answer });
    }
    const transcriptContext = buildTranscriptContext();
    messages.push({
      role: 'user',
      content: transcriptContext
        ? `以下是最近的双路语音转写上下文，请结合“我”的回答和“面试官”的问题重新生成答案。\n\n${transcriptContext}\n\n请回答面试官问题：${question}`
        : question,
    });

    let accumulated = '';
    try {
      await chat(messages, settings, (chunk: string) => {
        accumulated += chunk;
        const s2 = sessionRef.current;
        if (s2) {
          updateSessionQAList(
            s2.qaList.map((q) =>
              q.id === id ? { ...q, answer: accumulated, isStreaming: true } : q,
            ),
          );
        }
      });
      const s3 = sessionRef.current;
      if (s3) {
        updateSessionQAList(
          s3.qaList.map((q) =>
            q.id === id ? { ...q, answer: accumulated, isStreaming: false } : q,
          ),
        );
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : '未知错误';
      const s4 = sessionRef.current;
      if (s4) {
        updateSessionQAList(
          s4.qaList.map((q) =>
            q.id === id ? { ...q, error: errMsg, isStreaming: false } : q,
          ),
        );
      }
    } finally {
      dispatch({ type: 'SET_PROCESSING', payload: false });
    }
  }, [updateSessionQAList]);

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
        localQwenAsrService.isActive(),
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
      session.start(localQwenRef.current, {
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
      session.start(localQwenRef.current, {
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
        payload: '浏览器识别引擎只能识别麦克风，不能识别 Chrome 共享出来的系统音频。要识别微信/腾讯会议等系统音频，请把识别引擎切到豆包 ASR、本地 Qwen3-ASR 或 OpenAI 分片识别；或者把面试官声音改成麦克风。',
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
    dispatch({ type: 'SET_LISTENING', payload: false });
    // 立即 flush 合并缓冲区
    commitInterimQuestion();
    flushMergeBuffer();
  }, [sendQuestion]);

  // ===== 其余方法 =====
  const addManualQuestion = useCallback((q: string) => sendQuestion(q), [sendQuestion]);

  const editQuestion = useCallback((id: string, q: string) => { void regenerateAnswer(id, q); }, [regenerateAnswer]);

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

  const value: InterviewContextValue = {
    ...state,
    qaList,
    startListening,
    stopListening,
    sendQuestion,
    regenerateAnswer,
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
