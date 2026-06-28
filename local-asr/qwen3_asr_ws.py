#!/usr/bin/env python3
"""
Local Qwen3-ASR WebSocket bridge for InterviewDog.

Protocol expected by the frontend:
1. Client sends JSON:
   {"type":"start","sampleRate":16000,"format":"pcm_s16le","model":"...","hotwords":[...]}
2. Client streams binary Int16 PCM chunks.
3. Server returns JSON:
   {"text":"...", "isFinal": false}
4. Client sends {"type":"stop"} when done.

This bridge intentionally keeps the app-facing protocol stable. The model
adapter below tries the installed mlx-qwen3-asr package first. If its public
API changes, update only Qwen3AsrAdapter.transcribe_chunk().
"""

from __future__ import annotations

import argparse
import asyncio
import json
import time
from dataclasses import dataclass, field
from typing import Any

import numpy as np
import websockets
from websockets.server import WebSocketServerProtocol


DEFAULT_MODEL = ".models/Qwen3-ASR-1.7B-8bit"


@dataclass
class ClientState:
    sample_rate: int = 16000
    model: str = DEFAULT_MODEL
    hotwords: list[str] = field(default_factory=list)
    pcm_buffer: list[np.ndarray] = field(default_factory=list)
    last_emit_text: str = ""
    last_audio_at: float = field(default_factory=time.time)
    stream_dirty: bool = False


class Qwen3AsrAdapter:
    def __init__(self, model: str, hotwords: list[str]) -> None:
        self.model = model
        self.hotwords = hotwords
        # mlx-qwen3-asr treats `context` as previous transcript/context. Passing
        # "热词：..." here can be echoed into the transcript, so keep it empty
        # until the backend exposes a dedicated hotword API.
        self.context = ""
        self.backend: Any | None = None
        self.state: Any | None = None
        self.backend_kind = "session"
        self._load_backend()

    def _load_backend(self) -> None:
        try:
            from mlx_qwen3_asr import Session  # type: ignore
        except Exception as exc:
            raise RuntimeError(
                "mlx-qwen3-asr 未安装。请先运行 scripts/setup-local-qwen-asr.sh。"
            ) from exc

        self.backend = Session(self.model)
        self.state = self._init_streaming_state()

    def _init_streaming_state(self) -> Any:
        if self.backend is None:
            raise RuntimeError("Qwen3-ASR backend 尚未初始化。")
        return self.backend.init_streaming(
            context=self.context,
            language="zh",
            chunk_size_sec=0.8,
            max_context_sec=30.0,
            sample_rate=16000,
            finalization_mode="latency",
            endpointing_mode="fixed",
            endpoint_lookback_sec=0.3,
            endpoint_min_chunk_sec=0.5,
        )

    def transcribe_chunk(self, audio: np.ndarray, sample_rate: int, is_final: bool) -> str:
        if self.backend is None or self.state is None:
            return ""
        if audio.size == 0 and not is_final:
            return ""
        if sample_rate != 16000:
            raise RuntimeError(f"当前 bridge 只接收 16kHz PCM，收到 {sample_rate}Hz。")
        if is_final:
            if audio.size:
                self.state = self.backend.feed_audio(audio.astype(np.float32), self.state)
            self.state = self.backend.finish_streaming(self.state)
            text = sanitize_transcript(str(getattr(self.state, "text", "") or "").strip())
            self.state = self._init_streaming_state()
            return text
        else:
            self.state = self.backend.feed_audio(audio.astype(np.float32), self.state)
        return sanitize_transcript(str(getattr(self.state, "text", "") or "").strip())


def sanitize_transcript(text: str) -> str:
    if not text:
        return ""
    for marker in ("热词：", "热词:", "关键词：", "关键词:"):
        index = text.find(marker)
        if index >= 0:
            text = text[:index]
    return text.strip(" ，,。；;：:\n\t")


def extract_text(result: Any) -> str:
    if result is None:
        return ""
    if isinstance(result, str):
        return result.strip()
    if isinstance(result, dict):
        for key in ("text", "transcript", "result"):
            value = result.get(key)
            if isinstance(value, str):
                return value.strip()
        return ""
    if isinstance(result, (list, tuple)):
        return " ".join(extract_text(item) for item in result).strip()
    text = getattr(result, "text", None)
    return text.strip() if isinstance(text, str) else ""


def pcm_bytes_to_float32(data: bytes) -> np.ndarray:
    if not data:
        return np.array([], dtype=np.float32)
    pcm = np.frombuffer(data, dtype=np.int16)
    return (pcm.astype(np.float32) / 32768.0).copy()


async def send_json(ws: WebSocketServerProtocol, payload: dict[str, Any]) -> None:
    try:
        await ws.send(json.dumps(payload, ensure_ascii=False))
    except websockets.ConnectionClosed:
        return


async def handle_client(ws: WebSocketServerProtocol) -> None:
    state = ClientState()
    adapter: Qwen3AsrAdapter | None = None
    inference_lock = asyncio.Lock()

    async def flush(is_final: bool) -> None:
        nonlocal adapter
        if adapter is None:
            return
        async with inference_lock:
            if adapter is None:
                return
            if not state.pcm_buffer and not (is_final and state.stream_dirty):
                return
            audio = np.concatenate(state.pcm_buffer) if state.pcm_buffer else np.array([], dtype=np.float32)
            state.pcm_buffer.clear()

            # MLX GPU streams are thread-local, so keep model inference on the
            # same event-loop thread where the Session was created.
            text = adapter.transcribe_chunk(audio, state.sample_rate, is_final)
            state.stream_dirty = not is_final
            if is_final:
                state.last_emit_text = ""
        if text and text != state.last_emit_text:
            state.last_emit_text = text
            await send_json(ws, {"text": text, "isFinal": is_final})

    async def silence_watcher() -> None:
        while True:
            await asyncio.sleep(0.25)
            if adapter and state.pcm_buffer and time.time() - state.last_audio_at > 0.9:
                await flush(True)

    watcher = asyncio.create_task(silence_watcher())
    try:
      async for message in ws:
        if isinstance(message, str):
            data = json.loads(message)
            msg_type = data.get("type")
            if msg_type == "start":
                state.sample_rate = int(data.get("sampleRate") or 16000)
                state.model = str(data.get("model") or DEFAULT_MODEL)
                state.hotwords = [str(item).strip() for item in data.get("hotwords", []) if str(item).strip()]
                adapter = Qwen3AsrAdapter(state.model, state.hotwords)
                await send_json(ws, {"type": "ready", "model": state.model})
            elif msg_type == "stop":
                await flush(True)
                break
            continue

        state.pcm_buffer.append(pcm_bytes_to_float32(message))
        state.last_audio_at = time.time()
        total_samples = sum(chunk.size for chunk in state.pcm_buffer)
        if total_samples >= state.sample_rate * 1.2:
            await flush(False)
    except Exception as exc:
        await send_json(ws, {"type": "error", "error": str(exc)})
    finally:
        watcher.cancel()


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8766)
    args = parser.parse_args()

    async with websockets.serve(handle_client, args.host, args.port, max_size=8 * 1024 * 1024):
        print(f"Qwen3-ASR WebSocket listening on ws://{args.host}:{args.port}/ws")
        await asyncio.Future()


if __name__ == "__main__":
    asyncio.run(main())
