/**
 * TopBar — Top application bar with page title, connection status, and theme toggle.
 */

import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
} from '@mui/material';
import { useLocation } from 'react-router-dom';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import { NAV_ITEMS } from '../../constants';
import { useSettings } from '../../hooks/useSettings';
import { useTheme } from '../../hooks/useTheme';
import { StatusIndicator } from '../common/StatusIndicator';
import { AuthPanel } from '../auth/AuthPanel';

export function TopBar() {
  const { connectionStatus } = useSettings();
  const { mode, toggleTheme } = useTheme();
  const location = useLocation();

  const navItem = NAV_ITEMS.find((n) =>
    location.pathname.startsWith(n.path),
  );
  const title = navItem?.label ?? '面试狗';

  return (
    <AppBar
      position="static"
      color="transparent"
      elevation={0}
      sx={{ borderBottom: 1, borderColor: 'divider' }}
    >
      <Toolbar variant="dense">
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          {title}
        </Typography>
        <StatusIndicator status={connectionStatus} />
        <AuthPanel />
        <IconButton onClick={toggleTheme} size="small" sx={{ ml: 1 }}>
          {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
        </IconButton>
      </Toolbar>
    </AppBar>
  );
}
