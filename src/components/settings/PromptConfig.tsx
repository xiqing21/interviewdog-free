/**
 * PromptConfig — Editable system prompts for interview and exam modes.
 * Includes restore-to-default buttons.
 */

import {
  Paper,
  Typography,
  TextField,
  Button,
  Box,
} from '@mui/material';
import RestoreIcon from '@mui/icons-material/Restore';
import {
  DEFAULT_INTERVIEW_PROMPT,
  DEFAULT_EXAM_PROMPT,
} from '../../constants';
import { useSettings } from '../../hooks/useSettings';

export function PromptConfig() {
  const { aiSettings, updateAISettings } = useSettings();

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        提示词配置
      </Typography>

      {/* Interview prompt */}
      <Box sx={{ mb: 3 }}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 0.5,
          }}
        >
          <Typography variant="subtitle2">面试系统提示词</Typography>
          <Button
            size="small"
            startIcon={<RestoreIcon />}
            onClick={() =>
              updateAISettings({
                interviewSystemPrompt: DEFAULT_INTERVIEW_PROMPT,
              })
            }
          >
            恢复默认
          </Button>
        </Box>
        <TextField
          fullWidth
          multiline
          rows={4}
          value={aiSettings.interviewSystemPrompt}
          onChange={(e) =>
            updateAISettings({ interviewSystemPrompt: e.target.value })
          }
        />
      </Box>

      {/* Exam prompt */}
      <Box>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 0.5,
          }}
        >
          <Typography variant="subtitle2">笔试系统提示词</Typography>
          <Button
            size="small"
            startIcon={<RestoreIcon />}
            onClick={() =>
              updateAISettings({
                examSystemPrompt: DEFAULT_EXAM_PROMPT,
              })
            }
          >
            恢复默认
          </Button>
        </Box>
        <TextField
          fullWidth
          multiline
          rows={4}
          value={aiSettings.examSystemPrompt}
          onChange={(e) =>
            updateAISettings({ examSystemPrompt: e.target.value })
          }
        />
      </Box>
    </Paper>
  );
}
