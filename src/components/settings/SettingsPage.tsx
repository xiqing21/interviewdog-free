/**
 * SettingsPage — Vertical arrangement of all settings sub-components.
 */

import { Box, Typography } from '@mui/material';
import { ProviderConfig } from './ProviderConfig';
import { ModelConfig } from './ModelConfig';
import { PromptConfig } from './PromptConfig';
import { ConnectionTest } from './ConnectionTest';

export function SettingsPage() {
  return (
    <Box
      sx={{
        maxWidth: 700,
        mx: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 2.5,
      }}
    >
      <Typography variant="h5" fontWeight={700}>
        设置
      </Typography>
      <ProviderConfig />
      <ModelConfig />
      <PromptConfig />
      <ConnectionTest />
    </Box>
  );
}
