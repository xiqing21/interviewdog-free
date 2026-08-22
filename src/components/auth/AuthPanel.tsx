import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from '@mui/material';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import LogoutIcon from '@mui/icons-material/Logout';
import { useAuth } from '../../hooks/useAuth';
import { COMMERCIAL_MODE, FREE_TRIAL_MINUTES } from '../../config/commercial';

export function AuthPanel() {
  const { user, loading, configured, error, lastEmail, signIn, signUp, signOut, clearAuthError } = useAuth();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(lastEmail);
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'signup'>('login');

  const submit = async () => {
    if (!email.trim() || !password) return;
    try {
      if (mode === 'login') {
        await signIn(email.trim(), password);
      } else {
        await signUp(email.trim(), password);
      }
      setPassword('');
      if (!error) setOpen(false);
    } catch {
      // AuthContext already exposes a user-facing error.
    }
  };

  if (user) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 180 }} noWrap>
          {user.email}
        </Typography>
        <Button size="small" startIcon={<LogoutIcon />} onClick={() => { void signOut(); }} disabled={loading}>
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
