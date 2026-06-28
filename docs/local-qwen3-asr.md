# 本地 Qwen3-ASR (MLX) 接入说明

前端已支持选择 `本地 Qwen3-ASR（MLX）`，默认连接：

```text
ws://127.0.0.1:8766/ws
```

## 推荐模型

优先试 8bit 量化权重：

```text
.models/Qwen3-ASR-1.7B-8bit
mlx-community/Qwen3-ASR-1.7B-8bit
aufklarer/Qwen3-ASR-1.7B-MLX-8bit
mlx-community/Qwen3-ASR-1.7B-4bit
mlx-community/Qwen3-ASR-1.7B-5bit
```

0.6B 更省内存，1.7B 准确率更好。

## 前端 WebSocket 协议

连接打开后，前端先发送一条 JSON：

```json
{
  "type": "start",
  "sampleRate": 16000,
  "format": "pcm_s16le",
  "model": ".models/Qwen3-ASR-1.7B-8bit",
  "hotwords": []
}
```

说明：当前 `mlx-qwen3-asr` 的 `context` 更像“前文上下文”，不是严格的热词 API。为了避免模型把“热词：...”直接识别进正文，bridge 默认不再把热词注入 context。

随后前端持续发送二进制 `Int16Array` PCM 音频块。

本地服务需要返回 JSON：

```json
{
  "text": "识别出的文本",
  "isFinal": false
}
```

停顿或句子结束时可以返回：

```json
{
  "text": "完整问题文本",
  "isFinal": true
}
```

停止时，前端会发送：

```json
{ "type": "stop" }
```

## 本地服务实现建议

可以用 `mlx-qwen3-asr` 或 `mlx-audio` 启动一个本地 Python WebSocket bridge：

1. 接收前端 PCM。
2. 按 16kHz `pcm_s16le` 转成模型需要的 numpy/MLX 音频格式。
3. 调用 Qwen3-ASR streaming API。
4. 将增量结果按 `{ text, isFinal }` 返回。

如果先用 HTTP/OpenAI-compatible server 验证模型，也可以保留前端的 `OpenAI Whisper（系统音频备用）` 分片方案，把 baseUrl 指到本机服务；但低延迟实时效果建议用本文件里的 WebSocket 协议。
