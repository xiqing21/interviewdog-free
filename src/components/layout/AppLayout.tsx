/**
 * AppLayout — Root layout with sidebar, top bar, content area, and bottom bar.
 * Registers global keyboard shortcuts and displays the privacy dialog on first launch.
 */

import { useRef, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Box } from '@mui/material';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { BottomBar } from './BottomBar';
import { PrivacyDialog } from '../common/PrivacyDialog';
import { OnboardingGuide } from '../common/OnboardingGuide';
import { ExamFastModal } from '../common/ExamFastModal';
import { useSettings } from '../../hooks/useSettings';
import { useExam } from '../../hooks/useExam';
import { useInterview } from '../../hooks/useInterview';
import { useTheme } from '../../hooks/useTheme';
import { useHotkeys } from '../../hooks/useHotkeys';
import {
  onGlobalToggleGenerationPause,
  onIgnoreMouseChanged,
  onGlobalToggleIgnoreMouse,
  isDesktopApp,
} from '../../services/desktopWindowService';
import { publicAssetUrl } from '../../lib/assets';

export function AppLayout() {
  const { appSettings, acknowledgePrivacy } = useSettings();
  const { captureAndSolve } = useExam();
  const { toggleGenerationPause } = useInterview();
  const { toggleTheme } = useTheme();
  const location = useLocation();
  const mainRef = useRef<HTMLDivElement>(null);
  const [ghostFlash, setGhostFlash] = useState(false);

  // 监听原生全局快捷键（Cmd+Shift+A / Ctrl+Shift+A）
  useEffect(() => {
    const unsub = onGlobalToggleGenerationPause(() => {
      toggleGenerationPause();
    });
    return () => {
      unsub();
    };
  }, [toggleGenerationPause]);

  // 监听幽灵穿透模式触发（Cmd+Shift+P），提供余光确认的无感边框柔光闪烁
  useEffect(() => {
    if (!isDesktopApp()) return;
    const triggerGhostFlash = () => {
      setGhostFlash(true);
      setTimeout(() => setGhostFlash(false), 520);
    };
    const unsubChange = onIgnoreMouseChanged(triggerGhostFlash);
    const unsubGlobal = onGlobalToggleIgnoreMouse(triggerGhostFlash);
    return () => {
      unsubChange();
      unsubGlobal();
    };
  }, []);

  useHotkeys({
    onScreenshot: () => {
      // 若当前不在 /exam（例如在 /interview 页面），无需跳转，直接在当前页面无缝弹出快答浮窗
      if (location.pathname === '/exam') {
        void captureAndSolve(undefined, { showModal: false });
      } else {
        void captureAndSolve(undefined, { showModal: true });
      }
    },
    onToggleAnswerPause: () => {
      toggleGenerationPause();
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
              backgroundImage: `url(${publicAssetUrl('og-image.png')})`,
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
      <ExamFastModal />
      <OnboardingGuide />
      {ghostFlash && <div className="ghost-mode-flash" aria-hidden="true" />}
    </Box>
  );
}
