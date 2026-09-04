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
  notice: string | null;
  lastEmail: string;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<{ needsConfirmation: boolean }>;
  signInWithOAuth: (provider: 'google' | 'github') => Promise<void>;
  signOut: () => Promise<void>;
  clearAuthError: () => void;
  clearAuthNotice: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

function getAuthErrorMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : '';
  const name = error instanceof Error ? error.name : '';

  // Supabase wraps DNS failures, connection resets and CORS/network failures
  // as AuthRetryableFetchError. The raw message is not actionable for users.
  if (
    name === 'AuthRetryableFetchError' ||
    /failed to fetch|network request failed|connection closed|load failed/i.test(message)
  ) {
    return '登录服务暂时无法连接。请检查 VITE_SUPABASE_URL 是否仍是有效的 Supabase 项目地址，并确认该项目未暂停。';
  }

  return message || fallback;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
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

  useEffect(() => {
    if (!supabase || !user) return;
    let mounted = true;
    void (async () => {
      try {
        const { data } = await supabase
          .from('user_roles')
          .select('banned_at,ban_reason')
          .eq('user_id', user.id)
          .maybeSingle();
        if (!mounted || !data?.banned_at) return;
        setError(data.ban_reason ? `账号已被封禁：${data.ban_reason}` : '账号已被封禁。');
        void supabase?.auth.signOut();
        setUser(null);
      } catch {
        // Ignore role lookup failures; protected APIs still enforce access server-side.
      }
    })();
    return () => {
      mounted = false;
    };
  }, [user]);

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
      setError(getAuthErrorMessage(err, '登录失败'));
      throw err;
    } finally {
      setLoading(false);
    }
  }, [rememberEmail]);

  const signUp = useCallback(async (email: string, password: string) => {
    if (!supabase) {
      setError('还没有配置 Supabase 环境变量，无法注册。');
      return { needsConfirmation: false };
    }
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
      if (signUpError) throw signUpError;
      rememberEmail(email);
      if (!data.session) {
        setNotice('注册成功！激活确认邮件已发送至您的邮箱，请点击邮件中的确认链接完成激活后再登录。');
        return { needsConfirmation: true };
      }
      return { needsConfirmation: false };
    } catch (err) {
      setError(getAuthErrorMessage(err, '注册失败'));
      throw err;
    } finally {
      setLoading(false);
    }
  }, [rememberEmail]);

  const signInWithOAuth = useCallback(async (provider: 'google' | 'github') => {
    if (!supabase) {
      setError('还没有配置 Supabase 环境变量，无法登录。');
      return;
    }
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/interview`,
        },
      });
      if (oauthError) throw oauthError;
    } catch (err) {
      setError(getAuthErrorMessage(err, `${provider === 'google' ? 'Google' : 'GitHub'} 登录失败`));
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    setNotice(null);
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
    notice,
    lastEmail,
    signIn,
    signUp,
    signInWithOAuth,
    signOut,
    clearAuthError: () => setError(null),
    clearAuthNotice: () => setNotice(null),
  }), [error, lastEmail, loading, notice, signIn, signInWithOAuth, signOut, signUp, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
