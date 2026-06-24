/**
 * ExamTypeSelector — Renders exam type options as selectable chips.
 * Uses EXAM_TYPES configuration with custom colors.
 */

import { type ElementType } from 'react';
import { Box, Chip } from '@mui/material';
import CodeIcon from '@mui/icons-material/Code';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import BarChartIcon from '@mui/icons-material/BarChart';
import PsychologyIcon from '@mui/icons-material/Psychology';
import TranslateIcon from '@mui/icons-material/Translate';
import { EXAM_TYPES } from '../../constants';
import { useExam } from '../../hooks/useExam';

/** Maps icon name strings from EXAM_TYPES to actual icon components. */
const ICON_MAP: Record<string, ElementType> = {
  Code: CodeIcon,
  CheckCircle: CheckCircleIcon,
  BarChart: BarChartIcon,
  Psychology: PsychologyIcon,
  Translate: TranslateIcon,
};

export function ExamTypeSelector() {
  const { currentExamType, setExamType } = useExam();

  return (
    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
      {EXAM_TYPES.map((exam) => {
        const Icon = ICON_MAP[exam.icon];
        const selected = currentExamType === exam.key;
        return (
          <Chip
            key={exam.key}
            label={exam.label}
            icon={Icon ? <Icon /> : undefined}
            onClick={() => setExamType(exam.key)}
            variant={selected ? 'filled' : 'outlined'}
            sx={
              selected
                ? {
                    bgcolor: exam.color,
                    color: '#fff',
                    '& .MuiChip-icon': { color: '#fff' },
                    '&:hover': { bgcolor: exam.color },
                  }
                : {
                    borderColor: exam.color,
                    color: exam.color,
                    '& .MuiChip-icon': { color: exam.color },
                  }
            }
          />
        );
      })}
    </Box>
  );
}
