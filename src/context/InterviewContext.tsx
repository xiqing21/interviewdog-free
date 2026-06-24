/**
 * InterviewContext — Manages interview Q&A state with voice recognition.
 * Uses useReducer for state management with automatic localStorage persistence.
 */

import {
  createContext,
  useEffect,
  useReducer,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import type { QAItem, ChatMessage } from '../types';
import { STORAGE_KEYS } from '../constants';
import * as storageService from '../services/storageService';
import * as speechService from '../services/speechService';
import { chat } from '../services/aiService';
import { useSettings } from '../hooks/useSettings';

// ===== State Type =====
export interface InterviewState {
  qaList: QAItem[];
  currentQuestion: string;
  interimText: string;
  isListening: boolean;
  isProcessing: boolean;
  speechSupported: boolean;
  error: string | null;
}

// ===== Action Types =====
type InterviewAction =
  | { type: 'ADD_QA'; payload: QAItem }
  | { type: 'UPDATE_QA_ANSWER'; payload: { id: string; answer: string; isStreaming: boolean } }
  | { type: 'SET_QA_ERROR'; payload: { id: string; error: string } }
  | { type: 'SET_QA_QUESTION'; payload: { id: string; question: string } }
  | { type: 'SET_QA_LIST'; payload: QAItem[] }
  | { type: 'SET_CURRENT_QUESTION'; payload: string }
  | { type: 'SET_INTERIM'; payload: string }
  | { type: 'SET_LISTENING'; payload: boolean }
  | { type: 'SET_PROCESSING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_SPEECH_SUPPORTED'; payload: boolean }
  | { type: 'CLEAR_HISTORY' };

// ===== Helper: Generate unique ID =====
function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

// ===== Initial State =====
function getInitialState(): InterviewState {
  const qaList = storageService.get<QAItem[]>(STORAGE_KEYS.QA_LIST, []);
  return {
    qaList,
    currentQuestion: '',
    interimText: '',
    isListening: false,
    isProcessing: false,
    speechSupported: speechService.isSupported(),
    error: null,
  };
}

// ===== Reducer =====
function interviewReducer(
  state: InterviewState,
  action: InterviewAction,
): InterviewState {
  switch (action.type) {
    case 'ADD_QA':
      return { ...state, qaList: [...state.qaList, action.payload] };

    case 'UPDATE_QA_ANSWER':
      return {
        ...state,
        qaList: state.qaList.map((qa) =>
          qa.id === action.payload.id
            ? {
                ...qa,
                answer: action.payload.answer,
                isStreaming: action.payload.isStreaming,
              }
            : qa,
        ),
      };

    case 'SET_QA_ERROR':
      return {
        ...state,
        qaList: state.qaList.map((qa) =>
          qa.id === action.payload.id
            ? { ...qa, error: action.payload.error, isStreaming: false }
            : qa,
        ),
      };

    case 'SET_QA_QUESTION':
      return {
        ...state,
        qaList: state.qaList.map((qa) =>
          qa.id === action.payload.id
            ? { ...qa, question: action.payload.question }
            : qa,
        ),
      };

    case 'SET_QA_LIST':
      return { ...state, qaList: action.payload };

    case 'SET_CURRENT_QUESTION':
      return { ...state, currentQuestion: action.payload };

    case 'SET_INTERIM':
      return { ...state, interimText: action.payload };

    case 'SET_LISTENING':
      return { ...state, isListening: action.payload };

    case 'SET_PROCESSING':
      return { ...state, isProcessing: action.payload };

    case 'SET_ERROR':
      return { ...state, error: action.payload };

    case 'SET_SPEECH_SUPPORTED':
      return { ...state, speechSupported: action.payload };

    case 'CLEAR_HISTORY':
      return { ...state, qaList: [], error: null };

    default:
      return state;
  }
}

// ===== Context Type =====
export interface InterviewContextValue extends InterviewState {
  startListening: () => void;
  stopListening: () => void;
  sendQuestion: (question: string) => Promise<void>;
  regenerateAnswer: (id: string, newQuestion?: string) => Promise<void>;
  editQuestion: (id: string, question: string) => void;
  addManualQuestion: (question: string) => Promise<void>;
  clearHistory: () => void;
}

// ===== Context =====
export const InterviewContext = createContext<InterviewContextValue | null>(
  null,
);

// ===== Provider Props =====
interface InterviewProviderProps {
  children: ReactNode;
}

// ===== Provider =====
export function InterviewProvider({ children }: InterviewProviderProps) {
  const { aiSettings } = useSettings();
  const [state, dispatch] = useReducer(
    interviewReducer,
    undefined,
    getInitialState,
  );

  // Refs for accessing current state inside async callbacks
  const stateRef = useRef(state);
  stateRef.current = state;
  const aiSettingsRef = useRef(aiSettings);
  aiSettingsRef.current = aiSettings;
  const isProcessingRef = useRef(false);
  isProcessingRef.current = state.isProcessing;

  // Persist qaList to localStorage whenever it changes
  useEffect(() => {
    storageService.set(STORAGE_KEYS.QA_LIST, state.qaList);
  }, [state.qaList]);

  // ===== sendQuestion =====
  const sendQuestion = useCallback(async (question: string) => {
    const trimmed = question.trim();
    if (!trimmed || isProcessingRef.current) return;

    const id = generateId();
    const qaItem: QAItem = {
      id,
      question: trimmed,
      answer: '',
      timestamp: Date.now(),
      isStreaming: true,
    };

    dispatch({ type: 'ADD_QA', payload: qaItem });
    dispatch({ type: 'SET_PROCESSING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });

    // Build context messages: system prompt + recent Q&A turns + current question
    const settings = aiSettingsRef.current;
    const messages: ChatMessage[] = [
      { role: 'system', content: settings.interviewSystemPrompt },
    ];

    const contextSize = settings.contextWindowSize;
    const recentQA = stateRef.current.qaList.slice(-contextSize);
    for (const qa of recentQA) {
      messages.push({ role: 'user', content: qa.question });
      if (qa.answer) {
        messages.push({ role: 'assistant', content: qa.answer });
      }
    }
    messages.push({ role: 'user', content: trimmed });

    let accumulated = '';
    try {
      await chat(messages, settings, (chunk: string) => {
        accumulated += chunk;
        dispatch({
          type: 'UPDATE_QA_ANSWER',
          payload: { id, answer: accumulated, isStreaming: true },
        });
      });
      dispatch({
        type: 'UPDATE_QA_ANSWER',
        payload: { id, answer: accumulated, isStreaming: false },
      });
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : '生成回答时发生未知错误';
      dispatch({ type: 'SET_QA_ERROR', payload: { id, error: errorMsg } });
      dispatch({ type: 'SET_ERROR', payload: errorMsg });
    } finally {
      dispatch({ type: 'SET_PROCESSING', payload: false });
    }
  }, []);

  // ===== regenerateAnswer =====
  const regenerateAnswer = useCallback(
    async (id: string, newQuestion?: string) => {
      if (isProcessingRef.current) return;

      const qaItem = stateRef.current.qaList.find((qa) => qa.id === id);
      if (!qaItem) return;

      const question = newQuestion ?? qaItem.question;
      if (newQuestion) {
        dispatch({
          type: 'SET_QA_QUESTION',
          payload: { id, question: newQuestion },
        });
      }

      dispatch({
        type: 'UPDATE_QA_ANSWER',
        payload: { id, answer: '', isStreaming: true },
      });
      dispatch({ type: 'SET_PROCESSING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });

      // Build context from Q&A items before the one being regenerated
      const settings = aiSettingsRef.current;
      const messages: ChatMessage[] = [
        { role: 'system', content: settings.interviewSystemPrompt },
      ];

      const contextSize = settings.contextWindowSize;
      const allQA = stateRef.current.qaList;
      const itemIndex = allQA.findIndex((qa) => qa.id === id);
      const recentQA = allQA.slice(
        Math.max(0, itemIndex - contextSize),
        itemIndex,
      );
      for (const qa of recentQA) {
        messages.push({ role: 'user', content: qa.question });
        if (qa.answer) {
          messages.push({ role: 'assistant', content: qa.answer });
        }
      }
      messages.push({ role: 'user', content: question });

      let accumulated = '';
      try {
        await chat(messages, settings, (chunk: string) => {
          accumulated += chunk;
          dispatch({
            type: 'UPDATE_QA_ANSWER',
            payload: { id, answer: accumulated, isStreaming: true },
          });
        });
        dispatch({
          type: 'UPDATE_QA_ANSWER',
          payload: { id, answer: accumulated, isStreaming: false },
        });
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : '生成回答时发生未知错误';
        dispatch({ type: 'SET_QA_ERROR', payload: { id, error: errorMsg } });
        dispatch({ type: 'SET_ERROR', payload: errorMsg });
      } finally {
        dispatch({ type: 'SET_PROCESSING', payload: false });
      }
    },
    [],
  );

  // ===== startListening =====
  const startListening = useCallback(() => {
    if (!stateRef.current.speechSupported) return;
    dispatch({ type: 'SET_LISTENING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });

    speechService.start({
      onResult: (text: string, isFinal: boolean) => {
        if (isFinal) {
          dispatch({ type: 'SET_INTERIM', payload: '' });
          void sendQuestion(text);
        } else {
          dispatch({ type: 'SET_INTERIM', payload: text });
        }
      },
      onError: (error: string) => {
        dispatch({ type: 'SET_ERROR', payload: error });
        dispatch({ type: 'SET_LISTENING', payload: false });
      },
      onEnd: () => {
        dispatch({ type: 'SET_LISTENING', payload: false });
      },
    });
  }, [sendQuestion]);

  // ===== stopListening =====
  const stopListening = useCallback(() => {
    speechService.stop();
    dispatch({ type: 'SET_LISTENING', payload: false });
  }, []);

  // ===== editQuestion =====
  const editQuestion = useCallback(
    (id: string, question: string) => {
      void regenerateAnswer(id, question);
    },
    [regenerateAnswer],
  );

  // ===== addManualQuestion =====
  const addManualQuestion = useCallback(
    (question: string) => {
      return sendQuestion(question);
    },
    [sendQuestion],
  );

  // ===== clearHistory =====
  const clearHistory = useCallback(() => {
    dispatch({ type: 'CLEAR_HISTORY' });
    storageService.remove(STORAGE_KEYS.QA_LIST);
  }, []);

  const value: InterviewContextValue = {
    ...state,
    startListening,
    stopListening,
    sendQuestion,
    regenerateAnswer,
    editQuestion,
    addManualQuestion,
    clearHistory,
  };

  return (
    <InterviewContext.Provider value={value}>
      {children}
    </InterviewContext.Provider>
  );
}
