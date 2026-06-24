/**
 * Sidebar — Left navigation panel with logo, nav links, version, and theme toggle.
 */

import { type ElementType } from 'react';
import {
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  IconButton,
  Divider,
} from '@mui/material';
import { NavLink } from 'react-router-dom';
import RecordVoiceOverIcon from '@mui/icons-material/RecordVoiceOver';
import EditNoteIcon from '@mui/icons-material/EditNote';
import SettingsIcon from '@mui/icons-material/Settings';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import PetsIcon from '@mui/icons-material/Pets';
import { NAV_ITEMS } from '../../constants';
import { useTheme } from '../../hooks/useTheme';

/** Maps icon name strings from NAV_ITEMS to actual icon components. */
const ICON_MAP: Record<string, ElementType> = {
  RecordVoiceOver: RecordVoiceOverIcon,
  EditNote: EditNoteIcon,
  Settings: SettingsIcon,
};

export function Sidebar() {
  const { mode, toggleTheme } = useTheme();

  return (
    <Box
      sx={{
        width: 220,
        flexShrink: 0,
        borderRight: 1,
        borderColor: 'divider',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.paper',
      }}
    >
      {/* Logo / Title */}
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <PetsIcon color="primary" />
        <Typography variant="h6" fontWeight={700}>
          面试狗
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ ml: 'auto' }}
        >
          免费版
        </Typography>
      </Box>
      <Divider />

      {/* Navigation */}
      <List sx={{ flexGrow: 1, pt: 1 }}>
        {NAV_ITEMS.map((item) => {
          const Icon = ICON_MAP[item.icon];
          return (
            <NavLink
              key={item.path}
              to={item.path}
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              {({ isActive }) => (
                <ListItem disablePadding>
                  <ListItemButton selected={isActive}>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      {Icon && <Icon fontSize="small" />}
                    </ListItemIcon>
                    <ListItemText
                      primary={item.label}
                      primaryTypographyProps={{
                        fontSize: 14,
                        fontWeight: isActive ? 600 : 400,
                      }}
                    />
                  </ListItemButton>
                </ListItem>
              )}
            </NavLink>
          );
        })}
      </List>

      <Divider />

      {/* Footer: version + theme toggle */}
      <Box
        sx={{
          p: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Typography variant="caption" color="text.secondary">
          v1.0.0
        </Typography>
        <IconButton onClick={toggleTheme} size="small">
          {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
        </IconButton>
      </Box>
    </Box>
  );
}
