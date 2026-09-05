const STORAGE_KEY = 'interviewdog.desktop.opacity';
const SOURCE_KEY = 'interviewdog.desktop.selected_source_id';
const DEFAULT_OPACITY = 1;

export const OPACITY_LEVELS = [1.0, 0.8, 0.6, 0.4, 0.2] as const;

export function isDesktopApp(): boolean {
  return window.desktopWindow?.isDesktop === true;
}

export function readStoredOpacity(): number {
  const saved = Number(window.localStorage.getItem(STORAGE_KEY));
  if (Number.isNaN(saved)) return DEFAULT_OPACITY;
  return Math.min(1, Math.max(0.15, saved));
}

export async function applyDesktopOpacity(opacity: number): Promise<number> {
  const nextOpacity = Math.min(1, Math.max(0.15, opacity));
  window.localStorage.setItem(STORAGE_KEY, String(nextOpacity));
  if (!isDesktopApp()) return nextOpacity;
  return (await window.desktopWindow?.setOpacity(nextOpacity)) ?? nextOpacity;
}

export async function syncStoredDesktopOpacity(): Promise<void> {
  if (!isDesktopApp()) return;
  await applyDesktopOpacity(readStoredOpacity());
}

export async function hideDesktopWindow(): Promise<void> {
  if (!isDesktopApp()) return;
  await window.desktopWindow?.hide();
}

// ===== 防截屏 / 屏幕共享隐藏 =====
export async function getContentProtection(): Promise<boolean> {
  if (!isDesktopApp() || !window.desktopWindow?.getContentProtection) return false;
  return await window.desktopWindow.getContentProtection();
}

export async function setContentProtection(enabled: boolean): Promise<boolean> {
  if (!isDesktopApp() || !window.desktopWindow?.setContentProtection) return false;
  return await window.desktopWindow.setContentProtection(enabled);
}

// ===== 窗口置顶 =====
export async function getAlwaysOnTop(): Promise<boolean> {
  if (!isDesktopApp() || !window.desktopWindow?.getAlwaysOnTop) return false;
  return await window.desktopWindow.getAlwaysOnTop();
}

export async function setAlwaysOnTop(flag: boolean): Promise<boolean> {
  if (!isDesktopApp() || !window.desktopWindow?.setAlwaysOnTop) return false;
  return await window.desktopWindow.setAlwaysOnTop(flag);
}

// ===== 鼠标穿透（幽灵模式） =====
export async function getIgnoreMouseEvents(): Promise<boolean> {
  if (!isDesktopApp() || !window.desktopWindow?.getIgnoreMouseEvents) return false;
  return await window.desktopWindow.getIgnoreMouseEvents();
}

export async function setIgnoreMouseEvents(ignore: boolean): Promise<boolean> {
  if (!isDesktopApp() || !window.desktopWindow?.setIgnoreMouseEvents) return false;
  return await window.desktopWindow.setIgnoreMouseEvents(ignore);
}

// ===== 屏幕与窗口源 =====
export interface DesktopSourceItem {
  id: string;
  name: string;
  display_id?: string;
  appIcon: string | null;
  thumbnail: string | null;
}

export async function getDesktopSources(opts?: {
  types?: Array<'screen' | 'window'>;
  thumbnailSize?: { width: number; height: number };
}): Promise<DesktopSourceItem[]> {
  if (!isDesktopApp() || !window.desktopWindow?.getSources) return [];
  return (await window.desktopWindow.getSources(opts)) || [];
}

export function getSelectedCaptureSourceId(): string | null {
  return window.localStorage.getItem(SOURCE_KEY);
}

export function setSelectedCaptureSourceId(id: string | null): void {
  if (!id) {
    window.localStorage.removeItem(SOURCE_KEY);
  } else {
    window.localStorage.setItem(SOURCE_KEY, id);
  }
}

export async function captureDesktopScreen(sourceId?: string): Promise<string> {
  if (!isDesktopApp() || !window.desktopWindow?.captureScreen) {
    throw new Error('当前环境非桌面客户端，无法使用原生静默截屏');
  }
  const targetId = sourceId || getSelectedCaptureSourceId() || undefined;
  return await window.desktopWindow.captureScreen(targetId);
}

// ===== 全局快捷键与事件监听 =====
export function onGlobalScreenshot(callback: () => void): () => void {
  if (!isDesktopApp() || !window.desktopWindow?.onGlobalScreenshot) {
    return () => {};
  }
  return window.desktopWindow.onGlobalScreenshot(callback);
}

export function onGlobalToggleIgnoreMouse(callback: () => void): () => void {
  if (!isDesktopApp() || !window.desktopWindow?.onGlobalToggleIgnoreMouse) {
    return () => {};
  }
  return window.desktopWindow.onGlobalToggleIgnoreMouse(callback);
}

export function onIgnoreMouseChanged(callback: (state: boolean) => void): () => void {
  if (!isDesktopApp() || !window.desktopWindow?.onIgnoreMouseChanged) {
    return () => {};
  }
  return window.desktopWindow.onIgnoreMouseChanged(callback);
}
