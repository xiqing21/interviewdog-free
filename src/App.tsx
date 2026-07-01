/**
 * App v2 — Root application component.
 * Provider nesting: SettingsProvider > SessionProvider > InterviewProvider > ExamProvider
 */

import { useMemo } from 'react';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SettingsProvider } from './context/SettingsContext';
import { AuthProvider } from './context/AuthContext';
import { SessionProvider } from './context/SessionContext';
import { KnowledgeProvider } from './context/KnowledgeContext';
import { BillingProvider } from './context/BillingContext';
import { InterviewProvider } from './context/InterviewContext';
import { ExamProvider } from './context/ExamContext';
import { AppLayout } from './components/layout/AppLayout';
import { InterviewPage } from './components/interview/InterviewPage';
import { ExamPage } from './components/exam/ExamPage';
import { KnowledgePage } from './components/knowledge/KnowledgePage';
import { SettingsPage } from './components/settings/SettingsPage';
import { BillingPage } from './components/billing/BillingPage';
import { AdminPage } from './components/admin/AdminPage';
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
            <Route path="knowledge" element={<KnowledgePage />} />
            <Route path="exam" element={<ExamPage />} />
            <Route path="billing" element={<BillingPage />} />
            <Route path="admin" element={<AdminPage />} />
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
      <AuthProvider>
        <SessionProvider>
          <KnowledgeProvider>
            <BillingProvider>
              <InterviewProvider>
                <ExamProvider>
                  <AppContent />
                </ExamProvider>
              </InterviewProvider>
            </BillingProvider>
          </KnowledgeProvider>
        </SessionProvider>
      </AuthProvider>
    </SettingsProvider>
  );
}
