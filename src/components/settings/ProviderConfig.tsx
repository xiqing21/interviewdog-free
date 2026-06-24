/**
 * ProviderConfig v2 — AI 服务商配置（新增国内厂商）
 */

import {
  Paper, Typography, TextField, FormControl, InputLabel,
  Select, MenuItem, type SelectChangeEvent,
} from '@mui/material';
import type { AIProvider } from '../../types';
import { PROVIDER_DEFAULTS, PROVIDER_ORDER } from '../../constants';
import { useSettings } from '../../hooks/useSettings';

export function ProviderConfig() {
  const { aiSettings, updateAISettings, setProvider } = useSettings();

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>AI 服务商配置</Typography>

      <FormControl fullWidth sx={{ mb: 2 }}>
        <InputLabel id="provider-label">服务商</InputLabel>
        <Select labelId="provider-label" label="服务商" value={aiSettings.provider}
          onChange={(e: SelectChangeEvent) => setProvider(e.target.value as AIProvider)}>
          {PROVIDER_ORDER.map((key) => {
            const d = PROVIDER_DEFAULTS[key];
            return (
              <MenuItem key={key} value={key}>
                {d.label}
              </MenuItem>
            );
          })}
        </Select>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
          包含豆包、DeepSeek、智谱、Moonshot、通义千问等国内厂商预设
        </Typography>
      </FormControl>

      <TextField
        fullWidth label="API Key" type="password" placeholder="sk-..."
        value={aiSettings.apiKey}
        onChange={(e) => updateAISettings({ apiKey: e.target.value })}
        sx={{ mb: 2 }}
        helperText="密钥将经过混淆后存储在本地，不会上传至服务器"
      />

      <TextField
        fullWidth label="Base URL" placeholder="https://api.openai.com/v1"
        value={aiSettings.baseUrl}
        onChange={(e) => updateAISettings({ baseUrl: e.target.value })}
        helperText="API 基础地址，支持 OpenAI 兼容接口"
      />
    </Paper>
  );
}
