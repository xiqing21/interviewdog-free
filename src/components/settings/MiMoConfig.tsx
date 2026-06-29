import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
  type SelectChangeEvent,
} from '@mui/material';
import { useSettings } from '../../hooks/useSettings';
import { testConnection } from '../../services/mimoAsrService';
import type { MiMoASRConfig } from '../../types';

export function MiMoConfig() {
  const { appSettings, mimoConfig, updateMiMoConfig } = useSettings();
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  if (appSettings.asrProvider !== 'mimo') return null;

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>MiMo-V2.5-ASR 配置</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        使用小米 MiMo-V2.5-ASR 的 Chat Completions 音频识别接口。当前按本地 PCM 分片编码为 WAV 后提交，适合和豆包做速度/准确率对比。
      </Typography>

      <TextField
        fullWidth
        label="API Key"
        type="password"
        value={mimoConfig.apiKey}
        onChange={(event) => updateMiMoConfig({ apiKey: event.target.value })}
        placeholder="从 Xiaomi MiMo 控制台获取"
        sx={{ mb: 2 }}
      />

      <TextField
        fullWidth
        label="Base URL"
        value={mimoConfig.baseUrl}
        onChange={(event) => updateMiMoConfig({ baseUrl: event.target.value })}
        placeholder="https://api.xiaomimimo.com/v1"
        sx={{ mb: 2 }}
      />

      <TextField
        fullWidth
        label="模型"
        value={mimoConfig.model}
        onChange={(event) => updateMiMoConfig({ model: event.target.value })}
        placeholder="mimo-v2.5-asr"
        sx={{ mb: 2 }}
      />

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
        <FormControl fullWidth>
          <InputLabel>语言</InputLabel>
          <Select
            label="语言"
            value={mimoConfig.language}
            onChange={(event: SelectChangeEvent) => updateMiMoConfig({ language: event.target.value as MiMoASRConfig['language'] })}
          >
            <MenuItem value="auto">自动</MenuItem>
            <MenuItem value="zh">中文</MenuItem>
            <MenuItem value="en">英文</MenuItem>
          </Select>
        </FormControl>
        <FormControl fullWidth>
          <InputLabel>分片长度</InputLabel>
          <Select
            label="分片长度"
            value={String(mimoConfig.chunkMs)}
            onChange={(event: SelectChangeEvent) => updateMiMoConfig({ chunkMs: Number(event.target.value) })}
          >
            <MenuItem value="1500">1.5 秒</MenuItem>
            <MenuItem value="2500">2.5 秒</MenuItem>
            <MenuItem value="4000">4 秒</MenuItem>
            <MenuItem value="6000">6 秒</MenuItem>
          </Select>
        </FormControl>
      </Box>

      <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="contained"
          disabled={testing}
          onClick={async () => {
            setTesting(true);
            setResult(null);
            try {
              setResult(await testConnection(mimoConfig));
            } finally {
              setTesting(false);
            }
          }}
        >
          {testing ? '测试中...' : '测试 MiMo ASR'}
        </Button>
      </Box>
      {result && (
        <Alert severity={result.success ? 'success' : 'error'} sx={{ mt: 2 }}>
          {result.message}
        </Alert>
      )}
    </Paper>
  );
}
