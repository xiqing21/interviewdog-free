/**
 * QACard — Displays a single Q&A pair with markdown rendering,
 * copy button, regenerate, and question editing.
 */

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardActions,
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

      {/* Actions */}
      <CardActions sx={{ px: 2, pb: 1.5 }}>
        <CopyButton text={qa.answer} />
        <Button
          size="small"
          startIcon={<RefreshIcon />}
          onClick={() => regenerateAnswer(qa.id)}
        >
          重新生成
        </Button>
        <Button
          size="small"
          startIcon={<ShortTextIcon />}
          onClick={() => regenerateAnswer(qa.id, { mode: 'concise' })}
        >
          简洁
        </Button>
        <Button
          size="small"
          startIcon={<SubjectIcon />}
          onClick={() => regenerateAnswer(qa.id, { mode: 'detailed' })}
        >
          详细
        </Button>
        <Button
          size="small"
          startIcon={<AccountTreeIcon />}
          onClick={() => regenerateAnswer(qa.id, { mode: 'star' })}
        >
          STAR
        </Button>
        <Button
          size="small"
          startIcon={<AccountTreeIcon />}
          onClick={() => regenerateAnswer(qa.id, { mode: 'star-no-context' })}
        >
          清上下文STAR
        </Button>
        {qa.isStreaming && (
          <Button
            size="small"
            color="warning"
            startIcon={<StopCircleIcon />}
            onClick={stopGeneration}
          >
            停止
          </Button>
        )}
        {!editing && (
          <Button
            size="small"
            startIcon={<EditIcon />}
            onClick={handleStartEdit}
          >
            编辑问题
          </Button>
        )}
        <Button
          size="small"
          color="error"
          startIcon={<DeleteOutlineIcon />}
          onClick={() => deleteQuestion(qa.id)}
          sx={{ ml: 'auto' }}
        >
          删除
        </Button>
      </CardActions>
    </Card>
  );
}
