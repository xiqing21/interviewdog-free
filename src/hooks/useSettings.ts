/**
 * useSettings — Convenience hook to consume SettingsContext.
 * Throws if used outside of SettingsProvider.
 */

import { useContext } from 'react';
import {
  SettingsContext,
  type SettingsContextValue,
} from '../context/SettingsContext';

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error('useSettings 必须在 SettingsProvider 内部使用。');
  }
  return ctx;
}
