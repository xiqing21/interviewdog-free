/**
 * BottomBar — Bottom status bar with API status and hotkey hints.
 */

import { Box, Typography } from '@mui/material';
import { useSettings } from '../../hooks/useSettings';
import { COMMERCIAL_MODE } from '../../config/commercial';

export function BottomBar() {
  const { connectionStatus } = useSettings();

  let statusText = COMMERCIAL_MODE ? '需要帮助：xiaosuange@gmail.com' : 'API 未测试';
  if (!COMMERCIAL_MODE && connectionStatus) {
    if (connectionStatus.success) {
      statusText =
        connectionStatus.latency !== undefined
          ? `API 已连接 · ${connectionStatus.latency}ms`
          : 'API 已连接';
    } else {
      statusText = 'API 连接失败';
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
      <Typography variant="caption" color="text.secondary">
        {statusText}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        Ctrl+Shift+S 截图 · ↑↓ 滚动 · M 切换主题
      </Typography>
    </Box>
  );
}
