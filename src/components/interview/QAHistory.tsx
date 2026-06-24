/**
 * QAHistory — Scrollable list of Q&A cards with auto-scroll and clear button.
 */

import { useEffect, useRef } from 'react';
import { Box, Typography, Button } from '@mui/material';
import { QACard } from './QACard';
import { useInterview } from '../../hooks/useInterview';

export function QAHistory() {
  const { qaList, clearHistory } = useInterview();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [qaList]);

  if (qaList.length === 0) {
    return null;
  }

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 1,
        }}
      >
        <Typography variant="subtitle2" color="text.secondary">
          对话记录 ({qaList.length})
        </Typography>
        <Button size="small" color="error" onClick={clearHistory}>
          清空记录
        </Button>
      </Box>

      {qaList.map((qa) => (
        <QACard key={qa.id} qa={qa} />
      ))}

      <div ref={bottomRef} />
    </Box>
  );
}
