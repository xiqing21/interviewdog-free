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
import {
  onGlobalScreenshot,
  onGlobalAppendScreenshot,
  onGlobalSubmitExam,
  onGlobalResetExam,
} from '../services/desktopWindowService';
import { useSettings } from '../hooks/useSettings';
import {
  syncExamRecord,
  loadRemoteExamRecords,
  clearRemoteExamRecords,
  deleteRemoteExamRecord,
} from '../services/examSyncService';
import { stitchImagesVertical } from '../services/imageStitchService';
import { useBilling } from '../hooks/useBilling';
import { COMMERCIAL_MODE } from '../config/commercial';

export const EXAM_SOLVE_COST_SECONDS = 300; // 笔试解答单次消耗 5 分钟 (300秒)

// ===== State Type =====
export interface ExamState {
  records: ExamRecord[];
  currentImage: string;
  currentExamType: ExamType;
  currentAnswer: string;
  isStreaming: boolean;
  isProcessing: boolean;
  captureSupported: boolean;
  isFastModalOpen: boolean;
  error: string | null;
  // 多图与长图拼接支持
  capturedSlices: string[];
  preferredLanguage: string; // 'auto' | 'SQL' | 'Python' | 'Java' | 'C++'
}

// ===== Action Types =====
type ExamAction =
  | { type: 'ADD_RECORD'; payload: ExamRecord }
  | { type: 'UPDATE_RECORD'; payload: { id: string; answer: string; isStreaming: boolean } }
  | { type: 'DELETE_RECORD'; payload: { id: string } }
  | { type: 'SET_RECORD_ERROR'; payload: { id: string; error: string } }
  | { type: 'SET_RECORD_IMAGE_URL'; payload: { id: string; imageUrl: string } }
  | { type: 'SET_RECORDS'; payload: ExamRecord[] }
  | { type: 'SET_CURRENT_IMAGE'; payload: string }
  | { type: 'SET_CAPTURED_SLICES'; payload: string[] }
  | { type: 'SET_PREFERRED_LANGUAGE'; payload: string }
  | { type: 'SET_EXAM_TYPE'; payload: ExamType }
  | { type: 'SET_CURRENT_ANSWER'; payload: string }
  | { type: 'SET_STREAMING'; payload: boolean }
  | { type: 'SET_PROCESSING'; payload: boolean }
  | { type: 'SET_FAST_MODAL_OPEN'; payload: boolean }
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
    isFastModalOpen: false,
    error: null,
    capturedSlices: [],
    preferredLanguage: 'auto',
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

    case 'SET_RECORD_IMAGE_URL':
      return {
        ...state,
        records: state.records.map((r) =>
          r.id === action.payload.id
            ? { ...r, imageUrl: action.payload.imageUrl }
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

    case 'DELETE_RECORD':
      return {
        ...state,
        records: state.records.filter((r) => r.id !== action.payload.id),
      };

    case 'SET_CAPTURED_SLICES':
      return { ...state, capturedSlices: action.payload };

    case 'SET_PREFERRED_LANGUAGE':
      return { ...state, preferredLanguage: action.payload };

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

    case 'SET_FAST_MODAL_OPEN':
      return { ...state, isFastModalOpen: action.payload };

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
  captureScreen: (sourceId?: string) => Promise<string | null>;
  captureAndSolve: (sourceId?: string, options?: { showModal?: boolean }) => Promise<void>;
  appendCaptureOnly: (sourceId?: string) => Promise<string | null>;
  appendCaptureAndSolve: (sourceId?: string) => Promise<void>;
  resetCaptures: () => void;
  deleteRecord: (id: string) => Promise<void>;
  setPreferredLanguage: (lang: string) => void;
  setImageFromUpload: (base64: string) => void;
  setExamType: (type: ExamType) => void;
  solve: (overrideImage?: string, overrideLanguage?: string) => Promise<void>;
  regenerate: (id: string) => Promise<void>;
  clearHistory: () => void;
  openFastModal: () => void;
  closeFastModal: () => void;
  costPerSolveSeconds: number;
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
  const { remainingSeconds, consumeSeconds } = useBilling();
  const [state, dispatch] = useReducer(examReducer, undefined, getInitialState);

  // Refs for accessing current state inside async callbacks
  const stateRef = useRef(state);
  stateRef.current = state;
  const aiSettingsRef = useRef(aiSettings);
  aiSettingsRef.current = aiSettings;
  const isProcessingRef = useRef(false);
  isProcessingRef.current = state.isProcessing;
  const remainingSecondsRef = useRef(remainingSeconds);
  remainingSecondsRef.current = remainingSeconds;
  const consumeSecondsRef = useRef(consumeSeconds);
  consumeSecondsRef.current = consumeSeconds;

  // 首次挂载时从 Supabase 云端拉取历史笔试记录
  useEffect(() => {
    void loadRemoteExamRecords().then((remoteRecords) => {
      if (remoteRecords && remoteRecords.length > 0) {
        const local = stateRef.current.records;
        const map = new Map<string, ExamRecord>();
        for (const r of local) map.set(r.id, r);
        for (const r of remoteRecords) {
          if (!map.has(r.id)) {
            map.set(r.id, r);
          } else {
            const cur = map.get(r.id)!;
            if (!cur.imageUrl && r.imageUrl) {
              map.set(r.id, { ...cur, imageUrl: r.imageUrl });
            }
          }
        }
        const merged = Array.from(map.values())
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, MAX_EXAM_RECORDS);
        dispatch({ type: 'SET_RECORDS', payload: merged });
      }
    });
  }, []);

  // Persist records to localStorage whenever they change
  useEffect(() => {
    const toStore = state.records.slice(-MAX_EXAM_RECORDS).map((r) => {
      // 若已上传到 Supabase 对象存储，直接置空庞大的 Base64，彻底保护 localStorage 配额
      if (r.imageUrl) {
        return { ...r, imageBase64: '' };
      }
      return r;
    });
    try {
      storageService.set(STORAGE_KEYS.EXAM_RECORDS, toStore);
    } catch (err) {
      console.warn('[ExamContext] LocalStorage set failed, clearing base64 images to prevent quota overflow:', err);
      try {
        const stripped = toStore.map((r) => ({ ...r, imageBase64: '' }));
        storageService.set(STORAGE_KEYS.EXAM_RECORDS, stripped);
      } catch {
        // ignore
      }
    }
  }, [state.records]);

  // ===== captureScreen =====
  const captureScreen = useCallback(async (sourceId?: string): Promise<string | null> => {
    dispatch({ type: 'SET_ERROR', payload: null });
    try {
      const base64 = await captureService.capture(sourceId);
      dispatch({ type: 'SET_CURRENT_IMAGE', payload: base64 });
      return base64;
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : '截图失败，请重试。';
      dispatch({ type: 'SET_ERROR', payload: errorMsg });
      return null;
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

  const solveImage = useCallback(
    async (image: string, examType: ExamType, recordId?: string, overrideLang?: string) => {
      if (isProcessingRef.current) return;

      // 商业化模式下：单次笔试解答前置校验时长（需 >= 300秒 / 5分钟）
      if (COMMERCIAL_MODE) {
        if (remainingSecondsRef.current < EXAM_SOLVE_COST_SECONDS) {
          const minLeft = Math.floor(remainingSecondsRef.current / 60);
          const errorMsg = `账户可用时长不足（当前剩余 ${minLeft} 分钟，单次笔试解答需 5 分钟），请先充值或兑换卡密后再试。`;
          dispatch({ type: 'SET_ERROR', payload: errorMsg });
          return;
        }
      }

      const targetRecordId = recordId || generateId();
      const lang = overrideLang || stateRef.current.preferredLanguage;

      dispatch({ type: 'SET_PROCESSING', payload: true });
      dispatch({ type: 'SET_STREAMING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });
      dispatch({ type: 'SET_CURRENT_ANSWER', payload: '' });

      let extraInstruction = '';
      if (lang && lang !== 'auto') {
        if (lang === 'SQL') {
          extraInstruction =
            '【强制指定语言指令】：本题必须使用标准 SQL（MySQL 8.0+ / PostgreSQL / SparkSQL）编写最优解答，绝对禁止默认输出 Python 或其他语言！';
        } else {
          extraInstruction = `【强制指定语言指令】：本题必须使用 ${lang} 编写最优解完整代码，不要使用其他语言！`;
        }
      }

      let accumulated = '';
      let billed = false;
      try {
        const settings = aiSettingsRef.current;
        await visionChat(
          image,
          examType,
          settings,
          (chunk: string) => {
            // 当视觉大模型正常开始流式吐出答案时，触发扣费 5 分钟 (300秒)
            if (!billed && COMMERCIAL_MODE) {
              billed = true;
              void consumeSecondsRef.current(EXAM_SOLVE_COST_SECONDS);
            }

            accumulated += chunk;
            dispatch({ type: 'SET_CURRENT_ANSWER', payload: accumulated });
            if (recordId) {
              dispatch({
                type: 'UPDATE_RECORD',
                payload: { id: recordId, answer: accumulated, isStreaming: true },
              });
            }
          },
          extraInstruction,
        );

        dispatch({ type: 'SET_STREAMING', payload: false });

        if (recordId) {
          dispatch({
            type: 'UPDATE_RECORD',
            payload: { id: recordId, answer: accumulated, isStreaming: false },
          });
          const existing = stateRef.current.records.find((r) => r.id === recordId);
          if (existing) {
            void syncExamRecord({ ...existing, answer: accumulated, isStreaming: false });
          }
        } else {
          const record: ExamRecord = {
            id: targetRecordId,
            imageBase64: image,
            examType,
            answer: accumulated,
            timestamp: Date.now(),
            isStreaming: false,
          };
          dispatch({ type: 'ADD_RECORD', payload: record });
          // 自动同步至 Supabase Storage 对象存储与 exam_records 数据库表
          void syncExamRecord(record).then((imageUrl) => {
            if (imageUrl) {
              dispatch({ type: 'SET_RECORD_IMAGE_URL', payload: { id: targetRecordId, imageUrl } });
            }
          });
        }
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : '解答生成失败，请重试。';
        dispatch({ type: 'SET_STREAMING', payload: false });
        dispatch({ type: 'SET_ERROR', payload: errorMsg });
        if (recordId) dispatch({ type: 'SET_RECORD_ERROR', payload: { id: recordId, error: errorMsg } });
      } finally {
        dispatch({ type: 'SET_PROCESSING', payload: false });
      }
    },
    [],
  );

  // ===== solve =====
  const solve = useCallback(
    async (overrideImage?: string, overrideLanguage?: string) => {
      const targetImage = overrideImage || stateRef.current.currentImage;
      const targetLang = overrideLanguage || stateRef.current.preferredLanguage;
      const currentExamType = stateRef.current.currentExamType;
      if (targetImage) {
        await solveImage(targetImage, currentExamType, undefined, targetLang);
      }
    },
    [solveImage],
  );

  const captureAndSolve = useCallback(
    async (sourceId?: string, options?: { showModal?: boolean }) => {
      const image = await captureScreen(sourceId);
      if (image) {
        dispatch({ type: 'SET_CAPTURED_SLICES', payload: [image] });
        if (options?.showModal !== false) {
          dispatch({ type: 'SET_FAST_MODAL_OPEN', payload: true });
        }
        await solveImage(image, stateRef.current.currentExamType);
      }
    },
    [captureScreen, solveImage],
  );

  // ===== 向下滑动追加截图，并垂直无缝拼合为长图 =====
  const appendCaptureAndSolve = useCallback(
    async (sourceId?: string) => {
      try {
        const newSlice = await captureService.capture(sourceId);
        if (!newSlice) return;

        const currentSlices =
          stateRef.current.capturedSlices.length > 0
            ? stateRef.current.capturedSlices
            : stateRef.current.currentImage
            ? [stateRef.current.currentImage]
            : [];

        const nextSlices = [...currentSlices, newSlice];
        dispatch({ type: 'SET_CAPTURED_SLICES', payload: nextSlices });

        // 垂直拼接长图
        const stitched = await stitchImagesVertical(nextSlices);
        dispatch({ type: 'SET_CURRENT_IMAGE', payload: stitched });
        dispatch({ type: 'SET_FAST_MODAL_OPEN', payload: true });

        // 拼接完成后自动使用完整长图重新解答
        await solveImage(stitched, stateRef.current.currentExamType);
      } catch (err) {
        const msg = err instanceof Error ? err.message : '拼接长图失败，请重试';
        dispatch({ type: 'SET_ERROR', payload: msg });
      }
    },
    [solveImage],
  );

  // ===== 仅追加截图拼接长图，不立即调用 AI 求解（让用户继续滚动截取下一屏） =====
  const appendCaptureOnly = useCallback(
    async (sourceId?: string): Promise<string | null> => {
      try {
        const newSlice = await captureService.capture(sourceId);
        if (!newSlice) return null;

        // 如果上一道题已经生成了解答（并且不在流式输出中），新截屏代表开启下一道全新题目！
        // 彻底清空上一题遗留的多张切片与答案，让新题从第 1 屏纯净开始
        const isPreviousSolved = Boolean(
          stateRef.current.currentAnswer && !stateRef.current.isStreaming
        );

        const currentSlices = isPreviousSolved
          ? []
          : stateRef.current.capturedSlices.length > 0
          ? stateRef.current.capturedSlices
          : stateRef.current.currentImage
          ? [stateRef.current.currentImage]
          : [];

        const nextSlices = [...currentSlices, newSlice];
        dispatch({ type: 'SET_CAPTURED_SLICES', payload: nextSlices });
        if (isPreviousSolved) {
          dispatch({ type: 'SET_CURRENT_ANSWER', payload: '' });
          dispatch({ type: 'SET_ERROR', payload: null });
        }

        // 垂直拼接长图
        const stitched = await stitchImagesVertical(nextSlices);
        dispatch({ type: 'SET_CURRENT_IMAGE', payload: stitched });
        dispatch({ type: 'SET_FAST_MODAL_OPEN', payload: true });
        return stitched;
      } catch (err) {
        const msg = err instanceof Error ? err.message : '追加截屏失败，请重试';
        dispatch({ type: 'SET_ERROR', payload: msg });
        return null;
      }
    },
    [],
  );

  const resetCaptures = useCallback(() => {
    dispatch({ type: 'SET_CAPTURED_SLICES', payload: [] });
    dispatch({ type: 'SET_CURRENT_IMAGE', payload: '' });
    dispatch({ type: 'SET_CURRENT_ANSWER', payload: '' });
  }, []);

  const setPreferredLanguage = useCallback((lang: string) => {
    dispatch({ type: 'SET_PREFERRED_LANGUAGE', payload: lang });
  }, []);

  // ===== 单条记录删除（本地状态 + 远端 Supabase 数据库联动删除） =====
  const deleteRecord = useCallback(async (id: string) => {
    dispatch({ type: 'DELETE_RECORD', payload: { id } });
    await deleteRemoteExamRecord(id);
  }, []);

  // 全局快捷键监听（Electron 全局穿透 + 网页端键盘事件兜底）
  useEffect(() => {
    // 1. ⌘+Shift+S (单屏一键截取并立即出题)
    const unsubShot = onGlobalScreenshot(() => {
      void captureAndSolve();
    });

    // 2. ⌘+Shift+Down (向下追加截屏拼长图，不触发AI、不扣费)
    const unsubAppend = onGlobalAppendScreenshot(() => {
      void appendCaptureOnly();
    });

    // 3. ⌘+Shift+Enter / Return (长图拼合完毕，一键提交解答，扣除5分钟)
    const unsubSubmit = onGlobalSubmitExam(() => {
      void solve();
    });

    // 4. ⌘+Shift+Backspace (重置/清空已截取的切片)
    const unsubReset = onGlobalResetExam(() => {
      resetCaptures();
    });

    // 网页端聚焦时键盘快捷键支持
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      if (!isMod || !e.shiftKey) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        void appendCaptureOnly();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        void solve();
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        resetCaptures();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      unsubShot();
      unsubAppend();
      unsubSubmit();
      unsubReset();
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [captureAndSolve, appendCaptureOnly, solve, resetCaptures]);

  // ===== regenerate =====
  const regenerate = useCallback(
    async (id: string) => {
      if (isProcessingRef.current) return;

      const record = stateRef.current.records.find((r) => r.id === id);
      if (!record) return;

      dispatch({ type: 'SET_ERROR', payload: null });
      dispatch({
        type: 'UPDATE_RECORD',
        payload: { id, answer: '', isStreaming: true },
      });

      const img = record.imageUrl || record.imageBase64;
      await solveImage(img, record.examType, id);
    },
    [solveImage],
  );

  // ===== clearHistory =====
  const clearHistory = useCallback(() => {
    dispatch({ type: 'CLEAR_HISTORY' });
    dispatch({ type: 'SET_CAPTURED_SLICES', payload: [] });
    storageService.remove(STORAGE_KEYS.EXAM_RECORDS);
    void clearRemoteExamRecords();
  }, []);

  const openFastModal = useCallback(() => {
    dispatch({ type: 'SET_FAST_MODAL_OPEN', payload: true });
  }, []);

  const closeFastModal = useCallback(() => {
    dispatch({ type: 'SET_FAST_MODAL_OPEN', payload: false });
  }, []);

  const value: ExamContextValue = {
    ...state,
    captureScreen,
    captureAndSolve,
    appendCaptureOnly,
    appendCaptureAndSolve,
    resetCaptures,
    deleteRecord,
    setPreferredLanguage,
    setImageFromUpload,
    setExamType,
    solve,
    regenerate,
    clearHistory,
    openFastModal,
    closeFastModal,
    costPerSolveSeconds: EXAM_SOLVE_COST_SECONDS,
  };

  return <ExamContext.Provider value={value}>{children}</ExamContext.Provider>;
}
