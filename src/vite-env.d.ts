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
  onGlobalAppendScreenshot?: (callback: () => void) => () => void;
  onGlobalSubmitExam?: (callback: () => void) => () => void;
  onGlobalResetExam?: (callback: () => void) => () => void;
  onGlobalToggleIgnoreMouse?: (callback: () => void) => () => void;
  onGlobalToggleGenerationPause?: (callback: () => void) => () => void;
  onIgnoreMouseChanged?: (callback: (state: boolean) => void) => () => void;
  startSystemAudio: () => Promise<{ ok: boolean; alreadyRunning?: boolean; helperPath?: string; screenStatus?: string } | void>;
  stopSystemAudio: () => Promise<void>;
  getScreenAccessStatus?: () => Promise<string>;
  onSystemAudioData: (callback: (pcm: Int16Array) => void) => () => void;
  onSystemAudioEnded: (callback: () => void) => () => void;
  onSystemAudioError?: (callback: (message: string) => void) => () => void;
  asrGateway?: {
    connect: (url: string, startPayload?: any) => Promise<{ ok: boolean; error?: string }>;
    send: (payload: string | Uint8Array | ArrayBuffer) => Promise<boolean>;
    close: () => Promise<boolean>;
    onOpen: (callback: () => void) => () => void;
    onMessage: (callback: (data: string) => void) => () => void;
    onError: (callback: (error: string) => void) => () => void;
    onClose: (callback: (info: { code: number; reason: string }) => void) => () => void;
  };
}

interface Window {
  desktopWindow?: DesktopWindowBridge;
}
