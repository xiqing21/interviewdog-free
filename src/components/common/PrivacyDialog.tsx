/**
 * PrivacyDialog — Modal dialog displaying the privacy notice.
 * Shown on first launch until the user acknowledges.
 */

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
} from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';

interface PrivacyDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Called when the user acknowledges the privacy notice */
  onConfirm: () => void;
}

export function PrivacyDialog({ open, onConfirm }: PrivacyDialogProps) {
  return (
    <Dialog open={open} maxWidth="sm" fullWidth disableEscapeKeyDown>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <LockIcon color="primary" />
        隐私声明
      </DialogTitle>
      <DialogContent>
        <DialogContentText component="div" sx={{ '& p': { mb: 1.5 } }}>
          <p>
            感谢使用<strong>面试猪</strong>。在开始使用前，请仔细阅读以下隐私说明：
          </p>
          <p>
            <strong>1. 数据存储：</strong>
            未登录时，设置和对话记录主要保存在您浏览器的 localStorage 中；登录后，简历库、知识库、面试项目和复盘会同步到 Supabase，用于跨设备继续使用。
          </p>
          <p>
            <strong>2. API 密钥：</strong>
            您输入的 API Key 会经过简单混淆后存储在本地，但请注意这不是加密存储。请勿在公共设备上使用。
          </p>
          <p>
            <strong>3. AI 请求：</strong>
            您的问答内容会直接发送至您配置的 AI 服务商（如 OpenAI、Anthropic
            等），请确保您已了解并同意该服务商的隐私政策。
          </p>
          <p>
            <strong>4. 屏幕截图：</strong>
            笔试辅助功能需要获取屏幕共享权限，截图数据仅用于 AI
            分析，不会被保存到服务器。
          </p>
          <p>
            <strong>5. 使用提示：</strong>
            本工具仅供学习和练习使用，请在实际面试中遵守诚信原则。
          </p>
        </DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button
          onClick={onConfirm}
          variant="contained"
          color="primary"
          fullWidth
          size="large"
        >
          我已了解并同意
        </Button>
      </DialogActions>
    </Dialog>
  );
}
