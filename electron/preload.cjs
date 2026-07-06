const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopWindow', {
  isDesktop: true,
  getOpacity: () => ipcRenderer.invoke('desktop-window:get-opacity'),
  setOpacity: (value) => ipcRenderer.invoke('desktop-window:set-opacity', value),
  hide: () => ipcRenderer.invoke('desktop-window:hide'),
});
