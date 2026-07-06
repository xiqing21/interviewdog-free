/// <reference types="vite/client" />

interface DesktopWindowBridge {
  isDesktop: true;
  getOpacity: () => Promise<number>;
  setOpacity: (value: number) => Promise<number>;
  hide: () => Promise<void>;
  startSystemAudio: () => Promise<void>;
  stopSystemAudio: () => Promise<void>;
  onSystemAudioData: (callback: (pcm: Int16Array) => void) => () => void;
  onSystemAudioEnded: (callback: () => void) => () => void;
}

interface Window {
  desktopWindow?: DesktopWindowBridge;
}
