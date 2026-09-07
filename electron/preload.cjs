const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopWindow', {
  isDesktop: true,
  getOpacity: () => ipcRenderer.invoke('desktop-window:get-opacity'),
  setOpacity: (value) => ipcRenderer.invoke('desktop-window:set-opacity', value),
  hide: () => ipcRenderer.invoke('desktop-window:hide'),
  // 窗口防截屏/录屏隐藏
  getContentProtection: () => ipcRenderer.invoke('desktop-window:get-content-protection'),
  setContentProtection: (enabled) => ipcRenderer.invoke('desktop-window:set-content-protection', enabled),
  // 窗口置顶
  getAlwaysOnTop: () => ipcRenderer.invoke('desktop-window:get-always-on-top'),
  setAlwaysOnTop: (flag) => ipcRenderer.invoke('desktop-window:set-always-on-top', flag),
  // 鼠标穿透（幽灵模式）
  getIgnoreMouseEvents: () => ipcRenderer.invoke('desktop-window:get-ignore-mouse-events'),
  setIgnoreMouseEvents: (ignore) => ipcRenderer.invoke('desktop-window:set-ignore-mouse-events', ignore),
  // 屏幕与窗口源列表获取、原生静默截图
  getSources: (opts) => ipcRenderer.invoke('desktop-screen:get-sources', opts),
  captureScreen: (sourceId) => ipcRenderer.invoke('desktop-screen:capture-screen', sourceId),
  // 全局快捷键事件监听
  onGlobalScreenshot: (callback) => {
    const sub = () => callback();
    ipcRenderer.on('desktop-shortcut:screenshot', sub);
    return () => ipcRenderer.removeListener('desktop-shortcut:screenshot', sub);
  },
  onGlobalAppendScreenshot: (callback) => {
    const sub = () => callback();
    ipcRenderer.on('desktop-shortcut:append-screenshot', sub);
    return () => ipcRenderer.removeListener('desktop-shortcut:append-screenshot', sub);
  },
  onGlobalSubmitExam: (callback) => {
    const sub = () => callback();
    ipcRenderer.on('desktop-shortcut:submit-exam', sub);
    return () => ipcRenderer.removeListener('desktop-shortcut:submit-exam', sub);
  },
  onGlobalResetExam: (callback) => {
    const sub = () => callback();
    ipcRenderer.on('desktop-shortcut:reset-exam', sub);
    return () => ipcRenderer.removeListener('desktop-shortcut:reset-exam', sub);
  },
  onGlobalToggleIgnoreMouse: (callback) => {
    const sub = () => callback();
    ipcRenderer.on('desktop-shortcut:toggle-ignore-mouse', sub);
    return () => ipcRenderer.removeListener('desktop-shortcut:toggle-ignore-mouse', sub);
  },
  onGlobalToggleGenerationPause: (callback) => {
    const sub = () => callback();
    ipcRenderer.on('desktop-shortcut:toggle-generation-pause', sub);
    return () => ipcRenderer.removeListener('desktop-shortcut:toggle-generation-pause', sub);
  },
  onIgnoreMouseChanged: (callback) => {
    const sub = (_event, state) => callback(state);
    ipcRenderer.on('desktop-window:ignore-mouse-changed', sub);
    return () => ipcRenderer.removeListener('desktop-window:ignore-mouse-changed', sub);
  },
  // 原生音频采集支持
  startSystemAudio: () => ipcRenderer.invoke('desktop-audio:start'),
  stopSystemAudio: () => ipcRenderer.invoke('desktop-audio:stop'),
  getScreenAccessStatus: () => ipcRenderer.invoke('desktop-audio:get-screen-status'),
  openScreenRecordingSettings: () => ipcRenderer.invoke('desktop-audio:open-screen-settings'),
  onSystemAudioData: (callback) => {
    let pendingBytes = new Uint8Array(0);
    const subscription = (_event, buffer) => {
      let bytes;
      if (buffer instanceof ArrayBuffer) {
        bytes = new Uint8Array(buffer);
      } else if (ArrayBuffer.isView(buffer)) {
        bytes = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
      } else if (buffer && buffer.type === 'Buffer' && Array.isArray(buffer.data)) {
        bytes = Uint8Array.from(buffer.data);
      } else if (buffer && typeof buffer === 'object' && buffer.data) {
        bytes = new Uint8Array(buffer.data);
      } else {
        try {
          bytes = new Uint8Array(buffer);
        } catch {
          return;
        }
      }

      // Ensure we own the underlying buffer (avoid detached ArrayBuffer issues)
      const owned = new Uint8Array(bytes.byteLength);
      owned.set(bytes);

      const merged = new Uint8Array(pendingBytes.length + owned.length);
      merged.set(pendingBytes);
      merged.set(owned, pendingBytes.length);

      const alignedLength = merged.length - (merged.length % 2);
      if (alignedLength > 0) {
        const aligned = merged.slice(0, alignedLength);
        // Create Int16Array from a copy so sample alignment is stable
        const pcm = new Int16Array(aligned.buffer.slice(0), 0, alignedLength / 2);
        callback(pcm);
      }
      pendingBytes = merged.slice(alignedLength);
    };
    ipcRenderer.on('desktop-audio:data', subscription);
    return () => {
      pendingBytes = new Uint8Array(0);
      ipcRenderer.removeListener('desktop-audio:data', subscription);
    };
  },
  onSystemAudioEnded: (callback) => {
    const subscription = () => callback();
    ipcRenderer.on('desktop-audio:ended', subscription);
    return () => ipcRenderer.removeListener('desktop-audio:ended', subscription);
  },
  onSystemAudioError: (callback) => {
    const subscription = (_event, message) => callback(String(message || '系统音频错误'));
    ipcRenderer.on('desktop-audio:error', subscription);
    return () => ipcRenderer.removeListener('desktop-audio:error', subscription);
  },
  // 原生 ASR WebSocket 网关代理（彻底绕过 Chromium file:// Origin 保护）
  asrGateway: {
    connect: (url, startPayload) => ipcRenderer.invoke('desktop-asr:connect', url, startPayload),
    send: (payload) => ipcRenderer.invoke('desktop-asr:send', payload),
    close: () => ipcRenderer.invoke('desktop-asr:close'),
    onOpen: (callback) => {
      const sub = () => callback();
      ipcRenderer.on('desktop-asr:open', sub);
      return () => ipcRenderer.removeListener('desktop-asr:open', sub);
    },
    onMessage: (callback) => {
      const sub = (_event, data) => callback(data);
      ipcRenderer.on('desktop-asr:message', sub);
      return () => ipcRenderer.removeListener('desktop-asr:message', sub);
    },
    onError: (callback) => {
      const sub = (_event, err) => callback(err);
      ipcRenderer.on('desktop-asr:error', sub);
      return () => ipcRenderer.removeListener('desktop-asr:error', sub);
    },
    onClose: (callback) => {
      const sub = (_event, info) => callback(info);
      ipcRenderer.on('desktop-asr:close', sub);
      return () => ipcRenderer.removeListener('desktop-asr:close', sub);
    },
  },
});
