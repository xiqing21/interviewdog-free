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
            position: 'relative',
            isolation: 'isolate',
            '&::before': {
              content: '""',
              position: 'fixed',
              right: { xs: -120, md: 24 },
              bottom: { xs: 12, md: 18 },
              width: { xs: 420, md: 760 },
              aspectRatio: '1731 / 909',
              backgroundImage: 'url(/og-image.png)',
              backgroundSize: 'contain',
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'center',
              opacity: { xs: 0.035, md: 0.055 },
              pointerEvents: 'none',
              zIndex: 0,
              filter: 'saturate(0.9)',
            },
          }}
        >
          <Box sx={{ position: 'relative', zIndex: 1 }}>
            <Outlet />
          </Box>
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
