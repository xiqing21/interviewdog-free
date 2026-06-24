/**
 * SessionContext — 面试项目管理
 *
 * 管理多个面试项目（Session），每个 Session 包含独立的 Q&A 列表、简历、JD 和回答模式。
 * 所有数据持久化到 localStorage。
 */

import {
  createContext,
  useReducer,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import type {
  InterviewSession,
  SessionSummary,
  QAItem,
  AnswerMode,
} from '../types';
import { STORAGE_KEYS, MAX_SESSIONS, DEFAULT_RESUME_JD } from '../constants';
import * as storageService from '../services/storageService';

// ===== State =====
export interface SessionState {
  sessions: InterviewSession[];
  activeSessionId: string | null;
  resume: string;
  jd: string;
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

function getInitialState(): SessionState {
  const sessions = storageService.get<InterviewSession[]>(STORAGE_KEYS.SESSIONS, []);
  const activeId = storageService.get<string | null>(STORAGE_KEYS.ACTIVE_SESSION_ID, null);
  const rj = storageService.get<{ resume: string; jd: string }>(
    STORAGE_KEYS.RESUME_JD,
    DEFAULT_RESUME_JD,
  );

  return {
    sessions,
    activeSessionId: activeId && sessions.some((s) => s.id === activeId) ? activeId : null,
    resume: rj.resume,
    jd: rj.jd,
  };
}

// ===== Context Value =====
export interface SessionContextValue extends SessionState {
  activeSession: InterviewSession | null;
  sessionSummaries: SessionSummary[];
  createSession: (name: string) => void;
  switchSession: (id: string) => void;
  deleteSession: (id: string) => void;
  updateSessionName: (id: string, name: string) => void;
  updateSessionQAList: (qaList: QAItem[]) => void;
  setAnswerMode: (mode: AnswerMode) => void;
  setResume: (text: string) => void;
  setJD: (text: string) => void;
}

export const SessionContext = createContext<SessionContextValue | null>(null);

// ===== Provider =====
export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useReducer(
    (prev: SessionState, next: Partial<SessionState>) => ({ ...prev, ...next }),
    undefined,
    getInitialState,
  );
  const stateRef = useRef(state);
  stateRef.current = state;

  // 持久化
  useEffect(() => {
    storageService.set(STORAGE_KEYS.SESSIONS, state.sessions);
  }, [state.sessions]);
  useEffect(() => {
    storageService.set(STORAGE_KEYS.ACTIVE_SESSION_ID, state.activeSessionId);
  }, [state.activeSessionId]);

  const activeSession =
    state.sessions.find((s) => s.id === state.activeSessionId) ?? null;

  const sessionSummaries: SessionSummary[] = state.sessions.map((s) => ({
    id: s.id,
    name: s.name,
    createdAt: s.createdAt,
    qaCount: s.qaList.length,
  }));

  const createSession = useCallback((name: string) => {
    if (stateRef.current.sessions.length >= MAX_SESSIONS) return;
    const session: InterviewSession = {
      id: generateId(),
      name: name || `面试 ${new Date().toLocaleDateString('zh-CN')}`,
      createdAt: Date.now(),
      qaList: [],
      answerMode: 'concise',
      resume: stateRef.current.resume,
      jd: stateRef.current.jd,
    };
    setState({
      sessions: [...stateRef.current.sessions, session],
      activeSessionId: session.id,
    });
  }, []);

  const switchSession = useCallback((id: string) => {
    if (stateRef.current.sessions.some((s) => s.id === id)) {
      setState({ activeSessionId: id });
    }
  }, []);

  const deleteSession = useCallback((id: string) => {
    const newSessions = stateRef.current.sessions.filter((s) => s.id !== id);
    let newActiveId = stateRef.current.activeSessionId;
    if (newActiveId === id) {
      newActiveId = newSessions.length > 0 ? newSessions[0].id : null;
    }
    setState({ sessions: newSessions, activeSessionId: newActiveId });
  }, []);

  const updateSessionName = useCallback((id: string, name: string) => {
    setState({
      sessions: stateRef.current.sessions.map((s) =>
        s.id === id ? { ...s, name } : s,
      ),
    });
  }, []);

  const updateSessionQAList = useCallback((qaList: QAItem[]) => {
    if (!stateRef.current.activeSessionId) return;
    setState({
      sessions: stateRef.current.sessions.map((s) =>
        s.id === stateRef.current.activeSessionId ? { ...s, qaList } : s,
      ),
    });
  }, []);

  const setAnswerMode = useCallback((mode: AnswerMode) => {
    if (!stateRef.current.activeSessionId) return;
    setState({
      sessions: stateRef.current.sessions.map((s) =>
        s.id === stateRef.current.activeSessionId ? { ...s, answerMode: mode } : s,
      ),
    });
  }, []);

  const setResume = useCallback((text: string) => {
    const rj = { resume: text, jd: stateRef.current.jd };
    storageService.set(STORAGE_KEYS.RESUME_JD, rj);
    setState({ resume: text });
  }, []);

  const setJD = useCallback((text: string) => {
    const rj = { resume: stateRef.current.resume, jd: text };
    storageService.set(STORAGE_KEYS.RESUME_JD, rj);
    setState({ jd: text });
  }, []);

  const value: SessionContextValue = {
    ...state,
    activeSession,
    sessionSummaries,
    createSession,
    switchSession,
    deleteSession,
    updateSessionName,
    updateSessionQAList,
    setAnswerMode,
    setResume,
    setJD,
  };

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}
