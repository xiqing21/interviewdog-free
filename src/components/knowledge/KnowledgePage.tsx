import { useState, type ChangeEvent } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
  type SelectChangeEvent,
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import SaveIcon from '@mui/icons-material/Save';
import LinkIcon from '@mui/icons-material/Link';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { useKnowledge } from '../../hooks/useKnowledge';
import { isPdfFile, MAX_PDF_SIZE, parsePdf } from '../../services/pdfParserService';
import type { KnowledgeLibraryItem, KnowledgeQAPair, KnowledgeSourceType } from '../../types';

const KNOWLEDGE_TYPE_OPTIONS: Array<{ key: KnowledgeSourceType; label: string; desc: string }> = [
  { key: 'qa', label: 'QA 模式', desc: '适合常见问答、项目追问，命中问题时优先引用。' },
  { key: 'document', label: '文档模式', desc: '适合较长技术文档、项目复盘、架构说明。' },
  { key: 'text', label: '文本粘贴', desc: '适合临时话术、技术点、业务背景。' },
  { key: 'webpage', label: '网页读取', desc: '输入 URL 读取网页正文并保存。' },
];

export function KnowledgePage() {
  const {
    profile,
    syncError,
    addResume,
    updateResume,
    deleteResume,
    addKnowledgeItem,
    updateKnowledgeItem,
    deleteKnowledgeItem,
    setExpertKnowledge,
  } = useKnowledge();
  const [resumeName, setResumeName] = useState('');
  const [resumeText, setResumeText] = useState('');
  const [knowledgeName, setKnowledgeName] = useState('');
  const [knowledgeText, setKnowledgeText] = useState('');
  const [knowledgeType, setKnowledgeType] = useState<KnowledgeSourceType>('text');
  const [sourceUrl, setSourceUrl] = useState('');
  const [previewItem, setPreviewItem] = useState<KnowledgeLibraryItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [readingUrl, setReadingUrl] = useState(false);
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
      setResumeName(file.name.replace(/\.pdf$/i, ''));
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

  const handleReadUrl = async () => {
    setError(null);
    setReadingUrl(true);
    try {
      const response = await fetch('/api/read-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: sourceUrl }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || `网页读取失败：${response.status}`);
      setKnowledgeText(data.text || '');
      setKnowledgeName((current) => current || new URL(sourceUrl.startsWith('http') ? sourceUrl : `https://${sourceUrl}`).hostname);
    } catch (err) {
      setError(err instanceof Error ? err.message : '网页读取失败');
    } finally {
      setReadingUrl(false);
    }
  };

  const handleAddKnowledge = () => {
    const qaPairs = knowledgeType === 'qa' ? parseQAPairs(knowledgeText) : [];
    addKnowledgeItem(knowledgeName, knowledgeText, {
      type: knowledgeType,
      sourceUrl: knowledgeType === 'webpage' ? sourceUrl.trim() : undefined,
      qaPairs,
    });
    setKnowledgeName('');
    setKnowledgeText('');
    setSourceUrl('');
    setKnowledgeType('text');
    if (profile.expertKnowledge) setExpertKnowledge('');
  };

  return (
    <Box sx={{ maxWidth: 1080, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <Box>
        <Typography variant="h5" fontWeight={800}>简历与专家知识库</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          这里的内容会注入到面试回答上下文；登录后会同步到 Supabase，换设备可继续使用。
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
          <Button variant="contained" startIcon={<SaveIcon />} disabled={!resumeText.trim()} onClick={handleAddResume}>
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
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.5 }}>
            {profile.resumes.map((resume) => (
              <Paper key={resume.id} variant="outlined" sx={{ p: 2 }}>
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
                <Typography variant="body2" color="text.secondary" sx={{ minHeight: 44 }}>
                  {resume.content.slice(0, 120)}{resume.content.length > 120 ? '...' : ''}
                </Typography>
              </Paper>
            ))}
          </Box>
        )}
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>新增专家知识库</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          支持 QA、文档、手动文本和网页读取。创建面试项目时可按卡片多选挂载，不会再揉成一个大文本框。
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '220px 1fr' }, gap: 2, mb: 2 }}>
          <FormControl>
            <InputLabel>知识类型</InputLabel>
            <Select
              label="知识类型"
              value={knowledgeType}
              onChange={(event: SelectChangeEvent) => setKnowledgeType(event.target.value as KnowledgeSourceType)}
            >
              {KNOWLEDGE_TYPE_OPTIONS.map((option) => (
                <MenuItem key={option.key} value={option.key}>{option.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            fullWidth
            label="知识库名称"
            value={knowledgeName}
            onChange={(event) => setKnowledgeName(event.target.value)}
            placeholder="例如：Flink 实时数仓 / Web3 合约安全 / 电力业务指标"
          />
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          {KNOWLEDGE_TYPE_OPTIONS.find((item) => item.key === knowledgeType)?.desc}
        </Typography>
        {knowledgeType === 'webpage' && (
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <TextField
              fullWidth
              label="网页 URL"
              value={sourceUrl}
              onChange={(event) => setSourceUrl(event.target.value)}
              placeholder="https://example.com/article"
            />
            <Button variant="outlined" startIcon={<LinkIcon />} disabled={readingUrl || !sourceUrl.trim()} onClick={handleReadUrl}>
              {readingUrl ? '读取中' : '读取'}
            </Button>
          </Box>
        )}
        <TextField
          fullWidth
          multiline
          minRows={6}
          maxRows={16}
          label={knowledgeType === 'qa' ? 'QA 内容' : '知识库内容'}
          value={knowledgeText}
          onChange={(event) => setKnowledgeText(event.target.value)}
          placeholder={knowledgeType === 'qa'
            ? '示例：\nQ: 为什么选择 Fluss？\nA: 我当时考虑的是...\n\nQ: Flink Watermark 怎么设计？\nA: ...'
            : '粘贴项目亮点、技术文档、业务背景、常见追问、个人话术...'}
        />
        {knowledgeType === 'qa' && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            已解析 {parseQAPairs(knowledgeText).length} 组 QA；回答时会按面试官问题做轻量匹配，命中后优先引用。
          </Typography>
        )}
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          disabled={!knowledgeText.trim()}
          onClick={handleAddKnowledge}
          sx={{ mt: 2 }}
        >
          保存到专家库
        </Button>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>专家库</Typography>
        {profile.expertKnowledgeItems.length === 0 ? (
          <Typography variant="body2" color="text.secondary">还没有保存专家知识库。</Typography>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.5 }}>
            {profile.expertKnowledgeItems.map((item) => (
              <KnowledgeCard
                key={item.id}
                item={item}
                onPreview={() => setPreviewItem(item)}
                onDelete={() => deleteKnowledgeItem(item.id)}
                onUpdate={(patch) => updateKnowledgeItem(item.id, patch)}
              />
            ))}
          </Box>
        )}
      </Paper>

      <Dialog open={Boolean(previewItem)} onClose={() => setPreviewItem(null)} maxWidth="md" fullWidth>
        <DialogTitle>{previewItem?.name}</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
            <Chip size="small" label={typeLabel(previewItem?.type)} />
            <Chip size="small" label={`${previewItem?.content.length ?? 0} 字`} />
            {previewItem?.sourceUrl && <Chip size="small" label={previewItem.sourceUrl} />}
          </Box>
          {previewItem && (
            <>
              <TextField
                fullWidth
                multiline
                minRows={8}
                maxRows={18}
                label="完整内容"
                value={previewItem.content}
                onChange={(event) => {
                  const content = event.target.value;
                  const qaPairs = previewItem.type === 'qa' ? parseQAPairs(content) : previewItem.qaPairs;
                  updateKnowledgeItem(previewItem.id, { content, qaPairs });
                  setPreviewItem({ ...previewItem, content, qaPairs });
                }}
              />
              {previewItem.qaPairs?.length ? (
                <Box sx={{ display: 'grid', gap: 1.5, mt: 2 }}>
                  {previewItem.qaPairs.map((pair) => (
                    <Paper key={pair.id} variant="outlined" sx={{ p: 1.5 }}>
                      <Typography fontWeight={800}>Q: {pair.question}</Typography>
                      <Typography sx={{ mt: 0.75, whiteSpace: 'pre-wrap' }}>A: {pair.answer}</Typography>
                    </Paper>
                  ))}
                </Box>
              ) : null}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewItem(null)}>关闭</Button>
        </DialogActions>
      </Dialog>

      <Divider />
    </Box>
  );
}

function KnowledgeCard({
  item,
  onPreview,
  onDelete,
  onUpdate,
}: {
  item: KnowledgeLibraryItem;
  onPreview: () => void;
  onDelete: () => void;
  onUpdate: (patch: Partial<Pick<KnowledgeLibraryItem, 'name' | 'content' | 'type' | 'qaPairs'>>) => void;
}) {
  const qaCount = item.qaPairs?.length ?? 0;
  return (
    <Paper variant="outlined" sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        <TextField
          size="small"
          label="名称"
          value={item.name}
          onChange={(event) => onUpdate({ name: event.target.value })}
          sx={{ flexGrow: 1 }}
        />
        <IconButton onClick={onPreview} aria-label="预览知识库">
          <VisibilityIcon />
        </IconButton>
        <IconButton color="error" onClick={onDelete} aria-label="删除专家知识库">
          <DeleteOutlineIcon />
        </IconButton>
      </Box>
      <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
        <Chip size="small" label={typeLabel(item.type)} />
        <Chip size="small" label={`${item.content.length.toLocaleString('zh-CN')} 字`} />
        {qaCount > 0 && <Chip size="small" color="primary" label={`${qaCount} 组 QA`} />}
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ minHeight: 58 }}>
        {item.content.slice(0, 150)}{item.content.length > 150 ? '...' : ''}
      </Typography>
    </Paper>
  );
}

function typeLabel(type?: KnowledgeSourceType): string {
  return KNOWLEDGE_TYPE_OPTIONS.find((item) => item.key === type)?.label ?? '文档模式';
}

function parseQAPairs(text: string): KnowledgeQAPair[] {
  const pairs: KnowledgeQAPair[] = [];
  const regex = /(?:^|\n)\s*(?:Q|问题|问)\s*[:：]\s*([\s\S]*?)(?=\n\s*(?:A|答案|答)\s*[:：])\n\s*(?:A|答案|答)\s*[:：]\s*([\s\S]*?)(?=\n\s*(?:Q|问题|问)\s*[:：]|$)/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const question = (match[1] ?? '').trim();
    const answer = (match[2] ?? '').trim();
    if (question && answer) {
      pairs.push({ id: `${pairs.length + 1}`, question, answer });
    }
  }
  return pairs;
}
