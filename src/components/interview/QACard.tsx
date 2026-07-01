/**
 * QACard — Displays a single Q&A pair with markdown rendering,
 * copy button, regenerate, and question editing.
 */

import { useState } from 'react';
import {
  Card,
  CardContent,
  Box,
  Typography,
  TextField,
  Button,
  Chip,
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
    <Card className="fade-in" sx={{ mb: 2 }}>
      <CardContent>
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
                <Button size="small" onClick={handleSaveEdit} color="primary">
                  保存并重新生成
                </Button>
                <Button
                  size="small"
                  onClick={handleCancelEdit}
                  color="inherit"
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
              size="small"
              variant={qa.generationMode === 'normal' ? 'contained' : 'outlined'}
              startIcon={<RefreshIcon />}
              onClick={() => regenerateAnswer(qa.id)}
            >
              重新生成
            </Button>
            <Button
              size="small"
              variant={qa.generationMode === 'concise' ? 'contained' : 'outlined'}
              startIcon={<ShortTextIcon />}
              onClick={() => regenerateAnswer(qa.id, { mode: 'concise' })}
            >
              简洁
            </Button>
            <Button
              size="small"
              variant={qa.generationMode === 'detailed' ? 'contained' : 'outlined'}
              startIcon={<SubjectIcon />}
              onClick={() => regenerateAnswer(qa.id, { mode: 'detailed' })}
            >
              详细
            </Button>
            <Button
              size="small"
              variant={qa.generationMode === 'star' ? 'contained' : 'outlined'}
              startIcon={<AccountTreeIcon />}
              onClick={() => regenerateAnswer(qa.id, { mode: 'star' })}
            >
              STAR
            </Button>
          </Box>
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', alignItems: 'center' }}>
            <Button
              size="small"
              variant={qa.generationMode === 'no-context' ? 'contained' : 'outlined'}
              color="secondary"
              startIcon={<RefreshIcon />}
              onClick={() => regenerateAnswer(qa.id, { mode: 'no-context' })}
            >
              清上下文
            </Button>
            <Button
              size="small"
              variant={qa.generationMode === 'star-no-context' ? 'contained' : 'outlined'}
              color="secondary"
              startIcon={<AccountTreeIcon />}
              onClick={() => regenerateAnswer(qa.id, { mode: 'star-no-context' })}
            >
              清上下文 STAR
            </Button>
            <CopyButton text={qa.answer} />
            {qa.isStreaming && (
              <Button
                size="small"
                color="warning"
                variant="outlined"
                startIcon={<StopCircleIcon />}
                onClick={stopGeneration}
              >
                停止
              </Button>
            )}
            {!editing && (
              <Button
                size="small"
                variant="outlined"
                startIcon={<EditIcon />}
                onClick={handleStartEdit}
              >
                编辑问题
              </Button>
            )}
            <Button
              size="small"
              color="error"
              variant="outlined"
              startIcon={<DeleteOutlineIcon />}
              onClick={() => deleteQuestion(qa.id)}
              sx={{ ml: { sm: 'auto' } }}
            >
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
                  <Chip size="small" color="info" label="联网搜索参考" />
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
              <Typography color="error" variant="body2" sx={{ mt: 0.5 }}>
                {qa.error}
              </Typography>
            )}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}
