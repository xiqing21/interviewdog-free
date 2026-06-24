/**
 * AppLayout — Root layout with sidebar, top bar, content area, and bottom bar.
 * Registers global keyboard shortcuts and displays the privacy dialog on first launch.
 */

import { useRef } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Box } from '@mui/material';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { BottomBar } from './BottomBar';
import { PrivacyDialog } from '../common/PrivacyDialog';
import { useSettings } from '../../hooks/useSettings';
import { useExam } from '../../hooks/useExam';
import { useTheme } from '../../hooks/useTheme';
import { useHotkeys } from '../../hooks/useHotkeys';

export function AppLayout() {
  const { appSettings, acknowledgePrivacy } = useSettings();
  const { captureScreen } = useExam();
  const { toggleTheme } = useTheme();
  const navigate = useNavigate();
  const mainRef = useRef<HTMLDivElement>(null);

  useHotkeys({
    onScreenshot: () => {
      navigate('/exam');
      void captureScreen();
    },
    onScrollUp: () => {
      mainRef.current?.scrollBy({ top: -300, behavior: 'smooth' });
    },
    onScrollDown: () => {
      mainRef.current?.scrollBy({ top: 300, behavior: 'smooth' });
    },
    onToggleMode: toggleTheme,
  });

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />
      <Box
        sx={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <TopBar />
        <Box
          ref={mainRef}
          sx={{
            flexGrow: 1,
            overflow: 'auto',
            p: 3,
          }}
        >
          <Outlet />
        </Box>
        <BottomBar />
      </Box>
      <PrivacyDialog
        open={!appSettings.privacyAcknowledged}
        onConfirm={acknowledgePrivacy}
      />
    </Box>
  );
}
