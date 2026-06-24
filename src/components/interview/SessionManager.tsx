/**
 * SessionManager — 面试项目管理组件
 * 创建/切换/删除面试 Session，展示当前项目名和 Q&A 数量
 */

import { useState, useCallback } from 'react';
import {
  Paper, Typography, TextField, IconButton, Button,
  Menu, MenuItem, ListItemIcon, ListItemText, Box,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import { useSession } from '../../hooks/useSession';

export function SessionManager() {
  const { activeSession, sessionSummaries, createSession, switchSession, deleteSession, updateSessionName } = useSession();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const handleCreate = useCallback(() => {
    if (newName.trim()) {
      createSession(newName.trim());
      setNewName('');
    } else {
      createSession('');
    }
  }, [newName, createSession]);

  const handleSwitch = useCallback((id: string) => {
    switchSession(id);
    setAnchorEl(null);
  }, [switchSession]);

  return (
    <Paper sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
      <FolderOpenIcon color="primary" fontSize="small" />
      {editingId ? (
        <TextField
          size="small"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onBlur={() => { if (editName.trim()) updateSessionName(editingId, editName.trim()); setEditingId(null); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { if (editName.trim()) updateSessionName(editingId, editName.trim()); setEditingId(null); } }}
          autoFocus
          sx={{ minWidth: 150 }}
        />
      ) : (
        <Typography
          variant="body2"
          fontWeight={600}
          sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
          onClick={(e) => {
            if (activeSession) {
              setEditName(activeSession.name);
              setEditingId(activeSession.id);
            }
            setAnchorEl(e.currentTarget);
          }}
        >
          {activeSession ? `${activeSession.name} (${activeSession.qaList.length} 轮)` : '无面试项目'}
        </Typography>
      )}

      <Box sx={{ flex: 1 }} />

      <Button
        size="small"
        variant="outlined"
        onClick={(e) => setAnchorEl(e.currentTarget)}
        startIcon={<FolderOpenIcon />}
      >
        切换项目
      </Button>

      <TextField
        size="small"
        placeholder="新项目名称"
        value={newName}
        onChange={(e) => setNewName(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
        sx={{ width: 160 }}
        inputProps={{ style: { fontSize: '0.8rem' } }}
      />
      <IconButton size="small" color="primary" onClick={handleCreate}>
        <AddIcon />
      </IconButton>

      {/* 下拉菜单 */}
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        {sessionSummaries.length === 0 ? (
          <MenuItem disabled><Typography variant="body2" color="text.secondary">暂无项目</Typography></MenuItem>
        ) : (
          sessionSummaries.map((s) => (
            <MenuItem
              key={s.id}
              selected={s.id === activeSession?.id}
              onClick={() => handleSwitch(s.id)}
            >
              <ListItemIcon>
                <EditIcon
                  fontSize="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditName(s.name);
                    setEditingId(s.id);
                    setAnchorEl(null);
                  }}
                  sx={{ cursor: 'pointer' }}
                />
              </ListItemIcon>
              <ListItemText
                primary={s.name}
                secondary={`${s.qaCount} 轮问答 · ${new Date(s.createdAt).toLocaleDateString('zh-CN')}`}
              />
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteSession(s.id);
                  setAnchorEl(null);
                }}
                sx={{ ml: 1 }}
              >
                <DeleteIcon fontSize="small" color="error" />
              </IconButton>
            </MenuItem>
          ))
        )}
      </Menu>
    </Paper>
  );
}
