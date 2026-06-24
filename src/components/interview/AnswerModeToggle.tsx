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
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Typography variant="body2" color="text.secondary">
        回答模式：
      </Typography>
      <ToggleButtonGroup
        value={mode}
        exclusive
        onChange={handleChange}
        size="small"
      >
        <ToggleButton value="concise" sx={{ px: 2 }}>简洁</ToggleButton>
        <ToggleButton value="detailed" sx={{ px: 2 }}>详细</ToggleButton>
      </ToggleButtonGroup>
    </Box>
  );
}
