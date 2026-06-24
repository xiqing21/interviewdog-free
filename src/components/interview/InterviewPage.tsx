/**
 * InterviewPage — Main page for interview assistance.
 * Shows voice control, question editor, and Q&A history.
 * Prompts user to configure API key if not set.
 */

import { Box, Alert, Button } from '@mui/material';
import { Link } from 'react-router-dom';
import { VoiceControl } from './VoiceControl';
import { QuestionEditor } from './QuestionEditor';
import { QAHistory } from './QAHistory';
import { useSettings } from '../../hooks/useSettings';

export function InterviewPage() {
  const { aiSettings } = useSettings();

  if (!aiSettings.apiKey) {
    return (
      <Box sx={{ maxWidth: 800, mx: 'auto' }}>
        <Alert
          severity="warning"
          action={
            <Button
              color="inherit"
              size="small"
              component={Link}
              to="/settings"
            >
              前往设置
            </Button>
          }
        >
          请先在设置中配置 API Key 后使用面试辅助功能。
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto' }}>
      <VoiceControl />
      <QuestionEditor />
      <QAHistory />
    </Box>
  );
}
