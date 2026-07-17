/**
 * BottomBar — Bottom status bar with API status and hotkey hints.
 */

import type { ReactNode } from 'react';
import { Box, Link, Typography } from '@mui/material';
import { useSettings } from '../../hooks/useSettings';
import { COMMERCIAL_MODE } from '../../config/commercial';
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from '../../config/contact';

export function BottomBar() {
  const { connectionStatus } = useSettings();

  let statusNode: ReactNode = COMMERCIAL_MODE ? (
    <>
      需要帮助：
      <Link href={SUPPORT_MAILTO} underline="hover" color="inherit" fontWeight={700}>
        {SUPPORT_EMAIL}
      </Link>
    </>
  ) : (
    'API 未测试'
  );

  if (!COMMERCIAL_MODE && connectionStatus) {
    if (connectionStatus.success) {
      statusNode =
        connectionStatus.latency !== undefined
          ? `API 已连接 · ${connectionStatus.latency}ms`
          : 'API 已连接';
    } else {
      statusNode = 'API 连接失败';
    }
  }

  return (
    <Box
      sx={{
        px: 2,
        py: 0.75,
        borderTop: 1,
        borderColor: 'divider',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        bgcolor: 'background.paper',
      }}
    >
      <Typography variant="caption" color="text.secondary" component="div">
        {statusNode}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        Ctrl+Shift+S 截图 · ↑↓ 滚动 · M 切换主题
      </Typography>
    </Box>
  );
}
