import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from 'react';

type LiveEdge = 'start' | 'end';

interface SmartScrollerOptions {
  edge?: LiveEdge;
  threshold?: number;
  contentKey: string | number;
  resetKey?: string | number | null;
  resetPosition?: LiveEdge;
}

interface SmartScrollerResult<T extends HTMLElement> {
  ref: RefObject<T>;
  isAtLiveEdge: boolean;
  showJumpButton: boolean;
  handleScroll: () => void;
  jumpToLiveEdge: (behavior?: ScrollBehavior) => void;
  scrollToMessage: (messageId: string, behavior?: ScrollBehavior) => boolean;
}

export function useSmartScroller<T extends HTMLElement = HTMLDivElement>({
  edge = 'end',
  threshold = 32,
  contentKey,
  resetKey = null,
  resetPosition,
}: SmartScrollerOptions): SmartScrollerResult<T> {
  const ref = useRef<T>(null);
  const pinnedRef = useRef(true);
  const lastScrollHeightRef = useRef(0);
  const lastResetKeyRef = useRef<string | number | null>(resetKey);
  const [isAtLiveEdge, setIsAtLiveEdge] = useState(true);

  const measure = useCallback(() => {
    const node = ref.current;
    if (!node) return true;
    const distance = edge === 'end'
      ? node.scrollHeight - node.clientHeight - node.scrollTop
      : node.scrollTop;
    return distance <= threshold;
  }, [edge, threshold]);

  const syncPinned = useCallback(() => {
    const atEdge = measure();
    pinnedRef.current = atEdge;
    setIsAtLiveEdge(atEdge);
  }, [measure]);

  const jumpToLiveEdge = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const node = ref.current;
    if (!node) return;
    node.scrollTo({
      top: edge === 'end' ? node.scrollHeight : 0,
      behavior,
    });
    pinnedRef.current = true;
    setIsAtLiveEdge(true);
  }, [edge]);

  const scrollToMessage = useCallback((messageId: string, behavior: ScrollBehavior = 'smooth') => {
    const node = ref.current;
    if (!node) return false;
    const target = node.querySelector<HTMLElement>(`[data-message-id="${CSS.escape(messageId)}"]`);
    if (!target) return false;
    const top = target.offsetTop - node.offsetTop - 16;
    node.scrollTo({ top: Math.max(0, top), behavior });
    pinnedRef.current = measure();
    setIsAtLiveEdge(pinnedRef.current);
    return true;
  }, [measure]);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;

    const nextResetKey = resetKey;
    const didReset = nextResetKey !== lastResetKeyRef.current;
    lastResetKeyRef.current = nextResetKey;

    if (didReset) {
      const position = resetPosition ?? edge;
      node.scrollTop = position === 'end' ? node.scrollHeight : 0;
      lastScrollHeightRef.current = node.scrollHeight;
      pinnedRef.current = position === edge;
      setIsAtLiveEdge(pinnedRef.current);
      return;
    }

    const previousHeight = lastScrollHeightRef.current;
    const heightDelta = node.scrollHeight - previousHeight;
    if (pinnedRef.current) {
      node.scrollTop = edge === 'end' ? node.scrollHeight : 0;
    } else if (edge === 'start' && heightDelta > 0) {
      node.scrollTop += heightDelta;
    }
    lastScrollHeightRef.current = node.scrollHeight;
    setIsAtLiveEdge(measure());
  }, [contentKey, edge, measure, resetKey, resetPosition]);

  return {
    ref,
    isAtLiveEdge,
    showJumpButton: !isAtLiveEdge,
    handleScroll: syncPinned,
    jumpToLiveEdge,
    scrollToMessage,
  };
}
