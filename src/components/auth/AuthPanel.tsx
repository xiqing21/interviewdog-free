import { useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import LogoutIcon from '@mui/icons-material/Logout';
import { useAuth } from '../../hooks/useAuth';
import { COMMERCIAL_MODE, FREE_TRIAL_MINUTES } from '../../config/commercial';
import { getUserProfileInfo } from '../../lib/userProfileHelper';

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.35 24 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.27a7.22 7.22 0 0 1 0-4.54V6.58H1.25a11.96 11.96 0 0 0 0 10.84l4.03-3.15Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98Z"
      />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  );
}

export function AuthPanel() {
  const {
    user,
    loading,
    configured,
    error,
    notice,
    lastEmail,
    signIn,
    signUp,
    signInWithOAuth,
    signOut,
    clearAuthError,
    clearAuthNotice,
  } = useAuth();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(lastEmail);
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'signup'>('login');

  const submit = async () => {
    if (!email.trim() || !password) return;
    try {
      if (mode === 'login') {
        await signIn(email.trim(), password);
        setPassword('');
        setOpen(false);
      } else {
        const result = await signUp(email.trim(), password);
        setPassword('');
        if (result.needsConfirmation) {
          setMode('login');
        } else {
          setOpen(false);
        }
      }
    } catch {
      // AuthContext already exposes a user-facing error.
    }
  };

  if (user) {
    const profile = getUserProfileInfo(user.id || user.email || '');
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Tooltip title={`登录账号: ${user.email} (点击可管理/退出)`}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.8,
              py: 0.3,
              px: 0.8,
              borderRadius: '20px',
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: 'background.paper',
              cursor: 'default',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            {/* 潮流个性猪猪微头像 */}
            <Avatar
              sx={{
                width: 24,
                height: 24,
                fontSize: '13px',
                background: profile.avatarBg,
                color: profile.avatarText,
                boxShadow: `0 0 8px ${profile.avatarGlow}`,
                border: '1px solid rgba(255,255,255,0.6)',
              }}
            >
              {profile.emoji}
            </Avatar>

            {/* 精简、有辨识度的专属昵称 */}
            <Typography
              variant="caption"
              fontWeight={700}
              sx={{
                maxWidth: 105,
                color: 'text.primary',
                letterSpacing: '0.02em',
              }}
              noWrap
            >
              {profile.displayName}
            </Typography>
          </Box>
        </Tooltip>

        <Button
          size="small"
          color="inherit"
          onClick={() => { void signOut(); }}
          disabled={loading}
          sx={{
            minWidth: 0,
            px: 0.8,
            py: 0.2,
            fontSize: '0.75rem',
            color: 'text.secondary',
            '&:hover': { color: 'error.main' },
          }}
          startIcon={<LogoutIcon sx={{ fontSize: '14px !important' }} />}
        >
          退出
        </Button>
      </Box>
    );
  }

  return (
    <>
      <Button size="small" startIcon={<AccountCircleIcon />} onClick={() => setOpen(true)}>
        登录
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{mode === 'login' ? '邮箱登录' : '邮箱注册'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          {COMMERCIAL_MODE && (
            <Alert severity="success">
              注册后赠送 {FREE_TRIAL_MINUTES} 分钟试用；简历、知识库、面试记录和购买时长会跟随账号同步。
            </Alert>
          )}
          {!configured && !COMMERCIAL_MODE && (
            <Alert severity="warning">
              还没有配置 Supabase 环境变量。当前可本地使用，但不能云端同步。
            </Alert>
          )}
          {error && (
            <Alert severity="error" onClose={clearAuthError}>
              {error}
            </Alert>
          )}
          {notice && (
            <Alert severity="success" onClose={clearAuthNotice}>
              {notice}
            </Alert>
          )}
          <TextField
            label="邮箱"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
          />
          <TextField
            label="密码"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
          <Button
            variant="text"
            onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
          >
            {mode === 'login' ? '没有账号？直接注册' : '已有账号？返回登录'}
          </Button>

          <Divider sx={{ my: 0.5, fontSize: 13, color: 'text.secondary' }}>
            或者使用第三方账号快捷登录
          </Divider>

          <Stack direction="row" spacing={1.5}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<GoogleIcon />}
              onClick={() => { void signInWithOAuth('google'); }}
              disabled={loading || !configured}
              sx={{
                py: 0.8,
                fontWeight: 700,
                borderColor: 'divider',
                color: 'text.primary',
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              Google 登录
            </Button>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<GitHubIcon />}
              onClick={() => { void signInWithOAuth('github'); }}
              disabled={loading || !configured}
              sx={{
                py: 0.8,
                fontWeight: 700,
                borderColor: 'divider',
                color: 'text.primary',
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              GitHub 登录
            </Button>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>取消</Button>
          <Button variant="contained" onClick={submit} disabled={loading || !configured || !email.trim() || !password}>
            {mode === 'login' ? '登录' : '注册'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
