/**
 * AudioSourceSettings — 音频源 & ASR 服务商配置
 */

import {
  Paper, Typography, FormControl, InputLabel, Select, MenuItem,
  type SelectChangeEvent,
} from '@mui/material';
import type { ASRProvider, AudioSource } from '../../types';
import { AUDIO_SOURCES } from '../../constants';
import { useSettings } from '../../hooks/useSettings';

export function AudioSourceSettings() {
  const { appSettings, setASRProvider, setAudioSource, updateAppSettings } = useSettings();

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>音频源 & 语音识别</Typography>

      <FormControl fullWidth sx={{ mb: 2 }}>
        <InputLabel>音频来源</InputLabel>
        <Select
          label="音频来源"
          value={appSettings.audioSource}
          onChange={(e: SelectChangeEvent) => setAudioSource(e.target.value as AudioSource)}
        >
          {AUDIO_SOURCES.map((s) => (
            <MenuItem key={s.key} value={s.key}>{s.label}</MenuItem>
          ))}
        </Select>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
          {AUDIO_SOURCES.find((s) => s.key === appSettings.audioSource)?.desc}
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
        </Select>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
          {appSettings.asrProvider === 'doubao' ? '使用豆包实时语音识别，准确率更高，需配置下方豆包 ASR 凭证。' : '使用浏览器内置 Web Speech API，免费但准确率一般。'}
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
