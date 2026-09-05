import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Grid,
  Card,
  CardActionArea,
  CardMedia,
  CardContent,
  CircularProgress,
  Chip,
} from '@mui/material';
import ScreenShareIcon from '@mui/icons-material/ScreenShare';
import WindowIcon from '@mui/icons-material/Window';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import {
  getDesktopSources,
  getSelectedCaptureSourceId,
  setSelectedCaptureSourceId,
  type DesktopSourceItem,
} from '../../services/desktopWindowService';

interface WindowSelectorModalProps {
  open: boolean;
  onClose: () => void;
  onSelectAndSolve?: (sourceId: string) => void;
}

export function WindowSelectorModal({
  open,
  onClose,
  onSelectAndSolve,
}: WindowSelectorModalProps) {
  const [sources, setSources] = useState<DesktopSourceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    getSelectedCaptureSourceId(),
  );

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setSelectedId(getSelectedCaptureSourceId());
    void getDesktopSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 320, height: 180 },
    })
      .then((items) => {
        setSources(items);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [open]);

  const handleChooseSource = (source: DesktopSourceItem) => {
    setSelectedId(source.id);
    setSelectedCaptureSourceId(source.id);
    if (onSelectAndSolve) {
      onSelectAndSolve(source.id);
      onClose();
    }
  };

  const handleResetToPrimary = () => {
    setSelectedId(null);
    setSelectedCaptureSourceId(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ScreenShareIcon color="primary" />
          <Typography variant="h6" fontWeight={700}>
            选择要识别的窗口或屏幕
          </Typography>
        </Box>
        <Button size="small" variant="text" onClick={handleResetToPrimary}>
          恢复默认（捕获当前主屏幕）
        </Button>
      </DialogTitle>

      <DialogContent dividers sx={{ minHeight: 360, bgcolor: 'background.default' }}>
        {loading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 8 }}>
            <CircularProgress size={36} />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              正在扫描正在运行的窗口和屏幕...
            </Typography>
          </Box>
        ) : sources.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography variant="body2" color="text.secondary">
              未能获取到活动窗口，请检查系统的屏幕录制权限。
            </Typography>
          </Box>
        ) : (
          <Grid container spacing={2}>
            {sources.map((src) => {
              const isScreen = src.id.startsWith('screen:');
              const isCurrent = selectedId === src.id;

              return (
                <Grid item xs={12} sm={6} md={4} key={src.id}>
                  <Card
                    variant="outlined"
                    sx={{
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      borderWidth: isCurrent ? 2 : 1,
                      borderColor: isCurrent ? 'primary.main' : 'divider',
                      boxShadow: isCurrent ? 3 : 0,
                      transition: 'all 0.2s ease',
                      position: 'relative',
                    }}
                  >
                    <CardActionArea
                      onClick={() => handleChooseSource(src)}
                      sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}
                    >
                      <Box sx={{ position: 'relative', width: '100%', height: 140, bgcolor: 'black' }}>
                        {src.thumbnail ? (
                          <CardMedia
                            component="img"
                            image={src.thumbnail}
                            alt={src.name}
                            sx={{ width: '100%', height: '100%', objectFit: 'contain' }}
                          />
                        ) : (
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                            <WindowIcon sx={{ fontSize: 40, color: 'text.secondary' }} />
                          </Box>
                        )}
                        <Chip
                          size="small"
                          label={isScreen ? '整个屏幕' : '应用窗口'}
                          color={isScreen ? 'secondary' : 'default'}
                          sx={{
                            position: 'absolute',
                            top: 8,
                            left: 8,
                            opacity: 0.9,
                            fontSize: 11,
                          }}
                        />
                        {isCurrent && (
                          <CheckCircleIcon
                            color="primary"
                            sx={{
                              position: 'absolute',
                              top: 8,
                              right: 8,
                              bgcolor: 'background.paper',
                              borderRadius: '50%',
                            }}
                          />
                        )}
                      </Box>
                      <CardContent sx={{ py: 1.5, px: 2, width: '100%' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {src.appIcon && (
                            <Box
                              component="img"
                              src={src.appIcon}
                              alt=""
                              sx={{ width: 18, height: 18, borderRadius: 0.5 }}
                            />
                          )}
                          <Typography
                            variant="body2"
                            noWrap
                            fontWeight={isCurrent ? 700 : 500}
                            title={src.name}
                          >
                            {src.name || (isScreen ? '屏幕' : '未知窗口')}
                          </Typography>
                        </Box>
                      </CardContent>
                    </CardActionArea>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Typography variant="caption" color="text.secondary" sx={{ flexGrow: 1 }}>
          💡 选定窗口后，一键截屏快捷键将优先截取该窗口，适合指定浏览器笔试页面。
        </Typography>
        <Button onClick={onClose} color="inherit">
          关闭
        </Button>
      </DialogActions>
    </Dialog>
  );
}
