/// <reference types="vite/client" />

interface DesktopWindowBridge {
  isDesktop: true;
  getOpacity: () => Promise<number>;
  setOpacity: (value: number) => Promise<number>;
  hide: () => Promise<void>;
  startSystemAudio: () => Promise<{ ok: boolean; alreadyRunning?: boolean; helperPath?: string; screenStatus?: string } | void>;
  stopSystemAudio: () => Promise<void>;
  getScreenAccessStatus?: () => Promise<string>;
  openScreenRecordingSettings?: () => Promise<boolean>;
  onSystemAudioData: (callback: (pcm: Int16Array) => void) => () => void;
  onSystemAudioEnded: (callback: () => void) => () => void;
  onSystemAudioError?: (callback: (message: string) => void) => () => void;
}

interface Window {
  desktopWindow?: DesktopWindowBridge;
}
