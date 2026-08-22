/**
 * QACard — Displays a single Q&A pair with markdown rendering,
 * copy button, regenerate, and question editing.
 */

import { useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  Link as MuiLink,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import StopCircleIcon from '@mui/icons-material/StopCircle';
import ShortTextIcon from '@mui/icons-material/ShortText';
import SubjectIcon from '@mui/icons-material/Subject';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import type { QAItem } from '../../types';
import { useInterview } from '../../hooks/useInterview';
import { MarkdownRenderer } from '../common/MarkdownRenderer';
import { CopyButton } from '../common/CopyButton';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

interface QACardProps {
  qa: QAItem;
}

export function QACard({ qa }: QACardProps) {
  const { regenerateAnswer, editQuestion, deleteQuestion, stopGeneration } = useInterview();
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(qa.question);

  const handleStartEdit = (): void => {
    setEditText(qa.question);
    setEditing(true);
  };

  const handleSaveEdit = (): void => {
    const trimmed = editText.trim();
    if (trimmed && trimmed !== qa.question) {
      editQuestion(qa.id, trimmed);
    }
    setEditing(false);
  };

  const handleCancelEdit = (): void => {
    setEditText(qa.question);
    setEditing(false);
  };

  return (
    <div className="fade-in mb-4 rounded-2xl border border-border/80 bg-card/90 p-5 text-card-foreground shadow-[0_20px_60px_rgba(15,23,42,0.10)] backdrop-blur">
        {/* Question */}
        <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
          <Typography color="primary" fontWeight={700} sx={{ flexShrink: 0 }}>
            Q:
          </Typography>
          {editing ? (
            <Box sx={{ flexGrow: 1 }}>
              <TextField
                fullWidth
                multiline
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                autoFocus
                size="small"
              />
              <Box sx={{ mt: 0.5, display: 'flex', gap: 1 }}>
                <Button size="sm" onClick={handleSaveEdit}>
                  保存并重新生成
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCancelEdit}
                >
                  取消
                </Button>
              </Box>
            </Box>
          ) : (
            <Typography sx={{ flexGrow: 1 }}>{qa.question}</Typography>
          )}
        </Box>

        <Box
          sx={{
            mb: 1.75,
            display: 'flex',
            flexDirection: 'column',
            gap: 0.75,
          }}
        >
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
            <Button
              size="sm"
              variant={qa.generationMode === 'normal' ? 'default' : 'outline'}
              onClick={() => regenerateAnswer(qa.id)}
            >
              <RefreshIcon fontSize="inherit" />
              重新生成
            </Button>
            <Button
              size="sm"
              variant={qa.generationMode === 'concise' ? 'default' : 'outline'}
              onClick={() => regenerateAnswer(qa.id, { mode: 'concise' })}
            >
              <ShortTextIcon fontSize="inherit" />
              简洁
            </Button>
            <Button
              size="sm"
              variant={qa.generationMode === 'detailed' ? 'default' : 'outline'}
              onClick={() => regenerateAnswer(qa.id, { mode: 'detailed' })}
            >
              <SubjectIcon fontSize="inherit" />
              详细
            </Button>
            <Button
              size="sm"
              variant={qa.generationMode === 'star' ? 'default' : 'outline'}
              onClick={() => regenerateAnswer(qa.id, { mode: 'star' })}
            >
              <AccountTreeIcon fontSize="inherit" />
              STAR
            </Button>
          </Box>
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', alignItems: 'center' }}>
            <Button
              size="sm"
              variant={qa.generationMode === 'no-context' ? 'secondary' : 'outline'}
              onClick={() => regenerateAnswer(qa.id, { mode: 'no-context' })}
            >
              <RefreshIcon fontSize="inherit" />
              清上下文
            </Button>
            <Button
              size="sm"
              variant={qa.generationMode === 'star-no-context' ? 'secondary' : 'outline'}
              onClick={() => regenerateAnswer(qa.id, { mode: 'star-no-context' })}
            >
              <AccountTreeIcon fontSize="inherit" />
              清上下文 STAR
            </Button>
            <CopyButton text={qa.answer} />
            {qa.isStreaming && (
              <Button
                size="sm"
                variant="outline"
                onClick={stopGeneration}
              >
                <StopCircleIcon fontSize="inherit" />
                停止
              </Button>
            )}
            {!editing && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleStartEdit}
              >
                <EditIcon fontSize="inherit" />
                编辑问题
              </Button>
            )}
            <Button
              size="sm"
              variant="destructive"
              onClick={() => deleteQuestion(qa.id)}
              className="sm:ml-auto"
            >
              <DeleteOutlineIcon fontSize="inherit" />
              删除
            </Button>
          </Box>
        </Box>

        {/* Answer */}
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Typography
            color="secondary"
            fontWeight={700}
            sx={{ flexShrink: 0 }}
          >
            A:
          </Typography>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            {qa.searchResults && qa.searchResults.length > 0 && (
              <Box
                sx={{
                  mb: 1.5,
                  p: 1.25,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  bgcolor: 'action.hover',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
                  <Badge variant="secondary">联网搜索参考</Badge>
                  <Typography variant="caption" color="text.secondary">
                    已和原答案一起综合生成
                  </Typography>
                </Box>
                {qa.searchResults.slice(0, 4).map((item) => (
                  <Box key={item.url} sx={{ mb: 0.75 }}>
                    <MuiLink href={item.url} target="_blank" rel="noreferrer" underline="hover" fontSize={13}>
                      {item.title}
                    </MuiLink>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      {item.snippet}
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}
            {qa.answer ? (
              <>
                <MarkdownRenderer content={qa.answer} />
                {qa.isStreaming && (
                  <span className="cursor-blink" />
                )}
              </>
            ) : qa.isStreaming ? (
              <Typography color="text.secondary" variant="body2">
                正在生成回答...
              </Typography>
            ) : null}
            {qa.error && (
              <Typography color="error" variant="body2" sx={{ mt: 0.75 }}>
                {qa.error}
              </Typography>
            )}
          </Box>
        </Box>
    </div>
  );
}
