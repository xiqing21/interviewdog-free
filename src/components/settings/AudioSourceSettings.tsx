/**
 * AudioSourceSettings — 音频源 & ASR 服务商配置
 */

import {
  Paper, Typography, FormControl, InputLabel, Select, MenuItem,
  type SelectChangeEvent,
} from '@mui/material';
import type { ASRProvider, SpeakerAudioSource } from '../../types';
import { SPEAKER_AUDIO_SOURCES } from '../../constants';
import { useSettings } from '../../hooks/useSettings';

export function AudioSourceSettings() {
  const {
    appSettings,
    setASRProvider,
    setMyAudioSource,
    setInterviewerAudioSource,
    updateAppSettings,
  } = useSettings();

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>音频源 & 语音识别</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        声音分离会保留：你的声音走麦克风，面试官/会议声音走系统音频，避免把你的回答误当作面试官问题。
      </Typography>

      <FormControl fullWidth sx={{ mb: 2 }}>
        <InputLabel>我的声音</InputLabel>
        <Select
          label="我的声音"
          value={appSettings.myAudioSource}
          onChange={(e: SelectChangeEvent) => setMyAudioSource(e.target.value as SpeakerAudioSource)}
        >
          {SPEAKER_AUDIO_SOURCES.map((s) => (
            <MenuItem key={s.key} value={s.key}>{s.label}</MenuItem>
          ))}
        </Select>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
          {SPEAKER_AUDIO_SOURCES.find((s) => s.key === appSettings.myAudioSource)?.desc}
        </Typography>
      </FormControl>

      <FormControl fullWidth sx={{ mb: 2 }}>
        <InputLabel>面试官声音</InputLabel>
        <Select
          label="面试官声音"
          value={appSettings.interviewerAudioSource}
          onChange={(e: SelectChangeEvent) => setInterviewerAudioSource(e.target.value as SpeakerAudioSource)}
        >
          {SPEAKER_AUDIO_SOURCES.map((s) => (
            <MenuItem key={s.key} value={s.key}>{s.label}</MenuItem>
          ))}
        </Select>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
          {SPEAKER_AUDIO_SOURCES.find((s) => s.key === appSettings.interviewerAudioSource)?.desc}
        </Typography>
      </FormControl>

      <FormControl fullWidth>
        <InputLabel>语音识别引擎</InputLabel>
        <Select
          label="语音识别引擎"
          value={appSettings.asrProvider}
          onChange={(e: SelectChangeEvent) => setASRProvider(e.target.value as ASRProvider)}
        >
          <MenuItem value="browser">浏览器原生（免费）</MenuItem>
          <MenuItem value="doubao">豆包 ASR（火山引擎 - 更准确）</MenuItem>
          <MenuItem value="local-qwen">本地 Qwen3-ASR（MLX）</MenuItem>
          <MenuItem value="openai">OpenAI Whisper（系统音频备用）</MenuItem>
        </Select>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
          {providerDescription(appSettings.asrProvider)}
        </Typography>
      </FormControl>

      <FormControl fullWidth sx={{ mt: 2 }}>
        <InputLabel>问题合并超时 (ms)</InputLabel>
        <Select
          label="问题合并超时 (ms)"
          value={String(appSettings.mergeTimeoutMs)}
          onChange={(e: SelectChangeEvent) => updateAppSettings({ mergeTimeoutMs: Number(e.target.value) })}
        >
          <MenuItem value="500">500ms - 快速</MenuItem>
          <MenuItem value="1000">1000ms - 适中</MenuItem>
          <MenuItem value="1500">1500ms - 默认</MenuItem>
          <MenuItem value="2000">2000ms - 较长</MenuItem>
          <MenuItem value="3000">3000ms - 最长</MenuItem>
        </Select>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
          连续语音无新输入达到此时长后，自动将缓存的片段合并为一个完整问题发送。
        </Typography>
      </FormControl>
    </Paper>
  );
}

function providerDescription(provider: ASRProvider): string {
  if (provider === 'doubao') {
    return '使用豆包实时语音识别，准确率更高，需配置下方豆包 ASR 凭证。';
  }
  if (provider === 'openai') {
    return '使用 OpenAI-compatible 音频转写接口，能识别 Chrome 共享的系统音频，但会有约 4-6 秒延迟。';
  }
  if (provider === 'local-qwen') {
    return '使用本机 MLX Qwen3-ASR 服务识别音频，低延迟、可热词增强，需要先启动本地 WebSocket 服务。';
  }
  return '使用浏览器内置 Web Speech API，免费但只能稳定识别麦克风。';
}
