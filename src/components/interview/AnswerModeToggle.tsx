/**
 * AnswerModeToggle — 简洁/详细回答模式切换
 */

import { ToggleButtonGroup, ToggleButton, Typography, Box } from '@mui/material';
import { useSession } from '../../hooks/useSession';
import type { AnswerMode } from '../../types';

export function AnswerModeToggle() {
  const { activeSession, setAnswerMode } = useSession();
  const mode = activeSession?.answerMode ?? 'concise';

  const handleChange = (_: React.MouseEvent<HTMLElement>, newMode: AnswerMode | null) => {
    if (newMode) setAnswerMode(newMode);
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
      <Typography variant="caption" color="text.secondary" fontWeight={800}>
        回答模式
      </Typography>
      <ToggleButtonGroup
        value={mode}
        exclusive
        onChange={handleChange}
        size="small"
        sx={{
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1,
          overflow: 'hidden',
          '& .MuiToggleButton-root': {
            px: 2,
            py: 0.65,
            border: 0,
            borderRadius: 0,
            fontWeight: 800,
            color: 'text.secondary',
          },
          '& .Mui-selected': {
            color: 'primary.main',
            bgcolor: 'primary.50',
          },
        }}
      >
        <ToggleButton value="concise">精简</ToggleButton>
        <ToggleButton value="detailed">详细</ToggleButton>
      </ToggleButtonGroup>
    </Box>
  );
}
