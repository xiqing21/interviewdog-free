/**
 * AudioSourceSettings — 音频源 & ASR 服务商配置
 */

import { useState } from 'react';
import {
  Box,
  Button,
  IconButton,
  Paper,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  type SelectChangeEvent,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
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
  const [newHotword, setNewHotword] = useState('');

  const hotwords = parseHotwords(appSettings.asrHotwords);

  const updateHotwords = (nextHotwords: string[]): void => {
    updateAppSettings({ asrHotwords: serializeHotwords(nextHotwords) });
  };

  const handleHotwordChange = (index: number, value: string): void => {
    const nextHotwords = [...hotwords];
    nextHotwords[index] = value;
    updateHotwords(nextHotwords);
  };

  const handleAddHotword = (): void => {
    const trimmed = newHotword.trim();
    if (!trimmed) return;
    updateHotwords([...hotwords, trimmed]);
    setNewHotword('');
  };

  const handleDeleteHotword = (index: number): void => {
    updateHotwords(hotwords.filter((_, itemIndex) => itemIndex !== index));
  };

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
          <MenuItem value="gateway-doubao">Gateway 豆包实时（服务端 WS）</MenuItem>
          <MenuItem value="gateway-iflytek">Gateway 讯飞实时（服务端 WS）</MenuItem>
          <MenuItem value="gateway-alibaba">Gateway 阿里云（服务端兜底）</MenuItem>
          <MenuItem value="doubao">豆包 ASR（火山引擎 - 更准确）</MenuItem>
          <MenuItem value="local-qwen">本地 Qwen3-ASR（MLX）</MenuItem>
          <MenuItem value="mimo">MiMo-V2.5-ASR（小米，分片）</MenuItem>
          <MenuItem value="baidu">百度语音识别（分片）</MenuItem>
          <MenuItem value="google">Google Speech（分片）</MenuItem>
          <MenuItem value="alibaba">阿里云语音识别（分片）</MenuItem>
          <MenuItem value="iflytek">讯飞听写/听见（分片）</MenuItem>
          <MenuItem value="glm">GLM ASR（分片）</MenuItem>
          <MenuItem value="openai">OpenAI Whisper（系统音频备用）</MenuItem>
        </Select>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
          {providerDescription(appSettings.asrProvider)}
        </Typography>
      </FormControl>

      <Box sx={{ mt: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 1 }}>
          <Box>
            <Typography variant="subtitle2" fontWeight={800}>语音识别热词</Typography>
            <Typography variant="caption" color="text.secondary">
              可自定义增删改；Gateway 豆包/本地 Qwen/云分片会随启动配置传递，AI 回答也会同步参考这些专业词。
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, mb: 1.25 }}>
          <TextField
            fullWidth
            label="新增热词"
            value={newHotword}
            onChange={(event) => setNewHotword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                handleAddHotword();
              }
            }}
            placeholder="Fluss / StarRocks / 实时数仓"
          />
          <Button variant="outlined" startIcon={<AddIcon />} onClick={handleAddHotword} sx={{ flexShrink: 0 }}>
            添加
          </Button>
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1 }}>
          {hotwords.map((word, index) => (
            <Box key={index} sx={{ display: 'flex', gap: 0.75, alignItems: 'center' }}>
              <TextField
                fullWidth
                label={`热词 ${index + 1}`}
                value={word}
                onChange={(event) => handleHotwordChange(index, event.target.value)}
                onBlur={() => updateHotwords(hotwords)}
                placeholder="Fluss"
              />
              <IconButton
                size="small"
                color="error"
                aria-label={`删除热词 ${word || index + 1}`}
                onClick={() => handleDeleteHotword(index)}
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Box>
          ))}
          {hotwords.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
              还没有热词，建议先添加 Fluss、Flink、StarRocks、Paimon、湖仓一体。
            </Typography>
          )}
        </Box>
      </Box>

      <FormControl fullWidth sx={{ mt: 2 }}>
        <InputLabel>句内停顿容忍 (ms)</InputLabel>
        <Select
          label="句内停顿容忍 (ms)"
          value={String(appSettings.mergeTimeoutMs)}
          onChange={(e: SelectChangeEvent) => updateAppSettings({ mergeTimeoutMs: Number(e.target.value) })}
        >
          <MenuItem value="1000">1000ms - 浏览器快速</MenuItem>
          <MenuItem value="1500">1500ms - 快速停顿</MenuItem>
          <MenuItem value="2000">2000ms - 自然停顿</MenuItem>
          <MenuItem value="2500">2500ms - 通用默认</MenuItem>
          <MenuItem value="5000">5000ms - 长句</MenuItem>
          <MenuItem value="8000">8000ms - 很稳但较慢</MenuItem>
          <MenuItem value="12000">12000ms - 超长停顿</MenuItem>
        </Select>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
          面试官说话中途停顿不会立即触发；只有超过这个静默窗口，才把缓存内容合并成一个问题并生成答案。豆包也会严格按这里的设置执行。
        </Typography>
      </FormControl>
    </Paper>
  );
}

function parseHotwords(text: string): string[] {
  return text
    .split(/[,，、\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function serializeHotwords(items: string[]): string {
  const seen = new Set<string>();
  return items
    .map((item) => item.trim())
    .filter((item) => {
      if (!item || seen.has(item.toLowerCase())) return false;
      seen.add(item.toLowerCase());
      return true;
    })
    .join('、');
}

function providerDescription(provider: ASRProvider): string {
  if (provider === 'doubao') {
    return '使用豆包实时语音识别，准确率更高，需配置下方豆包 ASR 凭证。';
  }
  if (provider === 'gateway-doubao') {
    return '按面试狗架构：浏览器只采集 PCM，服务端 Gateway 长连接豆包流式 ASR，并按停顿窗口回传问题。';
  }
  if (provider === 'gateway-iflytek') {
    return '按面试狗架构：浏览器只采集 PCM，服务端 Gateway 长连接讯飞 WebIAT，适合和豆包做实时延迟对比。';
  }
  if (provider === 'gateway-alibaba') {
    return '按面试狗架构：浏览器只采集 PCM，服务端 Gateway 长连接阿里云 NLS 实时语音识别。';
  }
  if (provider === 'openai') {
    return '使用 OpenAI-compatible 音频转写接口，能识别 Chrome 共享的系统音频，但会有约 4-6 秒延迟。';
  }
  if (provider === 'local-qwen') {
    return '使用本机 MLX Qwen3-ASR 服务识别音频，低延迟、可热词增强，需要先启动本地 WebSocket 服务。';
  }
  if (provider === 'mimo') {
    return '使用小米 MiMo-V2.5-ASR 音频接口，按 WAV 分片识别，可用于和豆包延迟/准确率对比。';
  }
  if (['baidu', 'google', 'alibaba', 'iflytek', 'glm'].includes(provider)) {
    return '使用对应云厂商的语音识别接口，按本地 PCM/WAV 分片提交，适合横向测速。';
  }
  return '使用浏览器内置 Web Speech API，免费但只能稳定识别麦克风。';
}
