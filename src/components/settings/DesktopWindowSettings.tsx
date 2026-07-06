import { useEffect, useState } from 'react';
import { Alert, Box, Button, Slider, Stack, Typography } from '@mui/material';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import {
  applyDesktopOpacity,
  hideDesktopWindow,
  isDesktopApp,
  readStoredOpacity,
} from '../../services/desktopWindowService';

export function DesktopWindowSettings() {
  const [available, setAvailable] = useState(false);
  const [opacity, setOpacity] = useState(() => Math.round(readStoredOpacity() * 100));

  useEffect(() => {
    setAvailable(isDesktopApp());
  }, []);

  if (!available) return null;

  const handleOpacityChange = (_event: Event, value: number | number[]) => {
    const nextValue = Array.isArray(value) ? value[0] : value;
    setOpacity(nextValue);
    void applyDesktopOpacity(nextValue / 100);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Typography variant="subtitle1" fontWeight={700}>
        Mac 本地窗口
      </Typography>
      <Alert severity="info">
        透明度只影响本地桌面窗口显示；共享屏幕或截图时请使用隐藏窗口来保护隐私。
      </Alert>
      <Stack direction="row" spacing={2} alignItems="center">
        <Typography variant="body2" color="text.secondary" sx={{ width: 72 }}>
          透明度
        </Typography>
        <Slider
          min={80}
          max={100}
          step={5}
          value={opacity}
          valueLabelDisplay="auto"
          onChange={handleOpacityChange}
          aria-label="窗口透明度"
        />
        <Typography variant="body2" sx={{ width: 48, textAlign: 'right' }}>
          {opacity}%
        </Typography>
      </Stack>
      <Box>
        <Button
          variant="outlined"
          size="small"
          startIcon={<VisibilityOffIcon />}
          onClick={() => {
            void hideDesktopWindow();
          }}
        >
          隐藏窗口
        </Button>
      </Box>
    </Box>
  );
}
