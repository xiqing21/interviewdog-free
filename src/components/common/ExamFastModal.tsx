/**
 * ExamFastModal — 全局笔试快答悬浮抽屉/浮窗
 * 1. 自由拖拽移动：按住顶部标题栏任意拖动，防止遮挡问答区与问题区
 * 2. 跨页/滚动长题无缝拼接：支持向下滑动后追加下一屏，自动拼接长图
 * 3. 目标语言锁定：支持一键强制指定 SQL / Python / Java / C++，严防误判
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Button,
  Chip,
  CircularProgress,
  Tooltip,
  Collapse,
  Divider,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import RefreshIcon from '@mui/icons-material/Refresh';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import RemoveIcon from '@mui/icons-material/Remove';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import StorageIcon from '@mui/icons-material/Storage';
import CodeIcon from '@mui/icons-material/Code';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import CheckIcon from '@mui/icons-material/Check';
import { useNavigate, useLocation } from 'react-router-dom';
import { useExam } from '../../hooks/useExam';
import { useBilling } from '../../hooks/useBilling';
import { COMMERCIAL_MODE } from '../../config/commercial';
import { MarkdownRenderer } from './MarkdownRenderer';
import { CopyButton } from './CopyButton';
import { EXAM_TYPES } from '../../constants';

const LANGUAGE_OPTIONS = [
  { key: 'auto', label: '智能识别' },
  { key: 'SQL', label: 'SQL (数仓/表题)', icon: <StorageIcon sx={{ fontSize: 13, mr: 0.3 }} /> },
  { key: 'Python', label: 'Python', icon: <CodeIcon sx={{ fontSize: 13, mr: 0.3 }} /> },
  { key: 'Java', label: 'Java' },
  { key: 'C++', label: 'C++' },
];

/** 从 Markdown 回答中提取优先可直接运行的 SQL 或算法代码块 */
function extractSqlOrCode(markdown: string): { code: string; isSql: boolean } | null {
  if (!markdown) return null;
  // 匹配标准闭合的 ```sql ... ```
  const sqlMatch = /```sql\s*([\s\S]*?)```/i.exec(markdown);
  if (sqlMatch && sqlMatch[1]?.trim()) {
    return { code: sqlMatch[1].trim(), isSql: true };
  }
  // 匹配流式生成中尚未闭合的 ```sql ...
  const sqlStreamingMatch = /```sql\s*([\s\S]*)$/i.exec(markdown);
  if (sqlStreamingMatch && sqlStreamingMatch[1]?.trim()) {
    return { code: sqlStreamingMatch[1].trim(), isSql: true };
  }
  // 匹配其他指定语言闭合代码块
  const genericMatch = /```(?:[a-zA-Z0-9_+-]+)?\s*([\s\S]*?)```/i.exec(markdown);
  if (genericMatch && genericMatch[1]?.trim()) {
    return { code: genericMatch[1].trim(), isSql: false };
  }
  // 匹配流式生成中其他语言尚未闭合代码块
  const genericStreamingMatch = /```(?:[a-zA-Z0-9_+-]+)?\s*([\s\S]*)$/i.exec(markdown);
  if (genericStreamingMatch && genericStreamingMatch[1]?.trim()) {
    return { code: genericStreamingMatch[1].trim(), isSql: false };
  }
  return null;
}

export function ExamFastModal() {
  const {
    isFastModalOpen,
    closeFastModal,
    currentImage,
    currentExamType,
    currentAnswer,
    isStreaming,
    isProcessing,
    solve,
    error,
    records,
    appendCaptureOnly,
    resetCaptures,
    capturedSlices,
    preferredLanguage,
    setPreferredLanguage,
  } = useExam();

  const { remainingSeconds } = useBilling();
  const remainingMinutes = Math.floor(remainingSeconds / 60);
  const hasEnoughBalance = !COMMERCIAL_MODE || remainingSeconds >= 300;

  const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform);
  const shotKeyHint = isMac ? '⌘+⇧+S' : 'Ctrl+⇧+S';
  const appendKeyHint = isMac ? '⌘+⇧+↓' : 'Ctrl+⇧+↓';
  const submitKeyHint = isMac ? '⌘+⇧+Enter' : 'Ctrl+⇧+Enter';
  const resetKeyHint = isMac ? '⌘+⇧+⌫' : 'Ctrl+⇧+⌫';

  const navigate = useNavigate();
  const location = useLocation();
  const [minimized, setMinimized] = useState(false);
  const [showImageFull, setShowImageFull] = useState(false);

  // 代码一键复制状态反馈
  const [codeCopied, setCodeCopied] = useState(false);

  // 滚动容器与防抢焦流式滚动管理
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastScrollTopRef = useRef<number>(0);
  const userScrolledUpRef = useRef<boolean>(false);
  const [userScrolledUp, setUserScrolledUp] = useState(false);

  // 浮窗绝对坐标（支持自由鼠标拖拽）
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; mouseX: number; mouseY: number } | null>(null);

  // 监听容器滚动：用户若向上滑动查看前面的 SQL/题目，立即暂停自动吸底，绝不与用户抢夺滚轮
  const handleAnswerScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight <= 45;
    if (isNearBottom) {
      userScrolledUpRef.current = false;
      setUserScrolledUp(false);
    } else if (scrollTop < lastScrollTopRef.current) {
      // 正在向上滑动，保持当前位置
      userScrolledUpRef.current = true;
      setUserScrolledUp(true);
    }
    lastScrollTopRef.current = scrollTop;
  };

  // 点击平滑滚回到底部
  const scrollToBottom = () => {
    userScrolledUpRef.current = false;
    setUserScrolledUp(false);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  };

  // 流式生成时，仅在用户未往上滑的情况下自动吸底
  useEffect(() => {
    if (!scrollContainerRef.current) return;
    if (!userScrolledUpRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [currentAnswer]);

  // 当开启新一轮生成时，重置滚动位置与吸底状态
  useEffect(() => {
    if (isProcessing && !currentAnswer) {
      userScrolledUpRef.current = false;
      setUserScrolledUp(false);
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
      }
    }
  }, [isProcessing, currentAnswer]);

  // 一键复制代码块处理函数
  const extractedCode = extractSqlOrCode(currentAnswer);

  const handleCopyCode = async (code: string) => {
    if (!code) return;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(code);
      } else {
        const ta = document.createElement('textarea');
        ta.value = code;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2500);
    } catch (err) {
      console.warn('[ExamFastModal] 一键复制代码失败:', err);
    }
  };

  // 初始化坐标（默认停靠在右侧偏中上）
  useEffect(() => {
    if (pos === null && typeof window !== 'undefined') {
      const defaultX = Math.max(16, window.innerWidth - 600);
      const defaultY = 72;
      setPos({ x: defaultX, y: defaultY });
    }
  }, [pos]);

  // 鼠标拖动逻辑
  const handleMouseDown = (e: React.MouseEvent) => {
    // 仅响应标题栏自身，防止按钮点击触发拖动
    if ((e.target as HTMLElement).closest('button, .MuiChip-root')) return;

    e.preventDefault();
    setIsDragging(true);
    const currentX = pos?.x ?? Math.max(16, window.innerWidth - 600);
    const currentY = pos?.y ?? 72;
    dragRef.current = {
      startX: currentX,
      startY: currentY,
      mouseX: e.clientX,
      mouseY: e.clientY,
    };

    const handleMouseMove = (moveEvt: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = moveEvt.clientX - dragRef.current.mouseX;
      const dy = moveEvt.clientY - dragRef.current.mouseY;
      const nextX = Math.min(Math.max(8, dragRef.current.startX + dx), window.innerWidth - 320);
      const nextY = Math.min(Math.max(8, dragRef.current.startY + dy), window.innerHeight - 120);
      setPos({ x: nextX, y: nextY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      dragRef.current = null;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // 切换语言强制锁定
  const handleLanguageChange = (
    _event: React.MouseEvent<HTMLElement>,
    newLang: string | null,
  ) => {
    if (!newLang) return;
    setPreferredLanguage(newLang);
    // 立即以新语言重新触发生成
    void solve(undefined, newLang);
  };

  // 核心约束：笔试悬浮窗仅在面试辅助页面（/interview）挂载，笔试辅助页面（/exam）自身有完整大界面，绝对不弹窗覆盖
  if (location.pathname !== '/interview') {
    return null;
  }

  // 如果浮窗未打开，或者没有任何截图/答案，则不渲染
  if (!isFastModalOpen || (!currentImage && !currentAnswer && !isProcessing)) {
    return null;
  }

  const examConfig = EXAM_TYPES.find((e) => e.key === currentExamType);
  const latestRecord = records[records.length - 1];
  const imageSrc =
    latestRecord?.imageUrl ||
    (currentImage?.startsWith('http') || currentImage?.startsWith('data:')
      ? currentImage
      : `data:image/png;base64,${currentImage}`);

  // 最小化状态：显示为右下角精致悬浮胶囊
  if (minimized) {
    return (
      <Paper
        elevation={6}
        onClick={() => setMinimized(false)}
        sx={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 1500,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 2,
          py: 1,
          borderRadius: 4,
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'primary.main',
          cursor: 'pointer',
          boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
          transition: 'all 0.2s ease',
          '&:hover': {
            transform: 'translateY(-2px)',
          },
        }}
      >
        <AutoAwesomeIcon color="primary" fontSize="small" />
        <Typography variant="body2" fontWeight={700}>
          {isProcessing ? '笔试正在生成解答...' : '笔试快答已就绪'}
        </Typography>
        {isProcessing && <CircularProgress size={14} />}
        <IconButton
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            closeFastModal();
          }}
          sx={{ ml: 0.5, p: 0.2 }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Paper>
    );
  }

  const sliceCount = capturedSlices.length;

  return (
    <Paper
      elevation={12}
      className="fade-in"
      style={pos ? { left: `${pos.x}px`, top: `${pos.y}px` } : undefined}
      sx={{
        position: 'fixed',
        width: { xs: 'calc(100vw - 24px)', sm: 540, md: 590 },
        maxHeight: 'calc(100vh - 90px)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 1500,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: isDragging ? 'primary.main' : 'divider',
        borderRadius: 2.5,
        boxShadow: isDragging
          ? '0 16px 48px rgba(99, 102, 241, 0.35)'
          : '0 12px 40px rgba(0,0,0,0.3)',
        overflow: 'hidden',
        transition: isDragging ? 'none' : 'border-color 0.2s ease',
      }}
    >
      {/* 顶部可拖拽标题栏 */}
      <Box
        onMouseDown={handleMouseDown}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 1.1,
          bgcolor: 'action.hover',
          borderBottom: '1px solid',
          borderColor: 'divider',
          cursor: isDragging ? 'grabbing' : 'grab',
          userSelect: 'none',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <DragIndicatorIcon
            sx={{
              color: 'text.disabled',
              fontSize: 18,
              cursor: isDragging ? 'grabbing' : 'grab',
            }}
          />
          <Tooltip title={`单屏一键截取并解答：${shotKeyHint}`}>
            <Typography variant="subtitle2" fontWeight={800} sx={{ display: 'flex', alignItems: 'center', gap: 0.6, cursor: 'help' }}>
              笔试快答
            </Typography>
          </Tooltip>

          <Chip
            size="small"
            label={examConfig?.label ?? '编程题'}
            sx={{
              height: 20,
              fontSize: '0.7rem',
              bgcolor: examConfig?.color ? `${examConfig.color}22` : undefined,
              color: examConfig?.color,
              fontWeight: 700,
            }}
          />

          {sliceCount > 1 && (
            <Chip
              size="small"
              color="secondary"
              label={`长图拼接 (${sliceCount}屏)`}
              sx={{ height: 20, fontSize: '0.68rem', fontWeight: 700 }}
            />
          )}

          {COMMERCIAL_MODE && (
            <Tooltip title={hasEnoughBalance ? "单次笔试解答消耗 5 分钟时长" : "账户时长不足，请充值"}>
              <Chip
                size="small"
                variant={hasEnoughBalance ? "outlined" : "filled"}
                color={hasEnoughBalance ? "default" : "error"}
                label={hasEnoughBalance ? `剩余 ${remainingMinutes}m (5m/题)` : `时长不足 (${remainingMinutes}m)`}
                onClick={hasEnoughBalance ? undefined : () => {
                  closeFastModal();
                  navigate('/billing');
                }}
                sx={{
                  height: 20,
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  cursor: hasEnoughBalance ? 'default' : 'pointer',
                }}
              />
            </Tooltip>
          )}

          {isStreaming ? (
            <Chip
              size="small"
              color="primary"
              label="流式生成中"
              sx={{ height: 20, fontSize: '0.68rem', fontWeight: 600 }}
            />
          ) : currentAnswer ? (
            <Chip
              size="small"
              color="success"
              label="解答完成"
              sx={{ height: 20, fontSize: '0.68rem', fontWeight: 600 }}
            />
          ) : null}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Tooltip title="跳转至完整笔试页">
            <IconButton
              size="small"
              onClick={() => {
                closeFastModal();
                navigate('/exam');
              }}
            >
              <OpenInNewIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="最小化为胶囊">
            <IconButton size="small" onClick={() => setMinimized(true)}>
              <RemoveIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="关闭">
            <IconButton size="small" onClick={closeFastModal}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* 滚动长题与语言锁定控制栏 */}
      <Box
        sx={{
          px: 1.8,
          py: 0.8,
          bgcolor: 'background.default',
          borderBottom: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          flexDirection: 'column',
          gap: 0.8,
        }}
      >
        {/* 跨页长图向下滑动追加截图 */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, flexWrap: 'wrap' }}>
            <Tooltip title={`在答题界面滑动后按快捷键 ${appendKeyHint} 亦可直接追加截屏`}>
              <Button
                size="small"
                variant="outlined"
                color="primary"
                startIcon={<AddPhotoAlternateIcon />}
                onClick={() => void appendCaptureOnly()}
                disabled={isProcessing}
                sx={{
                  fontSize: '0.74rem',
                  py: 0.3,
                  px: 1.2,
                  borderRadius: 1.5,
                  fontWeight: 700,
                  textTransform: 'none',
                }}
              >
                下滑追加下一屏 ({appendKeyHint})
              </Button>
            </Tooltip>

            {sliceCount > 1 && (
              <>
                <Tooltip title={`快捷键 ${submitKeyHint}：一键提交解答完整长图`}>
                  <Button
                    size="small"
                    variant="contained"
                    color="primary"
                    startIcon={<AutoAwesomeIcon />}
                    onClick={() => void solve()}
                    disabled={isProcessing || !hasEnoughBalance}
                    sx={{
                      fontSize: '0.74rem',
                      py: 0.3,
                      px: 1.2,
                      borderRadius: 1.5,
                      fontWeight: 700,
                      textTransform: 'none',
                    }}
                  >
                    合并出题 ({submitKeyHint})
                  </Button>
                </Tooltip>
                <Tooltip title={`快捷键 ${resetKeyHint}：清空切片重截`}>
                  <Button
                    size="small"
                    variant="text"
                    color="inherit"
                    startIcon={<RestartAltIcon />}
                    onClick={() => {
                      resetCaptures();
                    }}
                    disabled={isProcessing}
                    sx={{ fontSize: '0.72rem', py: 0.2, color: 'text.secondary' }}
                  >
                    重置 ({resetKeyHint})
                  </Button>
                </Tooltip>
              </>
            )}
          </Box>

          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
            {sliceCount > 1
              ? `已拼 ${sliceCount} 屏长图（按 ${submitKeyHint} 即可提交）`
              : `长题向下滑动后按 ${appendKeyHint} 追加`}
          </Typography>
        </Box>

        {/* 语言强制锁定（严防 SQL 题被误判出 Python） */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, overflowX: 'auto', pb: 0.2 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem', flexShrink: 0 }}>
            指定语言:
          </Typography>
          <ToggleButtonGroup
            value={preferredLanguage}
            exclusive
            onChange={handleLanguageChange}
            size="small"
            sx={{
              height: 24,
              '& .MuiToggleButton-root': {
                fontSize: '0.7rem',
                px: 1,
                py: 0,
                textTransform: 'none',
                fontWeight: 600,
              },
            }}
          >
            {LANGUAGE_OPTIONS.map((item) => (
              <ToggleButton key={item.key} value={item.key}>
                {item.icon}
                {item.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>
      </Box>

      {/* 截图预览条 */}
      {currentImage && (
        <Box
          sx={{
            px: 2,
            py: 0.8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            bgcolor: 'action.hover',
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, overflow: 'hidden' }}>
            <Box
              component="img"
              src={imageSrc}
              alt="题目截图"
              sx={{
                width: 38,
                height: 24,
                objectFit: 'cover',
                borderRadius: 0.8,
                border: '1px solid',
                borderColor: 'divider',
              }}
            />
            <Typography variant="caption" color="text.secondary" noWrap sx={{ fontSize: '0.72rem' }}>
              {sliceCount > 1
                ? `已无缝拼合 ${sliceCount} 屏截图（保留完整表结构与题干）`
                : '截图已捕获并完成压缩（点击右侧可查看原图）'}
            </Typography>
          </Box>
          <Button
            size="small"
            variant="text"
            endIcon={showImageFull ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            onClick={() => setShowImageFull(!showImageFull)}
            sx={{ fontSize: '0.72rem', py: 0.2 }}
          >
            {showImageFull ? '收起原图' : '查看原图'}
          </Button>
        </Box>
      )}

      {/* 展开的原图 */}
      <Collapse in={showImageFull}>
        <Box
          sx={{
            p: 1.5,
            textAlign: 'center',
            bgcolor: 'background.default',
            borderBottom: '1px solid',
            borderColor: 'divider',
            maxHeight: 280,
            overflowY: 'auto',
          }}
        >
          <Box sx={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
            {isProcessing && <div className="scanline-laser" aria-hidden="true" />}
            <Box
              component="img"
              src={imageSrc}
              alt="题目原图"
              sx={{
                maxWidth: '100%',
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider',
              }}
            />
          </Box>
        </Box>
      </Collapse>

      {/* 错误提示 */}
      {error && !currentAnswer && (
        <Box sx={{ p: 1.5, bgcolor: 'error.main', color: 'error.contrastText', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
          <Typography variant="caption" sx={{ fontWeight: 600 }}>{error}</Typography>
          {error.includes('可用时长不足') && (
            <Button
              size="small"
              variant="contained"
              color="secondary"
              onClick={() => {
                closeFastModal();
                navigate('/billing');
              }}
              sx={{ fontSize: '0.72rem', py: 0.2, px: 1, flexShrink: 0, fontWeight: 700 }}
            >
              前往充值
            </Button>
          )}
        </Box>
      )}

      {/* 答案流式滚动区（带抗抢焦与手动翻页保护） */}
      <Box
        ref={scrollContainerRef}
        onScroll={handleAnswerScroll}
        sx={{
          position: 'relative',
          flexGrow: 1,
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          p: 2,
          minHeight: 200,
          maxHeight: 'calc(100vh - 300px)',
          fontSize: '0.88rem',
        }}
      >
        {currentAnswer ? (
          <>
            <MarkdownRenderer content={currentAnswer} />
            {isStreaming && <span className="cursor-blink" />}
          </>
        ) : isProcessing ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              py: 6,
              gap: 1.5,
              color: 'text.secondary',
            }}
          >
            <CircularProgress size={28} />
            <Typography variant="body2" fontWeight={600}>
              {sliceCount > 1
                ? '已拼合跨页长图，正在生成最优解答与步骤...'
                : '正在识别题目并生成最优解答与步骤...'}
            </Typography>
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
            尚未生成解答
          </Typography>
        )}

        {/* 用户向上滚动阅读代码时，若后台仍在流式出字，展示回到底部浮动胶囊 */}
        {userScrolledUp && isStreaming && (
          <Button
            size="small"
            variant="contained"
            color="primary"
            startIcon={<ArrowDownwardIcon sx={{ fontSize: 13 }} />}
            onClick={scrollToBottom}
            sx={{
              position: 'sticky',
              bottom: 8,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 10,
              fontSize: '0.72rem',
              py: 0.3,
              px: 1.5,
              borderRadius: 4,
              boxShadow: '0 4px 14px rgba(0,0,0,0.35)',
              textTransform: 'none',
              fontWeight: 700,
            }}
          >
            正在生成中，点击滚回最新
          </Button>
        )}
      </Box>

      <Divider />

      {/* 底部操作工具栏 */}
      <Box
        sx={{
          p: 1,
          px: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          bgcolor: 'background.default',
        }}
      >
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* 核心亮点：一键复制 SQL / 一键复制代码 */}
          {extractedCode && (
            <Button
              size="small"
              variant="contained"
              color={extractedCode.isSql ? 'primary' : 'secondary'}
              startIcon={
                codeCopied ? (
                  <CheckIcon fontSize="small" />
                ) : extractedCode.isSql ? (
                  <StorageIcon fontSize="small" />
                ) : (
                  <CodeIcon fontSize="small" />
                )
              }
              onClick={() => void handleCopyCode(extractedCode.code)}
              sx={{
                fontSize: '0.75rem',
                fontWeight: 800,
                bgcolor: codeCopied ? 'success.main' : undefined,
                '&:hover': {
                  bgcolor: codeCopied ? 'success.dark' : undefined,
                },
              }}
            >
              {codeCopied
                ? extractedCode.isSql
                  ? '✓ SQL 已复制'
                  : '✓ 代码已复制'
                : extractedCode.isSql
                ? '一键复制 SQL'
                : '一键复制代码'}
            </Button>
          )}

          {currentAnswer && <CopyButton text={currentAnswer} title="复制完整解答全文" />}
          {currentAnswer && !isStreaming && (
            <Button
              size="small"
              variant="contained"
              color="secondary"
              startIcon={<AddPhotoAlternateIcon />}
              onClick={() => {
                resetCaptures();
              }}
              sx={{ fontSize: '0.74rem', fontWeight: 700 }}
            >
              开启下一题 ({resetKeyHint})
            </Button>
          )}
          <Button
            size="small"
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => void solve()}
            disabled={isProcessing || !currentImage || !hasEnoughBalance}
            sx={{ fontSize: '0.75rem', fontWeight: 600 }}
          >
            {COMMERCIAL_MODE ? `重新解答 (${submitKeyHint} 扣5分)` : `重新解答 (${submitKeyHint})`}
          </Button>
        </Box>

        <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'primary.main', fontWeight: 600 }}>
          💡 防切屏监控：在考试窗口按 {appendKeyHint} 追加 / {submitKeyHint} 提交，鼠标无需移出！
        </Typography>
      </Box>
    </Paper>
  );
}
