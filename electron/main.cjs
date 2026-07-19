const { app, BrowserWindow, ipcMain, Menu, shell, systemPreferences, desktopCapturer } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');

const APP_TITLE = 'MianshiZhu Pro';
const MIN_OPACITY = 0.35;
const MAX_OPACITY = 1;
// Debug build: keep the window and Dock icon visible while fixing Mac audio.
const DEBUG_VISIBLE = true;

let mainWindow;
let audioProcess = null;
let audioStopRequested = false;

function clampOpacity(value) {
  const opacity = Number(value);
  if (Number.isNaN(opacity)) return MAX_OPACITY;
  return Math.min(MAX_OPACITY, Math.max(MIN_OPACITY, opacity));
}

function getScreenAccessStatus() {
  if (process.platform !== 'darwin') return 'granted';
  try {
    return systemPreferences.getMediaAccessStatus('screen');
  } catch {
    return 'unknown';
  }
}

function openScreenRecordingSettings() {
  // Works across recent macOS versions; fails silently if URL unsupported.
  shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture').catch(() => {
    shell.openExternal('x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension').catch(() => {});
  });
}

function resolveAudioHelperPath() {
  const candidates = [];
  if (app.isPackaged) {
    candidates.push(path.join(process.resourcesPath, 'build', 'mac-audio-helper'));
  }
  candidates.push(path.join(__dirname, '..', 'build', 'mac-audio-helper'));
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return candidates[0];
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
      // sandbox false: more reliable IPC binary audio transfer for desktop capture
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.setOpacity(MAX_OPACITY);
  if (!DEBUG_VISIBLE) {
    mainWindow.setContentProtection(true);
  }

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    // Web deploy uses dist/index.html as marketing site; the SPA shell is app.html.
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'app.html'));
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Forward renderer diagnostics to the packaged-app stdout while debugging
  // the native audio path. This is intentionally low-volume and harmless in
  // normal runs, but makes PCM/Gateway failures observable from a DMG build.
  mainWindow.webContents.on('console-message', (_event, level, message) => {
    console.log(`[renderer:${level}] ${message}`);
  });

  mainWindow.on('closed', () => {
    mainWindow = undefined;
  });
}

app.setName(APP_TITLE);

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  // The desktop app is system-audio-only. Permissions are requested only when
  // the user clicks “开始听音”, preventing two startup authorization prompts.
  if (process.platform === 'darwin' && !DEBUG_VISIBLE) {
    app.dock.hide();
  }
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (audioProcess) {
    audioProcess.kill();
    audioProcess = null;
  }
  app.quit();
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

ipcMain.handle('desktop-audio:get-screen-status', () => getScreenAccessStatus());

ipcMain.handle('desktop-audio:open-screen-settings', () => {
  openScreenRecordingSettings();
  return true;
});

ipcMain.handle('desktop-audio:start', async () => {
  if (audioProcess) {
    return { ok: true, alreadyRunning: true };
  }

  const screenStatus = getScreenAccessStatus();
  if (screenStatus !== 'granted') {
    // Best-effort prompt, then ask user to enable in Settings.
    try {
      await desktopCapturer.getSources({ types: ['screen'] });
    } catch (_) {
      // ignore
    }
    const after = getScreenAccessStatus();
    if (after !== 'granted') {
      openScreenRecordingSettings();
      throw new Error(
        '未获得「屏幕录制」权限。请在 系统设置 → 隐私与安全性 → 屏幕录制 中勾选「MianshiZhu Pro」，然后完全退出 App 再重新打开，再点开始听音。微信语音必须从本机扬声器/耳机播放才能被捕获。',
      );
    }
  }

  const helperPath = resolveAudioHelperPath();
  if (!fs.existsSync(helperPath)) {
    throw new Error(`找不到系统音频助手：${helperPath}`);
  }
  try {
    fs.accessSync(helperPath, fs.constants.X_OK);
  } catch {
    try {
      fs.chmodSync(helperPath, 0o755);
    } catch (err) {
      throw new Error(`系统音频助手不可执行：${helperPath}`);
    }
  }

  console.log('[main] Spawning audio helper at:', helperPath);
  try {
    audioStopRequested = false;
    audioProcess = spawn(helperPath, [], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });
  } catch (err) {
    console.error('[main] Failed to spawn audio helper:', err);
    throw new Error('无法启动原生声音捕捉助手，请检查权限设置。');
  }

  audioProcess.on('error', (err) => {
    console.error('[main] audio helper process error:', err);
    audioProcess = null;
    mainWindow?.webContents.send(
      'desktop-audio:error',
      `系统音频助手启动失败：${err.message || err}`,
    );
  });

  let loggedFirstChunk = false;
  audioProcess.stdout.on('data', (chunk) => {
    if (!loggedFirstChunk) {
      loggedFirstChunk = true;
      console.log('[main] first audio chunk bytes:', chunk?.length || 0);
    }
    // Explicit Uint8Array avoids structured-clone issues with Node Buffer in some Electron versions.
    const payload = chunk instanceof Uint8Array
      ? chunk
      : new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength);
    // Copy to a plain ArrayBuffer-backed view for IPC reliability
    const copy = new Uint8Array(payload.byteLength);
    copy.set(payload);
    mainWindow?.webContents.send('desktop-audio:data', copy);
  });

  audioProcess.stderr.on('data', (data) => {
    const text = data.toString().trim();
    console.warn(`[mac-audio-helper]: ${text}`);
    if (/error|denied|not authorized|fail/i.test(text) && !/SUCCESS/i.test(text)) {
      mainWindow?.webContents.send('desktop-audio:error', text);
    }
  });

  audioProcess.on('close', (code) => {
    const endedUnexpectedly = !audioStopRequested;
    console.log(`[mac-audio-helper] exited with code ${code}`);
    audioProcess = null;
    audioStopRequested = false;
    if (endedUnexpectedly) {
      mainWindow?.webContents.send('desktop-audio:ended');
      if (code && code !== 0) {
        mainWindow?.webContents.send(
          'desktop-audio:error',
          `系统音频助手异常退出（code=${code}）。请检查屏幕录制权限后重试。`,
        );
      }
    }
  });

  return { ok: true, helperPath, screenStatus: getScreenAccessStatus() };
});

ipcMain.handle('desktop-audio:stop', () => {
  if (audioProcess) {
    audioStopRequested = true;
    try {
      audioProcess.kill('SIGTERM');
    } catch (_) {
      // ignore
    }
    audioProcess = null;
  }
});
