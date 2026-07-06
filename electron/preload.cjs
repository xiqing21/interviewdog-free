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
    const subscription = (_event, buffer) => {
      const ab = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
      const int16Array = new Int16Array(ab);
      callback(int16Array);
    };
    ipcRenderer.on('desktop-audio:data', subscription);
    return () => ipcRenderer.removeListener('desktop-audio:data', subscription);
  },
  onSystemAudioEnded: (callback) => {
    const subscription = () => callback();
    ipcRenderer.on('desktop-audio:ended', subscription);
    return () => ipcRenderer.removeListener('desktop-audio:ended', subscription);
  }
});
