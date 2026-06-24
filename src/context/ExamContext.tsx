/**
 * ExamContext — Manages exam screen-capture and AI solving state.
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
import type { ExamRecord, ExamType } from '../types';
import { STORAGE_KEYS, MAX_EXAM_RECORDS } from '../constants';
import * as storageService from '../services/storageService';
import * as captureService from '../services/captureService';
import { visionChat } from '../services/aiService';
import { useSettings } from '../hooks/useSettings';

// ===== State Type =====
export interface ExamState {
  records: ExamRecord[];
  currentImage: string;
  currentExamType: ExamType;
  currentAnswer: string;
  isStreaming: boolean;
  isProcessing: boolean;
  captureSupported: boolean;
  error: string | null;
}

// ===== Action Types =====
type ExamAction =
  | { type: 'ADD_RECORD'; payload: ExamRecord }
  | { type: 'UPDATE_RECORD'; payload: { id: string; answer: string; isStreaming: boolean } }
  | { type: 'SET_RECORD_ERROR'; payload: { id: string; error: string } }
  | { type: 'SET_RECORDS'; payload: ExamRecord[] }
  | { type: 'SET_CURRENT_IMAGE'; payload: string }
  | { type: 'SET_EXAM_TYPE'; payload: ExamType }
  | { type: 'SET_CURRENT_ANSWER'; payload: string }
  | { type: 'SET_STREAMING'; payload: boolean }
  | { type: 'SET_PROCESSING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_CAPTURE_SUPPORTED'; payload: boolean }
  | { type: 'CLEAR_HISTORY' };

// ===== Helper: Generate unique ID =====
function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

// ===== Initial State =====
function getInitialState(): ExamState {
  const records = storageService.get<ExamRecord[]>(
    STORAGE_KEYS.EXAM_RECORDS,
    [],
  );
  // Truncate to MAX_EXAM_RECORDS (keep most recent)
  const truncated =
    records.length > MAX_EXAM_RECORDS
      ? records.slice(-MAX_EXAM_RECORDS)
      : records;

  return {
    records: truncated,
    currentImage: '',
    currentExamType: 'coding',
    currentAnswer: '',
    isStreaming: false,
    isProcessing: false,
    captureSupported: captureService.isSupported(),
    error: null,
  };
}

// ===== Reducer =====
function examReducer(state: ExamState, action: ExamAction): ExamState {
  switch (action.type) {
    case 'ADD_RECORD':
      return {
        ...state,
        records: [...state.records, action.payload].slice(-MAX_EXAM_RECORDS),
      };

    case 'UPDATE_RECORD':
      return {
        ...state,
        records: state.records.map((r) =>
          r.id === action.payload.id
            ? {
                ...r,
                answer: action.payload.answer,
                isStreaming: action.payload.isStreaming,
              }
            : r,
        ),
      };

    case 'SET_RECORD_ERROR':
      return {
        ...state,
        records: state.records.map((r) =>
          r.id === action.payload.id
            ? { ...r, error: action.payload.error, isStreaming: false }
            : r,
        ),
      };

    case 'SET_RECORDS':
      return { ...state, records: action.payload };

    case 'SET_CURRENT_IMAGE':
      return { ...state, currentImage: action.payload, currentAnswer: '' };

    case 'SET_EXAM_TYPE':
      return { ...state, currentExamType: action.payload };

    case 'SET_CURRENT_ANSWER':
      return { ...state, currentAnswer: action.payload };

    case 'SET_STREAMING':
      return { ...state, isStreaming: action.payload };

    case 'SET_PROCESSING':
      return { ...state, isProcessing: action.payload };

    case 'SET_ERROR':
      return { ...state, error: action.payload };

    case 'SET_CAPTURE_SUPPORTED':
      return { ...state, captureSupported: action.payload };

    case 'CLEAR_HISTORY':
      return { ...state, records: [], error: null };

    default:
      return state;
  }
}

// ===== Context Type =====
export interface ExamContextValue extends ExamState {
  captureScreen: () => Promise<void>;
  setImageFromUpload: (base64: string) => void;
  setExamType: (type: ExamType) => void;
  solve: () => Promise<void>;
  regenerate: (id: string) => Promise<void>;
  clearHistory: () => void;
}

// ===== Context =====
export const ExamContext = createContext<ExamContextValue | null>(null);

// ===== Provider Props =====
interface ExamProviderProps {
  children: ReactNode;
}

// ===== Provider =====
export function ExamProvider({ children }: ExamProviderProps) {
  const { aiSettings } = useSettings();
  const [state, dispatch] = useReducer(examReducer, undefined, getInitialState);

  // Refs for accessing current state inside async callbacks
  const stateRef = useRef(state);
  stateRef.current = state;
  const aiSettingsRef = useRef(aiSettings);
  aiSettingsRef.current = aiSettings;
  const isProcessingRef = useRef(false);
  isProcessingRef.current = state.isProcessing;

  // Persist records to localStorage whenever they change
  useEffect(() => {
    const toStore = state.records.slice(-MAX_EXAM_RECORDS);
    storageService.set(STORAGE_KEYS.EXAM_RECORDS, toStore);
  }, [state.records]);

  // ===== captureScreen =====
  const captureScreen = useCallback(async () => {
    dispatch({ type: 'SET_ERROR', payload: null });
    try {
      const base64 = await captureService.capture();
      dispatch({ type: 'SET_CURRENT_IMAGE', payload: base64 });
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : '截图失败，请重试。';
      dispatch({ type: 'SET_ERROR', payload: errorMsg });
    }
  }, []);

  // ===== setImageFromUpload =====
  const setImageFromUpload = useCallback((base64: string) => {
    dispatch({ type: 'SET_CURRENT_IMAGE', payload: base64 });
  }, []);

  // ===== setExamType =====
  const setExamType = useCallback((type: ExamType) => {
    dispatch({ type: 'SET_EXAM_TYPE', payload: type });
  }, []);

  // ===== solve =====
  const solve = useCallback(async () => {
    if (!stateRef.current.currentImage || isProcessingRef.current) return;

    dispatch({ type: 'SET_PROCESSING', payload: true });
    dispatch({ type: 'SET_STREAMING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });
    dispatch({ type: 'SET_CURRENT_ANSWER', payload: '' });

    const settings = aiSettingsRef.current;
    const image = stateRef.current.currentImage;
    const examType = stateRef.current.currentExamType;

    let accumulated = '';
    try {
      await visionChat(image, examType, settings, (chunk: string) => {
        accumulated += chunk;
        dispatch({ type: 'SET_CURRENT_ANSWER', payload: accumulated });
      });

      dispatch({ type: 'SET_STREAMING', payload: false });

      const record: ExamRecord = {
        id: generateId(),
        imageBase64: image,
        examType,
        answer: accumulated,
        timestamp: Date.now(),
        isStreaming: false,
      };
      dispatch({ type: 'ADD_RECORD', payload: record });
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : '解答生成失败，请重试。';
      dispatch({ type: 'SET_STREAMING', payload: false });
      dispatch({ type: 'SET_ERROR', payload: errorMsg });
    } finally {
      dispatch({ type: 'SET_PROCESSING', payload: false });
    }
  }, []);

  // ===== regenerate =====
  const regenerate = useCallback(async (id: string) => {
    if (isProcessingRef.current) return;

    const record = stateRef.current.records.find((r) => r.id === id);
    if (!record) return;

    dispatch({ type: 'SET_PROCESSING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });
    dispatch({
      type: 'UPDATE_RECORD',
      payload: { id, answer: '', isStreaming: true },
    });

    const settings = aiSettingsRef.current;

    let accumulated = '';
    try {
      await visionChat(
        record.imageBase64,
        record.examType,
        settings,
        (chunk: string) => {
          accumulated += chunk;
          dispatch({
            type: 'UPDATE_RECORD',
            payload: { id, answer: accumulated, isStreaming: true },
          });
        },
      );
      dispatch({
        type: 'UPDATE_RECORD',
        payload: { id, answer: accumulated, isStreaming: false },
      });
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : '解答生成失败，请重试。';
      dispatch({ type: 'SET_RECORD_ERROR', payload: { id, error: errorMsg } });
      dispatch({ type: 'SET_ERROR', payload: errorMsg });
    } finally {
      dispatch({ type: 'SET_PROCESSING', payload: false });
    }
  }, []);

  // ===== clearHistory =====
  const clearHistory = useCallback(() => {
    dispatch({ type: 'CLEAR_HISTORY' });
    storageService.remove(STORAGE_KEYS.EXAM_RECORDS);
  }, []);

  const value: ExamContextValue = {
    ...state,
    captureScreen,
    setImageFromUpload,
    setExamType,
    solve,
    regenerate,
    clearHistory,
  };

  return <ExamContext.Provider value={value}>{children}</ExamContext.Provider>;
}
