import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemText,
  Typography,
} from '@mui/material';
import { useLocation } from 'react-router-dom';

const GUIDE_KEY_PREFIX = 'mianshizhu_guide_seen:';

const GUIDES: Record<string, { title: string; subtitle: string; steps: string[] }> = {
  interview: {
    title: '开始一场实时面试',
    subtitle: '建议先用 1-2 分钟试跑，确认能听到会议声音。',
    steps: [
      '点击开始面试后，按浏览器提示选择正在面试的窗口或标签页，并勾选共享音频。',
      '系统会优先识别面试官的问题；如果自动判断不准，可以在右侧用“当前/最近问题触发”。',
      '答案上方可以随时重新生成，支持简洁、详细、STAR、清上下文等模式。',
      '面试结束后点击归档，再生成复盘，总结表现亮点和风险点。',
    ],
  },
  knowledge: {
    title: '让回答更像你本人',
    subtitle: '简历和知识库越清晰，答案越贴近真实经历。',
    steps: [
      '先上传或粘贴简历，后续新建项目时可以直接勾选引用。',
      '知识库可以保存 QA、文档、文本或网页内容，适合放项目细节和八股模板。',
      'QA 类型知识库会在问题相似时优先命中，适合准备高频题。',
    ],
  },
  billing: {
    title: '试用与购买时长',
    subtitle: '新账号先送 15 分钟，适合快速验证效果。',
    steps: [
      '真实面试通常 30-60 分钟，建议提前购买足够时长，避免中途额度不足。',
      '购买后时长会同步到账号，换设备登录也能继续使用。',
      '月卡适合集中求职期，多岗位、多轮面试复盘会更划算。',
    ],
  },
  settings: {
    title: '个性化识别体验',
    subtitle: '商业版不用配置模型，只需要维护你的偏好。',
    steps: [
      '添加专业热词，例如 Fluss、StarRocks、项目名或公司名。',
      '如果面试官说话经常停顿，可以把问题结束判定调得更稳一点。',
      '主题可以按使用环境切换，夜间面试建议用深色工作台。',
    ],
  },
};

export function OnboardingGuide() {
  const location = useLocation();
  const guideId = useMemo(() => {
    if (location.pathname.startsWith('/knowledge')) return 'knowledge';
    if (location.pathname.startsWith('/billing')) return 'billing';
    if (location.pathname.startsWith('/settings')) return 'settings';
    return 'interview';
  }, [location.pathname]);
  const guide = GUIDES[guideId];
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const key = `${GUIDE_KEY_PREFIX}${guideId}`;
    setOpen(localStorage.getItem(key) !== '1');
  }, [guideId]);

  const close = () => {
    localStorage.setItem(`${GUIDE_KEY_PREFIX}${guideId}`, '1');
    setOpen(false);
  };

  return (
    <Dialog open={open} onClose={close} maxWidth="sm" fullWidth>
      <DialogTitle>{guide.title}</DialogTitle>
      <DialogContent dividers>
        <Typography color="text.secondary" sx={{ mb: 1.5 }}>
          {guide.subtitle}
        </Typography>
        <List dense disablePadding>
          {guide.steps.map((step, index) => (
            <ListItem key={step} alignItems="flex-start" disableGutters>
              <Box
                sx={{
                  width: 26,
                  height: 26,
                  borderRadius: '50%',
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText',
                  display: 'grid',
                  placeItems: 'center',
                  fontWeight: 800,
                  flexShrink: 0,
                  mt: 0.3,
                  mr: 1.25,
                }}
              >
                {index + 1}
              </Box>
              <ListItemText primary={step} primaryTypographyProps={{ lineHeight: 1.7 }} />
            </ListItem>
          ))}
        </List>
      </DialogContent>
      <DialogActions>
        <Button variant="contained" onClick={close}>我知道了</Button>
      </DialogActions>
    </Dialog>
  );
}
