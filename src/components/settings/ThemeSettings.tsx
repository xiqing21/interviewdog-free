import {
  Box,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Typography,
  type SelectChangeEvent,
} from '@mui/material';
import { THEME_OPTIONS } from '../../constants';
import type { ThemeMode } from '../../types';
import { useTheme } from '../../hooks/useTheme';

export function ThemeSettings() {
  const { mode, setTheme } = useTheme();
  const selected = THEME_OPTIONS.find((item) => item.key === mode);

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>界面主题</Typography>
      <Box sx={{ display: 'grid', gap: 1.5 }}>
        <FormControl fullWidth>
          <InputLabel>主题</InputLabel>
          <Select
            label="主题"
            value={mode}
            onChange={(event: SelectChangeEvent) => setTheme(event.target.value as ThemeMode)}
          >
            {THEME_OPTIONS.map((item) => (
              <MenuItem key={item.key} value={item.key}>{item.label}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <Typography variant="body2" color="text.secondary">
          {selected?.desc ?? '选择适合当前面试环境的界面风格。'}
        </Typography>
      </Box>
    </Paper>
  );
}
