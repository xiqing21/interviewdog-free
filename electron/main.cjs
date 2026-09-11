const { app, BrowserWindow, ipcMain, Menu, shell, systemPreferences, desktopCapturer, session, globalShortcut, screen } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { spawn, execSync } = require('node:child_process');

process.on('uncaughtException', (err) => {
  try {
    fs.appendFileSync('/tmp/mianshizhu-debug.log', `[UNCAUGHT EXCEPTION] ${err && err.stack || err}\n`);
  } catch {}
});

// Chromium loopback on macOS 14.2+/26 uses Core Audio taps when this is on.
// Must be set before app ready. Harmless if a given Electron build ignores it.
app.commandLine.appendSwitch(
  'enable-features',
  'MacCatapSystemAudioLoopbackCapture,MacLoopbackAudioForScreenShare,MacSckSystemAudioLoopbackOverride',
);

const APP_TITLE = 'MianshiZhu Pro';
const MIN_OPACITY = 0.15;
const MAX_OPACITY = 1;
// Debug build: keep the window and Dock icon visible while fixing Mac audio.
const DEBUG_VISIBLE = false;

let mainWindow;
let audioProcess = null;
let audioStopRequested = false;
let isContentProtected = true;
let isAlwaysOnTop = false;
let isMouseIgnored = false;

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

const LOG_FILE = '/tmp/mianshizhu-debug.log';
function logDebug(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try { fs.appendFileSync(LOG_FILE, line); } catch {}
  console.log(msg);
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
  if (isAlwaysOnTop) {
    applyAlwaysOnTop(mainWindow, true);
  }

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    const rendererHtml = resolveRendererHtml();
    logDebug(`[main] loading renderer: ${rendererHtml}`);
    mainWindow.loadFile(rendererHtml).catch((err) => {
      logDebug(`[main] failed to load renderer: ${err}`);
    });
  }

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    logDebug(`[main] did-fail-load: ${JSON.stringify({ errorCode, errorDescription, validatedURL })}`);
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Forward renderer diagnostics to debug log
  mainWindow.webContents.on('console-message', (_event, level, message) => {
    logDebug(`[renderer:${level}] ${message}`);
  });

  mainWindow.on('closed', () => {
    mainWindow = undefined;
  });
}

function registerGlobalShortcuts() {
  const isMac = process.platform === 'darwin';
  const screenshotKey = isMac ? 'Command+Shift+S' : 'Ctrl+Shift+S';
  const passthroughKey = isMac ? 'Command+Shift+P' : 'Ctrl+Shift+P';

  try {
    globalShortcut.register('CommandOrControl+Shift+I', () => {
      mainWindow?.webContents.openDevTools({ mode: 'detach' });
    });
  } catch (err) {
    console.error('[main] Failed to register devtools shortcut:', err);
  }

  try {
    globalShortcut.register(screenshotKey, () => {
      console.log(`[main] Global shortcut triggered: ${screenshotKey}`);
      mainWindow?.webContents.send('desktop-shortcut:screenshot');
    });
  } catch (err) {
    console.error(`[main] Failed to register shortcut ${screenshotKey}:`, err);
  }

  try {
    globalShortcut.register(passthroughKey, () => {
      console.log(`[main] Global shortcut triggered: ${passthroughKey}`);
      isMouseIgnored = !isMouseIgnored;
      mainWindow?.setIgnoreMouseEvents(isMouseIgnored, { forward: true });
      mainWindow?.webContents.send('desktop-window:ignore-mouse-changed', isMouseIgnored);
    });
  } catch (err) {
    console.error(`[main] Failed to register shortcut ${passthroughKey}:`, err);
  }

  const toggleAnswerKey = isMac ? 'Command+Shift+A' : 'Ctrl+Shift+A';
  try {
    globalShortcut.register(toggleAnswerKey, () => {
      console.log(`[main] Global shortcut triggered: ${toggleAnswerKey}`);
      mainWindow?.webContents.send('desktop-shortcut:toggle-generation-pause');
    });
  } catch (err) {
    console.error(`[main] Failed to register shortcut ${toggleAnswerKey}:`, err);
  }

  // ===== 笔试答题快捷键（防鼠标移出监控） =====
  // 1. 向下滑动追加截屏（长图拼合，不触发AI、不扣费）
  const appendKey = isMac ? 'Command+Shift+Down' : 'Ctrl+Shift+Down';
  try {
    globalShortcut.register(appendKey, () => {
      console.log(`[main] Global shortcut triggered: ${appendKey}`);
      mainWindow?.webContents.send('desktop-shortcut:append-screenshot');
    });
  } catch (err) {
    console.error(`[main] Failed to register shortcut ${appendKey}:`, err);
  }

  // 2. 快捷提交解答（拼合完成后一键提交，扣除5分钟）
  const submitKeys = isMac ? ['Command+Shift+Return', 'Command+Shift+Enter'] : ['Ctrl+Shift+Enter'];
  for (const sKey of submitKeys) {
    try {
      globalShortcut.register(sKey, () => {
        console.log(`[main] Global shortcut triggered: ${sKey}`);
        mainWindow?.webContents.send('desktop-shortcut:submit-exam');
      });
    } catch (err) {
      console.error(`[main] Failed to register shortcut ${sKey}:`, err);
    }
  }

  // 3. 重置/放弃当前截图切片
  const resetKey = isMac ? 'Command+Shift+Backspace' : 'Ctrl+Shift+Backspace';
  try {
    globalShortcut.register(resetKey, () => {
      console.log(`[main] Global shortcut triggered: ${resetKey}`);
      mainWindow?.webContents.send('desktop-shortcut:reset-exam');
    });
  } catch (err) {
    console.error(`[main] Failed to register shortcut ${resetKey}:`, err);
  }
}

app.setName(APP_TITLE);

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  registerDisplayMediaHandler();

  // Ensure WebSocket requests from local file:// origin pass CORS/Origin checks
  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: ['wss://*/*', 'ws://*/*'] },
    (details, callback) => {
      logDebug(`[main] ws onBeforeSendHeaders for ${details.url}, Origin=${details.requestHeaders['Origin']}`);
      details.requestHeaders['Origin'] = 'https://mianshizhu.xyz';
      callback({ requestHeaders: details.requestHeaders });
    },
  );

  // The desktop app is system-audio-only. Permissions are requested only when
  // the user clicks “开始听音”, preventing two startup authorization prompts.
  if (process.platform === 'darwin' && !DEBUG_VISIBLE) {
    app.dock.hide();
  }
  createWindow();
  registerGlobalShortcuts();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
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

ipcMain.handle('desktop-window:get-content-protection', () => {
  return isContentProtected;
});

ipcMain.handle('desktop-window:set-content-protection', (_event, enabled) => {
  isContentProtected = Boolean(enabled);
  if (mainWindow) {
    mainWindow.setContentProtection(isContentProtected);
  }
  return isContentProtected;
});

function applyAlwaysOnTop(targetWindow, flag) {
  if (!targetWindow) return;
  if (process.platform === 'darwin') {
    // 允许穿透 macOS 独立全屏虚拟桌面（Spaces），如全屏浏览器、牛客/赛码在线全屏考试
    targetWindow.setVisibleOnAllWorkspaces(flag, { visibleOnFullScreen: true, skipTransformProcessType: true });
  }
  targetWindow.setAlwaysOnTop(flag, 'screen-saver', 1);
}

ipcMain.handle('desktop-window:get-always-on-top', () => {
  return mainWindow ? mainWindow.isAlwaysOnTop() : isAlwaysOnTop;
});

ipcMain.handle('desktop-window:set-always-on-top', (_event, flag) => {
  isAlwaysOnTop = Boolean(flag);
  if (mainWindow) {
    applyAlwaysOnTop(mainWindow, isAlwaysOnTop);
  }
  return isAlwaysOnTop;
});

ipcMain.handle('desktop-window:get-ignore-mouse-events', () => {
  return isMouseIgnored;
});

ipcMain.handle('desktop-window:set-ignore-mouse-events', (_event, ignore) => {
  isMouseIgnored = Boolean(ignore);
  if (mainWindow) {
    mainWindow.setIgnoreMouseEvents(isMouseIgnored, { forward: true });
  }
  return isMouseIgnored;
});

ipcMain.handle('desktop-screen:get-sources', async (_event, opts) => {
  const types = opts?.types || ['screen', 'window'];
  const thumbnailSize = opts?.thumbnailSize || { width: 320, height: 180 };
  const sources = await desktopCapturer.getSources({
    types,
    thumbnailSize,
    fetchWindowIcons: true,
  });
  return sources.map((s) => ({
    id: s.id,
    name: s.name,
    display_id: s.display_id,
    appIcon: s.appIcon ? s.appIcon.toDataURL() : null,
    thumbnail: s.thumbnail ? s.thumbnail.toDataURL() : null,
  }));
});

ipcMain.handle('desktop-screen:capture-screen', async (_event, sourceId) => {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.size;
  // 视觉大模型（Qwen-VL-Max / GPT-4o）最优长边为 1440px：字迹清晰，体积从 10MB 缩减至 200KB，传输与出题速度大幅提升
  const MAX_DIM = 1440;
  const aspect = (width && height) ? (width / height) : (16 / 9);
  let targetW, targetH;
  if (width >= height) {
    targetW = Math.min(width || 1440, MAX_DIM);
    targetH = Math.round(targetW / aspect);
  } else {
    targetH = Math.min(height || 900, MAX_DIM);
    targetW = Math.round(targetH * aspect);
  }

  const sources = await desktopCapturer.getSources({
    types: ['screen', 'window'],
    thumbnailSize: { width: targetW * 2, height: targetH * 2 },
  });

  let target = null;
  if (sourceId) {
    target = sources.find((s) => s.id === sourceId);
  }
  if (!target) {
    target = sources.find((s) => s.id.startsWith('screen:')) || sources[0];
  }
  if (!target) {
    throw new Error('未找到可用的屏幕或窗口进行截图');
  }

  const resized = target.thumbnail.resize({ width: targetW, height: targetH, quality: 'better' });
  const jpegBuffer = resized.toJPEG(85);
  return jpegBuffer.toString('base64');
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

  logDebug(`[main] Spawning audio helper at: ${helperPath}`);
  try {
    audioStopRequested = false;
    audioProcess = spawn(helperPath, [], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });
  } catch (err) {
    logDebug(`[main] Failed to spawn audio helper: ${err}`);
    throw new Error('无法启动原生声音捕捉助手，请检查权限设置。');
  }

  audioProcess.on('error', (err) => {
    logDebug(`[main] audio helper process error: ${err}`);
    audioProcess = null;
    mainWindow?.webContents.send(
      'desktop-audio:error',
      `系统音频助手启动失败：${err.message || err}`,
    );
  });

  let audioChunkCount = 0;
  audioProcess.stdout.on('data', (chunk) => {
    audioChunkCount++;
    if (audioChunkCount <= 5 || audioChunkCount % 100 === 0) {
      logDebug(`[main] audio chunk #${audioChunkCount} bytes=${chunk?.length || 0}`);
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
    logDebug(`[mac-audio-helper]: ${text}`);
    // 忽略诊断日志与状态信息（@AUTH 包含 (0=authorized 1=denied 2=undetermined) 解释文本，绝不能误判为 error）
    if (text.startsWith('@AUTH') || text.startsWith('FORMAT:') || text.startsWith('SUCCESS:')) {
      return;
    }
    if (/not authorized|kTCCServiceAudioCapture denied/i.test(text)) {
      openScreenRecordingSettings();
      mainWindow?.webContents.send(
        'desktop-audio:error',
        '未获得系统音频权限。请在 系统设置 → 隐私与安全性 里勾选「MianshiZhu Pro」的屏幕录制/系统音频，完全退出后再打开，再点开始听音。微信语音必须从本机扬声器或耳机播放。',
      );
      return;
    }
    if (/^Error:|^FATAL:/i.test(text)) {
      mainWindow?.webContents.send('desktop-audio:error', text);
    }
  });

    const child = audioProcess;
    child.on('close', (code) => {
      if (audioProcess !== child) return;
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
    child.stdout?.removeAllListeners();
    child.stderr?.removeAllListeners();
    child.removeAllListeners('error');
    child.removeAllListeners('close');
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
    }, 400);
  }
  return { ok: true };
});

// ===== 原生 Node.js ASR WebSocket 网关代理（彻底解决 Electron file:// 协议 Origin 1008/1005 拦截） =====
const WebSocketClient = require('ws');
let HttpsProxyAgent = null;
try {
  HttpsProxyAgent = require('https-proxy-agent').HttpsProxyAgent;
} catch (e) {
  logDebug(`[main-asr] note: https-proxy-agent unavailable: ${e.message}`);
}
let asrSocket = null;
let asrSocketId = 0;

function getMacSystemProxy() {
  if (process.platform !== 'darwin') return null;
  try {
    const out = execSync('scutil --proxy', { encoding: 'utf8' });
    const isHttps = /HTTPSEnable\s*:\s*1/.test(out);
    const isHttp = /HTTPEnable\s*:\s*1/.test(out);
    if (!isHttps && !isHttp) return null;
    const hostMatch = out.match(/HTTPSProxy\s*:\s*([^\s]+)/) || out.match(/HTTPProxy\s*:\s*([^\s]+)/);
    const portMatch = out.match(/HTTPSPort\s*:\s*(\d+)/) || out.match(/HTTPPort\s*:\s*(\d+)/);
    if (hostMatch && portMatch) {
      return `http://${hostMatch[1]}:${portMatch[1]}`;
    }
  } catch {}
  return null;
}

async function resolveProxyForUrl(targetUrl) {
  try {
    if (session.defaultSession) {
      const proxyStr = await session.defaultSession.resolveProxy(targetUrl);
      if (proxyStr) {
        const match = proxyStr.match(/(?:PROXY|HTTPS)\s+([^;\s]+)/i);
        if (match && match[1]) {
          return match[1].startsWith('http') ? match[1] : `http://${match[1]}`;
        }
      }
    }
  } catch (e) {
    logDebug(`[main-asr] session.resolveProxy error: ${e.message}`);
  }

  const envProxy = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.ALL_PROXY || process.env.all_proxy;
  if (envProxy) return envProxy;

  const macProxy = getMacSystemProxy();
  if (macProxy) return macProxy;

  return null;
}

ipcMain.handle('desktop-asr:connect', async (_event, url, startPayload) => {
  const currentSocketId = ++asrSocketId;
  logDebug(`[main-asr] connecting to ${url} (socket #${currentSocketId})`);
  if (asrSocket) {
    const oldSocket = asrSocket;
    asrSocket = null;
    oldSocket.removeAllListeners();
    try { oldSocket.close(1000, 'reconnecting'); } catch {}
  }

  try {
    let agent = null;
    const proxyUrl = await resolveProxyForUrl(url);
    if (proxyUrl) {
      try {
        agent = new HttpsProxyAgent(proxyUrl);
        logDebug(`[main-asr] using proxy agent ${proxyUrl}`);
      } catch (e) {
        logDebug(`[main-asr] failed to create HttpsProxyAgent: ${e.message}`);
      }
    }

    const wsOptions = {
      headers: {
        'Origin': 'https://mianshizhu.xyz',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) MianshiZhu/1.0.8 Chrome/130.0.0.0 Electron/43.0.0 Safari/537.36'
      }
    };
    if (agent) {
      wsOptions.agent = agent;
    }

    const ws = new WebSocketClient(url, wsOptions);
    asrSocket = ws;

    // 连接握手 6 秒超时防挂起保护
    const handshakeTimer = setTimeout(() => {
      if (asrSocketId !== currentSocketId || asrSocket !== ws) return;
      if (ws.readyState === WebSocketClient.CONNECTING) {
        logDebug(`[main-asr] handshake timeout for ${url} after 6000ms`);
        try { ws.terminate(); } catch {}
        mainWindow?.webContents.send('desktop-asr:error', '识别网关握手超时，正在重试...');
        mainWindow?.webContents.send('desktop-asr:close', { code: 1006, reason: 'handshake timeout' });
        asrSocket = null;
      }
    }, 6000);

    ws.on('open', () => {
      clearTimeout(handshakeTimer);
      if (asrSocketId !== currentSocketId || asrSocket !== ws) return;
      logDebug(`[main-asr] WebSocket connected to ${url}, sending start payload`);
      if (startPayload) {
        try {
          ws.send(JSON.stringify(startPayload));
        } catch (e) {
          logDebug(`[main-asr] send startPayload error: ${e.message}`);
        }
      }
      mainWindow?.webContents.send('desktop-asr:open');
    });

    ws.on('message', (data) => {
      if (asrSocketId !== currentSocketId || asrSocket !== ws) return;
      const str = data.toString();
      if (!str.includes('voiceRecBase64') && str.length < 200) {
        logDebug(`[main-asr] message: ${str}`);
      }
      mainWindow?.webContents.send('desktop-asr:message', str);
    });

    ws.on('error', (err) => {
      clearTimeout(handshakeTimer);
      if (asrSocketId !== currentSocketId || asrSocket !== ws) return;
      logDebug(`[main-asr] WebSocket error: ${err.message}`);
      mainWindow?.webContents.send('desktop-asr:error', err.message);
    });

    ws.on('close', (code, reason) => {
      clearTimeout(handshakeTimer);
      if (asrSocketId !== currentSocketId || asrSocket !== ws) return;
      logDebug(`[main-asr] WebSocket closed: code=${code}, reason=${reason}`);
      mainWindow?.webContents.send('desktop-asr:close', { code, reason: reason ? reason.toString() : '' });
      asrSocket = null;
    });

    return { ok: true };
  } catch (err) {
    logDebug(`[main-asr] failed to create WebSocketClient: ${err.message}`);
    return { ok: false, error: err.message };
  }
});

let asrSendCount = 0;
ipcMain.handle('desktop-asr:send', (_event, payload) => {
  if (asrSocket && asrSocket.readyState === WebSocketClient.OPEN) {
    try {
      asrSendCount++;
      if (asrSendCount <= 3 || asrSendCount % 50 === 0) {
        logDebug(`[main-asr] sent payload #${asrSendCount}`);
      }
      asrSocket.send(payload);
      return true;
    } catch (err) {
      logDebug(`[main-asr] send error: ${err.message}`);
      return false;
    }
  }
  return false;
});

ipcMain.handle('desktop-asr:close', () => {
  if (asrSocket) {
    const s = asrSocket;
    asrSocket = null;
    s.removeAllListeners();
    try {
      s.send(JSON.stringify({ type: 'stop' }));
      s.close(1000, 'user stop');
    } catch {}
  }
  return true;
});
