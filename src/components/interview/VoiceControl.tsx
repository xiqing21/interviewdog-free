/**
 * VoiceControl — Large circular button for voice input with pulse animation.
 * Displays interim transcription text and listening status.
 */

import { Box, IconButton, Typography } from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';
import StopIcon from '@mui/icons-material/Stop';
import { useInterview } from '../../hooks/useInterview';

export function VoiceControl() {
  const {
    isListening,
    interimText,
    speechSupported,
    startListening,
    stopListening,
    error,
  } = useInterview();

  if (!speechSupported) {
    return (
      <Box sx={{ textAlign: 'center', py: 2 }}>
        <Typography variant="body2" color="text.secondary">
          当前浏览器不支持语音识别功能，请使用 Chrome 或 Edge 浏览器。
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        py: 3,
      }}
    >
      <IconButton
        onClick={isListening ? stopListening : startListening}
        className={isListening ? 'pulse-glow' : ''}
        sx={{
          width: 72,
          height: 72,
          bgcolor: isListening ? 'error.main' : 'primary.main',
          color: '#fff',
          transition: 'all 0.3s ease',
          '&:hover': {
            bgcolor: isListening ? 'error.dark' : 'primary.dark',
          },
        }}
      >
        {isListening ? <StopIcon /> : <MicIcon />}
      </IconButton>

      <Typography
        sx={{ mt: 1.5, minHeight: 20, textAlign: 'center' }}
        color="text.secondary"
        variant="body2"
      >
        {isListening
          ? interimText || '正在聆听...'
          : '点击开始语音输入'}
      </Typography>

      {error && (
        <Typography color="error" variant="body2" sx={{ mt: 0.5 }}>
          {error}
        </Typography>
      )}
    </Box>
  );
}
