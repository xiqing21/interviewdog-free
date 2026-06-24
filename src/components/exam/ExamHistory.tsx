/**
 * ExamHistory — Scrollable list of past exam records with expand/collapse.
 * Shows thumbnail, exam type, answer summary, and clear button.
 */

import { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  IconButton,
  Collapse,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import RefreshIcon from '@mui/icons-material/Refresh';
import { EXAM_TYPES } from '../../constants';
import { useExam } from '../../hooks/useExam';
import { MarkdownRenderer } from '../common/MarkdownRenderer';
import { CopyButton } from '../common/CopyButton';

export function ExamHistory() {
  const { records, clearHistory, regenerate, isProcessing } = useExam();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (records.length === 0) {
    return null;
  }

  const toggleExpand = (id: string): void => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <Box sx={{ mt: 3 }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 1,
        }}
      >
        <Typography variant="subtitle2" color="text.secondary">
          历史记录 ({records.length})
        </Typography>
        <Button size="small" color="error" onClick={clearHistory}>
          清空
        </Button>
      </Box>

      {records.map((record) => {
        const examConfig = EXAM_TYPES.find((e) => e.key === record.examType);
        const expanded = expandedId === record.id;
        const summary =
          record.answer.length > 100
            ? `${record.answer.slice(0, 100)}...`
            : record.answer || '（空）';

        return (
          <Card key={record.id} sx={{ mb: 1 }} variant="outlined">
            <CardContent
              sx={{
                display: 'flex',
                gap: 1.5,
                alignItems: 'center',
                py: 1.5,
                '&:last-child': { pb: 1.5 },
              }}
            >
              {/* Thumbnail */}
              <Box
                component="img"
                src={`data:image/png;base64,${record.imageBase64}`}
                alt="题目截图"
                sx={{
                  width: 48,
                  height: 48,
                  objectFit: 'cover',
                  borderRadius: 1,
                  flexShrink: 0,
                }}
              />

              {/* Summary */}
              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <Box
                    sx={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      bgcolor: examConfig?.color ?? '#999',
                    }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {examConfig?.label ?? '未知题型'}
                  </Typography>
                </Box>
                <Typography
                  variant="body2"
                  sx={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {summary}
                </Typography>
              </Box>

              {/* Expand toggle */}
              <IconButton size="small" onClick={() => toggleExpand(record.id)}>
                {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            </CardContent>

            {/* Expanded content */}
            <Collapse in={expanded}>
              <CardContent sx={{ pt: 0 }}>
                <Box
                  component="img"
                  src={`data:image/png;base64,${record.imageBase64}`}
                  alt="题目截图"
                  sx={{
                    maxWidth: '100%',
                    maxHeight: 300,
                    borderRadius: 1,
                    mb: 1.5,
                  }}
                />
                {record.answer ? (
                  <>
                    <MarkdownRenderer content={record.answer} />
                    {record.isStreaming && (
                      <span className="cursor-blink" />
                    )}
                  </>
                ) : record.isStreaming ? (
                  <Typography color="text.secondary" variant="body2">
                    正在生成解答...
                  </Typography>
                ) : null}
                {record.error && (
                  <Typography color="error" variant="body2" sx={{ mt: 0.5 }}>
                    {record.error}
                  </Typography>
                )}
                <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
                  <CopyButton text={record.answer} />
                  <Button
                    size="small"
                    startIcon={<RefreshIcon />}
                    onClick={() => void regenerate(record.id)}
                    disabled={isProcessing}
                  >
                    重新生成
                  </Button>
                </Box>
              </CardContent>
            </Collapse>
          </Card>
        );
      })}
    </Box>
  );
}
