/**
 * StatusIndicator — Displays a colored status dot with a label.
 * Used to show AI API connection status.
 */

import { Box, Typography } from '@mui/material';
import type { ConnectionTestResult } from '../../types';

type StatusType = 'success' | 'warning' | 'error' | 'idle';

interface StatusIndicatorProps {
  /** The connection test result, or null if untested */
  status: ConnectionTestResult | null;
}

const STATUS_COLORS: Record<StatusType, string> = {
  success: '#4caf50',
  warning: '#ff9800',
  error: '#f44336',
  idle: '#9e9e9e',
};

export function StatusIndicator({ status }: StatusIndicatorProps) {
  let type: StatusType = 'idle';
  let label = '未测试';

  if (status) {
    if (status.success) {
      type = 'success';
      label =
        status.latency !== undefined
          ? `已连接 ${status.latency}ms`
          : '已连接';
    } else {
      type = 'error';
      label = '连接失败';
    }
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
      <Box
        sx={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: STATUS_COLORS[type],
          flexShrink: 0,
        }}
      />
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
    </Box>
  );
}
