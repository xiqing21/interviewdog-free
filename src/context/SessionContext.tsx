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
  ResumeJDData,
  TranscriptLine,
  InterviewReview,
} from '../types';
import { STORAGE_KEYS, MAX_SESSIONS, DEFAULT_RESUME_JD } from '../constants';
import * as storageService from '../services/storageService';
import { useAuth } from '../hooks/useAuth';
import * as sessionSyncService from '../services/sessionSyncService';

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
  createSession: (name: string, profile?: InterviewSessionProfile) => void;
  switchSession: (id: string) => void;
  deleteSession: (id: string) => void;
  updateSessionName: (id: string, name: string) => void;
  updateSessionQAList: (qaList: QAItem[]) => void;
  updateSessionTranscriptLines: (lines: TranscriptLine[]) => void;
  updateSessionProfile: (profile: Partial<InterviewSessionProfile>) => void;
  updateSessionReview: (review: InterviewReview) => void;
  archiveActiveSession: (review?: InterviewReview) => void;
  setAnswerMode: (mode: AnswerMode) => void;
  setResume: (text: string) => void;
  setJD: (text: string) => void;
}

export interface InterviewSessionProfile extends ResumeJDData {
  targetRole: string;
  focusAreas: string[];
}

export const SessionContext = createContext<SessionContextValue | null>(null);

// ===== Provider =====
export function SessionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useReducer(
    (prev: SessionState, next: Partial<SessionState>) => ({ ...prev, ...next }),
    undefined,
    getInitialState,
  );
  const stateRef = useRef(state);
  stateRef.current = state;
  const remoteLoadedForUser = useRef<string | null>(null);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 持久化
  useEffect(() => {
    storageService.set(STORAGE_KEYS.SESSIONS, state.sessions);
  }, [state.sessions]);
  useEffect(() => {
    storageService.set(STORAGE_KEYS.ACTIVE_SESSION_ID, state.activeSessionId);
  }, [state.activeSessionId]);

  useEffect(() => {
    if (!user || !sessionSyncService.canSyncSessions()) {
      remoteLoadedForUser.current = null;
      return;
    }

    let cancelled = false;
    sessionSyncService.loadRemoteSessions()
      .then((remoteSessions) => {
        if (cancelled) return;
        const merged = mergeSessions(stateRef.current.sessions, remoteSessions);
        remoteLoadedForUser.current = user.id;
        setState({
          sessions: merged,
          activeSessionId: stateRef.current.activeSessionId ?? merged[0]?.id ?? null,
        });
      })
      .catch((error) => {
        console.warn('[SessionContext] Failed to load Supabase sessions:', error);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!user || !sessionSyncService.canSyncSessions()) return;
    if (remoteLoadedForUser.current !== user.id) return;
    if (syncTimer.current) clearTimeout(syncTimer.current);

    syncTimer.current = setTimeout(() => {
      const sessions = stateRef.current.sessions;
      Promise.all(sessions.map((session) => sessionSyncService.syncSession(session)))
        .catch((error) => {
          console.warn('[SessionContext] Failed to sync Supabase sessions:', error);
        });
    }, 800);

    return () => {
      if (syncTimer.current) clearTimeout(syncTimer.current);
    };
  }, [state.sessions, user]);

  const activeSession =
    state.sessions.find((s) => s.id === state.activeSessionId) ?? null;

  const sessionSummaries: SessionSummary[] = state.sessions.map((s) => ({
    id: s.id,
    name: s.name,
    createdAt: s.createdAt,
    qaCount: s.qaList.length,
  }));

  const createSession = useCallback((name: string, profile?: InterviewSessionProfile) => {
    if (stateRef.current.sessions.length >= MAX_SESSIONS) return;
    const session: InterviewSession = {
      id: generateId(),
      name: name || profile?.targetRole || `面试 ${new Date().toLocaleDateString('zh-CN')}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      qaList: [],
      transcriptLines: [],
      answerMode: 'concise',
      resume: profile?.resume ?? stateRef.current.resume,
      jd: profile?.jd ?? stateRef.current.jd,
      targetRole: profile?.targetRole,
      focusAreas: profile?.focusAreas ?? [],
    };
    setState({
      sessions: [...stateRef.current.sessions, session],
      activeSessionId: session.id,
      resume: session.resume ?? '',
      jd: session.jd ?? '',
    });
  }, []);

  const switchSession = useCallback((id: string) => {
    const session = stateRef.current.sessions.find((s) => s.id === id);
    if (session) {
      setState({
        activeSessionId: id,
        resume: session.resume ?? '',
        jd: session.jd ?? '',
      });
    }
  }, []);

  const deleteSession = useCallback((id: string) => {
    const newSessions = stateRef.current.sessions.filter((s) => s.id !== id);
    let newActiveId = stateRef.current.activeSessionId;
    if (newActiveId === id) {
      newActiveId = newSessions.length > 0 ? newSessions[0].id : null;
    }
    setState({ sessions: newSessions, activeSessionId: newActiveId });
    void sessionSyncService.deleteRemoteSession(id).catch((error) => {
      console.warn('[SessionContext] Failed to delete remote session:', error);
    });
  }, []);

  const updateSessionName = useCallback((id: string, name: string) => {
    setState({
      sessions: stateRef.current.sessions.map((s) =>
        s.id === id ? { ...s, name, updatedAt: Date.now() } : s,
      ),
    });
  }, []);

  const updateSessionQAList = useCallback((qaList: QAItem[]) => {
    if (!stateRef.current.activeSessionId) return;
    setState({
      sessions: stateRef.current.sessions.map((s) =>
        s.id === stateRef.current.activeSessionId ? { ...s, qaList, updatedAt: Date.now() } : s,
      ),
    });
  }, []);

  const updateSessionTranscriptLines = useCallback((lines: TranscriptLine[]) => {
    if (!stateRef.current.activeSessionId) return;
    setState({
      sessions: stateRef.current.sessions.map((s) =>
        s.id === stateRef.current.activeSessionId
          ? { ...s, transcriptLines: lines, updatedAt: Date.now() }
          : s,
      ),
    });
  }, []);

  const updateSessionProfile = useCallback((profile: Partial<InterviewSessionProfile>) => {
    if (!stateRef.current.activeSessionId) return;
    const nextResume = profile.resume ?? stateRef.current.resume;
    const nextJd = profile.jd ?? stateRef.current.jd;
    storageService.set(STORAGE_KEYS.RESUME_JD, { resume: nextResume, jd: nextJd });
    setState({
      resume: nextResume,
      jd: nextJd,
      sessions: stateRef.current.sessions.map((s) =>
        s.id === stateRef.current.activeSessionId
          ? {
              ...s,
              resume: profile.resume ?? s.resume,
              jd: profile.jd ?? s.jd,
              targetRole: profile.targetRole ?? s.targetRole,
              focusAreas: profile.focusAreas ?? s.focusAreas,
              updatedAt: Date.now(),
            }
          : s,
      ),
    });
  }, []);

  const updateSessionReview = useCallback((review: InterviewReview) => {
    if (!stateRef.current.activeSessionId) return;
    setState({
      sessions: stateRef.current.sessions.map((s) =>
        s.id === stateRef.current.activeSessionId
          ? { ...s, review, updatedAt: Date.now() }
          : s,
      ),
    });
  }, []);

  const archiveActiveSession = useCallback((review?: InterviewReview) => {
    if (!stateRef.current.activeSessionId) return;
    const now = Date.now();
    setState({
      sessions: stateRef.current.sessions.map((s) =>
        s.id === stateRef.current.activeSessionId
          ? { ...s, archivedAt: now, updatedAt: now, review: review ?? s.review }
          : s,
      ),
    });
  }, []);

  const setAnswerMode = useCallback((mode: AnswerMode) => {
    if (!stateRef.current.activeSessionId) return;
    setState({
      sessions: stateRef.current.sessions.map((s) =>
        s.id === stateRef.current.activeSessionId ? { ...s, answerMode: mode, updatedAt: Date.now() } : s,
      ),
    });
  }, []);

  const setResume = useCallback((text: string) => {
    const rj = { resume: text, jd: stateRef.current.jd };
    storageService.set(STORAGE_KEYS.RESUME_JD, rj);
    setState({
      resume: text,
      sessions: stateRef.current.sessions.map((s) =>
        s.id === stateRef.current.activeSessionId ? { ...s, resume: text, updatedAt: Date.now() } : s,
      ),
    });
  }, []);

  const setJD = useCallback((text: string) => {
    const rj = { resume: stateRef.current.resume, jd: text };
    storageService.set(STORAGE_KEYS.RESUME_JD, rj);
    setState({
      jd: text,
      sessions: stateRef.current.sessions.map((s) =>
        s.id === stateRef.current.activeSessionId ? { ...s, jd: text, updatedAt: Date.now() } : s,
      ),
    });
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
    updateSessionTranscriptLines,
    updateSessionProfile,
    updateSessionReview,
    archiveActiveSession,
    setAnswerMode,
    setResume,
    setJD,
  };

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

function mergeSessions(localSessions: InterviewSession[], remoteSessions: InterviewSession[]): InterviewSession[] {
  const byId = new Map<string, InterviewSession>();
  for (const session of [...localSessions, ...remoteSessions]) {
    const existing = byId.get(session.id);
    if (!existing || (session.updatedAt ?? session.createdAt) >= (existing.updatedAt ?? existing.createdAt)) {
      byId.set(session.id, session);
    }
  }
  return [...byId.values()]
    .sort((a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt))
    .slice(0, MAX_SESSIONS);
}
