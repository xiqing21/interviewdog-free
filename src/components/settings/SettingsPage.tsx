/**
 * SettingsPage v2 — 包含所有设置子组件
 * AI配置 / 模型自动发现 / 音频识别 / 简历JD / Prompt / 连接测试
 */

import { Alert, Box, Typography, Divider } from '@mui/material';
import { ProviderConfig } from './ProviderConfig';
import { ModelConfig } from './ModelConfig';
import { ModelDiscovery } from './ModelDiscovery';
import { PromptConfig } from './PromptConfig';
import { ConnectionTest } from './ConnectionTest';
import { AudioSourceSettings } from './AudioSourceSettings';
import { DoubaoConfig } from './DoubaoConfig';
import { LocalQwenConfig } from './LocalQwenConfig';
import { MiMoConfig } from './MiMoConfig';
import { CloudASRConfig } from './CloudASRConfig';
import { ResumeJDSettings } from './ResumeJDSettings';
import { ThemeSettings } from './ThemeSettings';
import { COMMERCIAL_MODE } from '../../config/commercial';

export function SettingsPage() {
  if (COMMERCIAL_MODE) {
    return (
      <Box sx={{ maxWidth: 760, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        <Typography variant="h5" fontWeight={700}>设置</Typography>
        <Alert severity="info">
          商业版由平台统一提供实时理解和 AI 回答能力。你只需要维护简历、知识库、岗位方向和专业热词，不需要配置任何模型或语音服务。
        </Alert>
        <ThemeSettings />

        <Divider />

        <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1 }}>识别与热词</Typography>
        <AudioSourceSettings />

        <Divider />

        <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1 }}>简历与岗位</Typography>
        <ResumeJDSettings />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 700, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <Typography variant="h5" fontWeight={700}>设置</Typography>
      <ThemeSettings />

      {/* AI 服务商 */}
      <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1 }}>🤖 AI 模型</Typography>
      <ProviderConfig />
      <ModelConfig />
      <ModelDiscovery type="text" />
      <ModelDiscovery type="vision" />

      <Divider />

      {/* 音频识别 */}
      <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1 }}>🎤 语音识别</Typography>
      <AudioSourceSettings />
      <DoubaoConfig />
      <LocalQwenConfig />
      <MiMoConfig />
      <CloudASRConfig />

      <Divider />

      {/* 简历 & JD */}
      <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1 }}>📄 简历与岗位</Typography>
      <ResumeJDSettings />

      <Divider />

      {/* Prompt & 测试 */}
      <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1 }}>⚙️ 高级</Typography>
      <PromptConfig />
      <ConnectionTest />
    </Box>
  );
}
