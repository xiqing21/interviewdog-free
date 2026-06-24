/**
 * QuestionEditor — Text input for manual question entry.
 * Enter key sends the question (Shift+Enter for newline).
 */

import { useState } from 'react';
import { Box, TextField, Button } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import { useInterview } from '../../hooks/useInterview';

export function QuestionEditor() {
  const { sendQuestion, isProcessing } = useInterview();
  const [text, setText] = useState('');

  const handleSend = (): void => {
    const trimmed = text.trim();
    if (trimmed && !isProcessing) {
      void sendQuestion(trimmed);
      setText('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
      <TextField
        fullWidth
        placeholder="输入面试问题，按 Enter 发送..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        multiline
        maxRows={3}
        disabled={isProcessing}
      />
      <Button
        variant="contained"
        onClick={handleSend}
        disabled={!text.trim() || isProcessing}
        sx={{ minWidth: 48, px: 1.5 }}
      >
        <SendIcon />
      </Button>
    </Box>
  );
}
