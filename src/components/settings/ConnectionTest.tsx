/**
 * ConnectionTest — Button to test AI API connection with result display.
 */

import {
  Paper,
  Typography,
  Button,
  Alert,
  CircularProgress,
} from '@mui/material';
import NetworkCheckIcon from '@mui/icons-material/NetworkCheck';
import { useSettings } from '../../hooks/useSettings';

export function ConnectionTest() {
  const { connectionStatus, isTestingConnection, testConnection } =
    useSettings();

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        连接测试
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        测试当前配置是否能成功连接到 AI 服务商
      </Typography>

      <Button
        variant="contained"
        onClick={() => void testConnection()}
        disabled={isTestingConnection}
        startIcon={
          isTestingConnection ? (
            <CircularProgress size={16} color="inherit" />
          ) : (
            <NetworkCheckIcon />
          )
        }
      >
        {isTestingConnection ? '测试中...' : '测试连接'}
      </Button>

      {connectionStatus && (
        <Alert
          severity={connectionStatus.success ? 'success' : 'error'}
          sx={{ mt: 2 }}
        >
          {connectionStatus.message}
        </Alert>
      )}
    </Paper>
  );
}
