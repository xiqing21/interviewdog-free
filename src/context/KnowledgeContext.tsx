import {
  createContext,
  useCallback,
  useEffect,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';
import type { KnowledgeProfile, ResumeLibraryItem } from '../types';
import { DEFAULT_KNOWLEDGE_PROFILE, STORAGE_KEYS } from '../constants';
import * as storageService from '../services/storageService';
import * as profileSyncService from '../services/profileSyncService';
import { useAuth } from '../hooks/useAuth';

interface KnowledgeState {
  profile: KnowledgeProfile;
  syncError: string | null;
}

export interface KnowledgeContextValue extends KnowledgeState {
  addResume: (name: string, content: string, tags?: string[]) => void;
  updateResume: (id: string, patch: Partial<Pick<ResumeLibraryItem, 'name' | 'content' | 'tags'>>) => void;
  deleteResume: (id: string) => void;
  setExpertKnowledge: (text: string) => void;
}

export const KnowledgeContext = createContext<KnowledgeContextValue | null>(null);

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

function getInitialState(): KnowledgeState {
  return {
    profile: {
      ...DEFAULT_KNOWLEDGE_PROFILE,
      ...storageService.get<KnowledgeProfile>(STORAGE_KEYS.KNOWLEDGE_PROFILE, DEFAULT_KNOWLEDGE_PROFILE),
    },
    syncError: null,
  };
}

export function KnowledgeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useReducer(
    (prev: KnowledgeState, next: Partial<KnowledgeState>) => ({ ...prev, ...next }),
    undefined,
    getInitialState,
  );
  const stateRef = useRef(state);
  stateRef.current = state;
  const loadedForUser = useRef<string | null>(null);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    storageService.set(STORAGE_KEYS.KNOWLEDGE_PROFILE, state.profile);
  }, [state.profile]);

  useEffect(() => {
    if (!user || !profileSyncService.canSyncProfile()) {
      loadedForUser.current = null;
      return;
    }

    let cancelled = false;
    profileSyncService.loadRemoteProfile()
      .then((remote) => {
        if (cancelled) return;
        loadedForUser.current = user.id;
        if (!remote) {
          void profileSyncService.syncProfile(stateRef.current.profile).catch((error) => {
            setState({ syncError: error instanceof Error ? error.message : '知识库同步失败' });
          });
          return;
        }
        setState({ profile: mergeProfile(stateRef.current.profile, remote), syncError: null });
      })
      .catch((error) => {
        setState({ syncError: error instanceof Error ? error.message : '知识库同步失败' });
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!user || !profileSyncService.canSyncProfile()) return;
    if (loadedForUser.current !== user.id) return;
    if (syncTimer.current) clearTimeout(syncTimer.current);

    syncTimer.current = setTimeout(() => {
      profileSyncService.syncProfile(stateRef.current.profile)
        .then(() => setState({ syncError: null }))
        .catch((error) => {
          setState({ syncError: error instanceof Error ? error.message : '知识库同步失败' });
        });
    }, 800);

    return () => {
      if (syncTimer.current) clearTimeout(syncTimer.current);
    };
  }, [state.profile, user]);

  const updateProfile = useCallback((patch: Partial<KnowledgeProfile>) => {
    setState({
      profile: {
        ...stateRef.current.profile,
        ...patch,
        updatedAt: Date.now(),
      },
    });
  }, []);

  const addResume = useCallback((name: string, content: string, tags: string[] = []) => {
    const trimmed = content.trim();
    if (!trimmed) return;
    const now = Date.now();
    const item: ResumeLibraryItem = {
      id: generateId(),
      name: name.trim() || `简历 ${new Date(now).toLocaleDateString('zh-CN')}`,
      content: trimmed,
      tags,
      createdAt: now,
      updatedAt: now,
    };
    updateProfile({ resumes: [...stateRef.current.profile.resumes, item] });
  }, [updateProfile]);

  const updateResume = useCallback((
    id: string,
    patch: Partial<Pick<ResumeLibraryItem, 'name' | 'content' | 'tags'>>,
  ) => {
    updateProfile({
      resumes: stateRef.current.profile.resumes.map((resume) =>
        resume.id === id ? { ...resume, ...patch, updatedAt: Date.now() } : resume,
      ),
    });
  }, [updateProfile]);

  const deleteResume = useCallback((id: string) => {
    updateProfile({
      resumes: stateRef.current.profile.resumes.filter((resume) => resume.id !== id),
    });
  }, [updateProfile]);

  const setExpertKnowledge = useCallback((text: string) => {
    updateProfile({ expertKnowledge: text });
  }, [updateProfile]);

  return (
    <KnowledgeContext.Provider
      value={{
        ...state,
        addResume,
        updateResume,
        deleteResume,
        setExpertKnowledge,
      }}
    >
      {children}
    </KnowledgeContext.Provider>
  );
}

function mergeProfile(local: KnowledgeProfile, remote: KnowledgeProfile): KnowledgeProfile {
  if ((remote.updatedAt ?? 0) > (local.updatedAt ?? 0)) return remote;
  return local;
}
