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
import { useState } from 'react';
import StorageIcon from '@mui/icons-material/Storage';
import CodeIcon from '@mui/icons-material/Code';
import CheckIcon from '@mui/icons-material/Check';
import { MarkdownRenderer } from '../common/MarkdownRenderer';
import { CopyButton } from '../common/CopyButton';

function extractSqlOrCode(markdown: string): { code: string; isSql: boolean } | null {
  if (!markdown) return null;
  const sqlMatch = /```sql\s*([\s\S]*?)```/i.exec(markdown) || /```sql\s*([\s\S]*)$/i.exec(markdown);
  if (sqlMatch && sqlMatch[1]?.trim()) {
    return { code: sqlMatch[1].trim(), isSql: true };
  }
  const genericMatch = /```(?:[a-zA-Z0-9_+-]+)?\s*([\s\S]*?)```/i.exec(markdown) || /```(?:[a-zA-Z0-9_+-]+)?\s*([\s\S]*)$/i.exec(markdown);
  if (genericMatch && genericMatch[1]?.trim()) {
    return { code: genericMatch[1].trim(), isSql: false };
  }
  return null;
}

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
  const [codeCopied, setCodeCopied] = useState(false);

  const extractedCode = extractSqlOrCode(currentAnswer);

  const handleCopyCode = async (code: string) => {
    if (!code) return;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(code);
      } else {
        const ta = document.createElement('textarea');
        ta.value = code;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2500);
    } catch (err) {
      console.warn('Copy failed:', err);
    }
  };

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

        {extractedCode && (
          <Button
            variant="contained"
            color={extractedCode.isSql ? 'primary' : 'secondary'}
            startIcon={
              codeCopied ? (
                <CheckIcon fontSize="small" />
              ) : extractedCode.isSql ? (
                <StorageIcon fontSize="small" />
              ) : (
                <CodeIcon fontSize="small" />
              )
            }
            onClick={() => void handleCopyCode(extractedCode.code)}
            sx={{
              fontWeight: 800,
              bgcolor: codeCopied ? 'success.main' : undefined,
              '&:hover': {
                bgcolor: codeCopied ? 'success.dark' : undefined,
              },
            }}
          >
            {codeCopied
              ? extractedCode.isSql
                ? '✓ SQL 已复制'
                : '✓ 代码已复制'
              : extractedCode.isSql
              ? '一键复制 SQL'
              : '一键复制代码'}
          </Button>
        )}

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
