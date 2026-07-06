/// <reference types="vite/client" />

interface DesktopWindowBridge {
  isDesktop: true;
  getOpacity: () => Promise<number>;
  setOpacity: (value: number) => Promise<number>;
  hide: () => Promise<void>;
}

interface Window {
  desktopWindow?: DesktopWindowBridge;
}
