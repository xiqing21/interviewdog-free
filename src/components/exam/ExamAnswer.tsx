/**
 * ExamAnswer — Displays the solve button and streaming answer.
 * Shows loading state during solving and cursor animation during streaming.
 */

import {
  Box,
  Button,
  Paper,
  Alert,
  Chip,
  CircularProgress,
  Divider,
  Typography,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { useNavigate } from 'react-router-dom';
import { useExam } from '../../hooks/useExam';
import { useBilling } from '../../hooks/useBilling';
import { COMMERCIAL_MODE } from '../../config/commercial';
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

  const { remainingSeconds } = useBilling();
  const navigate = useNavigate();
  const remainingMinutes = Math.floor(remainingSeconds / 60);
  const hasEnoughBalance = !COMMERCIAL_MODE || remainingSeconds >= 300;

  return (
    <Box sx={{ mt: 2 }}>
      {/* Action row */}
      <Box sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center', flexWrap: 'wrap' }}>
        <Button
          variant="contained"
          onClick={() => void solve()}
          disabled={!currentImage || isProcessing || !hasEnoughBalance}
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
            : COMMERCIAL_MODE
              ? currentAnswer
                ? '重新生成 (消耗5分钟)'
                : '开始解答 (消耗5分钟)'
              : currentAnswer
                ? '重新生成'
                : '开始解答'}
        </Button>
        {COMMERCIAL_MODE && (
          <Chip
            size="small"
            variant="outlined"
            color={hasEnoughBalance ? 'default' : 'error'}
            label={`账户可用: ${remainingMinutes} 分钟 (每次消耗 5 分钟)`}
          />
        )}
        {currentAnswer && !isStreaming && <CopyButton text={currentAnswer} />}
      </Box>

      {/* Error display */}
      {error && !currentAnswer && (
        <Alert
          severity="error"
          sx={{ mb: 1 }}
          action={
            error.includes('可用时长不足') ? (
              <Button color="inherit" size="small" onClick={() => navigate('/billing')}>
                前往充值
              </Button>
            ) : undefined
          }
        >
          {error}
        </Alert>
      )}

      {/* Answer display */}
      {currentAnswer && (
        <Paper className="exam-answer-card" variant="outlined">
          <Box className="exam-answer-card__header">
            <Box>
              <Typography variant="subtitle1" fontWeight={800}>解答结果</Typography>
              <Typography variant="caption" color="text.secondary">
                已按题干生成，可直接复制代码运行
              </Typography>
            </Box>
            <Chip
              size="small"
              color={isStreaming ? 'primary' : 'success'}
              label={isStreaming ? '生成中' : '已完成'}
            />
          </Box>
          <Divider />
          <Box className="exam-answer-card__content">
            <MarkdownRenderer className="exam-answer-markdown" content={currentAnswer} />
            {isStreaming && <span className="cursor-blink" />}
          </Box>
        </Paper>
      )}

      {/* Empty state hint */}
      {!currentAnswer && !isProcessing && currentImage && (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ textAlign: 'center', py: 2 }}
        >
          点击“开始解答”进行本地文字识别后生成答案
        </Typography>
      )}
    </Box>
  );
}
