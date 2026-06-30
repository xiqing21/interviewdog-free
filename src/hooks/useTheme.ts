/**
 * useTheme — Convenience hook for theme management.
 * Returns current mode, toggle function, and setter.
 */

import { useCallback } from 'react';
import type { ThemeMode } from '../types';
import { THEME_OPTIONS } from '../constants';
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
    const index = THEME_OPTIONS.findIndex((item) => item.key === mode);
    const next = THEME_OPTIONS[(index + 1) % THEME_OPTIONS.length]?.key ?? 'dark';
    setTheme(next);
  }, [mode, setTheme]);

  return { mode, toggleTheme, setTheme };
}
