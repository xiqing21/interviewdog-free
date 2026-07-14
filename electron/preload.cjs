const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopWindow', {
  isDesktop: true,
  getOpacity: () => ipcRenderer.invoke('desktop-window:get-opacity'),
  setOpacity: (value) => ipcRenderer.invoke('desktop-window:set-opacity', value),
  hide: () => ipcRenderer.invoke('desktop-window:hide'),
  // 原生音频采集支持
  startSystemAudio: () => ipcRenderer.invoke('desktop-audio:start'),
  stopSystemAudio: () => ipcRenderer.invoke('desktop-audio:stop'),
  onSystemAudioData: (callback) => {
    let pendingBytes = new Uint8Array(0);
    const subscription = (_event, buffer) => {
      const bytes = buffer instanceof Uint8Array
        ? new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)
        : new Uint8Array(buffer);
      const merged = new Uint8Array(pendingBytes.length + bytes.length);
      merged.set(pendingBytes);
      merged.set(bytes, pendingBytes.length);
      const alignedLength = merged.length - (merged.length % 2);
      if (alignedLength > 0) {
        const aligned = merged.slice(0, alignedLength);
        callback(new Int16Array(aligned.buffer));
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
  }
});
