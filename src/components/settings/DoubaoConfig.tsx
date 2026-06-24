/**
 * DoubaoConfig — 豆包语音识别凭证配置
 * 仅当 ASR Provider 选择豆包时显示
 */

import { Paper, Typography, TextField } from '@mui/material';
import { useSettings } from '../../hooks/useSettings';

export function DoubaoConfig() {
  const { doubaoConfig, updateDoubaoConfig, appSettings } = useSettings();

  if (appSettings.asrProvider !== 'doubao') return null;

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
        fullWidth label="Cluster" value={doubaoConfig.cluster}
        onChange={(e) => updateDoubaoConfig({ cluster: e.target.value })}
        placeholder="volcengine_input_common"
        helperText="语音识别集群，默认使用通用集群。"
      />
    </Paper>
  );
}
