/**
 * SettingsPage v2 — 包含所有设置子组件
 * AI配置 / 模型自动发现 / 音频识别 / 简历JD / Prompt / 连接测试
 */

import { Box, Typography, Divider } from '@mui/material';
import { ProviderConfig } from './ProviderConfig';
import { ModelConfig } from './ModelConfig';
import { ModelDiscovery } from './ModelDiscovery';
import { PromptConfig } from './PromptConfig';
import { ConnectionTest } from './ConnectionTest';
import { AudioSourceSettings } from './AudioSourceSettings';
import { DoubaoConfig } from './DoubaoConfig';
import { LocalQwenConfig } from './LocalQwenConfig';
import { MiMoConfig } from './MiMoConfig';
import { ResumeJDSettings } from './ResumeJDSettings';

export function SettingsPage() {
  return (
    <Box sx={{ maxWidth: 700, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <Typography variant="h5" fontWeight={700}>设置</Typography>

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
