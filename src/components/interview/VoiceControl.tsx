/**
 * VoiceControl v2 — 语音输入控制
 * 显示当前音频源（系统音频/麦克风），大圆形按钮控制录音，含合并状态提示
 */

import { Box, IconButton, Typography, Chip } from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';
import StopIcon from '@mui/icons-material/Stop';
import ComputerIcon from '@mui/icons-material/Computer';
import SmartphoneIcon from '@mui/icons-material/Smartphone';
import { useInterview } from '../../hooks/useInterview';
import { useSettings } from '../../hooks/useSettings';

export function VoiceControl() {
  const { isListening, interimText, isMerging, error, startListening, stopListening } = useInterview();
  const { appSettings } = useSettings();
  const isSystemAudio = appSettings.audioSource === 'system';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 2 }}>
      {/* 音频源指示 */}
      <Chip
        icon={isSystemAudio ? <ComputerIcon /> : <SmartphoneIcon />}
        label={isSystemAudio ? '系统音频（面试官）' : '麦克风'}
        size="small"
        variant="outlined"
        sx={{ mb: 1.5, opacity: 0.7 }}
      />

      {/* 录音按钮 */}
      <IconButton
        onClick={isListening ? stopListening : startListening}
        className={isListening ? 'pulse-glow' : ''}
        sx={{
          width: 72, height: 72,
          bgcolor: isListening ? 'error.main' : 'primary.main',
          color: '#fff',
          transition: 'all 0.3s ease',
          '&:hover': { bgcolor: isListening ? 'error.dark' : 'primary.dark' },
        }}
      >
        {isListening ? <StopIcon /> : <MicIcon />}
      </IconButton>

      {/* 状态文字 */}
      <Typography sx={{ mt: 1.5, minHeight: 20, textAlign: 'center' }} color="text.secondary" variant="body2">
        {isListening
          ? isMerging
            ? (interimText || '正在合并长问题...')
            : (interimText || '正在聆听...')
          : '点击开始语音输入'}
      </Typography>

      {/* 错误提示 */}
      {error && (
        <Typography color="error" variant="body2" sx={{ mt: 0.5, textAlign: 'center' }}>
          {error}
        </Typography>
      )}
    </Box>
  );
}
