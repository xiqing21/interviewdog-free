const { app, BrowserWindow, ipcMain, Menu, shell, systemPreferences, desktopCapturer, session } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');

// Chromium loopback on macOS 14.2+/26 uses Core Audio taps when this is on.
// Must be set before app ready. Harmless if a given Electron build ignores it.
app.commandLine.appendSwitch(
  'enable-features',
  'MacCatapSystemAudioLoopbackCapture,MacLoopbackAudioForScreenShare,MacSckSystemAudioLoopbackOverride',
);

const APP_TITLE = 'MianshiZhu Pro';
const MIN_OPACITY = 0.35;
const MAX_OPACITY = 1;
// Debug build: keep the window and Dock icon visible while fixing Mac audio.
const DEBUG_VISIBLE = false;

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
  // macOS 14.4+/26 splits "系统音频" from classic Screen Recording.
  const urls = [
    'x-apple.systempreferences:com.apple.preference.security?Privacy_AudioCapture',
    'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture',
    'x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension',
  ];
  (async () => {
    for (const url of urls) {
      try {
        await shell.openExternal(url);
        return;
      } catch {
        // try next
      }
    }
  })();
}

function registerDisplayMediaHandler() {
  try {
    session.defaultSession.setDisplayMediaRequestHandler(async (_request, callback) => {
      const sources = await desktopCapturer.getSources({ types: ['screen'] });
      const screen = sources[0];
      if (!screen) {
        callback({});
        return;
      }
      callback({ video: screen, audio: 'loopback' });
    });
  } catch (err) {
    console.error('[main] setDisplayMediaRequestHandler failed', err);
  }
}

function resolveRendererHtml() {
  const distDir = path.join(__dirname, '..', 'dist');
  const appHtml = path.join(distDir, 'app.html');
  const indexHtml = path.join(distDir, 'index.html');
  // assemble-site moves the SPA to app.html and replaces index.html with marketing.
  // A desktop-only Vite build keeps the SPA at index.html. Prefer the SPA shell.
  if (fs.existsSync(appHtml)) return appHtml;
  if (fs.existsSync(indexHtml)) return indexHtml;
  return appHtml;
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
    const rendererHtml = resolveRendererHtml();
    console.log('[main] loading renderer', rendererHtml);
    mainWindow.loadFile(rendererHtml).catch((err) => {
      console.error('[main] failed to load renderer', rendererHtml, err);
    });
  }

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error('[main] did-fail-load', { errorCode, errorDescription, validatedURL });
  });

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
  registerDisplayMediaHandler();
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

  // Best-effort TCC prompt. macOS 14.4+/26 uses a separate「系统音频」permission
  // for Core Audio taps; classic Screen Recording may already be granted while
  // the helper still gets silent buffers. Always spawn the helper and surface
  // its AUTH/Error lines instead of blocking here.
  try {
    await desktopCapturer.getSources({ types: ['screen'] });
  } catch (_) {
    // ignore — helper will request audio-capture itself
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
    if (/not authorized|Error:/i.test(text)) {
      openScreenRecordingSettings();
      mainWindow?.webContents.send(
        'desktop-audio:error',
        '未获得系统音频权限。请在 系统设置 → 隐私与安全性 里勾选「MianshiZhu Pro」的屏幕录制/系统音频，完全退出后再打开，再点开始听音。微信语音必须从本机扬声器或耳机播放。',
      );
      return;
    }
    if (/error|denied|fail/i.test(text) && !/SUCCESS/i.test(text)) {
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
    const child = audioProcess;
    audioProcess = null;
    try {
      child.kill('SIGTERM');
    } catch (_) {
      // ignore
    }
    setTimeout(() => {
      try {
        child.kill('SIGKILL');
      } catch (_) {
        // already gone
      }
    }, 800);
  }
});
