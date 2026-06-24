/**
 * ProviderConfig — AI provider selection, API key, and base URL configuration.
 * Selecting a provider auto-fills the default baseUrl and models.
 */

import {
  Paper,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  type SelectChangeEvent,
} from '@mui/material';
import type { AIProvider } from '../../types';
import { useSettings } from '../../hooks/useSettings';

export function ProviderConfig() {
  const { aiSettings, updateAISettings, setProvider } = useSettings();

  const handleProviderChange = (e: SelectChangeEvent): void => {
    setProvider(e.target.value as AIProvider);
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        AI 服务商配置
      </Typography>

      {/* Provider selection */}
      <FormControl fullWidth sx={{ mb: 2 }}>
        <InputLabel id="provider-label">服务商</InputLabel>
        <Select
          labelId="provider-label"
          label="服务商"
          value={aiSettings.provider}
          onChange={handleProviderChange}
        >
          <MenuItem value="openai">OpenAI</MenuItem>
          <MenuItem value="anthropic">Anthropic</MenuItem>
          <MenuItem value="custom">自定义</MenuItem>
        </Select>
      </FormControl>

      {/* API Key */}
      <TextField
        fullWidth
        label="API Key"
        type="password"
        placeholder="sk-..."
        value={aiSettings.apiKey}
        onChange={(e) => updateAISettings({ apiKey: e.target.value })}
        sx={{ mb: 2 }}
        helperText="密钥将经过混淆后存储在本地，不会上传至服务器"
      />

      {/* Base URL */}
      <TextField
        fullWidth
        label="Base URL"
        placeholder="https://api.openai.com/v1"
        value={aiSettings.baseUrl}
        onChange={(e) => updateAISettings({ baseUrl: e.target.value })}
        helperText="API 基础地址，支持 OpenAI 兼容接口"
      />
    </Paper>
  );
}
