/**
 * Official contact card: email (mailto), QQ group QR, WeChat QR.
 */
import { Box, Button, Link, Paper, Stack, Typography } from '@mui/material';
import {
  QQ_GROUP_ID,
  QQ_GROUP_NAME,
  SUPPORT_EMAIL,
  SUPPORT_MAILTO,
  SUPPORT_MAILTO_HELP,
  WECHAT_DISPLAY_NAME,
  qqGroupQrUrl,
  wechatQrUrl,
} from '../../config/contact';

interface ContactSupportProps {
  compact?: boolean;
}

export function ContactSupport({ compact = false }: ContactSupportProps) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: compact ? 2 : 2.5,
        borderRadius: 3,
        borderColor: 'divider',
        background: (t) =>
          t.palette.mode === 'dark'
            ? 'linear-gradient(180deg, rgba(255,122,0,0.08), transparent)'
            : 'linear-gradient(180deg, #fff8f0, #fff)',
      }}
    >
      <Typography variant={compact ? 'subtitle1' : 'h6'} fontWeight={800} gutterBottom>
        联系官方
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.7 }}>
        使用、支付、额度、识别异常或商务合作，欢迎通过邮箱、微信或 QQ 群联系。
      </Typography>

      <Stack spacing={1.25} sx={{ mb: 2.5 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
          <Typography variant="body2" fontWeight={700} sx={{ minWidth: 48 }}>
            邮箱
          </Typography>
          <Link href={SUPPORT_MAILTO} underline="hover" fontWeight={700} color="primary">
            {SUPPORT_EMAIL}
          </Link>
          <Button
            size="small"
            variant="contained"
            href={SUPPORT_MAILTO_HELP}
            sx={{ borderRadius: 999, textTransform: 'none', fontWeight: 800 }}
          >
            写邮件
          </Button>
        </Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
          <Typography variant="body2" fontWeight={700} sx={{ minWidth: 48 }}>
            QQ 群
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {QQ_GROUP_NAME} · 群号 {QQ_GROUP_ID}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
          <Typography variant="body2" fontWeight={700} sx={{ minWidth: 48 }}>
            微信
          </Typography>
          <Typography variant="body2" color="text.secondary">
            添加 {WECHAT_DISPLAY_NAME}（扫码）
          </Typography>
        </Box>
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
          gap: 2,
        }}
      >
        <QrCard title="官方 QQ 群" caption={`群号 ${QQ_GROUP_ID}`} src={qqGroupQrUrl()} />
        <QrCard title="微信客服" caption={WECHAT_DISPLAY_NAME} src={wechatQrUrl()} />
      </Box>
    </Paper>
  );
}

function QrCard({ title, caption, src }: { title: string; caption: string; src: string }) {
  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: 2.5,
        border: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        textAlign: 'center',
      }}
    >
      <Typography variant="subtitle2" fontWeight={800} gutterBottom>
        {title}
      </Typography>
      <Box
        component="img"
        src={src}
        alt={title}
        sx={{
          width: '100%',
          maxWidth: 240,
          mx: 'auto',
          borderRadius: 2,
          display: 'block',
          bgcolor: '#fafafa',
        }}
      />
      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
        {caption}
      </Typography>
    </Box>
  );
}
