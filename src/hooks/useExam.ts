/**
 * useExam — Convenience hook to consume ExamContext.
 * Throws if used outside of ExamProvider.
 */

import { useContext } from 'react';
import {
  ExamContext,
  type ExamContextValue,
} from '../context/ExamContext';

export function useExam(): ExamContextValue {
  const ctx = useContext(ExamContext);
  if (!ctx) {
    throw new Error('useExam 必须在 ExamProvider 内部使用。');
  }
  return ctx;
}
