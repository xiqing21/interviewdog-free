const { app, BrowserWindow, ipcMain, Menu, shell, systemPreferences, desktopCapturer } = require('electron');
const path = require('node:path');

const APP_TITLE = 'MianshiZhu Pro';
const MIN_OPACITY = 0.35;
const MAX_OPACITY = 1;

let mainWindow;

function clampOpacity(value) {
  const opacity = Number(value);
  if (Number.isNaN(opacity)) return MAX_OPACITY;
  return Math.min(MAX_OPACITY, Math.max(MIN_OPACITY, opacity));
}

function checkAndRequestPermissions() {
  if (process.platform === 'darwin') {
    try {
      const micStatus = systemPreferences.getMediaAccessStatus('microphone');
      if (micStatus !== 'granted') {
        systemPreferences.askForMediaAccess('microphone')
          .then(granted => {
            console.log('Microphone access granted:', granted);
          })
          .catch(err => {
            console.error('Error requesting microphone access:', err);
          });
      }

      const screenStatus = systemPreferences.getMediaAccessStatus('screen');
      if (screenStatus !== 'granted') {
        desktopCapturer.getSources({ types: ['screen'] })
          .then(sources => {
            console.log('Screen capture permission requested, sources found:', sources.length);
          })
          .catch(err => {
            console.error('Error requesting screen capture access:', err);
          });
      }
    } catch (err) {
      console.error('Error checking/requesting permissions:', err);
    }
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 980,
    minHeight: 680,
    title: APP_TITLE,
    backgroundColor: '#00000000',
    transparent: true,
    vibrancy: 'under-window',
    visualEffectState: 'active',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.setOpacity(MAX_OPACITY);
  mainWindow.setContentProtection(true);

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = undefined;
  });
}

app.setName(APP_TITLE);

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  checkAndRequestPermissions();
  if (process.platform === 'darwin') {
    app.dock.hide(); // 隐藏 macOS Dock 栏图标
  }
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  app.quit(); // 所有窗口关闭时直接退出应用，避免后台无图标运行常驻
});

ipcMain.handle('desktop-window:get-opacity', () => {
  return mainWindow?.getOpacity() ?? MAX_OPACITY;
});

ipcMain.handle('desktop-window:set-opacity', (_event, value) => {
  const opacity = clampOpacity(value);
  mainWindow?.setOpacity(opacity);
  return opacity;
});

ipcMain.handle('desktop-window:hide', () => {
  mainWindow?.hide();
});
