const STORAGE_KEY = 'interviewdog.desktop.opacity';
const DEFAULT_OPACITY = 1;

export function isDesktopApp(): boolean {
  return window.desktopWindow?.isDesktop === true;
}

export function readStoredOpacity(): number {
  const saved = Number(window.localStorage.getItem(STORAGE_KEY));
  if (Number.isNaN(saved)) return DEFAULT_OPACITY;
  return Math.min(1, Math.max(0.35, saved));
}

export async function applyDesktopOpacity(opacity: number): Promise<number> {
  const nextOpacity = Math.min(1, Math.max(0.35, opacity));
  window.localStorage.setItem(STORAGE_KEY, String(nextOpacity));
  if (!isDesktopApp()) return nextOpacity;
  return window.desktopWindow?.setOpacity(nextOpacity) ?? nextOpacity;
}

export async function syncStoredDesktopOpacity(): Promise<void> {
  if (!isDesktopApp()) return;
  await applyDesktopOpacity(readStoredOpacity());
}

export async function hideDesktopWindow(): Promise<void> {
  if (!isDesktopApp()) return;
  await window.desktopWindow?.hide();
}
