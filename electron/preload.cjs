const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopWindow', {
  isDesktop: true,
  getOpacity: () => ipcRenderer.invoke('desktop-window:get-opacity'),
  setOpacity: (value) => ipcRenderer.invoke('desktop-window:set-opacity', value),
  hide: () => ipcRenderer.invoke('desktop-window:hide'),
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
});
