# ASR Gateway 超时问题与解决方法

## 1. 问题现象

面试进行一段时间后，面试官再次提问时不再识别。浏览器控制台可能同时出现：

- `豆包 45000292: quota exceeded for types: concurrency`
- `WebSocket is closed before the connection is established`
- `ObjectMultiplex - orphaned data`
- `MaxListenersExceededWarning`
- `ScriptProcessorNode is deprecated`

其中，真正需要优先处理的是豆包并发错误和 Gateway WebSocket 生命周期。浏览器扩展产生的 `contentscript.js` 日志，以及 `ScriptProcessorNode` 的弃用提示，不是本次长时间不识别的主要原因。

## 2. 根因

### 2.1 Vercel Hobby 函数时长限制

原 Gateway 运行在 Vercel Function 中。当前 Vercel 团队是 Hobby 套餐，Fluid Compute 默认函数时长为 300 秒，函数达到限制后会终止长连接。删除代码里的 `maxDuration` 不能突破套餐平台限制。

面试官提问和候选人回答之间可能超过 5 分钟，因此不能把实时 Gateway 依赖在有固定最大时长的 Serverless Function 上。

### 2.2 Gateway 与豆包上游连接缺少完整保活

浏览器到 Gateway、Gateway 到豆包是两条独立的 WebSocket 连接。长时间没有新语音时，如果没有心跳，任意一层都可能被中间网络或上游服务关闭。

### 2.3 连接关闭后的清理和重连不完整

历史逻辑在收到 `end`、网络错误或上游关闭后，可能留下旧 WebSocket、音频采集节点或重连计时器，造成重复监听、重复重连和豆包并发额度不释放，最终触发 `45000292`。

### 2.4 运营后台配置与常驻 Gateway 的配置来源不同

运营后台的豆包配置保存在 Supabase 的 `admin_app_config` 表中。常驻 Gateway 初期没有 Supabase 环境变量，因此读取不到后台保存的 App ID、Access Token 和 Resource ID，返回 `Missing Doubao App ID or Access Token`。

## 3. 已实施的解决方案

### 3.1 Gateway 迁移到常驻 WebSocket 服务

Gateway 部署在搬瓦工服务器上，不再依赖 Vercel Function 的 300 秒生命周期：

- 服务器：Ubuntu 26.04
- 资源：2 核、1 GB 内存、19 GB 磁盘
- 运行时：Bun
- 进程管理：systemd
- 反向代理：Nginx
- TLS：Let's Encrypt
- 地址：`wss://bwg.yihan.me/api/asr-gateway`

Vercel 继续负责网页、登录、支付和业务 API；浏览器和 Mac App 的实时识别连接直接进入常驻 Gateway。

### 3.2 双向心跳

浏览器每 20 秒向 Gateway 发送 `keepalive`，Gateway 返回 `pong`；Gateway 同时每 20 秒向豆包上游发送 WebSocket ping。

这样可以保证：

- 候选人长时间回答时连接继续保持；
- 面试官沉默后仍能继续接收下一句话；
- 连接断开时能尽快进入清理和重连流程。

### 3.3 主动停止和结束归档

点击“停止听音”或“结束归档”时，流程必须是：

1. 停止浏览器或 Mac App 的音频采集。
2. 向 Gateway 发送 `type: stop`。
3. Gateway 向豆包发送结束帧。
4. 关闭豆包上游 WebSocket。
5. 返回 `end` 并关闭浏览器到 Gateway 的 WebSocket。
6. 清理 AudioContext、Processor、MediaStream、重连计时器和缓存音频。

因此，常驻服务不会永久占用豆包并发。只有用户正在听音时才占用一条豆包上游连接，停止后会释放。

### 3.4 多用户保护

当前 Gateway 已加入基础保护：

- 默认最多 20 个客户端连接；
- 每个客户端拥有独立的豆包上游连接；
- 不同用户不会共用或串用同一条识别流；
- WebSocket ping/pong 失活后自动 terminate；
- 连接关闭时从 active client 集合移除；
- 限制允许的商业版域名来源。

在进一步扩大用户规模前，还应增加基于登录态的 WebSocket 鉴权和按用户限流。

### 3.5 运营后台配置同步

常驻 Gateway 在开始识别时，通过受内部同步密钥保护的配置请求读取运营后台最新 ASR 配置。同步接口复用现有 `api/asr-gateway` Function，避免 Hobby 套餐新增 Serverless Function 后超过 12 个函数限制。

同步内容包括：

- `doubaoAppId`
- `doubaoAccessToken`
- `doubaoResourceId`

同步接口不会把密钥返回给浏览器。客户端仍可以发送用户本地配置，Gateway 会将后台配置和客户端配置合并，客户端提供的非空配置优先用于当前会话。

## 4. 配置和部署

### 前端变量

项目环境变量模板中包含：

```env
VITE_ASR_GATEWAY_URL=wss://bwg.yihan.me/api/asr-gateway
```

商业版 Vercel Production 环境已经配置该变量。Mac App 在没有注入构建变量时使用同一 WSS 地址作为 fallback。

### 常驻服务关键变量

服务器 systemd 服务使用以下配置：

```text
GATEWAY_STANDALONE=true
PORT=8080
ASR_GATEWAY_MAX_CLIENTS=20
ASR_GATEWAY_ALLOWED_ORIGINS=商业版域名列表
ASR_GATEWAY_CONFIG_URL=https://mianshizhu.xyz/api/asr-gateway?config=1
ASR_GATEWAY_SYNC_SECRET=服务器与 Vercel 之间的内部密钥
```

内部密钥、Supabase Service Role Key、豆包 Access Token 不得提交到 GitHub 或写入前端变量。

## 5. 排查方法

### 5.1 判断 Gateway 是否在线

```bash
curl -i https://bwg.yihan.me/api/asr-gateway
```

HTTP 返回 `426 WebSocket upgrade required` 是正常的，说明 HTTPS 入口已到达 Gateway。

### 5.2 测试 WebSocket 心跳

连接后发送：

```json
{"type":"keepalive"}
```

应收到：

```json
{"type":"pong"}
```

### 5.3 测试豆包配置和生命周期

用 `start` 创建 Gateway 会话，应收到：

```json
{"type":"ready","provider":"gateway-doubao"}
```

再发送：

```json
{"type":"stop"}
```

应收到：

```json
{"type":"end"}
```

### 5.4 服务器状态

```bash
systemctl status interviewdog-gateway
journalctl -u interviewdog-gateway -f
systemctl status nginx
```

### 5.5 错误处理原则

- `45000292`、`quota exceeded`、`concurrency`：视为不可重试错误，立即停止整条采集链路并释放资源。
- `gateway end`、网络 close：检查心跳、上游连接和自动重连逻辑。
- `Missing Doubao App ID or Access Token`：先检查运营后台配置同步接口和服务器同步密钥，再检查客户端本地配置。
- `MaxListenersExceededWarning`：检查是否重复创建 WebSocket、AudioContext 或事件监听器，不要只通过提高监听器上限掩盖泄漏。
- `ScriptProcessorNode is deprecated`：属于后续音频采集升级事项，不是本次 Gateway 超时的直接原因。

## 6. 测试清单

- 开始听音后静默 1～2 分钟，再让面试官继续提问。
- 候选人连续回答 10～15 分钟后，再让面试官继续提问。
- 点击“停止听音”，确认共享音频和 Gateway 都释放。
- 点击“结束归档”，确认不再重连、不再占用豆包并发。
- 浏览器刷新或关闭后重新进入，确认旧连接不会残留。
- 在 `interviewpig.xyz`、`interviewpig.cn`、`mianshizhu.xyz`、`mianshizhu.cn` 及对应正常的 `www` 域名测试。
- 多个浏览器同时开始和停止听音，确认连接互不串线。

