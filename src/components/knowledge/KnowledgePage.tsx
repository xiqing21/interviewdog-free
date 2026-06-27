import { useState, type ChangeEvent } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import SaveIcon from '@mui/icons-material/Save';
import { useKnowledge } from '../../hooks/useKnowledge';
import { isPdfFile, MAX_PDF_SIZE, parsePdf } from '../../services/pdfParserService';

export function KnowledgePage() {
  const {
    profile,
    syncError,
    addResume,
    updateResume,
    deleteResume,
    setExpertKnowledge,
  } = useKnowledge();
  const [resumeName, setResumeName] = useState('');
  const [resumeText, setResumeText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    if (!isPdfFile(file)) {
      setError('仅支持 PDF 简历。');
      return;
    }
    if (file.size > MAX_PDF_SIZE) {
      setError(`文件过大，最大支持 ${MAX_PDF_SIZE / 1024 / 1024}MB。`);
      return;
    }

    setLoading(true);
    try {
      const text = await parsePdf(file);
      setResumeName(file.name.replace(/\\.pdf$/i, ''));
      setResumeText(text);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PDF 解析失败');
    } finally {
      setLoading(false);
      event.target.value = '';
    }
  };

  const handleAddResume = () => {
    addResume(resumeName, resumeText);
    setResumeName('');
    setResumeText('');
  };

  return (
    <Box sx={{ maxWidth: 980, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <Box>
        <Typography variant="h5" fontWeight={800}>简历与专家知识库</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          这里的内容会注入到每次面试 AI 回答上下文；登录后会同步到 Supabase，换设备可继续使用。
        </Typography>
      </Box>

      {syncError && <Alert severity="warning">Supabase 同步暂时失败：{syncError}</Alert>}
      {error && <Alert severity="error">{error}</Alert>}

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>新增简历</Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
          <Button variant="outlined" component="label" startIcon={<UploadFileIcon />} disabled={loading}>
            {loading ? '解析中...' : '上传 PDF 简历'}
            <input type="file" hidden accept=".pdf" onChange={handleUpload} />
          </Button>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            disabled={!resumeText.trim()}
            onClick={handleAddResume}
          >
            保存到简历库
          </Button>
        </Box>
        <TextField
          fullWidth
          label="简历名称"
          value={resumeName}
          onChange={(event) => setResumeName(event.target.value)}
          placeholder="例如：大数据开发简历 / Web3 后端简历"
          sx={{ mb: 2 }}
        />
        <TextField
          fullWidth
          multiline
          minRows={5}
          maxRows={14}
          label="简历内容"
          value={resumeText}
          onChange={(event) => setResumeText(event.target.value)}
          placeholder="上传 PDF 自动解析，或直接粘贴简历文本..."
        />
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>简历库</Typography>
        {profile.resumes.length === 0 ? (
          <Typography variant="body2" color="text.secondary">还没有保存简历。</Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {profile.resumes.map((resume) => (
              <Box key={resume.id} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 2 }}>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
                  <TextField
                    size="small"
                    label="名称"
                    value={resume.name}
                    onChange={(event) => updateResume(resume.id, { name: event.target.value })}
                    sx={{ flexGrow: 1 }}
                  />
                  <Chip size="small" label={`${resume.content.length} 字`} />
                  <IconButton color="error" onClick={() => deleteResume(resume.id)} aria-label="删除简历">
                    <DeleteOutlineIcon />
                  </IconButton>
                </Box>
                <TextField
                  fullWidth
                  multiline
                  minRows={4}
                  maxRows={10}
                  value={resume.content}
                  onChange={(event) => updateResume(resume.id, { content: event.target.value })}
                />
              </Box>
            ))}
          </Box>
        )}
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>专家知识库</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          可以放项目亮点、技术栈总结、常见追问、行业知识、个人话术。AI 回答时会优先结合这些内容。
        </Typography>
        <TextField
          fullWidth
          multiline
          minRows={10}
          maxRows={24}
          label="专家知识库"
          value={profile.expertKnowledge}
          onChange={(event) => setExpertKnowledge(event.target.value)}
          placeholder="例如：Flink CDC -> Fluss -> Paimon -> StarRocks 链路经验；电力大数据指标体系；Web3 项目安全经验..."
        />
      </Paper>

      <Divider />
    </Box>
  );
}
