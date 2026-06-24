/**
 * ResumeJDSettings — 简历 & JD 上传/编辑组件
 * 支持上传 PDF 简历和粘贴 JD 文本，实时注入到面试 AI 上下文
 */

import { useState, useCallback } from 'react';
import { Paper, Typography, TextField, Button, Box, Alert, CircularProgress } from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { useSession } from '../../hooks/useSession';
import { parsePdf, isPdfFile, MAX_PDF_SIZE } from '../../services/pdfParserService';

export function ResumeJDSettings() {
  const { resume, jd, setResume, setJD } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleResumeUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    if (!isPdfFile(file)) {
      setError('仅支持 PDF 格式的简历文件。');
      return;
    }
    if (file.size > MAX_PDF_SIZE) {
      setError(`文件过大，最大支持 ${MAX_PDF_SIZE / 1024 / 1024}MB。`);
      return;
    }

    setLoading(true);
    try {
      const text = await parsePdf(file);
      setResume(text);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PDF 解析失败');
    } finally {
      setLoading(false);
    }
  }, [setResume]);

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>简历 & 岗位匹配</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        上传简历和岗位描述（JD），AI 将根据你的背景和应聘岗位给出更有针对性的回答。
        简历会被注入到每次 AI 调用的上下文中。
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}

      {/* 简历 */}
      <Typography variant="subtitle2" gutterBottom>简历（上传 PDF）</Typography>
      <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
        <Button variant="outlined" component="label" startIcon={<UploadFileIcon />} disabled={loading}>
          {loading ? <CircularProgress size={20} /> : '上传 PDF 简历'}
          <input type="file" accept=".pdf" hidden onChange={handleResumeUpload} />
        </Button>
      </Box>
      <TextField
        fullWidth multiline minRows={4} maxRows={12}
        label="简历文本" value={resume}
        onChange={(e) => setResume(e.target.value)}
        placeholder="上传 PDF 后自动解析，也可以手动粘贴简历内容..."
        sx={{ mb: 2 }}
      />

      {/* JD */}
      <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>岗位描述（JD）</Typography>
      <TextField
        fullWidth multiline minRows={3} maxRows={10}
        label="JD 文本" value={jd}
        onChange={(e) => setJD(e.target.value)}
        placeholder="粘贴目标岗位的职位描述..."
      />
    </Paper>
  );
}
