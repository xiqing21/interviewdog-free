import { useState, useEffect } from 'react';
import {
  Box,
  Button,
  ButtonGroup,
  IconButton,
  Tooltip,
  Chip,
  Typography,
} from '@mui/material';
import PushPinIcon from '@mui/icons-material/PushPin';
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined';
import LayersClearIcon from '@mui/icons-material/LayersClear';
import SecurityIcon from '@mui/icons-material/Security';
import SecurityUpdateWarningIcon from '@mui/icons-material/SecurityUpdateWarning';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import WindowIcon from '@mui/icons-material/Window';
import {
  isDesktopApp,
  readStoredOpacity,
  applyDesktopOpacity,
  OPACITY_LEVELS,
  getContentProtection,
  setContentProtection,
  getAlwaysOnTop,
  setAlwaysOnTop,
  getIgnoreMouseEvents,
  setIgnoreMouseEvents,
  onIgnoreMouseChanged,
  onGlobalToggleIgnoreMouse,
  getSelectedCaptureSourceId,
} from '../../services/desktopWindowService';
import { useExam } from '../../hooks/useExam';
import { useInterview } from '../../hooks/useInterview';
import { WindowSelectorModal } from './WindowSelectorModal';
import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutline';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';

export function DesktopHudToolbar() {
  const [available, setAvailable] = useState(false);
  const [opacity, setOpacity] = useState(1);
  const [alwaysOnTopState, setAlwaysOnTopState] = useState(false);
  const [ignoreMouseState, setIgnoreMouseState] = useState(false);
  const [contentProtected, setContentProtected] = useState(true);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);

  const { captureAndSolve, isProcessing } = useExam();
  const { isGenerationPaused, toggleGenerationPause } = useInterview();
  const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform);
  const shotKeyHint = isMac ? '⌘+⇧+S' : 'Ctrl+Shift+S';
  const ghostKeyHint = isMac ? '⌘+⇧+P' : 'Ctrl+Shift+P';
  const answerKeyHint = isMac ? '⌘+⇧+A' : 'Ctrl+Shift+A';

  useEffect(() => {
    const isDesk = isDesktopApp();
    setAvailable(isDesk);
    if (!isDesk) return;

    setOpacity(readStoredOpacity());
    setSelectedSourceId(getSelectedCaptureSourceId());

    void getContentProtection().then((prot) => setContentProtected(prot));
    void getAlwaysOnTop().then((top) => setAlwaysOnTopState(top));
    void getIgnoreMouseEvents().then((igm) => setIgnoreMouseState(igm));

    const unsubChange = onIgnoreMouseChanged((state) => {
      setIgnoreMouseState(state);
    });

    const unsubGlobal = onGlobalToggleIgnoreMouse(() => {
      setIgnoreMouseState((prev) => !prev);
    });

    return () => {
      unsubChange();
      unsubGlobal();
    };
  }, []);

  if (!available) return null;

  const handleTogglePin = async () => {
    const next = !alwaysOnTopState;
    setAlwaysOnTopState(next);
    await setAlwaysOnTop(next);
  };

  const handleToggleIgnoreMouse = async () => {
    const next = !ignoreMouseState;
    setIgnoreMouseState(next);
    await setIgnoreMouseEvents(next);
  };

  const handleToggleContentProtection = async () => {
    const next = !contentProtected;
    setContentProtected(next);
    await setContentProtection(next);
  };

  const handleSelectOpacity = async (level: number) => {
    setOpacity(level);
    await applyDesktopOpacity(level);
  };

  return (
    <>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.8,
          px: 1,
          py: 0.5,
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
          WebkitAppRegion: 'no-drag',
        }}
      >
        {/* 一键截屏答题 */}
        <Tooltip title={`一键静默截屏并由AI解答 (${shotKeyHint})`}>
          <span>
            <Button
              variant="contained"
              color="primary"
              size="small"
              disabled={isProcessing}
              startIcon={<CameraAltIcon />}
              onClick={() => void captureAndSolve()}
              sx={{
                fontWeight: 700,
                fontSize: '0.75rem',
                textTransform: 'none',
                px: 1.2,
              }}
            >
              {isProcessing ? '解答中...' : `一键答题 (${shotKeyHint})`}
            </Button>
          </span>
        </Tooltip>

        {/* 窗口选择 */}
        <Tooltip title="选择指定窗口或屏幕识别">
          <IconButton
            size="small"
            color={selectedSourceId ? 'primary' : 'default'}
            onClick={() => setSelectorOpen(true)}
          >
            <WindowIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <Box sx={{ width: 1, height: 18, bgcolor: 'divider', mx: 0.2 }} />

        {/* 5档透明度 */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11, userSelect: 'none' }}>
            透:
          </Typography>
          <ButtonGroup size="small" variant="outlined" sx={{ height: 24 }}>
            {OPACITY_LEVELS.map((level) => {
              const percent = Math.round(level * 100);
              const isSelected = Math.abs(opacity - level) < 0.05;
              return (
                <Button
                  key={level}
                  onClick={() => void handleSelectOpacity(level)}
                  variant={isSelected ? 'contained' : 'outlined'}
                  color={isSelected ? 'primary' : 'inherit'}
                  sx={{
                    px: 0.6,
                    py: 0,
                    minWidth: 32,
                    fontSize: '0.68rem',
                    fontWeight: isSelected ? 700 : 400,
                  }}
                >
                  {percent}%
                </Button>
              );
            })}
          </ButtonGroup>
        </Box>

        <Box sx={{ width: 1, height: 18, bgcolor: 'divider', mx: 0.2 }} />

        {/* 窗口置顶 */}
        <Tooltip title={alwaysOnTopState ? '已置顶在最前（点击取消）' : '点击将窗口固定在最前端'}>
          <IconButton
            size="small"
            color={alwaysOnTopState ? 'primary' : 'default'}
            onClick={() => void handleTogglePin()}
          >
            {alwaysOnTopState ? <PushPinIcon fontSize="small" /> : <PushPinOutlinedIcon fontSize="small" />}
          </IconButton>
        </Tooltip>

        {/* 鼠标穿透（幽灵模式） */}
        <Tooltip
          title={
            ignoreMouseState
              ? `已开启鼠标穿透！可直接点击底层页面（按 ${ghostKeyHint} 解除）`
              : `开启鼠标穿透（幽灵模式），鼠标将穿透窗口操作底层页面 (快捷键 ${ghostKeyHint})`
          }
        >
          <Button
            size="small"
            variant={ignoreMouseState ? 'contained' : 'outlined'}
            color={ignoreMouseState ? 'secondary' : 'inherit'}
            startIcon={<LayersClearIcon />}
            onClick={() => void handleToggleIgnoreMouse()}
            sx={{
              px: 1,
              py: 0.2,
              fontSize: '0.72rem',
              textTransform: 'none',
              minWidth: 'auto',
            }}
          >
            {ignoreMouseState ? `已穿透 (${ghostKeyHint})` : '鼠标穿透'}
          </Button>
        </Tooltip>

        <Box sx={{ width: 1, height: 18, bgcolor: 'divider', mx: 0.2 }} />

        {/* 自动生成/暂停生成切换开关 (快捷键 ⌘+Shift+A) */}
        <Tooltip
          title={
            isGenerationPaused
              ? `AI自动应答已拦截（语音识别持续记录中，不漏任何面试官提问）。按 ${answerKeyHint} 或点击恢复自动解答`
              : `AI自动应答开启中。面试官提问结束后将自动生成答案。按 ${answerKeyHint} 或点击可快速暂停/恢复`
          }
        >
          <Button
            size="small"
            variant={isGenerationPaused ? 'contained' : 'outlined'}
            color={isGenerationPaused ? 'warning' : 'inherit'}
            startIcon={isGenerationPaused ? <PauseCircleOutlineIcon /> : <PlayCircleOutlineIcon />}
            onClick={() => toggleGenerationPause()}
            sx={{
              px: 1,
              py: 0.2,
              fontSize: '0.72rem',
              textTransform: 'none',
              minWidth: 'auto',
              fontWeight: isGenerationPaused ? 700 : 500,
            }}
          >
            {isGenerationPaused ? `应答暂停 (${answerKeyHint})` : `自动应答 (${answerKeyHint})`}
          </Button>
        </Tooltip>

        {/* 防截屏/屏幕共享隐藏 */}
        <Tooltip
          title={
            contentProtected
              ? '防截屏保护已生效：在腾讯会议/Zoom/监考截屏中本窗口不可见；一键截屏也不会截到自身'
              : '防截屏已关闭：本窗口将在屏幕共享和截屏中可见（点击开启防截屏隐藏）'
          }
        >
          <Chip
            size="small"
            icon={contentProtected ? <SecurityIcon fontSize="small" /> : <SecurityUpdateWarningIcon fontSize="small" />}
            label={contentProtected ? '防录屏隐藏' : '共享可见'}
            color={contentProtected ? 'success' : 'default'}
            variant={contentProtected ? 'filled' : 'outlined'}
            onClick={() => void handleToggleContentProtection()}
            sx={{
              cursor: 'pointer',
              height: 24,
              fontSize: '0.7rem',
              fontWeight: 600,
            }}
          />
        </Tooltip>
      </Box>

      {/* 挑选窗口弹窗 */}
      <WindowSelectorModal
        open={selectorOpen}
        onClose={() => {
          setSelectorOpen(false);
          setSelectedSourceId(getSelectedCaptureSourceId());
        }}
        onSelectAndSolve={(srcId) => {
          setSelectedSourceId(srcId);
          void captureAndSolve(srcId);
        }}
      />
    </>
  );
}
