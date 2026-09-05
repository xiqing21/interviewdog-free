/// <reference types="vite/client" />

interface DesktopWindowBridge {
  isDesktop: true;
  getOpacity: () => Promise<number>;
  setOpacity: (value: number) => Promise<number>;
  hide: () => Promise<void>;
  getContentProtection?: () => Promise<boolean>;
  setContentProtection?: (enabled: boolean) => Promise<boolean>;
  getAlwaysOnTop?: () => Promise<boolean>;
  setAlwaysOnTop?: (flag: boolean) => Promise<boolean>;
  getIgnoreMouseEvents?: () => Promise<boolean>;
  setIgnoreMouseEvents?: (ignore: boolean) => Promise<boolean>;
  getSources?: (opts?: { types?: Array<'screen' | 'window'>; thumbnailSize?: { width: number; height: number } }) => Promise<
    Array<{
      id: string;
      name: string;
      display_id?: string;
      appIcon: string | null;
      thumbnail: string | null;
    }>
  >;
  captureScreen?: (sourceId?: string) => Promise<string>;
  onGlobalScreenshot?: (callback: () => void) => () => void;
  onGlobalToggleIgnoreMouse?: (callback: () => void) => () => void;
  onIgnoreMouseChanged?: (callback: (state: boolean) => void) => () => void;
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
