/**
 * InterviewPage v2 — 面试辅助主页面
 * 集成 Session 管理、回答模式切换、语音控制、手动触发
 */

import { Box, Alert, Button, Typography, TextField, IconButton, Paper } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import { Link } from 'react-router-dom';
import { useState, useCallback } from 'react';
import { VoiceControl } from './VoiceControl';
import { QAHistory } from './QAHistory';
import { SessionManager } from './SessionManager';
import { AnswerModeToggle } from './AnswerModeToggle';
import { useSettings } from '../../hooks/useSettings';
import { useInterview } from '../../hooks/useInterview';
import { useSession } from '../../hooks/useSession';

export function InterviewPage() {
  const { aiSettings } = useSettings();
  const { activeSession } = useSession();
  const { isProcessing, isListening, addManualQuestion } = useInterview();
  const [manualInput, setManualInput] = useState('');

  const handleManualSend = useCallback(() => {
    const q = manualInput.trim();
    if (!q || isProcessing) return;
    addManualQuestion(q);
    setManualInput('');
  }, [manualInput, isProcessing, addManualQuestion]);

  if (!aiSettings.apiKey) {
    return (
      <Box sx={{ maxWidth: 800, mx: 'auto' }}>
        <Alert severity="warning" action={<Button color="inherit" size="small" component={Link} to="/settings">前往设置</Button>}>
          请先在设置中配置 API Key 后使用面试辅助功能。
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Session 管理器 */}
      <SessionManager />

      {!activeSession ? (
        <Alert severity="info">请先创建一个面试项目开始面试。</Alert>
      ) : (
        <>
          {/* 回答模式 + 语音控制 */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
            <AnswerModeToggle />
          </Box>
          <VoiceControl />

          {/* 手动触发区域：未监听时显示 */}
          {!isListening && (
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle2" gutterBottom color="text.secondary">
                💡 手动触发 — 语音未触发时，可直接输入问题并生成答案
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="粘贴或输入面试官的问题..."
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleManualSend(); }}}
                  multiline
                  maxRows={3}
                />
                <IconButton color="primary" onClick={handleManualSend} disabled={!manualInput.trim() || isProcessing} sx={{ alignSelf: 'flex-end' }}>
                  <SendIcon />
                </IconButton>
              </Box>
            </Paper>
          )}

          <QAHistory />
        </>
      )}
    </Box>
  );
}
