/**
 * Sidebar — Left navigation panel with logo, nav links, version, and theme toggle.
 */

import { useEffect, useState, type ElementType } from 'react';
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
import LibraryBooksIcon from '@mui/icons-material/LibraryBooks';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { NAV_ITEMS } from '../../constants';
import { COMMERCIAL_MODE } from '../../config/commercial';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../hooks/useAuth';
import { adminRequest } from '../../services/adminService';

/** Maps icon name strings from NAV_ITEMS to actual icon components. */
const ICON_MAP: Record<string, ElementType> = {
  RecordVoiceOver: RecordVoiceOverIcon,
  EditNote: EditNoteIcon,
  LibraryBooks: LibraryBooksIcon,
  WorkspacePremium: WorkspacePremiumIcon,
  AdminPanelSettings: AdminPanelSettingsIcon,
  Settings: SettingsIcon,
};

export function Sidebar() {
  const { mode, toggleTheme } = useTheme();
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const width = collapsed ? 72 : 220;

  useEffect(() => {
    let mounted = true;
    if (!user) {
      setIsAdmin(false);
      return;
    }
    adminRequest<{ admin: boolean }>('me')
      .then((result) => {
        if (mounted) setIsAdmin(Boolean(result.admin));
      })
      .catch(() => {
        if (mounted) setIsAdmin(false);
      });
    return () => {
      mounted = false;
    };
  }, [user]);

  return (
    <Box
      sx={{
        width,
        flexShrink: 0,
        borderRight: 1,
        borderColor: 'divider',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.paper',
        transition: 'width 160ms ease',
      }}
    >
      {/* Logo / Title */}
      <Box sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box component="img" src="/logo.svg" alt="面试猪" sx={{ width: 30, height: 30, flexShrink: 0 }} />
        {!collapsed && (
          <>
            <Typography variant="h6" fontWeight={700}>
              面试猪
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ ml: 'auto' }}
            >
              {COMMERCIAL_MODE ? 'Pro' : '免费版'}
            </Typography>
          </>
        )}
      </Box>
      <Divider />

      <Box sx={{ p: 1, display: 'flex', justifyContent: collapsed ? 'center' : 'flex-end' }}>
        <IconButton
          size="small"
          onClick={() => setCollapsed((value) => !value)}
          aria-label={collapsed ? '展开侧栏' : '收起侧栏'}
        >
          {collapsed ? <ChevronRightIcon fontSize="small" /> : <ChevronLeftIcon fontSize="small" />}
        </IconButton>
      </Box>

      {/* Navigation */}
      <List sx={{ flexGrow: 1, pt: 0 }}>
        {NAV_ITEMS.filter((item) => !('adminOnly' in item) || isAdmin).map((item) => {
          const Icon = ICON_MAP[item.icon];
          return (
            <NavLink
              key={item.path}
              to={item.path}
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              {({ isActive }) => (
                <ListItem disablePadding>
                  <ListItemButton selected={isActive} sx={{ justifyContent: collapsed ? 'center' : 'flex-start', px: collapsed ? 1 : 2 }}>
                    <ListItemIcon sx={{ minWidth: collapsed ? 0 : 36, color: 'inherit' }}>
                      {Icon && <Icon fontSize="small" />}
                    </ListItemIcon>
                    {!collapsed && (
                      <ListItemText
                        primary={item.label}
                        primaryTypographyProps={{
                          fontSize: 14,
                          fontWeight: isActive ? 600 : 400,
                        }}
                      />
                    )}
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
          justifyContent: collapsed ? 'center' : 'space-between',
        }}
      >
        {!collapsed && (
          <Typography variant="caption" color="text.secondary">
            v1.0.0
          </Typography>
        )}
        <IconButton onClick={toggleTheme} size="small">
          {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
        </IconButton>
      </Box>
    </Box>
  );
}
