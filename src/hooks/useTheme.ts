/**
 * useTheme — Convenience hook for theme management.
 * Returns current mode, toggle function, and setter.
 */

import { useCallback } from 'react';
import type { ThemeMode } from '../types';
import { useSettings } from './useSettings';

export interface UseThemeReturn {
  mode: ThemeMode;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
}

export function useTheme(): UseThemeReturn {
  const { appSettings, setTheme } = useSettings();
  const mode = appSettings.theme;

  const toggleTheme = useCallback(() => {
    setTheme(mode === 'dark' ? 'light' : 'dark');
  }, [mode, setTheme]);

  return { mode, toggleTheme, setTheme };
}
