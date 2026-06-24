/**
 * ModelDiscovery — 模型列表自动发现组件
 * 调用 /v1/models 获取可用模型列表，支持搜索过滤和选择
 */

import { useState, useCallback } from 'react';
import {
  Paper, Typography, Button, List, ListItemButton, ListItemText,
  TextField, CircularProgress, Alert, Chip, Box,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import type { ModelInfo } from '../../types';
import { discoverModels } from '../../services/modelDiscoveryService';
import { useSettings } from '../../hooks/useSettings';

interface Props {
  type: 'text' | 'vision';
}

export function ModelDiscovery({ type }: Props) {
  const { aiSettings, updateAISettings } = useSettings();
  const [loading, setLoading] = useState(false);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const currentModel = type === 'text' ? aiSettings.textModel : aiSettings.visionModel;
  const label = type === 'text' ? '文本模型' : '视觉模型';

  const handleDiscover = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await discoverModels(aiSettings.baseUrl, aiSettings.apiKey);
    if (result.success) {
      setModels(result.models);
    } else {
      setError(result.error ?? '获取失败');
    }
    setLoading(false);
  }, [aiSettings.baseUrl, aiSettings.apiKey]);

  const handleSelect = useCallback((modelId: string) => {
    if (type === 'text') {
      updateAISettings({ textModel: modelId });
    } else {
      updateAISettings({ visionModel: modelId });
    }
  }, [type, updateAISettings]);

  const filtered = models.filter((m) =>
    !search || m.id.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <Paper sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="subtitle1" fontWeight={600}>
          自动发现 {label}
        </Typography>
        <Button
          size="small" variant="outlined" startIcon={<RefreshIcon />}
          onClick={handleDiscover} disabled={loading || !aiSettings.baseUrl || !aiSettings.apiKey}
        >
          {loading ? <CircularProgress size={18} /> : '获取模型列表'}
        </Button>
      </Box>

      <Typography variant="caption" color="text.secondary">
        填写 Base URL 和 API Key 后，点击按钮自动拉取可用模型列表。当前选择：
        <Chip size="small" label={currentModel || '未选择'} sx={{ ml: 0.5 }} />
      </Typography>

      {error && <Alert severity="warning" sx={{ mt: 1 }}>{error}</Alert>}

      {filtered.length > 0 && (
        <>
          <TextField
            fullWidth size="small" placeholder="搜索模型..." value={search}
            onChange={(e) => setSearch(e.target.value)} sx={{ mt: 1, mb: 1 }}
          />
          <List dense sx={{ maxHeight: 250, overflow: 'auto', bgcolor: 'background.default', borderRadius: 1 }}>
            {filtered.slice(0, 50).map((m) => (
              <ListItemButton
                key={m.id}
                selected={currentModel === m.id}
                onClick={() => handleSelect(m.id)}
              >
                <ListItemText
                  primary={m.id}
                  secondary={m.owned_by}
                  primaryTypographyProps={{ variant: 'body2', fontFamily: 'monospace' }}
                  secondaryTypographyProps={{ variant: 'caption' }}
                />
              </ListItemButton>
            ))}
            {filtered.length > 50 && (
              <Typography variant="caption" color="text.secondary" sx={{ p: 1, display: 'block', textAlign: 'center' }}>
                仅显示前 50 个模型，请使用搜索过滤。
              </Typography>
            )}
          </List>
        </>
      )}
    </Paper>
  );
}
