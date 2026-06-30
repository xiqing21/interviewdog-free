import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { User } from '@supabase/supabase-js';
import { STORAGE_KEYS } from '../constants';
import * as storageService from '../services/storageService';
import { isSupabaseConfigured, supabase } from '../services/supabaseClient';

export interface AuthContextValue {
  user: User | null;
  loading: boolean;
  configured: boolean;
  error: string | null;
  lastEmail: string;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearAuthError: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [error, setError] = useState<string | null>(null);
  const [lastEmail, setLastEmail] = useState(
    storageService.get<string>(STORAGE_KEYS.LAST_AUTH_EMAIL, ''),
  );

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let mounted = true;
    supabase.auth.getUser()
      .then(({ data }) => {
        if (mounted) setUser(data.user ?? null);
      })
      .catch(() => {
        if (mounted) setUser(null);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const rememberEmail = useCallback((email: string) => {
    setLastEmail(email);
    storageService.set(STORAGE_KEYS.LAST_AUTH_EMAIL, email);
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) {
      setError('还没有配置 Supabase 环境变量，无法登录。');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      rememberEmail(email);
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [rememberEmail]);

  const signUp = useCallback(async (email: string, password: string) => {
    if (!supabase) {
      setError('还没有配置 Supabase 环境变量，无法注册。');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
      if (signUpError) throw signUpError;
      rememberEmail(email);
      if (!data.session) {
        setError('注册成功，但 Supabase 当前要求邮箱确认。请在 Auth 设置里关闭 Confirm email 后再登录。');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '注册失败');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [rememberEmail]);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    try {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
      setUser(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '退出失败');
    } finally {
      setLoading(false);
    }
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    configured: isSupabaseConfigured(),
    error,
    lastEmail,
    signIn,
    signUp,
    signOut,
    clearAuthError: () => setError(null),
  }), [error, lastEmail, loading, signIn, signOut, signUp, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
