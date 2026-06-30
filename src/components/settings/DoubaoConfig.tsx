/**
 * DoubaoConfig — 豆包语音识别凭证配置
 * 仅当 ASR Provider 选择豆包时显示
 */

import { useState } from 'react';
import { Alert, Box, Button, Paper, Typography, TextField } from '@mui/material';
import { useSettings } from '../../hooks/useSettings';
import { testConnection, type DoubaoAsrTestResult } from '../../services/doubaoAsrService';

export function DoubaoConfig() {
  const { doubaoConfig, updateDoubaoConfig, appSettings } = useSettings();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<DoubaoAsrTestResult | null>(null);

  if (appSettings.asrProvider !== 'doubao' && appSettings.asrProvider !== 'gateway-doubao') return null;

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>豆包 ASR 配置（火山引擎）</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        使用火山引擎实时语音识别服务，准确率远超浏览器原生。
        在火山引擎控制台 → 语音技术 → 实时语音识别 中获取凭证。
      </Typography>
      <TextField
        fullWidth label="App ID" value={doubaoConfig.appId}
        onChange={(e) => updateDoubaoConfig({ appId: e.target.value })}
        placeholder="从火山引擎控制台获取" sx={{ mb: 2 }}
      />
      <TextField
        fullWidth label="Access Token" type="password" value={doubaoConfig.accessToken}
        onChange={(e) => updateDoubaoConfig({ accessToken: e.target.value })}
        placeholder="从火山引擎控制台获取" sx={{ mb: 2 }}
      />
      <TextField
        fullWidth label="Resource ID" value={doubaoConfig.resourceId}
        onChange={(e) => updateDoubaoConfig({ resourceId: e.target.value })}
        placeholder="volc.bigasr.sauc.duration"
        helperText="已按你的凭证实测，volc.bigasr.sauc.duration 可以握手；如果控制台给了实例专属 Resource ID，请以控制台为准。"
      />
      <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="contained"
          onClick={async () => {
            setTesting(true);
            setTestResult(null);
            try {
              setTestResult(await testConnection(doubaoConfig));
            } finally {
              setTesting(false);
            }
          }}
          disabled={testing}
        >
          {testing ? '测试中...' : '测试豆包 ASR'}
        </Button>
      </Box>
      {testResult && (
        <Alert severity={testResult.success ? 'success' : 'error'} sx={{ mt: 2 }}>
          {testResult.message}
        </Alert>
      )}
    </Paper>
  );
}
