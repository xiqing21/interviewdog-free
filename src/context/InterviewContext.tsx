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
import type { QAItem, ChatMessage } from '../types';
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
import { chat } from '../services/aiService';
import { useSettings } from '../hooks/useSettings';
import { useSession } from '../hooks/useSession';

// ===== State =====
export interface InterviewState {
  currentQuestion: string;
  interimText: string;
  isListening: boolean;
  isProcessing: boolean;
  isMerging: boolean;
  speechSupported: boolean;
  error: string | null;
}

type InterviewAction =
  | { type: 'SET_CURRENT_QUESTION'; payload: string }
  | { type: 'SET_INTERIM'; payload: string }
  | { type: 'SET_LISTENING'; payload: boolean }
  | { type: 'SET_PROCESSING'; payload: boolean }
  | { type: 'SET_MERGING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null };

function getInitialState(): InterviewState {
  return {
    currentQuestion: '',
    interimText: '',
    isListening: false,
    isProcessing: false,
    isMerging: false,
    speechSupported: speechService.isSupported() || doubaoAsrService.isSupported(),
    error: null,
  };
}

function interviewReducer(state: InterviewState, action: InterviewAction): InterviewState {
  switch (action.type) {
    case 'SET_CURRENT_QUESTION': return { ...state, currentQuestion: action.payload };
    case 'SET_INTERIM': return { ...state, interimText: action.payload };
    case 'SET_LISTENING': return { ...state, isListening: action.payload };
    case 'SET_PROCESSING': return { ...state, isProcessing: action.payload };
    case 'SET_MERGING': return { ...state, isMerging: action.payload };
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
  addManualQuestion: (question: string) => Promise<void>;
  clearHistory: () => void;
}

export const InterviewContext = createContext<InterviewContextValue | null>(null);

// ===== Provider =====
export function InterviewProvider({ children }: { children: ReactNode }) {
  const { aiSettings, appSettings, doubaoConfig } = useSettings();
  const { activeSession, updateSessionQAList, resume, jd } = useSession();
  const [state, dispatch] = useReducer(interviewReducer, undefined, getInitialState);

  const stateRef = useRef(state); stateRef.current = state;
  const aiRef = useRef(aiSettings); aiRef.current = aiSettings;
  const appRef = useRef(appSettings); appRef.current = appSettings;
  const doubaoRef = useRef(doubaoConfig); doubaoRef.current = doubaoConfig;
  const sessionRef = useRef(activeSession); sessionRef.current = activeSession;
  const resumeRef = useRef(resume); resumeRef.current = resume;
  const jdRef = useRef(jd); jdRef.current = jd;
  const isProcessingRef = useRef(false); isProcessingRef.current = state.isProcessing;

  // 合并缓冲区
  const mergeBuffer = useRef<string[]>([]);
  const mergeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 持久化当前 session 的 qaList
  const qaList = activeSession?.qaList ?? [];
  useEffect(() => {
    storageService.set(STORAGE_KEYS.QA_LIST, qaList);
  }, [qaList]);

  // ===== 构建系统提示词 =====
  function buildSystemPrompt(): string {
    const mode = activeSession?.answerMode ?? 'concise';
    const modePrompt = ANSWER_MODES.find((m) => m.key === mode)?.prompt ?? '';
    let prompt = modePrompt;

    // 注入简历+JD
    const currentResume = resumeRef.current;
    const currentJd = jdRef.current;
    if (currentResume || currentJd) {
      const rj = RESUME_JD_PROMPT_TEMPLATE
        .replace('{resume}', currentResume || '（未设置）')
        .replace('{jd}', currentJd || '（未设置）');
      prompt += '\n\n' + rj;
    }

    return prompt;
  }

  // ===== 发送问题给 AI =====
  const sendQuestion = useCallback(async (question: string) => {
    const trimmed = question.trim();
    if (!trimmed || isProcessingRef.current) return;

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
    messages.push({ role: 'user', content: trimmed });

    let accumulated = '';
    try {
      await chat(messages, settings, (chunk: string) => {
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
      const sess3 = sessionRef.current;
      if (sess3) {
        updateSessionQAList(
          sess3.qaList.map((qa) =>
            qa.id === id ? { ...qa, answer: accumulated, isStreaming: false } : qa,
          ),
        );
      }
    } catch (error) {
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
    messages.push({ role: 'user', content: question });

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

  function handleRecognitionResult(text: string, isFinal: boolean) {
    if (isFinal) {
      const app = appRef.current;
      const timeout = app.mergeTimeoutMs || MERGE_TIMEOUT_DEFAULT;
      mergeBuffer.current.push(text);
      dispatch({ type: 'SET_MERGING', payload: true });
      dispatch({ type: 'SET_INTERIM', payload: '' });

      // 清除旧定时器，重新计时
      if (mergeTimer.current) clearTimeout(mergeTimer.current);
      mergeTimer.current = setTimeout(() => {
        flushMergeBuffer();
        mergeTimer.current = null;
      }, timeout);
    } else {
      dispatch({ type: 'SET_INTERIM', payload: text });
    }
  }

  // ===== 语音监听（路由：系统音频→豆包ASR / 麦克风→浏览器ASR） =====
  const startListening = useCallback(() => {
    const app = appRef.current;
    dispatch({ type: 'SET_LISTENING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });

    if (app.audioSource === 'system') {
      // 系统音频 → 优先豆包ASR，降级浏览器ASR
      if (app.asrProvider === 'doubao' && doubaoAsrService.isSupported()) {
        const config = doubaoRef.current;
        if (!config.appId || !config.accessToken) {
          dispatch({ type: 'SET_ERROR', payload: '请先在设置中配置豆包 ASR 的 App ID 和 Access Token。' });
          dispatch({ type: 'SET_LISTENING', payload: false });
          return;
        }
        doubaoAsrService.start(config, {
          onResult: (text, isFinal) => handleRecognitionResult(text, isFinal),
          onError: (e) => { dispatch({ type: 'SET_ERROR', payload: e }); dispatch({ type: 'SET_LISTENING', payload: false }); },
          onEnd: () => dispatch({ type: 'SET_LISTENING', payload: false }),
        });
        // 启动系统音频并馈入豆包 ASR
        systemAudioService.start({
          onPcmData: (pcm) => doubaoAsrService.sendAudio(pcm),
          onError: (e) => { dispatch({ type: 'SET_ERROR', payload: e }); dispatch({ type: 'SET_LISTENING', payload: false }); },
          onEnd: () => { doubaoAsrService.stop(); dispatch({ type: 'SET_LISTENING', payload: false }); },
        });
        return;
      }
      // 降级：系统音频 → 浏览器 ASR（注意：浏览器 ASR 可能无法直接处理系统音频流）
      if (speechService.isSupported()) {
        // 用麦克风作为降级方案（系统音频捕获后通过 AudioContext 路由到 Speech API 复杂度太高）
        dispatch({ type: 'SET_ERROR', payload: '系统音频模式建议使用豆包 ASR。已切换到麦克风模式。' });
      }
    }

    // 默认：麦克风 → 浏览器 ASR
    if (!speechService.isSupported()) {
      dispatch({ type: 'SET_ERROR', payload: '当前浏览器不支持语音识别。请使用 Chrome 浏览器或配置豆包 ASR。' });
      dispatch({ type: 'SET_LISTENING', payload: false });
      return;
    }

    speechService.start({
      onResult: (text, isFinal) => handleRecognitionResult(text, isFinal),
      onError: (e) => { dispatch({ type: 'SET_ERROR', payload: e }); dispatch({ type: 'SET_LISTENING', payload: false }); },
      onEnd: () => dispatch({ type: 'SET_LISTENING', payload: false }),
    });
  }, [sendQuestion]);

  const stopListening = useCallback(() => {
    speechService.stop();
    systemAudioService.stop();
    doubaoAsrService.stop();
    dispatch({ type: 'SET_LISTENING', payload: false });
    // 立即 flush 合并缓冲区
    flushMergeBuffer();
  }, [sendQuestion]);

  // ===== 其余方法 =====
  const addManualQuestion = useCallback((q: string) => sendQuestion(q), [sendQuestion]);

  const editQuestion = useCallback((id: string, q: string) => { void regenerateAnswer(id, q); }, [regenerateAnswer]);

  const clearHistory = useCallback(() => {
    updateSessionQAList([]);
    dispatch({ type: 'SET_ERROR', payload: null });
  }, [updateSessionQAList]);

  const value: InterviewContextValue = {
    ...state,
    qaList,
    startListening,
    stopListening,
    sendQuestion,
    regenerateAnswer,
    editQuestion,
    addManualQuestion,
    clearHistory,
  };

  return <InterviewContext.Provider value={value}>{children}</InterviewContext.Provider>;
}
