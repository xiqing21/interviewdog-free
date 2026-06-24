/**
 * App v2 — Root application component.
 * Provider nesting: SettingsProvider > SessionProvider > InterviewProvider > ExamProvider
 */

import { useMemo } from 'react';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SettingsProvider } from './context/SettingsContext';
import { SessionProvider } from './context/SessionContext';
import { InterviewProvider } from './context/InterviewContext';
import { ExamProvider } from './context/ExamContext';
import { AppLayout } from './components/layout/AppLayout';
import { InterviewPage } from './components/interview/InterviewPage';
import { ExamPage } from './components/exam/ExamPage';
import { SettingsPage } from './components/settings/SettingsPage';
import { useSettings } from './hooks/useSettings';
import { createAppTheme } from './styles/theme';

function AppContent(): JSX.Element {
  const { appSettings } = useSettings();
  const theme = useMemo(() => createAppTheme(appSettings.theme), [appSettings.theme]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<AppLayout />}>
            <Route index element={<Navigate to="/interview" replace />} />
            <Route path="interview" element={<InterviewPage />} />
            <Route path="exam" element={<ExamPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/interview" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default function App(): JSX.Element {
  return (
    <SettingsProvider>
      <SessionProvider>
        <InterviewProvider>
          <ExamProvider>
            <AppContent />
          </ExamProvider>
        </InterviewProvider>
      </SessionProvider>
    </SettingsProvider>
  );
}
