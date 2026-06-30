# 实时 ASR Gateway 优化说明

本文档记录本项目从“慢速分片识别”优化到“接近面试狗体验”的核心改造。当前最推荐的识别引擎是：

```text
Gateway 豆包实时（服务端 WS）
```

实测效果：系统音频识别速度明显提升，响应节奏和面试狗类似，适合腾讯会议、微信、浏览器标签页等外部音频场景。

## 1. 原问题

之前语音识别慢，主要不是豆包模型慢，而是链路形态不对。

旧方案大致有几类：

1. 浏览器原生 Web Speech API
   - 优点：免费、简单。
   - 问题：基本只能稳定识别麦克风，不能可靠识别 Chrome 共享出来的系统音频。

2. 客户端直连豆包 WebSocket
   - 优点：理论上是实时。
   - 问题：浏览器侧处理豆包二进制协议、gzip、首包 request、音频帧顺序时很容易出错，之前出现过 `no request object before data`。

3. 分片 HTTP 云 ASR
   - 优点：接百度、Google、阿里、GLM 等接口比较直接。
   - 问题：必须攒够 1.5 秒、2.5 秒、4 秒甚至更长音频再请求，天然会慢；长问题还容易被切碎，导致 AI 每几秒就回答一次。

4. 本地 ASR 模型
   - 优点：不走公网，理论上低延迟。
   - 问题：本机内存占用高，模型效果和稳定性不如云端成熟服务，不适合作为当前主方案。

所以真正的瓶颈是：

```text
音频传输和 ASR 会话架构，而不是单纯模型能力。
```

## 2. 目标架构

参考面试狗的抓包结论后，目标架构改成：

```text
Chrome 音频采集
  -> 前端持续发送 16kHz PCM
  -> 服务端 ASR Gateway
  -> 服务端长连接云厂商实时 ASR
  -> 服务端返回 VoiceMessage
  -> 前端合并问题并触发 AI 回答
```

关键点：

- 前端只做音频采集，不再承担复杂厂商协议。
- 服务端保持 WebSocket 长连接，不再每几秒发一次 HTTP 请求。
- 音频格式统一成 `pcm_s16le / 16kHz / mono`。
- 问题断句窗口使用设置里的“句内停顿容忍”，可以在面试过程中调 1 秒、1.5 秒、2 秒等。
- 面试官系统音频和我的麦克风保持双路逻辑：系统音频识别为面试官，麦克风识别为我。

## 3. 本次实现的核心文件

### `api/asr-gateway.ts`

新增服务端 ASR Gateway。

它接收前端 JSON WebSocket 消息：

```json
{
  "type": "start",
  "provider": "gateway-doubao",
  "speaker": "interviewer",
  "asrEndWindowSize": 1500,
  "config": {}
}
```

持续接收音频：

```json
{
  "type": "audio",
  "voiceRecBase64": "..."
}
```

返回统一消息：

```json
{
  "type": "VoiceMessage",
  "provider": "gateway-doubao",
  "speaker": "interviewer",
  "text": "请做一个自我介绍",
  "isFinal": true
}
```

目前支持：

- `gateway-doubao`
- `gateway-iflytek`
- `gateway-alibaba`

其中豆包路径是本次效果提升最明显的主路径。

### `src/services/asrGatewayService.ts`

新增前端 Gateway 客户端。

它负责：

- 连接 `/api/asr-gateway`
- 发送 `start` 消息
- 将 `Int16Array` PCM 转成 Base64
- 等服务端 `ready` 后再推送音频
- 服务端未 ready 时先缓存少量音频帧
- 接收 `VoiceMessage` 并回调给面试上下文

本地开发时，如果页面运行在 `localhost` 或 `127.0.0.1`，Gateway 地址会指向线上生产：

```text
wss://interviewdog-free.vercel.app/api/asr-gateway
```

这样可以避免 Vite 本地 dev server 不支持 Vercel API WebSocket upgrade 的问题。

### `src/context/InterviewContext.tsx`

把 Gateway 接入面试主流程。

关键逻辑：

- 如果面试官声音是系统音频，并且引擎是 Gateway，则先触发 Chrome 系统音频共享。
- 系统音频 PCM 通过 `systemAudioService.start()` 持续送给 `asrGatewayService.sendAudio()`。
- Gateway 返回的面试官文本进入 `handleRecognitionResult()`。
- `isFinal` 片段进入问题合并缓冲区。
- 超过“句内停顿容忍”后，合并成一个完整问题并触发 AI。
- 停止面试、结束面试、切换项目时都会停止 Gateway，避免残留“识别中”。

双路策略：

```text
面试官：系统音频 -> Gateway ASR -> 触发 AI 回答
我：麦克风 -> 浏览器 ASR -> 只记录，不触发 AI
```

这样不会把我自己的回答误判成面试官问题。

## 4. 豆包实时 Gateway 为什么快

旧分片方案：

```text
采集音频 -> 攒够 chunk -> 编码 -> HTTP 请求 -> 等返回 -> 再处理
```

新 Gateway 方案：

```text
采集音频 -> 立即推 PCM -> 服务端长连接豆包 -> 流式返回增量结果
```

速度提升来自几个点：

1. 去掉 HTTP 分片等待
   - 不再等 2.5 秒或 4 秒音频块攒满。
   - 音频一产生就进入服务端 WebSocket。

2. 服务端处理豆包协议
   - 豆包大模型流式 ASR 使用二进制帧、gzip、首包 request、音频帧和结束帧。
   - 这些放在 Node 服务端处理比浏览器端稳定。

3. 修复首包顺序问题
   - 之前豆包报错：

```text
payload unmarshal: no request object before data
```

   - 根因是上游还没正确收到 request object，就收到了 audio data。
   - Gateway 中先发送完整 request，再向前端发 `ready`，前端收到 `ready` 才开始 flush 音频队列。

4. 统一 16k PCM
   - 前端采集后统一送 `Int16Array` PCM。
   - 服务端只做轻量协议封包，不做重型音频转码。

5. 断句窗口前后打通
   - 前端设置里的 `mergeTimeoutMs` 传给 Gateway。
   - 讯飞使用 `vad_eos`。
   - 阿里使用 `max_sentence_silence`。
   - 豆包返回后仍走前端问题合并逻辑。

## 5. 豆包 Gateway 协议处理

在 `api/asr-gateway.ts` 中，豆包使用：

```text
wss://openspeech.bytedance.com/api/v3/sauc/bigmodel
```

连接头包括：

```text
X-Api-App-Key
X-Api-Access-Key
X-Api-Resource-Id
X-Api-Connect-Id
X-Api-Request-Id
X-Api-Sequence
```

连接打开后先发送 full request：

```ts
upstream.on('open', () => {
  upstream.send(buildDoubaoFullRequest());
  send({ type: 'ready', provider: 'gateway-doubao' });
});
```

之后音频帧走：

```ts
buildDoubaoAudioFrame(pcm, false)
```

停止时发送空音频结束帧：

```ts
buildDoubaoAudioFrame(Buffer.alloc(0), true)
```

豆包返回帧会在服务端解析：

- 读取 message type
- 判断 error frame
- 解 gzip payload
- JSON parse
- 提取 `payload.result.text`
- 转成统一 `VoiceMessage`

## 6. 问题合并和自动触发

识别速度快以后，另一个重点是不能“一停顿就乱触发”。

当前逻辑在 `InterviewContext.tsx` 中：

- `handleRecognitionResult(text, isFinal, speaker)` 接收识别结果。
- `speaker === 'me'` 只记录，不触发 AI。
- `speaker === 'interviewer'` 才会进入问题判断。
- final 文本先进入 `mergeBuffer`。
- 定时器等待 `mergeTimeoutMs`。
- 期间如果继续识别到面试官问题，会重置定时器并继续合并。
- 超时后 `flushMergeBuffer()` 才调用 `sendQuestion()`。

所以一个 20 秒问题中间停 1 秒、1.5 秒、2 秒，不会立刻割裂成多个问题，具体取决于设置里的“句内停顿容忍”。

## 7. 为什么面试官和我的声音不会再混

现在识别入口不再只看“声音从哪里来”，而是绑定 speaker：

```text
系统音频 -> interviewer
麦克风 -> me
```

因此：

- 如果面试官声音选择系统音频，系统音频识别出来一定按面试官处理。
- 如果我的声音选择麦克风，麦克风识别出来一定按我处理。
- 我的回答只进入右侧双方对话记录，不触发 AI。
- 面试官问题才进入左侧问题列表并触发 AI。

这比“识别出来后再猜是谁说的”稳定得多。

## 8. UI 入口

设置页和面试页都增加了新的识别引擎选项：

```text
Gateway 豆包实时（服务端 WS）
Gateway 讯飞实时（服务端 WS）
Gateway 阿里云（服务端 NLS WebSocket）
```

推荐测试组合：

```text
我的声音：麦克风
面试官声音：系统音频
识别引擎：Gateway 豆包实时（服务端 WS）
句内停顿容忍：1500ms 或 2000ms
```

## 9. 和面试狗架构的对应关系

面试狗抓包观察到的特点：

```text
客户端采集音频
WebSocket / DataChannel 推 PCM
服务端 ASR
asrEndWindowSize 控制断句
VoiceMessage 返回识别结果
```

本项目现在对应为：

```text
前端采集系统音频/麦克风
WebSocket JSON 推 Base64 PCM 到 /api/asr-gateway
服务端连接豆包/讯飞/阿里实时 ASR
mergeTimeoutMs / asrEndWindowSize 控制问题合并
VoiceMessage 返回统一识别结果
```

两者本质一致：客户端轻量化，ASR 服务端化，实时长连接化。

## 10. 后续优化方向

1. 把 ASR Gateway 独立部署为常驻 Node 服务
   - Vercel 能跑当前实现，但不是最理想的长 WebSocket 承载环境。
   - 如果后续高频使用，建议单独部署到支持常驻 WebSocket 的服务，例如 Railway、Fly.io、Render、ECS、Cloudflare Workers Durable Objects 等。

2. 进一步降低前端 Base64 开销
   - 当前为了统一协议，前端用 JSON + Base64。
   - 后续可改成二进制 WebSocket 帧，减少编码体积和 CPU。

3. 增加 ASR 延迟监控
   - 记录音频帧发送时间、首字返回时间、final 返回时间。
   - 在设置页显示 p50/p95 延迟。

4. 增加 Gateway 健康测试
   - 当前豆包已有测试按钮。
   - 后续可为 Gateway 豆包、讯飞、阿里分别加“实时链路测试”。

5. 优化长问题断句
   - 可以把“问题合并超时”和“厂商 VAD 超时”分开设置。
   - 例如厂商 800ms 快速出字，前端 1500ms 合并问题。

## 11. 结论

这次速度提升的关键不是换了另一个 ASR 模型，而是把识别链路从：

```text
客户端复杂协议 / HTTP 分片 / 等 chunk 返回
```

改成：

```text
客户端轻采集 / 服务端实时 Gateway / 云厂商长连接流式识别
```

其中 `Gateway 豆包实时（服务端 WS）` 是当前最推荐方案。它解决了之前豆包首包顺序错误、系统音频识别慢、问题分片割裂、浏览器不能识别系统音频等核心问题，所以最终体验能接近面试狗。
