import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  ButtonGroup,
  FormControlLabel,
  Slider,
  Stack,
  Switch,
  Typography,
  Chip,
} from '@mui/material';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import PushPinIcon from '@mui/icons-material/PushPin';
import LayersClearIcon from '@mui/icons-material/LayersClear';
import SecurityIcon from '@mui/icons-material/Security';
import {
  applyDesktopOpacity,
  hideDesktopWindow,
  isDesktopApp,
  readStoredOpacity,
  OPACITY_LEVELS,
  getContentProtection,
  setContentProtection,
  getAlwaysOnTop,
  setAlwaysOnTop,
  getIgnoreMouseEvents,
  setIgnoreMouseEvents,
} from '../../services/desktopWindowService';

export function DesktopWindowSettings() {
  const [available, setAvailable] = useState(false);
  const [opacity, setOpacity] = useState(() => Math.round(readStoredOpacity() * 100));
  const [contentProtected, setContentProtected] = useState(true);
  const [alwaysOnTopState, setAlwaysOnTopState] = useState(false);
  const [ignoreMouseState, setIgnoreMouseState] = useState(false);

  const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform);
  const shotKeyHint = isMac ? '⌘ + Shift + S' : 'Ctrl + Shift + S';
  const ghostKeyHint = isMac ? '⌘ + Shift + P' : 'Ctrl + Shift + P';

  useEffect(() => {
    const isDesk = isDesktopApp();
    setAvailable(isDesk);
    if (!isDesk) return;

    void getContentProtection().then(setContentProtected);
    void getAlwaysOnTop().then(setAlwaysOnTopState);
    void getIgnoreMouseEvents().then(setIgnoreMouseState);
  }, []);

  if (!available) return null;

  const handleOpacityChange = (_event: Event, value: number | number[]) => {
    const nextValue = Array.isArray(value) ? value[0] : value;
    setOpacity(nextValue);
    void applyDesktopOpacity(nextValue / 100);
  };

  const handleLevelSelect = (level: number) => {
    const next = Math.round(level * 100);
    setOpacity(next);
    void applyDesktopOpacity(level);
  };

  const handleToggleProtection = async (checked: boolean) => {
    setContentProtected(checked);
    await setContentProtection(checked);
  };

  const handleTogglePin = async (checked: boolean) => {
    setAlwaysOnTopState(checked);
    await setAlwaysOnTop(checked);
  };

  const handleToggleIgnoreMouse = async (checked: boolean) => {
    setIgnoreMouseState(checked);
    await setIgnoreMouseEvents(checked);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="subtitle1" fontWeight={700}>
        客户端专属：隐蔽与窗口辅助设置
      </Typography>

      <Alert severity="success" icon={<SecurityIcon />}>
        防截屏/屏幕共享保护：开启后在腾讯会议、Zoom、各类在线笔试监控截屏中，本窗口完全隐身透明；一键截屏答题时也不会截入自身窗口。
      </Alert>

      {/* 防截屏隐藏开关 */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
        <Box>
          <Typography variant="body2" fontWeight={600}>
            防截屏 / 屏幕共享不可见
          </Typography>
          <Typography variant="caption" color="text.secondary">
            针对监考插件、远程协助、屏幕录制等场景自动隐藏自身
          </Typography>
        </Box>
        <FormControlLabel
          control={
            <Switch
              checked={contentProtected}
              onChange={(e) => void handleToggleProtection(e.target.checked)}
              color="success"
            />
          }
          label={contentProtected ? '已开启隐身' : '已关闭'}
        />
      </Box>

      {/* 置顶与鼠标穿透 */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
        <Box sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="body2" fontWeight={600} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <PushPinIcon fontSize="small" color={alwaysOnTopState ? 'primary' : 'inherit'} />
              窗口置顶
            </Typography>
            <Typography variant="caption" color="text.secondary">
              始终保持在其他所有软件最上层
            </Typography>
          </Box>
          <Switch
            checked={alwaysOnTopState}
            onChange={(e) => void handleTogglePin(e.target.checked)}
          />
        </Box>

        <Box sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="body2" fontWeight={600} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <LayersClearIcon fontSize="small" color={ignoreMouseState ? 'secondary' : 'inherit'} />
              鼠标穿透 (幽灵模式)
            </Typography>
            <Typography variant="caption" color="text.secondary">
              快捷键 {ghostKeyHint} 快速切换
            </Typography>
          </Box>
          <Switch
            checked={ignoreMouseState}
            onChange={(e) => void handleToggleIgnoreMouse(e.target.checked)}
            color="secondary"
          />
        </Box>
      </Box>

      {/* 透明度调节 */}
      <Box sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="body2" fontWeight={600}>
            窗口透明度 (当前: {opacity}%)
          </Typography>
          <ButtonGroup size="small" variant="outlined">
            {OPACITY_LEVELS.map((level) => {
              const pct = Math.round(level * 100);
              const isSel = Math.abs(opacity - pct) < 3;
              return (
                <Button
                  key={level}
                  onClick={() => handleLevelSelect(level)}
                  variant={isSel ? 'contained' : 'outlined'}
                >
                  {pct}%
                </Button>
              );
            })}
          </ButtonGroup>
        </Box>
        <Stack direction="row" spacing={2} alignItems="center">
          <Slider
            min={15}
            max={100}
            step={5}
            value={opacity}
            valueLabelDisplay="auto"
            onChange={handleOpacityChange}
            aria-label="窗口透明度"
          />
        </Stack>
      </Box>

      {/* 快捷键汇总 */}
      <Box sx={{ p: 1.5, bgcolor: 'background.default', borderRadius: 1, border: '1px dashed', borderColor: 'divider' }}>
        <Typography variant="caption" fontWeight={700} color="text.secondary" display="block" gutterBottom>
          系统全局快捷键（窗口未聚焦时亦可直接触发）：
        </Typography>
        <Stack direction="row" spacing={2} sx={{ mt: 1, flexWrap: 'wrap', gap: 1 }}>
          <Chip label={`一键静默截屏并答题：${shotKeyHint}`} size="small" color="primary" variant="outlined" />
          <Chip label={`一键切换鼠标穿透：${ghostKeyHint}`} size="small" color="secondary" variant="outlined" />
        </Stack>
      </Box>

      <Box>
        <Button
          variant="outlined"
          size="small"
          startIcon={<VisibilityOffIcon />}
          onClick={() => {
            void hideDesktopWindow();
          }}
        >
          立即隐藏窗口
        </Button>
      </Box>
    </Box>
  );
}
