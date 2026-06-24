/**
 * ModelConfig — Text model, vision model, streaming toggle, and context window slider.
 */

import {
  Paper,
  Typography,
  TextField,
  FormControlLabel,
  Switch,
  Slider,
  Box,
} from '@mui/material';
import { useSettings } from '../../hooks/useSettings';

export function ModelConfig() {
  const { aiSettings, updateAISettings } = useSettings();

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        模型配置
      </Typography>

      {/* Text model */}
      <TextField
        fullWidth
        label="文本模型"
        placeholder="gpt-4o"
        value={aiSettings.textModel}
        onChange={(e) => updateAISettings({ textModel: e.target.value })}
        sx={{ mb: 2 }}
        helperText="用于面试问答的文本模型"
      />

      {/* Vision model */}
      <TextField
        fullWidth
        label="视觉模型"
        placeholder="gpt-4o"
        value={aiSettings.visionModel}
        onChange={(e) => updateAISettings({ visionModel: e.target.value })}
        sx={{ mb: 2 }}
        helperText="用于笔试截图识别的视觉模型"
      />

      {/* Streaming toggle */}
      <FormControlLabel
        control={
          <Switch
            checked={aiSettings.streaming}
            onChange={(e) =>
              updateAISettings({ streaming: e.target.checked })
            }
          />
        }
        label="流式输出"
        sx={{ mb: 2, display: 'flex' }}
      />

      {/* Context window size */}
      <Box>
        <Typography variant="body2" gutterBottom>
          上下文窗口大小：{aiSettings.contextWindowSize} 轮对话
        </Typography>
        <Slider
          value={aiSettings.contextWindowSize}
          onChange={(_, value) =>
            updateAISettings({ contextWindowSize: value as number })
          }
          min={0}
          max={20}
          step={1}
          marks
          valueLabelDisplay="auto"
        />
        <Typography variant="caption" color="text.secondary">
          设置发送给 AI 的历史对话轮数，0 表示不携带上下文
        </Typography>
      </Box>
    </Paper>
  );
}
