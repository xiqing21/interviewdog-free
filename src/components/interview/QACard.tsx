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
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import type { QAItem } from '../../types';
import { useInterview } from '../../hooks/useInterview';
import { MarkdownRenderer } from '../common/MarkdownRenderer';
import { CopyButton } from '../common/CopyButton';

interface QACardProps {
  qa: QAItem;
}

export function QACard({ qa }: QACardProps) {
  const { regenerateAnswer, editQuestion, deleteQuestion, isProcessing } = useInterview();
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
          disabled={isProcessing}
        >
          重新生成
        </Button>
        {!editing && (
          <Button
            size="small"
            startIcon={<EditIcon />}
            onClick={handleStartEdit}
            disabled={isProcessing}
          >
            编辑问题
          </Button>
        )}
        <Button
          size="small"
          color="error"
          startIcon={<DeleteOutlineIcon />}
          onClick={() => deleteQuestion(qa.id)}
          disabled={isProcessing}
          sx={{ ml: 'auto' }}
        >
          删除
        </Button>
      </CardActions>
    </Card>
  );
}
