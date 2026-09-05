/**
 * TopBar — Top application bar with page title, connection status, and theme toggle.
 */

import {
  AppBar,
  Box,
  Chip,
  Toolbar,
  Typography,
  IconButton,
} from '@mui/material';
import { useLocation, useNavigate } from 'react-router-dom';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import { NAV_ITEMS } from '../../constants';
import { useSettings } from '../../hooks/useSettings';
import { useTheme } from '../../hooks/useTheme';
import { useBilling } from '../../hooks/useBilling';
import { StatusIndicator } from '../common/StatusIndicator';
import { AuthPanel } from '../auth/AuthPanel';
import { COMMERCIAL_MODE } from '../../config/commercial';
import { DesktopHudToolbar } from '../desktop/DesktopHudToolbar';

function formatRemaining(seconds: number): string {
  return `${Math.floor(seconds / 60)} 分钟`;
}

export function TopBar() {
  const { connectionStatus } = useSettings();
  const { mode, toggleTheme } = useTheme();
  const { remainingSeconds } = useBilling();
  const location = useLocation();
  const navigate = useNavigate();

  const navItem = NAV_ITEMS.find((n) =>
    location.pathname.startsWith(n.path),
  );
  const title = navItem?.label ?? '面试猪';

  return (
    <AppBar
      position="static"
      color="transparent"
      elevation={0}
      sx={{ borderBottom: 1, borderColor: 'divider', WebkitAppRegion: 'drag', userSelect: 'none' }}
    >
      <Toolbar variant="dense">
        <Typography variant="h6" sx={{ mr: 2 }}>
          {title}
        </Typography>
        <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center' }}>
          <DesktopHudToolbar />
        </Box>
        {!COMMERCIAL_MODE && (
          <Box sx={{ WebkitAppRegion: 'no-drag' }}>
            <StatusIndicator status={connectionStatus} />
          </Box>
        )}
        <Chip
          size="small"
          color={remainingSeconds <= 5 * 60 ? 'warning' : 'primary'}
          label={`剩余 ${formatRemaining(remainingSeconds)}`}
          onClick={() => navigate('/billing')}
          sx={{ ml: 1, cursor: 'pointer', WebkitAppRegion: 'no-drag' }}
        />
        <Box sx={{ WebkitAppRegion: 'no-drag' }}>
          <AuthPanel />
        </Box>
        <IconButton onClick={toggleTheme} size="small" sx={{ ml: 1, WebkitAppRegion: 'no-drag' }}>
          {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
        </IconButton>
      </Toolbar>
    </AppBar>
  );
}
