# macOS 客户端防屏幕共享、窗口拖拽及权限适配说明文档

为了提升 macOS 客户端的安全性、防作弊/隐私保护能力以及用户交互体验，我们对桌面版应用进行了深度适配。本文档详细说明了各项功能的具体实现原理及代码位置。

---

## 一、 共享屏幕与截图防偷看（Content Protection）

### 1. 功能描述
在进行 Zoom、腾讯会议、飞书、Google Meet 等会议软件屏幕共享，或者进行 macOS 系统自带/第三方截图及录屏时，本应用窗口的区域在共享画面中会自动呈现为全黑，或者完全不可见，但在物理桌面上依然能被用户正常看到。

### 2. 实现原理
通过 Electron 主进程窗口的 `setContentProtection(enable)` API 实现。
- **底层机制**：在 macOS 上，该方法会调用 Cocoa 层的 `[NSWindow setSharingType:NSWindowSharingNone]`。
- **代码实现**：
  在 `electron/main.cjs` 的 `createWindow()` 函数中，当窗口创建完成并设置透明度后，立即启用内容保护：
  ```javascript
  mainWindow.setOpacity(MAX_OPACITY);
  mainWindow.setContentProtection(true); // 启用防截图与共享保护
  ```

---

## 二、 窗口可拖拽移动（Window Draggable Areas）

### 1. 功能描述
由于 macOS 版客户端隐藏了原生窗口标题栏（使用了 `titleBarStyle: 'hiddenInset'`），默认情况下无边框窗口无法通过点击边缘移动。我们对应用顶栏及侧边栏进行了拖拽适配。

### 2. 实现原理
利用 CSS 的 `-webkit-app-region: drag` 和 `no-drag` 属性。
- **拖拽区域设计**：
  - **顶部应用栏**：在 `src/components/layout/TopBar.tsx` 的 `AppBar` 组件样式中加入 `WebkitAppRegion: 'drag'` 和 `userSelect: 'none'`。
  - **左侧边栏顶部**：在 `src/components/layout/Sidebar.tsx` 的顶部 Logo/标题 `Box` 容器中加入 `WebkitAppRegion: 'drag'` 和 `userSelect: 'none'`，并预留了 `pt: 3.5` 的内边距以避开 macOS 左上角的红绿黄交通灯按钮。
- **防拖拽（交互元素）设置**：
  为避免拖拽区域影响正常的按钮点击、文字选择或表单交互，我们为所有的交互子组件显式添加了 `WebkitAppRegion: 'no-drag'` 样式：
  - 顶栏的剩余时间 `Chip` 按钮。
  - 顶栏的登录/退出 `AuthPanel` 组件。
  - 顶栏的暗黑模式切换 `IconButton` 按钮。
  - 侧边栏的 Logo 图片（防止点击拖拽图片导致窗口误移动）。

---

## 三、 窗口透明度调优（Opacity Limit Adjustment）

### 1. 功能描述
支持桌面窗口透明度调节，默认透明度为 `100%`（完全不透明），允许调节的最低限度为 `35%`。

### 2. 实现原理
- **主进程限制**：修改 `electron/main.cjs` 中的限制常量：
  ```javascript
  const MIN_OPACITY = 0.35; // 限制最低透明度为 35%
  ```
- **数据层过滤**：在 `src/services/desktopWindowService.ts` 的读取和设置中限制最小值：
  ```typescript
  export function readStoredOpacity(): number {
    const saved = Number(window.localStorage.getItem(STORAGE_KEY));
    if (Number.isNaN(saved)) return DEFAULT_OPACITY;
    return Math.min(1, Math.max(0.35, saved)); // 过滤出最低 0.35
  }
  ```
- **设置界面滑块约束**：在 `src/components/settings/DesktopWindowSettings.tsx` 中，将 opacity 调节 `Slider` 的 `min` 属性设置为 `35`。

---

## 四、 运行时权限主动申请（Permissions Auto-Request）

### 1. 功能描述
在客户端初次启动时，会自动弹窗提示用户授权“麦克风”和“屏幕录制（访问其他应用）”权限，而不需要等使用到具体功能时才被动申请。

### 2. 实现原理
在 Electron 主进程 ready 后通过系统原生 API 主动触发权限请求：
- **麦克风权限**：调用 `systemPreferences.askForMediaAccess('microphone')`。
- **屏幕录制权限**：由于 macOS 限制，没有直接的主动触发 Screen Recording 权限的简单方法。我们通过在主进程中调用一次 `desktopCapturer.getSources({ types: ['screen'] })`，可以强制系统弹出屏幕录制请求弹窗。
- **代码实现** (`electron/main.cjs`)：
  ```javascript
  function checkAndRequestPermissions() {
    if (process.platform === 'darwin') {
      try {
        const micStatus = systemPreferences.getMediaAccessStatus('microphone');
        if (micStatus !== 'granted') {
          systemPreferences.askForMediaAccess('microphone').catch(err => {});
        }

        const screenStatus = systemPreferences.getMediaAccessStatus('screen');
        if (screenStatus !== 'granted') {
          desktopCapturer.getSources({ types: ['screen'] }).catch(err => {});
        }
      } catch (err) {}
    }
  }
  ```

---

## 五、 打包与安全性配置（Plist & Entitlements）

### 1. 信息属性列表描述（plist）
在 `package.json` 中的 `build.mac` 字段下增加了 `extendInfo` 声明。如果缺少这些声明，macOS 系统在应用请求麦克风或屏幕录制时会直接闪退：
```json
"extendInfo": {
  "NSMicrophoneUsageDescription": "面试猪需要访问您的麦克风以采集您的声音并进行实时转写。",
  "NSScreenCaptureUsageDescription": "面试猪需要屏幕录制权限以捕获会议窗口并提取系统/会议音频进行实时转写。"
}
```

### 2. 沙盒特权豁免（Entitlements）
在 macOS 开启硬化运行安全性（Hardened Runtime）时，必须通过 entitlements 声明权限豁免，否则会被系统强行禁止调用底层音频输入。
在 `build/entitlements.mac.plist` 中添加了以下声明：
```xml
<key>com.apple.security.device.audio-input</key>
<true/>
```

---

## 六、 隐藏 Dock 栏图标（Dock Icon Hidden）

### 1. 功能描述
为满足客户端在使用过程中的低调与隐蔽需求，应用在运行时不会在 macOS 底部 Dock 栏显示应用图标，也不会显示在应用切换器 (Cmd + Tab) 中。

### 2. 实现原理
在 `electron/main.cjs` 中，利用 Electron 的 `app.dock.hide()` 接口：
```javascript
if (process.platform === 'darwin') {
  app.dock.hide(); // 隐藏 macOS Dock 栏图标
}
```
**退出安全防错机制**：由于隐藏了 Dock 图标，为防止应用在关闭窗口后仍在后台常驻导致内存泄露，我们修改了窗口关闭逻辑，强制关闭所有窗口时立即安全退出程序：
```javascript
app.on('window-all-closed', () => {
  app.quit(); // 所有窗口关闭时直接退出应用
});
```

---

## 七、 解决本地客户端中 API 相对路径请求失效问题（Absolute API URL Resolving）

### 1. 功能描述
在网页版中，前端可以使用 `/api/billing` 等相对路径进行 API 请求。但在 Electron 客户端生产环境中，由于页面是通过本地文件协议（`file://`）加载的，相对路径请求会被解析为本地磁盘文件（如 `file:///api/billing`），从而导致 `Failed to fetch` 报错。

### 2. 实现原理
我们设计了全局 API 地址解析工具 [apiHelper.ts](file:///Users/felix/Documents/interview-copilot/interviewdog-free/src/services/apiHelper.ts)：
- 在网页端运行时，自动沿用相对路径访问当前域名。
- 在桌面端（Electron 环境下 `file:` 协议）运行时，自动将请求路由解析重定向到生产环境 API 域名 `https://mianshizhu-commercial.vercel.app`。

**更新覆盖的文件**：
- [apiHelper.ts](file:///Users/felix/Documents/interview-copilot/interviewdog-free/src/services/apiHelper.ts) [NEW]
- [KnowledgePage.tsx](file:///Users/felix/Documents/interview-copilot/interviewdog-free/src/components/knowledge/KnowledgePage.tsx) — 处理网页读取请求。
- [adminService.ts](file:///Users/felix/Documents/interview-copilot/interviewdog-free/src/services/adminService.ts) — 处理后台管理相关 API。
- [aiService.ts](file:///Users/felix/Documents/interview-copilot/interviewdog-free/src/services/aiService.ts) — 处理聊天与对话相关 API。
- [billingService.ts](file:///Users/felix/Documents/interview-copilot/interviewdog-free/src/services/billingService.ts) — 解决购买页面的 `Failed to fetch` 问题。
- [cloudAsrService.ts](file:///Users/felix/Documents/interview-copilot/interviewdog-free/src/services/cloudAsrService.ts) — 处理云端语音识别代理请求。
- [mimoAsrService.ts](file:///Users/felix/Documents/interview-copilot/interviewdog-free/src/services/mimoAsrService.ts) — 处理 MiMo ASR 识别代理。
- [openaiChunkAsrService.ts](file:///Users/felix/Documents/interview-copilot/interviewdog-free/src/services/openaiChunkAsrService.ts) — 处理 OpenAI 音频分片识别。
- [webSearchService.ts](file:///Users/felix/Documents/interview-copilot/interviewdog-free/src/services/webSearchService.ts) — 处理 AI 联网搜索相关 API。

---

## 八、 免选择器原生系统音频内录（Native ScreenCaptureKit Audio Loopback）

### 1. 功能描述
在 macOS 桌面端中，无需每次弹出浏览器的“分享窗口/共享屏幕”选择器，应用将自动拉取系统主屏幕的声音。只要该应用在系统的“屏幕录制”权限中已被授权，即可静默拉取系统和所有会议软件的声音，极大地提升了用户体验。

### 2. 实现原理

#### A. Swift 独立原生采集器 ([mac-audio-helper.swift](file:///Users/felix/Documents/interview-copilot/interviewdog-free/electron/mac-audio-helper.swift))
使用 macOS 13+ 推出的原生安全音频框架 `ScreenCaptureKit`，绕过 WebRTC 层级限制：
- 利用 `SCShareableContent.excludingDesktopWindows` 自动查找主屏幕并创建 `SCContentFilter` 过滤条件。
- 配置 `SCStreamConfiguration.capturesAudio = true` 开启系统声音捕捉，并自动将采集信号在系统底层重采样至 AI 识别专用的 **16000Hz 单声道 (Mono) 16-bit Linear PCM**。
- 将捕获到的原始 PCM 音频二进制数据以流的方式实时写入标准输出 (`stdout`)。

#### B. Electron 主进程管道桥接与分发 ([main.cjs](file:///Users/felix/Documents/interview-copilot/interviewdog-free/electron/main.cjs) & [preload.cjs](file:///Users/felix/Documents/interview-copilot/interviewdog-free/electron/preload.cjs))
- 当渲染进程请求开启录音时，主进程通过 `child_process.spawn` 启动编译好的 `mac-audio-helper` 原生助手程序。
- 监听原生助手的 `stdout` 事件，在接收到 16-bit PCM 二进制包时，通过 IPC 通道 `desktop-audio:data` 直接将其传输回 React 渲染端。
- 当渲染端停止面试或窗口关闭时，主进程强制 `kill` 该子进程以释放声卡捕获通道。

#### C. React 前端零感知切换 ([systemAudioService.ts](file:///Users/felix/Documents/interview-copilot/interviewdog-free/src/services/systemAudioService.ts))
我们对全局系统声音采集服务进行了重构：
- 自动检测是否处于拥有 `window.desktopWindow.startSystemAudio` 的桌面端原生环境。
- 如果是，直接走原生 IPC 音频流总线监听器，静默激活内录，前端 UI 和转写引擎在数据流层面**完全透明、零感知，无缝兼容**。
- 如果是非桌面环境，则自动优雅降级，回弹至浏览器自带的 `getDisplayMedia` 窗口共享选择弹窗。

**更新覆盖的文件**：
- [mac-audio-helper.swift](file:///Users/felix/Documents/interview-copilot/interviewdog-free/electron/mac-audio-helper.swift) [NEW] — 原生声音读取 Swift 源码。
- [main.cjs](file:///Users/felix/Documents/interview-copilot/interviewdog-free/electron/main.cjs) — 添加音频助手子进程调度与 IPC 交互管道。
- [preload.cjs](file:///Users/felix/Documents/interview-copilot/interviewdog-free/electron/preload.cjs) — 向渲染层暴露音频启动、停止、数据接收钩子。
- [vite-env.d.ts](file:///Users/felix/Documents/interview-copilot/interviewdog-free/src/vite-env.d.ts) — 新增原生音频相关 TypeScript 声明。
- [systemAudioService.ts](file:///Users/felix/Documents/interview-copilot/interviewdog-free/src/services/systemAudioService.ts) — 融合原生流与 WebRTC 流的无缝重构桥接。
- [package.json](file:///Users/felix/Documents/interview-copilot/interviewdog-free/package.json) — 配置 `extraResources` 将编译好的 `mac-audio-helper` 打包进应用安装包。


