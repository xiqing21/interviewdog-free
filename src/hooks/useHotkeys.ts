/**
 * useHotkeys — Registers global keyboard shortcuts.
 * Supports Ctrl+Shift+S (screenshot), ↑ (scroll up), ↓ (scroll down), M (toggle mode).
 */

import { useEffect, useRef } from 'react';

export interface HotkeyCallbacks {
  onScreenshot?: () => void;
  onScrollUp?: () => void;
  onScrollDown?: () => void;
  onToggleMode?: () => void;
  onToggleAnswerPause?: () => void;
}

export function useHotkeys(callbacks: HotkeyCallbacks): void {
  const ref = useRef(callbacks);
  ref.current = callbacks;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      if (!isCmdOrCtrl || !e.shiftKey) return;

      switch (e.key) {
        case 'A':
        case 'a':
          e.preventDefault();
          ref.current.onToggleAnswerPause?.();
          break;
        case 'S':
        case 's':
          e.preventDefault();
          ref.current.onScreenshot?.();
          break;
        case 'ArrowUp':
          e.preventDefault();
          ref.current.onScrollUp?.();
          break;
        case 'ArrowDown':
          e.preventDefault();
          ref.current.onScrollDown?.();
          break;
        case 'M':
        case 'm':
          e.preventDefault();
          ref.current.onToggleMode?.();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}
