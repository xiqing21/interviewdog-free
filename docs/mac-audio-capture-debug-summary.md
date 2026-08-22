# Mac 客户端系统音频捕获排查总结

## 现象

Mac 客户端可以直接进入面试页，但播放 Mac 上的语音后没有识别结果。此前为了排查问题，临时关闭了窗口防截图和 Dock 隐藏。

## 结论

Mac 客户端不需要选择微信、腾讯会议或其他窗口。它通过 macOS ScreenCaptureKit 捕获当前系统输出音频，声音只要经过 Mac 的扬声器或耳机输出，就可以被识别。

如果语音只在手机扬声器播放，Mac 客户端无法捕获手机端的声音。

## 根因

1. Electron 本地页面使用 `file://` 来源，Gateway 原先只允许商业网站域名，WebSocket 会被服务端以 `1008 origin not allowed` 拒绝。
2. Gateway 尚未完成握手时，Mac 原生音频不会启动，导致连接异常时看起来像没有音频捕获。
3. 原生 helper 通过 stdout 输出连续 PCM 流，Electron 的 IPC 分块不保证按 16-bit 样本边界切分，直接转换可能造成音频数据错位或丢失。

## 修复内容

- Gateway 白名单加入 `file://`，允许 Mac Electron 客户端建立连接。
- Mac 原生音频采集独立于 Gateway 握手启动，连接恢复后自动发送缓存的 PCM。
- preload 增加 PCM 字节缓存，确保每个 `Int16Array` 都按 2 字节对齐。
- Mac 端默认强制使用系统音频，麦克风保持静音。
- Mac 端跳过 Chrome 共享窗口准备页，不再要求选择面试窗口。
- 恢复默认窗口保护：`setContentProtection(true)`。
- 恢复默认隐藏 Dock 图标。

## 验证结果

- `bun run build` 通过。
- `bun run desktop:pack` 通过。
- ScreenCaptureKit helper 成功启动并输出非零 PCM。
- Electron Gateway WebSocket 成功返回 `ready`。
- Mac 播放测试语音后，页面成功识别出：

  > 请介绍一下你在大数据项目中遇到的性能优化问题以及解决方案。

- AI 回答正常生成。

## 测试步骤

1. 关闭旧版 App，打开最新 Mac 包。
2. 在 Mac 微信、浏览器或播放器中播放语音，确认声音经过 Mac 当前扬声器或耳机输出。
3. 点击“开始听音”。
4. 等待状态显示“系统音频已连接”。
5. 播放面试官语音，确认左侧出现识别问题并生成 AI 回答。

## 注意事项

- 手机端单独播放的声音不会进入 Mac 的系统音频。
- 正式运行继续保持窗口不可被截图或屏幕共享捕获，Dock 图标也保持隐藏。
- 当前本地测试包未配置 Apple Developer ID 签名，正式分发前仍需完成签名和公证。
