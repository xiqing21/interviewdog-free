import { useState } from 'react';
import { Alert, Box, Button, Paper, TextField, Typography } from '@mui/material';
import { useSettings } from '../../hooks/useSettings';
import { testConnection } from '../../services/localQwenAsrService';

export function LocalQwenConfig() {
  const { appSettings, localQwenConfig, updateLocalQwenConfig } = useSettings();
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  if (appSettings.asrProvider !== 'local-qwen') return null;

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>本地 Qwen3-ASR (MLX) 配置</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        适合 Apple Silicon 本机运行 MLX 量化权重。网页只负责采集麦克风/系统音频，识别由你电脑上的本地服务完成。
      </Typography>
      <TextField
        fullWidth
        label="WebSocket 地址"
        value={localQwenConfig.endpoint}
        onChange={(event) => updateLocalQwenConfig({ endpoint: event.target.value })}
        placeholder="ws://127.0.0.1:8766/ws"
        sx={{ mb: 2 }}
      />
      <TextField
        fullWidth
        label="模型"
        value={localQwenConfig.model}
        onChange={(event) => updateLocalQwenConfig({ model: event.target.value })}
        placeholder=".models/Qwen3-ASR-1.7B-8bit"
        helperText="0.6B 更省内存，1.7B 准确率更好。"
        sx={{ mb: 2 }}
      />
      <TextField
        fullWidth
        multiline
        minRows={3}
        label="热词"
        value={localQwenConfig.hotwords}
        onChange={(event) => updateLocalQwenConfig({ hotwords: event.target.value })}
        placeholder="大数据开发、StarRocks、Flink、Fluss、MLX、量化、湖仓一体"
        helperText="可选。当前不会自动注入热词；如果填了也只作为后端参数发送，避免把“热词：...”识别进正文。"
      />
      <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="contained"
          disabled={testing}
          onClick={async () => {
            setTesting(true);
            setResult(null);
            try {
              setResult(await testConnection(localQwenConfig));
            } finally {
              setTesting(false);
            }
          }}
        >
          {testing ? '测试中...' : '测试本地 Qwen3-ASR'}
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
