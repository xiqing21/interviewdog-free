/**
 * ImageUploader — Screen capture and image upload component.
 * Supports screenshot, drag-and-drop, clipboard paste, and file selection.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { Box, Button, Typography, Chip } from '@mui/material';
import ScreenshotMonitorIcon from '@mui/icons-material/ScreenshotMonitor';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import WindowIcon from '@mui/icons-material/Window';
import { useExam } from '../../hooks/useExam';
import { isDesktopApp } from '../../services/desktopWindowService';
import { WindowSelectorModal } from '../desktop/WindowSelectorModal';

export function ImageUploader() {
  const {
    currentImage,
    captureScreen,
    setImageFromUpload,
    captureSupported,
    isProcessing,
  } = useExam();
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /** Reads an image File and stores its base64 data (without data URI prefix). */
  const handleFile = useCallback(
    (file: File): void => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        if (base64) {
          setImageFromUpload(base64);
        }
      };
      reader.readAsDataURL(file);
    },
    [setImageFromUpload],
  );

  /** Handles clipboard paste events for images. */
  const handlePaste = useCallback(
    (e: ClipboardEvent): void => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            handleFile(file);
            break;
          }
        }
      }
    },
    [handleFile],
  );

  useEffect(() => {
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  const handleDrop = (e: React.DragEvent): void => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleFileInputChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ): void => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
    e.target.value = '';
  };

  const [selectorOpen, setSelectorOpen] = useState(false);
  const desktop = isDesktopApp();
  const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform);
  const shotKeyHint = isMac ? '⌘+⇧+S' : 'Ctrl+Shift+S';

  return (
    <Box>
      {/* Action buttons */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexWrap: 'wrap' }}>
        {captureSupported && (
          <Button
            variant="contained"
            onClick={() => void captureScreen()}
            disabled={isProcessing}
            startIcon={<ScreenshotMonitorIcon />}
          >
            {desktop ? '一键截屏' : '屏幕截图'}
          </Button>
        )}
        {desktop && (
          <Button
            variant="outlined"
            onClick={() => setSelectorOpen(true)}
            startIcon={<WindowIcon />}
          >
            挑选窗口/屏幕
          </Button>
        )}
        <Button
          variant="outlined"
          onClick={() => fileInputRef.current?.click()}
          startIcon={<UploadFileIcon />}
        >
          上传图片
        </Button>
        {desktop && (
          <Chip
            size="small"
            color="primary"
            variant="outlined"
            label={`快捷键：${shotKeyHint} (全局静默截题)`}
            sx={{ ml: 'auto', fontWeight: 600 }}
          />
        )}
      </Box>

      <WindowSelectorModal
        open={selectorOpen}
        onClose={() => setSelectorOpen(false)}
        onSelectAndSolve={(srcId) => {
          void captureScreen(srcId);
        }}
      />

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileInputChange}
      />

      {/* Drop zone / Preview */}
      <Box
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        sx={{
          border: '2px dashed',
          borderColor: dragOver ? 'primary.main' : 'divider',
          borderRadius: 2,
          p: 2,
          minHeight: 200,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: dragOver ? 'action.hover' : 'background.default',
          transition: 'all 0.2s ease',
        }}
      >
        {currentImage ? (
          <Box
            component="img"
            src={`data:image/png;base64,${currentImage}`}
            alt="题目截图"
            sx={{
              maxWidth: '100%',
              maxHeight: 400,
              borderRadius: 1,
            }}
          />
        ) : (
          <Typography color="text.secondary" variant="body2">
            拖拽图片到此处、粘贴（Ctrl+V）或点击上方按钮上传
          </Typography>
        )}
      </Box>
    </Box>
  );
}
