/**
 * ExamPage — Main page for exam assistance.
 * Shows exam type selector, image uploader, answer display, and history.
 * Prompts user to configure API key if not set.
 */

import { Box, Alert, Button } from '@mui/material';
import { Link } from 'react-router-dom';
import { ExamTypeSelector } from './ExamTypeSelector';
import { ImageUploader } from './ImageUploader';
import { ExamAnswer } from './ExamAnswer';
import { ExamHistory } from './ExamHistory';
import { useSettings } from '../../hooks/useSettings';

export function ExamPage() {
  const { aiSettings } = useSettings();

  if (!aiSettings.apiKey) {
    return (
      <Box sx={{ maxWidth: 900, mx: 'auto' }}>
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
          请先在设置中配置 API Key 后使用笔试辅助功能。
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto' }}>
      <ExamTypeSelector />
      <ImageUploader />
      <ExamAnswer />
      <ExamHistory />
    </Box>
  );
}
