import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  LinearProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import BoltIcon from '@mui/icons-material/Bolt';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import PrivacyTipIcon from '@mui/icons-material/PrivacyTip';
import CardGiftcardIcon from '@mui/icons-material/CardGiftcard';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { COMMERCIAL_PLANS, FAKA_PURCHASE_URL, FREE_TRIAL_MINUTES } from '../../config/commercial';
import { ContactSupport } from '../common/ContactSupport';
import { useAuth } from '../../hooks/useAuth';
import { useBilling } from '../../hooks/useBilling';

function formatMinutes(seconds: number): string {
  return `${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒`;
}

export function BillingPage() {
  const { user } = useAuth();
  const { remainingSeconds, entitlement, loading, error, startCheckout, redeemCardKey } = useBilling();
  const [cardCode, setCardCode] = useState('');
  const [redeemLoading, setRedeemLoading] = useState(false);
  const [redeemSuccess, setRedeemSuccess] = useState<string | null>(null);
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const [xianyuDialogOpen, setXianyuDialogOpen] = useState(false);

  const totalSeconds = entitlement
    ? (entitlement.freeTrialMinutes + entitlement.purchasedMinutes) * 60
    : FREE_TRIAL_MINUTES * 60;
  const usedRatio = totalSeconds > 0 ? Math.min(100, ((totalSeconds - remainingSeconds) / totalSeconds) * 100) : 0;

  const handleRedeem = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const code = cardCode.trim();
    if (!code) return;
    setRedeemLoading(true);
    setRedeemSuccess(null);
    setRedeemError(null);
    try {
      const result = await redeemCardKey(code);
      setRedeemSuccess(result.message);
      setCardCode('');
    } catch (err) {
      setRedeemError(err instanceof Error ? err.message : '卡密兑换失败，请检查后重试');
    } finally {
      setRedeemLoading(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 1180, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Paper
        sx={{
          p: { xs: 2.5, md: 4 },
          overflow: 'hidden',
          position: 'relative',
          background:
            'linear-gradient(135deg, rgba(125,211,252,0.20), rgba(248,113,113,0.10) 45%, rgba(250,204,21,0.16))',
        }}
      >
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} alignItems={{ md: 'center' }}>
          <Box sx={{ flex: 1 }}>
            <Chip icon={<BoltIcon />} color="primary" label="新用户先送 15 分钟" sx={{ mb: 2 }} />
            <Typography variant="h3" fontWeight={900} sx={{ fontSize: { xs: 34, md: 48 }, lineHeight: 1.05 }}>
              关键面试时刻，让回答更稳一点。
            </Typography>
            <Typography variant="h6" color="text.secondary" sx={{ mt: 2, maxWidth: 720 }}>
              面试猪会实时理解对话，结合你的简历、岗位和知识库生成可直接口述的回答。适合八股文、项目深挖、场景题和复盘。
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 2 }}>
              {['双路语音理解', '只针对面试官问题给答案', '简历知识库增强', 'STAR 一键重写', '面试后复盘'].map((item) => (
                <Chip key={item} label={item} variant="outlined" />
              ))}
            </Stack>
          </Box>
          <Paper sx={{ p: 2.5, width: { xs: '100%', md: 330 } }}>
            <Typography variant="subtitle2" color="text.secondary">
              当前可用时长
            </Typography>
            <Typography variant="h4" fontWeight={900} sx={{ my: 1 }}>
              {formatMinutes(remainingSeconds)}
            </Typography>
            <LinearProgress variant="determinate" value={usedRatio} sx={{ height: 9, borderRadius: 99 }} />
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              免费试用适合快速体验；真实面试通常 30-60 分钟，建议提前准备足够时长。
            </Typography>
          </Paper>
        </Stack>
      </Paper>

      {error && <Alert severity="error">{error}</Alert>}
      {!user && (
        <Alert severity="info">
          请先登录或注册，再领取 15 分钟试用和购买/兑换面试时长。你的简历、知识库、面试记录会跟随账号同步。
        </Alert>
      )}

      {/* 卡密兑换专用模块 */}
      <Paper
        variant="outlined"
        sx={{
          p: { xs: 2.5, md: 3.5 },
          borderColor: 'primary.main',
          background: 'linear-gradient(180deg, rgba(59,130,246,0.04) 0%, rgba(255,255,255,0) 100%)',
          borderRadius: 3,
        }}
      >
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} alignItems={{ md: 'center' }}>
          <Box sx={{ flex: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <CardGiftcardIcon color="primary" sx={{ fontSize: 28 }} />
              <Typography variant="h5" fontWeight={900}>
                卡密充值 / 激活码兑换
              </Typography>
              <Chip size="small" color="primary" label="自动发卡秒到账" />
            </Stack>
            <Typography variant="body2" color="text.secondary">
              在合作发卡网购买卡密后，贴到右侧即可立即充值到账；或前往闲鱼搜索享专属特惠。
            </Typography>

            {/* 快捷购买与闲鱼优惠通道 */}
            <Stack direction="row" spacing={1.5} sx={{ mt: 1.5 }} flexWrap="wrap" useFlexGap>
              <Button
                variant="contained"
                color="primary"
                size="small"
                startIcon={<ShoppingCartIcon />}
                endIcon={<OpenInNewIcon sx={{ fontSize: 16 }} />}
                href={FAKA_PURCHASE_URL}
                target="_blank"
                rel="noopener noreferrer"
                sx={{ fontWeight: 800, borderRadius: 2 }}
              >
                去发卡网购买卡密 (24H秒发)
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={<LocalOfferIcon />}
                onClick={() => setXianyuDialogOpen(true)}
                sx={{
                  fontWeight: 800,
                  borderRadius: 2,
                  borderColor: '#f59e0b',
                  color: '#d97706',
                  bgcolor: 'rgba(245,158,11,0.04)',
                  '&:hover': {
                    borderColor: '#d97706',
                    bgcolor: 'rgba(245,158,11,0.10)',
                  },
                }}
              >
                闲鱼搜「面试猪」享专属特惠 🎁
              </Button>
            </Stack>

            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              客服邮箱：xiaosuange@gmail.com ｜ 官方QQ群：592906421
            </Typography>
          </Box>

          <Box
            component="form"
            onSubmit={(e) => void handleRedeem(e)}
            sx={{ width: { xs: '100%', md: 440 } }}
          >
            <Stack direction="row" spacing={1.5}>
              <TextField
                fullWidth
                size="small"
                placeholder="请输入卡密 (如 MSZ-30M-XXXX-XXXX)"
                value={cardCode}
                onChange={(e) => setCardCode(e.target.value.toUpperCase())}
                disabled={!user || redeemLoading}
                autoComplete="off"
                sx={{
                  '& .MuiInputBase-input': {
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    letterSpacing: 0.5,
                  },
                }}
              />
              <Button
                type="submit"
                variant="contained"
                disabled={!user || !cardCode.trim() || redeemLoading}
                sx={{ minWidth: 108, fontWeight: 800 }}
              >
                {redeemLoading ? <CircularProgress size={20} color="inherit" /> : '立即兑换'}
              </Button>
            </Stack>
          </Box>
        </Stack>

        {redeemSuccess && (
          <Alert
            icon={<CheckCircleOutlineIcon fontSize="inherit" />}
            severity="success"
            sx={{ mt: 2 }}
            onClose={() => setRedeemSuccess(null)}
          >
            {redeemSuccess}
          </Alert>
        )}
        {redeemError && (
          <Alert severity="error" sx={{ mt: 2 }} onClose={() => setRedeemError(null)}>
            {redeemError}
          </Alert>
        )}
      </Paper>

      <Box>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ sm: 'center' }}
          sx={{ mb: 1 }}
          spacing={1}
        >
          <Typography variant="h5" fontWeight={900}>
            商业版套餐选购
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button
              size="small"
              variant="outlined"
              color="primary"
              startIcon={<ShoppingCartIcon />}
              endIcon={<OpenInNewIcon sx={{ fontSize: 16 }} />}
              href={FAKA_PURCHASE_URL}
              target="_blank"
              rel="noopener noreferrer"
              sx={{ fontWeight: 700 }}
            >
              发卡网直达
            </Button>
            <Button
              size="small"
              variant="text"
              startIcon={<LocalOfferIcon />}
              onClick={() => setXianyuDialogOpen(true)}
              sx={{ fontWeight: 700, color: '#d97706' }}
            >
              闲鱼搜「面试猪」更优惠
            </Button>
          </Stack>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          选择适合你的面试时长套餐，或在合作发卡平台购买卡密兑换。
        </Typography>

        <Grid container spacing={2}>
          {COMMERCIAL_PLANS.map((plan) => (
            <Grid item xs={12} md={4} key={plan.id}>
              <Paper
                sx={{
                  p: 2.5,
                  height: '100%',
                  border: '1px solid',
                  borderColor: plan.popular ? 'primary.main' : 'divider',
                  boxShadow: plan.popular ? '0 20px 60px rgba(80, 150, 255, 0.20)' : undefined,
                }}
              >
                <Stack spacing={1.5} sx={{ height: '100%' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <WorkspacePremiumIcon color={plan.popular ? 'primary' : 'inherit'} />
                    <Typography variant="h6" fontWeight={800}>{plan.name}</Typography>
                    {plan.badge && <Chip size="small" color={plan.popular ? 'primary' : 'default'} label={plan.badge} sx={{ ml: 'auto' }} />}
                  </Box>
                  <Box>
                    <Typography component="span" variant="h4" fontWeight={900}>{plan.priceLabel}</Typography>
                    {plan.originalPriceLabel && (
                      <Typography component="span" color="text.secondary" sx={{ ml: 1, textDecoration: 'line-through' }}>
                        {plan.originalPriceLabel}
                      </Typography>
                    )}
                  </Box>
                  <Typography variant="subtitle1" fontWeight={800}>{plan.minutesLabel}</Typography>
                  <Typography variant="body2" color="text.secondary">{plan.description}</Typography>
                  <Stack spacing={0.75} sx={{ flex: 1 }}>
                    {plan.highlights.map((item) => (
                      <Typography key={item} variant="body2">- {item}</Typography>
                    ))}
                  </Stack>
                  <Button
                    size="large"
                    variant={plan.popular ? 'contained' : 'outlined'}
                    disabled={!user || loading}
                    onClick={() => { void startCheckout(plan.id); }}
                  >
                    {plan.checkoutMode === 'subscription' ? '开通月卡' : '立即购买'}
                  </Button>
                </Stack>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </Box>

      <Paper sx={{ p: 2.5 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
          <PrivacyTipIcon color="primary" />
          <Box>
            <Typography variant="subtitle1" fontWeight={800}>商业版体验说明</Typography>
            <Typography variant="body2" color="text.secondary">
              用户不需要配置模型或语音服务密钥。平台统一提供实时理解、答案生成和复盘能力；用户只需要上传简历、知识库和自定义专业热词。
            </Typography>
          </Box>
        </Stack>
      </Paper>

      <ContactSupport />

      {/* 闲鱼专属优惠弹窗 */}
      <Dialog
        open={xianyuDialogOpen}
        onClose={() => setXianyuDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3, p: 1 } }}
      >
        <DialogTitle sx={{ fontWeight: 900, pb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          <LocalOfferIcon sx={{ color: '#f59e0b' }} />
          闲鱼搜索「面试猪」专享优惠
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary', lineHeight: 1.6 }}>
            想获取更优惠的时长尝鲜特惠？你可以前往闲鱼搜索官方认证渠道，拍下即可享受专属特惠体验价：
          </Typography>
          <Box sx={{ p: 2, bgcolor: 'rgba(245,158,11,0.08)', borderRadius: 2, border: '1px dashed #f59e0b', mb: 2 }}>
            <Typography variant="subtitle2" fontWeight={800} color="#b45309" gutterBottom>
              📱 闲鱼省钱流程：
            </Typography>
            <Typography variant="body2" sx={{ color: '#92400e', fontSize: 13, lineHeight: 1.8 }}>
              1. 打开手机 <b>闲鱼 App</b><br />
              2. 搜索框输入 <b>「面试猪」</b> 或 <b>「求职面试练习模拟器」</b><br />
              3. 认准「面试猪」官方特惠卡密宝贝，拍下享粉丝专属折扣<br />
              4. 付款后自动发卡密，复制回本页面兑换即可秒到账！
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, display: 'flex', gap: 1 }}>
          <Button
            variant="contained"
            fullWidth
            href="https://www.goofish.com/"
            target="_blank"
            rel="noopener noreferrer"
            sx={{ fontWeight: 800, bgcolor: '#f59e0b', '&:hover': { bgcolor: '#d97706' } }}
          >
            打开闲鱼搜索
          </Button>
          <Button variant="outlined" onClick={() => setXianyuDialogOpen(false)}>
            我知道了
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
