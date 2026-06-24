/**
 * useInterview — Convenience hook to consume InterviewContext.
 * Throws if used outside of InterviewProvider.
 */

import { useContext } from 'react';
import {
  InterviewContext,
  type InterviewContextValue,
} from '../context/InterviewContext';

export function useInterview(): InterviewContextValue {
  const ctx = useContext(InterviewContext);
  if (!ctx) {
    throw new Error('useInterview 必须在 InterviewProvider 内部使用。');
  }
  return ctx;
}
