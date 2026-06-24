/**
 * ExamAnswer — Displays the solve button and streaming answer.
 * Shows loading state during solving and cursor animation during streaming.
 */

import {
  Box,
  Button,
  Paper,
  Alert,
  CircularProgress,
  Typography,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { useExam } from '../../hooks/useExam';
import { MarkdownRenderer } from '../common/MarkdownRenderer';
import { CopyButton } from '../common/CopyButton';

export function ExamAnswer() {
  const {
    currentImage,
    currentAnswer,
    isProcessing,
    isStreaming,
    solve,
    error,
  } = useExam();

  return (
    <Box sx={{ mt: 2 }}>
      {/* Action row */}
      <Box sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
        <Button
          variant="contained"
          onClick={() => void solve()}
          disabled={!currentImage || isProcessing}
          startIcon={
            isProcessing ? (
              <CircularProgress size={16} color="inherit" />
            ) : (
              <AutoAwesomeIcon />
            )
          }
        >
          {isProcessing
            ? '解答中...'
            : currentAnswer
              ? '重新生成'
              : '开始解答'}
        </Button>
        {currentAnswer && !isStreaming && <CopyButton text={currentAnswer} />}
      </Box>

      {/* Error display */}
      {error && (
        <Alert severity="error" sx={{ mb: 1 }}>
          {error}
        </Alert>
      )}

      {/* Answer display */}
      {currentAnswer && (
        <Paper sx={{ p: 2 }} variant="outlined">
          <MarkdownRenderer content={currentAnswer} />
          {isStreaming && <span className="cursor-blink" />}
        </Paper>
      )}

      {/* Empty state hint */}
      {!currentAnswer && !isProcessing && currentImage && (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ textAlign: 'center', py: 2 }}
        >
          点击"开始解答"按钮获取答案
        </Typography>
      )}
    </Box>
  );
}
