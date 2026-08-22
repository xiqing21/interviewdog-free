import { useEffect, useMemo, useState, type ReactNode } from 'react';
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
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import BlockIcon from '@mui/icons-material/Block';
import AddCardIcon from '@mui/icons-material/AddCard';
import SettingsSuggestIcon from '@mui/icons-material/SettingsSuggest';
import RefreshIcon from '@mui/icons-material/Refresh';
import ScienceIcon from '@mui/icons-material/Science';
import TravelExploreIcon from '@mui/icons-material/TravelExplore';
import CardGiftcardIcon from '@mui/icons-material/CardGiftcard';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import StorefrontIcon from '@mui/icons-material/Storefront';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import PersonAddAlt1Icon from '@mui/icons-material/PersonAddAlt1';
import EditNoteIcon from '@mui/icons-material/EditNote';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import {
  adminRequest,
  type AdminAuditLogRow,
  type AdminConfig,
  type AdminUserRow,
  type BillingTransactionRow,
  type CardKeyRow,
  type CardKeySummary,
  type CardKeysPayload,
  type CommercialOpsPayload,
  type GenerateCardKeysResponse,
  type SeoInsightPayload,
} from '../../services/adminService';

function minutes(seconds: number): string {
  return `${Math.floor(seconds / 60)} 分钟`;
}

export function AdminPage() {
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [transactions, setTransactions] = useState<BillingTransactionRow[]>([]);
  const [logs, setLogs] = useState<AdminAuditLogRow[]>([]);
  const [configs, setConfigs] = useState<AdminConfig[]>([]);
  const [ops, setOps] = useState<CommercialOpsPayload | null>(null);
  const [seoInsights, setSeoInsights] = useState<SeoInsightPayload | null>(null);
  const [seoActionResult, setSeoActionResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [adjustMinutes, setAdjustMinutes] = useState('60');
  const [adjustNote, setAdjustNote] = useState('后台手动赠送');
  const [configTestResult, setConfigTestResult] = useState<Record<string, { ok: boolean; message: string }>>({});
  const [couponForm, setCouponForm] = useState({ code: '', discountPercent: '20', bonusMinutes: '30', maxRedemptions: '100', note: '' });
  const [ticketForm, setTicketForm] = useState({ email: 'xiaosuange@gmail.com', subject: '', message: '', priority: 'normal' });
  const [experimentForm, setExperimentForm] = useState({ name: '新用户价格实验', status: 'draft', variants: '标准价 99 元 / 新人价 69 元', note: '' });
  const [riskForm, setRiskForm] = useState({ ruleKey: 'concurrent_sessions', enabled: true, threshold: '2', actionValue: 'limit', note: '同账号超过 2 个设备同时听音时限制新会话。' });

  // 卡密与发卡网模块状态
  const [cardKeys, setCardKeys] = useState<CardKeyRow[]>([]);
  const [cardKeySummary, setCardKeySummary] = useState<CardKeySummary | null>(null);
  const [cardKeyFilter, setCardKeyFilter] = useState({ status: 'all', batchNo: 'all', listed: 'all', search: '' });
  const [cardGenForm, setCardGenForm] = useState({
    minutes: '30',
    count: '20',
    batchNo: `FAKA-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-30M`,
    note: '发卡平台30元商品卡密',
  });
  const [generatingCards, setGeneratingCards] = useState(false);
  const [generatedBatchResult, setGeneratedBatchResult] = useState<GenerateCardKeysResponse | null>(null);
  const [copiedBatch, setCopiedBatch] = useState(false);
  const [copiedSingleCode, setCopiedSingleCode] = useState<string | null>(null);

  // 单张卡密自定义创建
  const [singleDialogOpen, setSingleDialogOpen] = useState(false);
  const [singleForm, setSingleForm] = useState({
    code: '',
    minutes: '30',
    batchNo: 'CUSTOM_MANUAL',
    note: '后台手动单张定制',
  });

  // 手动代充/核销模态框
  const [redeemDialogOpen, setRedeemDialogOpen] = useState(false);
  const [selectedCardToRedeem, setSelectedCardToRedeem] = useState<CardKeyRow | null>(null);
  const [targetUserEmail, setTargetUserEmail] = useState('');
  const [redeemModalLoading, setRedeemModalLoading] = useState(false);
  const [cardOpSuccessMessage, setCardOpSuccessMessage] = useState<string | null>(null);

  // 备注编辑模态框
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [selectedCardForNote, setSelectedCardForNote] = useState<CardKeyRow | null>(null);
  const [editingNote, setEditingNote] = useState('');

  const aiConfig = useMemo(() => configs.find((item) => item.key === 'ai')?.value ?? {}, [configs]);
  const asrConfig = useMemo(() => configs.find((item) => item.key === 'asr')?.value ?? {}, [configs]);
  const seoConfig = useMemo(() => configs.find((item) => item.key === 'seo')?.value ?? {}, [configs]);

  const refreshCardKeys = async (filter = cardKeyFilter) => {
    try {
      const cardKeyResult = await adminRequest<CardKeysPayload>('listCardKeys', {
        status: filter.status,
        batchNo: filter.batchNo,
        listed: filter.listed,
        search: filter.search,
      });
      setCardKeys(cardKeyResult.cardKeys);
      setCardKeySummary(cardKeyResult.summary);
    } catch {
      // ignore
    }
  };

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      await adminRequest('me');
      setIsAdmin(true);
      const [userResult, txResult, configResult, logResult, opsResult, cardKeyResult] = await Promise.all([
        adminRequest<{ users: AdminUserRow[] }>('listUsers'),
        adminRequest<{ transactions: BillingTransactionRow[] }>('listTransactions'),
        adminRequest<{ configs: AdminConfig[] }>('getConfig'),
        adminRequest<{ logs: AdminAuditLogRow[] }>('listAuditLogs'),
        adminRequest<CommercialOpsPayload>('listCommercialOps'),
        adminRequest<CardKeysPayload>('listCardKeys', {
          status: cardKeyFilter.status,
          batchNo: cardKeyFilter.batchNo,
          listed: cardKeyFilter.listed,
          search: cardKeyFilter.search,
        }).catch(() => ({
          cardKeys: [],
          summary: {
            total: 0,
            unused: 0,
            listedUnused: 0,
            unlistedUnused: 0,
            redeemed: 0,
            revoked: 0,
            expired: 0,
            totalMinutesRedeemed: 0,
            todayRedeemedCount: 0,
            lowStockThreshold: 20,
            lowStock: false,
            batches: [],
          },
        })),
      ]);
      setUsers(userResult.users);
      setTransactions(txResult.transactions);
      setConfigs(configResult.configs);
      setLogs(logResult.logs);
      setOps(opsResult);
      setCardKeys(cardKeyResult.cardKeys);
      setCardKeySummary(cardKeyResult.summary);
      setSelectedUserId((current) => current || userResult.users[0]?.id || '');
    } catch (err) {
      setIsAdmin(false);
      setError(err instanceof Error ? err.message : '后台加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const selectedUser = users.find((user) => user.id === selectedUserId);

  const setBan = async (user: AdminUserRow, banned: boolean) => {
    await adminRequest('setBan', {
      userId: user.id,
      banned,
      reason: banned ? '后台手动封禁' : '',
    });
    await refresh();
  };

  const submitAdjustMinutes = async () => {
    if (!selectedUserId) return;
    await adminRequest('adjustMinutes', {
      userId: selectedUserId,
      minutes: Number(adjustMinutes),
      note: adjustNote,
    });
    await refresh();
  };

  const updateConfig = async (key: 'ai' | 'asr' | 'seo', form: HTMLFormElement) => {
    const data = new FormData(form);
    const value = Object.fromEntries([...data.entries()].map(([name, item]) => [name, String(item)]));
    await adminRequest('updateConfig', { key, value });
    await refresh();
  };

  const testConfig = async (key: 'ai' | 'asr' | 'seo', form: HTMLFormElement) => {
    const data = new FormData(form);
    const value = Object.fromEntries([...data.entries()].map(([name, item]) => [name, String(item)]));
    const result = await adminRequest<{ ok: boolean; message: string }>('testConfig', { key, value });
    setConfigTestResult((current) => ({ ...current, [key]: result }));
  };

  const runSeoAction = async (action: 'getSeoInsights' | 'submitIndexNow' | 'submitBingUrls' | 'submitGoogleSitemap') => {
    setSeoActionResult(null);
    if (action === 'getSeoInsights') {
      const result = await adminRequest<SeoInsightPayload>('getSeoInsights', { days: 28 });
      setSeoInsights(result);
      setSeoActionResult({ ok: true, message: 'SEO/GEO 数据已刷新。' });
      return;
    }
    const result = await adminRequest<{ ok: boolean; message: string }>(action);
    setSeoActionResult(result);
  };

  const createCoupon = async () => {
    await adminRequest('createCoupon', {
      ...couponForm,
      discountPercent: Number(couponForm.discountPercent),
      bonusMinutes: Number(couponForm.bonusMinutes),
      maxRedemptions: Number(couponForm.maxRedemptions),
    });
    setCouponForm({ code: '', discountPercent: '20', bonusMinutes: '30', maxRedemptions: '100', note: '' });
    await refresh();
  };

  const updateCouponStatus = async (id: string, status: string) => {
    await adminRequest('updateCoupon', { id, status });
    await refresh();
  };

  const createTicket = async () => {
    await adminRequest('createTicket', {
      ...ticketForm,
      userId: selectedUserId || undefined,
    });
    setTicketForm({ email: 'xiaosuange@gmail.com', subject: '', message: '', priority: 'normal' });
    await refresh();
  };

  const updateTicketStatus = async (id: string, status: string, adminNote?: string | null) => {
    await adminRequest('updateTicket', { id, status, adminNote: adminNote ?? '' });
    await refresh();
  };

  const saveExperiment = async () => {
    await adminRequest('saveExperiment', experimentForm);
    await refresh();
  };

  const saveRiskRule = async () => {
    await adminRequest('saveRiskRule', {
      ...riskForm,
      threshold: Number(riskForm.threshold),
    });
    await refresh();
  };

  // 卡密高级管理操作
  const handleGenerateCardKeys = async () => {
    setGeneratingCards(true);
    setGeneratedBatchResult(null);
    setCopiedBatch(false);
    setCardOpSuccessMessage(null);
    try {
      const result = await adminRequest<GenerateCardKeysResponse>('generateCardKeys', {
        minutes: Number(cardGenForm.minutes),
        count: Number(cardGenForm.count),
        batchNo: cardGenForm.batchNo,
        note: cardGenForm.note,
      });
      setGeneratedBatchResult(result);
      setCardOpSuccessMessage(`成功批量生成 ${result.count} 笔卡密！已放入导出预览区。`);
      await refreshCardKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成卡密失败');
    } finally {
      setGeneratingCards(false);
    }
  };

  const handleCreateSingleCardKey = async () => {
    try {
      await adminRequest('createSingleCardKey', {
        code: singleForm.code,
        minutes: Number(singleForm.minutes),
        batchNo: singleForm.batchNo,
        note: singleForm.note,
      });
      setSingleDialogOpen(false);
      setSingleForm({ code: '', minutes: '30', batchNo: 'CUSTOM_MANUAL', note: '后台手动单张定制' });
      setCardOpSuccessMessage('成功创建单张定制卡密！');
      await refreshCardKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建单张卡密失败');
    }
  };

  const handleCopyBatch = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedBatch(true);
      setTimeout(() => setCopiedBatch(false), 3000);
    } catch {
      // ignore
    }
  };

  const downloadPlainText = (text: string, filename: string) => {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleMarkListed = async (batchNo: string, listed: boolean) => {
    if (!batchNo || batchNo === 'all') {
      setError('请先筛选指定批次，再标记是否已导入发卡网。');
      return;
    }
    try {
      const result = await adminRequest<{ ok: boolean; count: number }>('markCardKeysListed', {
        batchNo,
        listed,
        listedChannel: 'houfaka',
      });
      setCardOpSuccessMessage(
        listed
          ? `已将批次 ${batchNo} 的 ${result.count} 笔待使用卡密标记为已导入发卡网。`
          : `已取消批次 ${batchNo} 的发卡网上架标记。`,
      );
      await refreshCardKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新上架状态失败');
    }
  };

  const handleCopySingle = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedSingleCode(code);
      setTimeout(() => setCopiedSingleCode(null), 2000);
    } catch {
      // ignore
    }
  };

  const handleExportFilteredUnused = async (download = false) => {
    const unusedKeys = cardKeys.filter((k) => k.status === 'unused');
    if (unusedKeys.length === 0) {
      setError('当前列表没有待使用的卡密可导出。');
      return;
    }
    const text = unusedKeys.map((k) => k.code).join('\n');
    if (download) {
      downloadPlainText(text, `faka-${cardKeyFilter.batchNo === 'all' ? 'unused' : cardKeyFilter.batchNo}.txt`);
      setCardOpSuccessMessage(`已下载当前筛选的 ${unusedKeys.length} 笔待使用卡密，可直接导入发卡网。`);
      return;
    }
    await handleCopyBatch(text);
    setCardOpSuccessMessage(`已一键复制当前筛选的 ${unusedKeys.length} 笔待使用卡密（每行一个）！`);
  };

  const handleRevokeCardKey = async (id: string, currentStatus: string) => {
    const targetStatus = currentStatus === 'revoked' ? 'unused' : 'revoked';
    await adminRequest('revokeCardKey', { id, status: targetStatus });
    await refreshCardKeys();
  };

  const handleDeleteCardKey = async (id: string) => {
    if (!window.confirm('确定彻底删除该条未使用卡密吗？')) return;
    await adminRequest('deleteCardKey', { id });
    await refreshCardKeys();
  };

  const handleBatchRevokeCurrent = async () => {
    if (cardKeyFilter.batchNo === 'all') {
      setError('请先在上方筛选指定的批次后再执行批量操作。');
      return;
    }
    if (!window.confirm(`确定将批次 ${cardKeyFilter.batchNo} 的所有卡密作废吗？`)) return;
    await adminRequest('batchRevokeByBatch', { batchNo: cardKeyFilter.batchNo, status: 'revoked' });
    setCardOpSuccessMessage(`已将批次 ${cardKeyFilter.batchNo} 的卡密批量作废。`);
    await refreshCardKeys();
  };

  const handleBatchDeleteCurrent = async () => {
    if (cardKeyFilter.batchNo === 'all') {
      setError('请先在上方筛选指定的批次后再执行批量删除。');
      return;
    }
    if (!window.confirm(`确定彻底删除批次 ${cardKeyFilter.batchNo} 的所有【待使用】卡密吗？此操作不可恢复！`)) return;
    await adminRequest('batchDeleteUnusedByBatch', { batchNo: cardKeyFilter.batchNo });
    setCardOpSuccessMessage(`已批量删除批次 ${cardKeyFilter.batchNo} 中所有未使用的卡密。`);
    await refreshCardKeys();
  };

  const handleOpenRedeemModal = (card: CardKeyRow) => {
    setSelectedCardToRedeem(card);
    setTargetUserEmail(selectedUser?.email ?? '');
    setRedeemDialogOpen(true);
  };

  const handleConfirmAdminRedeem = async () => {
    if (!selectedCardToRedeem || !targetUserEmail.trim()) return;
    setRedeemModalLoading(true);
    try {
      const res = await adminRequest<{ ok: boolean; message: string }>('adminRedeemCardKey', {
        id: selectedCardToRedeem.id,
        code: selectedCardToRedeem.code,
        email: targetUserEmail.trim(),
      });
      setCardOpSuccessMessage(res.message);
      setRedeemDialogOpen(false);
      setSelectedCardToRedeem(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '代充核销失败');
    } finally {
      setRedeemModalLoading(false);
    }
  };

  const handleOpenNoteModal = (card: CardKeyRow) => {
    setSelectedCardForNote(card);
    setEditingNote(card.note || '');
    setNoteDialogOpen(true);
  };

  const handleSaveNote = async () => {
    if (!selectedCardForNote) return;
    try {
      await adminRequest('updateCardKeyNote', {
        id: selectedCardForNote.id,
        note: editingNote,
      });
      setNoteDialogOpen(false);
      setSelectedCardForNote(null);
      await refreshCardKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存备注失败');
    }
  };

  if (loading && !isAdmin) {
    return <Typography color="text.secondary">正在检查后台权限...</Typography>;
  }

  if (!isAdmin) {
    return (
      <Box sx={{ maxWidth: 680, mx: 'auto' }}>
        <Alert severity="error">{error ?? '没有后台权限。请使用管理员账号登录。'}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1220, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ md: 'center' }} spacing={1}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h4" fontWeight={900}>运营后台</Typography>
          <Typography variant="body2" color="text.secondary">
            管理账号、发卡网卡密生成与全生命周期监控、充值流水、模型配置、语音服务配置和后台操作日志。
          </Typography>
        </Box>
        <Button startIcon={<RefreshIcon />} variant="outlined" onClick={() => { void refresh(); }} disabled={loading}>
          刷新
        </Button>
      </Stack>
      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
      {cardOpSuccessMessage && <Alert severity="success" onClose={() => setCardOpSuccessMessage(null)}>{cardOpSuccessMessage}</Alert>}

      <Tabs value={tab} onChange={(_, value) => setTab(value)} variant="scrollable" scrollButtons="auto">
        <Tab label="用户与充值" />
        <Tab label="消费/充值记录" />
        <Tab icon={<StorefrontIcon fontSize="small" />} iconPosition="start" label="发卡网与卡密管理" />
        <Tab label="模型与语音配置" />
        <Tab label="SEO/GEO" />
        <Tab label="增长/工单/风控" />
        <Tab label="审计日志" />
      </Tabs>

      {/* Tab 0: 用户与充值 */}
      {tab === 0 && (
        <Grid container spacing={2}>
          <Grid item xs={12} md={7}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" fontWeight={800} gutterBottom>账号列表</Typography>
              <Stack spacing={1.25}>
                {users.map((user) => (
                  <Paper
                    key={user.id}
                    variant="outlined"
                    sx={{ p: 1.5, cursor: 'pointer', borderColor: selectedUserId === user.id ? 'primary.main' : 'divider' }}
                    onClick={() => setSelectedUserId(user.id)}
                  >
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography fontWeight={800} noWrap>{user.email ?? user.id}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          剩余 {minutes(user.remainingSeconds)} / 已用 {minutes(user.usedSeconds)}
                        </Typography>
                      </Box>
                      <Chip size="small" label={user.plan} />
                      <Chip size="small" color={user.bannedAt ? 'error' : 'success'} label={user.bannedAt ? '已封禁' : '正常'} />
                      <Button
                        size="small"
                        color={user.bannedAt ? 'success' : 'error'}
                        variant="outlined"
                        startIcon={<BlockIcon />}
                        onClick={(event) => {
                          event.stopPropagation();
                          void setBan(user, !user.bannedAt);
                        }}
                      >
                        {user.bannedAt ? '解封' : '封禁'}
                      </Button>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            </Paper>
          </Grid>
          <Grid item xs={12} md={5}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" fontWeight={800} gutterBottom>手动调整时长</Typography>
              {selectedUser ? (
                <Stack spacing={1.5}>
                  <Alert severity="info">
                    当前用户：{selectedUser.email ?? selectedUser.id}，剩余 {minutes(selectedUser.remainingSeconds)}
                  </Alert>
                  <TextField
                    label="调整分钟数"
                    value={adjustMinutes}
                    onChange={(event) => setAdjustMinutes(event.target.value)}
                    helperText="正数为赠送/充值，负数为扣减。"
                  />
                  <TextField
                    label="备注"
                    value={adjustNote}
                    onChange={(event) => setAdjustNote(event.target.value)}
                  />
                  <Button variant="contained" startIcon={<AddCardIcon />} onClick={() => { void submitAdjustMinutes(); }}>
                    确认调整
                  </Button>
                </Stack>
              ) : (
                <Typography color="text.secondary">请选择一个用户。</Typography>
              )}
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* Tab 1: 消费/充值记录 */}
      {tab === 1 && (
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" fontWeight={800} gutterBottom>消费/充值记录</Typography>
          <Stack spacing={1}>
            {transactions.map((item) => (
              <Paper key={item.id} variant="outlined" sx={{ p: 1.25 }}>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ md: 'center' }}>
                  <Chip
                    size="small"
                    color={item.type === 'card_key_redemption' ? 'primary' : 'default'}
                    label={item.type === 'card_key_redemption' ? '卡密充值' : item.type}
                  />
                  <Typography sx={{ flex: 1 }} variant="body2">{item.user_id}</Typography>
                  <Typography variant="body2" fontWeight={700}>{item.minutes} 分钟</Typography>
                  <Typography variant="caption" color="text.secondary">{new Date(item.created_at).toLocaleString('zh-CN')}</Typography>
                </Stack>
                {item.note && <Typography variant="caption" color="text.secondary">{item.note}</Typography>}
              </Paper>
            ))}
          </Stack>
        </Paper>
      )}

      {/* Tab 2: 卡密管理与发卡网对接 */}
      {tab === 2 && (
        <Stack spacing={2.5}>
          {/* 1. 卡密实时监控看板 */}
          <Paper sx={{ p: 2.5 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} sx={{ mb: 1.5 }}>
              <StorefrontIcon color="primary" />
              <Box sx={{ flex: 1 }}>
                <Typography variant="h6" fontWeight={900}>发卡网与卡密全生命周期管理</Typography>
                <Typography variant="body2" color="text.secondary">
                  对接猴发卡商品「面试猪手动充值」（¥30 = 30 分钟）。后台制卡后导出粘贴到发卡网，用户购买后在充值页兑换。
                </Typography>
              </Box>
              <Button
                variant="outlined"
                startIcon={<AddCircleOutlineIcon />}
                onClick={() => setSingleDialogOpen(true)}
              >
                单张定制卡密
              </Button>
            </Stack>

            {cardKeySummary?.lowStock && (
              <Alert severity="warning" sx={{ mb: 1.5 }}>
                发卡网待售库存仅剩 {cardKeySummary.listedUnused} 笔（预警线 {cardKeySummary.lowStockThreshold}）。请尽快生成新卡密并导入发卡网，避免售罄。
              </Alert>
            )}

            <Alert severity="info" sx={{ mb: 1.5 }}>
              发卡网导入步骤：打开该商品的「卡密管理」→「添加卡密」→ 粘贴下方每行一个的卡密 → 保存。导入后点「标记已导入发卡网」，库存监控才会按待售数量计算。
            </Alert>

            <Grid container spacing={1.5}>
              {[
                { title: '发卡网待售', value: cardKeySummary?.listedUnused ?? 0, color: 'success.main', sub: '已导入发卡网、尚未兑换' },
                { title: '未导入发卡网', value: cardKeySummary?.unlistedUnused ?? 0, color: 'warning.main', sub: '已生成但还没贴进发卡网' },
                { title: '已兑换激活', value: cardKeySummary?.redeemed ?? 0, color: 'primary.main', sub: '用户已充值到账' },
                { title: '今日兑换', value: cardKeySummary?.todayRedeemedCount ?? 0, color: 'info.main', sub: '今天新增兑换笔数' },
                { title: '累计兑换时长', value: `${cardKeySummary?.totalMinutesRedeemed ?? 0} 分`, color: 'secondary.main', sub: '累计充值服务总量' },
                { title: '已作废/过期', value: (cardKeySummary?.revoked ?? 0) + (cardKeySummary?.expired ?? 0), color: 'text.secondary', sub: '不可再售卖或兑换' },
              ].map((metric) => (
                <Grid item xs={6} md={2} key={metric.title}>
                  <Paper variant="outlined" sx={{ p: 1.75, height: '100%' }}>
                    <Typography variant="caption" color="text.secondary" fontWeight={700}>{metric.title}</Typography>
                    <Typography variant="h4" fontWeight={900} sx={{ color: metric.color, my: 0.5, fontSize: { xs: 26, md: 32 } }}>
                      {metric.value}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">{metric.sub}</Typography>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </Paper>

          {/* 2. 批量制卡与发卡网导出工具 */}
          <Grid container spacing={2}>
            <Grid item xs={12} md={5}>
              <Paper sx={{ p: 2.5, height: '100%' }}>
                <Typography variant="h6" fontWeight={800} gutterBottom>批量生成发卡网卡密</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  为发卡网快速制卡。生成后直接一键复制每行一个的纯文本卡密列表粘贴进发卡平台。
                </Typography>

                <Stack spacing={2}>
                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ display: 'block', mb: 0.75 }}>
                      快捷选择套餐时长 (分钟)：
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      {[
                        { label: '30 分钟 (发卡网推荐¥30)', value: '30' },
                        { label: '60 分钟', value: '60' },
                        { label: '120 分钟', value: '120' },
                        { label: '300 分钟', value: '300' },
                      ].map((item) => (
                        <Chip
                          key={item.value}
                          label={item.label}
                          clickable
                          color={cardGenForm.minutes === item.value ? 'primary' : 'default'}
                          onClick={() => {
                            const dateTag = new Date().toISOString().slice(0, 10).replace(/-/g, '');
                            setCardGenForm((prev) => ({
                              ...prev,
                              minutes: item.value,
                              batchNo: `FAKA-${dateTag}-${item.value}M`,
                            }));
                          }}
                        />
                      ))}
                    </Stack>
                  </Box>

                  <Grid container spacing={1.5}>
                    <Grid item xs={6}>
                      <TextField
                        fullWidth
                        size="small"
                        label="充值时长 (分钟)"
                        type="number"
                        value={cardGenForm.minutes}
                        onChange={(e) => setCardGenForm((prev) => ({ ...prev, minutes: e.target.value }))}
                      />
                    </Grid>
                    <Grid item xs={6}>
                      <TextField
                        fullWidth
                        size="small"
                        label="生成数量 (笔)"
                        type="number"
                        value={cardGenForm.count}
                        onChange={(e) => setCardGenForm((prev) => ({ ...prev, count: e.target.value }))}
                      />
                    </Grid>
                  </Grid>

                  <TextField
                    fullWidth
                    size="small"
                    label="批次名称 (Batch Tag)"
                    value={cardGenForm.batchNo}
                    onChange={(e) => setCardGenForm((prev) => ({ ...prev, batchNo: e.target.value }))}
                    helperText="用于在发卡网和管理后台区分不同的补货批次"
                  />

                  <TextField
                    fullWidth
                    size="small"
                    label="备注说明"
                    value={cardGenForm.note}
                    onChange={(e) => setCardGenForm((prev) => ({ ...prev, note: e.target.value }))}
                  />

                  <Button
                    variant="contained"
                    size="large"
                    startIcon={generatingCards ? <CircularProgress size={18} color="inherit" /> : <CardGiftcardIcon />}
                    disabled={generatingCards}
                    onClick={() => { void handleGenerateCardKeys(); }}
                  >
                    {generatingCards ? '正在批量生成...' : `立即批量生成 ${cardGenForm.count} 笔卡密`}
                  </Button>
                </Stack>
              </Paper>
            </Grid>

            {/* 卡密导出预览区域 */}
            <Grid item xs={12} md={7}>
              <Paper sx={{ p: 2.5, height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                  <ContentCopyIcon color="primary" />
                  <Typography variant="h6" fontWeight={800}>发卡网一键导出区</Typography>
                  {generatedBatchResult && (
                    <Chip size="small" color="success" label={`批次: ${generatedBatchResult.batchNo} (${generatedBatchResult.count}笔)`} sx={{ ml: 'auto' }} />
                  )}
                </Stack>

                {generatedBatchResult ? (
                  <Stack spacing={1.5} sx={{ flex: 1 }}>
                    <Alert severity="success" icon={<CheckCircleOutlineIcon fontSize="inherit" />}>
                      成功生成 <strong>{generatedBatchResult.count}</strong> 笔面额为 <strong>{generatedBatchResult.minutes} 分钟</strong> 的卡密！
                    </Alert>

                    <TextField
                      fullWidth
                      multiline
                      minRows={7}
                      maxRows={10}
                      value={generatedBatchResult.plainTextList}
                      InputProps={{
                        readOnly: true,
                        sx: { fontFamily: 'monospace', fontSize: 13, backgroundColor: 'action.hover' },
                      }}
                      helperText="格式为每行一个卡密，完全兼容发卡平台的批量卡密导入格式。"
                    />

                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                      <Button
                        variant="contained"
                        color="primary"
                        size="large"
                        startIcon={<ContentCopyIcon />}
                        onClick={() => { void handleCopyBatch(generatedBatchResult.plainTextList); }}
                        sx={{ fontWeight: 900, flex: 1 }}
                      >
                        {copiedBatch ? '已复制，去发卡网粘贴' : '复制全部卡密（粘贴到发卡网）'}
                      </Button>
                      <Button
                        variant="outlined"
                        size="large"
                        startIcon={<FileDownloadIcon />}
                        onClick={() => {
                          downloadPlainText(
                            generatedBatchResult.plainTextList,
                            `${generatedBatchResult.batchNo}.txt`,
                          );
                        }}
                      >
                        下载 txt
                      </Button>
                      <Button
                        variant="outlined"
                        size="large"
                        onClick={() => { void handleMarkListed(generatedBatchResult.batchNo, true); }}
                      >
                        标记已导入发卡网
                      </Button>
                    </Stack>
                  </Stack>
                ) : (
                  <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: 3, textAlign: 'center' }}>
                    <CardGiftcardIcon sx={{ fontSize: 56, color: 'text.disabled', mb: 1 }} />
                    <Typography color="text.secondary" fontWeight={700}>
                      在左侧设定时长与数量并点击生成，此处将显示可直接一键复制的卡密池。
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                      公开仓库里的种子卡密已作废。请用这里生成新卡密，再导入猴发卡「面试猪手动充值」商品。
                    </Typography>
                  </Box>
                )}
              </Paper>
            </Grid>
          </Grid>

          {/* 3. 卡密列表与实时状态管理 */}
          <Paper sx={{ p: 2.5 }}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }} sx={{ mb: 2 }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h6" fontWeight={800}>卡密明细与管理工作台</Typography>
                <Typography variant="caption" color="text.secondary">
                  共 {cardKeys.length} 条记录，支持按状态、批次筛选、搜索、导出、作废、删除及直接为用户代充
                </Typography>
              </Box>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }} flexWrap="wrap">
                <FormControl size="small" sx={{ minWidth: 140 }}>
                  <InputLabel>批次筛选</InputLabel>
                  <Select
                    label="批次筛选"
                    value={cardKeyFilter.batchNo}
                    onChange={(e) => {
                      const next = { ...cardKeyFilter, batchNo: e.target.value };
                      setCardKeyFilter(next);
                      void refreshCardKeys(next);
                    }}
                  >
                    <MenuItem value="all">全部批次</MenuItem>
                    {(cardKeySummary?.batches ?? []).map((b) => (
                      <MenuItem key={b.batchNo} value={b.batchNo}>
                        {b.batchNo} ({b.count}条)
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel>状态筛选</InputLabel>
                  <Select
                    label="状态筛选"
                    value={cardKeyFilter.status}
                    onChange={(e) => {
                      const next = { ...cardKeyFilter, status: e.target.value };
                      setCardKeyFilter(next);
                      void refreshCardKeys(next);
                    }}
                  >
                    <MenuItem value="all">全部状态</MenuItem>
                    <MenuItem value="unused">待使用</MenuItem>
                    <MenuItem value="redeemed">已兑换</MenuItem>
                    <MenuItem value="revoked">已作废</MenuItem>
                    <MenuItem value="expired">已过期</MenuItem>
                  </Select>
                </FormControl>

                <FormControl size="small" sx={{ minWidth: 140 }}>
                  <InputLabel>上架筛选</InputLabel>
                  <Select
                    label="上架筛选"
                    value={cardKeyFilter.listed}
                    onChange={(e) => {
                      const next = { ...cardKeyFilter, listed: e.target.value };
                      setCardKeyFilter(next);
                      void refreshCardKeys(next);
                    }}
                  >
                    <MenuItem value="all">全部上架状态</MenuItem>
                    <MenuItem value="yes">已导入发卡网</MenuItem>
                    <MenuItem value="no">未导入发卡网</MenuItem>
                  </Select>
                </FormControl>

                <TextField
                  size="small"
                  placeholder="搜索卡密 / 邮箱 / 备注"
                  value={cardKeyFilter.search}
                  onChange={(e) => setCardKeyFilter((prev) => ({ ...prev, search: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void refreshCardKeys();
                  }}
                  sx={{ width: 180 }}
                />

                <Button variant="outlined" size="small" onClick={() => { void refreshCardKeys(); }}>
                  查询
                </Button>

                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<ContentCopyIcon />}
                  onClick={() => { void handleExportFilteredUnused(false); }}
                >
                  复制待使用
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<FileDownloadIcon />}
                  onClick={() => { void handleExportFilteredUnused(true); }}
                >
                  下载 txt
                </Button>
              </Stack>
            </Stack>

            {/* 批次级批量运维工具条 */}
            {cardKeyFilter.batchNo !== 'all' && (
              <Alert
                severity="info"
                sx={{ mb: 2 }}
                action={
                  <Stack direction="row" spacing={1}>
                    <Button size="small" variant="outlined" onClick={() => { void handleMarkListed(cardKeyFilter.batchNo, true); }}>
                      标记已导入发卡网
                    </Button>
                    <Button size="small" variant="outlined" onClick={() => { void handleMarkListed(cardKeyFilter.batchNo, false); }}>
                      取消上架标记
                    </Button>
                    <Button size="small" color="warning" variant="outlined" onClick={() => { void handleBatchRevokeCurrent(); }}>
                      作废此批次
                    </Button>
                    <Button size="small" color="error" variant="outlined" onClick={() => { void handleBatchDeleteCurrent(); }}>
                      删除此批次待使用卡密
                    </Button>
                  </Stack>
                }
              >
                当前选中批次：<strong>{cardKeyFilter.batchNo}</strong>，你可以对该批次执行批量运维操作。
              </Alert>
            )}

            <Divider sx={{ mb: 2 }} />

            <Stack spacing={1.25}>
              {cardKeys.length === 0 ? (
                <Alert severity="info">没有找到匹配的卡密记录。</Alert>
              ) : (
                cardKeys.map((card) => (
                  <Paper
                    key={card.id}
                    variant="outlined"
                    sx={{
                      p: 1.5,
                      borderColor: card.status === 'unused' ? 'success.light' : card.status === 'redeemed' ? 'primary.light' : 'divider',
                      backgroundColor: card.status === 'revoked' ? 'action.hover' : 'background.paper',
                    }}
                  >
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'center' }}>
                      <Box sx={{ minWidth: 260 }}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography
                            component="span"
                            sx={{ fontFamily: 'monospace', fontWeight: 900, fontSize: 15, letterSpacing: 0.5 }}
                          >
                            {card.code}
                          </Typography>
                          <Button
                            size="small"
                            variant="text"
                            sx={{ minWidth: 48, p: 0.5, fontSize: 12 }}
                            onClick={() => { void handleCopySingle(card.code); }}
                          >
                            {copiedSingleCode === card.code ? '✅ 已复制' : '复制'}
                          </Button>
                        </Stack>
                        <Typography variant="caption" color="text.secondary" display="block">
                          批次：{card.batch_no} {card.note ? `｜ 备注：${card.note}` : ''}
                        </Typography>
                      </Box>

                      <Chip
                        size="small"
                        color="primary"
                        variant="outlined"
                        label={`+${card.minutes} 分钟`}
                        sx={{ fontWeight: 800 }}
                      />

                      <Chip
                        size="small"
                        color={
                          card.status === 'unused'
                            ? 'success'
                            : card.status === 'redeemed'
                              ? 'primary'
                              : card.status === 'revoked'
                                ? 'error'
                                : 'default'
                        }
                        label={
                          card.status === 'unused'
                            ? '待使用'
                            : card.status === 'redeemed'
                              ? '已兑换'
                              : card.status === 'revoked'
                                ? '已作废'
                                : '已过期'
                        }
                      />
                      {card.status === 'unused' && (
                        <Chip
                          size="small"
                          variant="outlined"
                          color={card.listed_at ? 'success' : 'warning'}
                          label={card.listed_at ? '已导入发卡网' : '未导入发卡网'}
                        />
                      )}

                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        {card.status === 'redeemed' ? (
                          <Typography variant="caption" color="primary.main" fontWeight={700} display="block">
                            兑换用户：{card.redeemed_by_email || card.redeemed_by || '已兑换'} (
                            {card.redeemed_at ? new Date(card.redeemed_at).toLocaleString('zh-CN') : '-'})
                          </Typography>
                        ) : (
                          <Typography variant="caption" color="text.secondary" display="block">
                            创建时间：{new Date(card.created_at).toLocaleString('zh-CN')}
                          </Typography>
                        )}
                      </Box>

                      <Stack direction="row" spacing={1}>
                        {card.status === 'unused' && (
                          <Tooltip title="为指定用户代充此卡密">
                            <Button
                              size="small"
                              variant="contained"
                              color="primary"
                              startIcon={<PersonAddAlt1Icon />}
                              onClick={() => handleOpenRedeemModal(card)}
                            >
                              代充核销
                            </Button>
                          </Tooltip>
                        )}
                        <IconButton size="small" onClick={() => handleOpenNoteModal(card)}>
                          <EditNoteIcon fontSize="small" />
                        </IconButton>
                        {card.status !== 'redeemed' && (
                          <Button
                            size="small"
                            variant="outlined"
                            color={card.status === 'revoked' ? 'success' : 'warning'}
                            onClick={() => { void handleRevokeCardKey(card.id, card.status); }}
                          >
                            {card.status === 'revoked' ? '恢复启用' : '作废'}
                          </Button>
                        )}
                        {card.status === 'unused' && (
                          <Button
                            size="small"
                            variant="outlined"
                            color="error"
                            startIcon={<DeleteOutlineIcon />}
                            onClick={() => { void handleDeleteCardKey(card.id); }}
                          >
                            删除
                          </Button>
                        )}
                      </Stack>
                    </Stack>
                  </Paper>
                ))
              )}
            </Stack>
          </Paper>
        </Stack>
      )}

      {/* Tab 3: 模型与语音配置 */}
      {tab === 3 && (
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <ConfigForm
              title="AI 模型配置"
              icon={<SettingsSuggestIcon />}
              fields={[
                ['baseUrl', 'Base URL'],
                ['textModel', '文本模型'],
                ['visionModel', '视觉模型'],
                ['apiKey', 'API Key'],
              ]}
              values={aiConfig}
              onSubmit={(form) => updateConfig('ai', form)}
              onTest={(form) => testConfig('ai', form)}
              testResult={configTestResult.ai}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <ConfigForm
              title="实时语音配置"
              icon={<SettingsSuggestIcon />}
              fields={[
                ['provider', '默认识别架构'],
                ['doubaoAppId', '豆包 App ID'],
                ['doubaoAccessToken', '豆包 Access Token'],
                ['doubaoResourceId', '豆包 Resource ID'],
                ['iflytekAppId', '讯飞 AppID'],
                ['iflytekApiKey', '讯飞 API Key'],
                ['iflytekApiSecret', '讯飞 API Secret'],
                ['alibabaAppKey', '阿里 AppKey'],
                ['alibabaToken', '阿里 Token'],
                ['alibabaEndpoint', '阿里 Endpoint'],
              ]}
              values={asrConfig}
              onSubmit={(form) => updateConfig('asr', form)}
              onTest={(form) => testConfig('asr', form)}
              testResult={configTestResult.asr}
            />
          </Grid>
        </Grid>
      )}

      {/* Tab 4: SEO / GEO */}
      {tab === 4 && (
        <Grid container spacing={2}>
          <Grid item xs={12} md={5}>
            <ConfigForm
              title="SEO / GEO 配置"
              icon={<TravelExploreIcon />}
              fields={[
                ['siteUrl', '主站 URL'],
                ['sitemapUrl', 'Sitemap URL'],
                ['googleSiteUrl', 'Google Search Console Property'],
                ['googleServiceAccountJson', 'Google Service Account JSON'],
                ['bingApiKey', 'Bing Webmaster API Key'],
                ['indexNowHost', 'IndexNow Host'],
                ['indexNowKey', 'IndexNow Key'],
                ['indexNowKeyLocation', 'IndexNow Key Location'],
              ]}
              values={seoConfig}
              onSubmit={(form) => updateConfig('seo', form)}
              onTest={(form) => testConfig('seo', form)}
              testResult={configTestResult.seo}
            />
          </Grid>
          <Grid item xs={12} md={7}>
            <SeoConsole
              insights={seoInsights}
              actionResult={seoActionResult}
              onAction={(action) => runSeoAction(action)}
            />
          </Grid>
        </Grid>
      )}

      {/* Tab 5: 增长/工单/风控 */}
      {tab === 5 && (
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" fontWeight={900} gutterBottom>运营数据看板</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                支持邮箱：xiaosuange@gmail.com。这里统计注册、付费分钟、消耗分钟、开放工单和有效优惠码。
              </Typography>
              <Grid container spacing={1.25}>
                {[
                  ['注册用户', ops?.metrics.users ?? 0],
                  ['付费/赠送分钟', ops?.metrics.paidMinutes ?? 0],
                  ['已消耗分钟', ops?.metrics.usedMinutes ?? 0],
                  ['待处理工单', ops?.metrics.openTickets ?? 0],
                  ['有效优惠码', ops?.metrics.activeCoupons ?? 0],
                ].map(([title, value]) => (
                  <Grid item xs={6} md={2.4} key={title}>
                    <Paper variant="outlined" sx={{ p: 1.5, height: '100%' }}>
                      <Typography variant="caption" color="text.secondary">{title}</Typography>
                      <Typography variant="h5" fontWeight={900}>{value}</Typography>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </Paper>
          </Grid>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" fontWeight={800} gutterBottom>优惠券和邀请码</Typography>
              <Stack spacing={1.2}>
                <Grid container spacing={1}>
                  <Grid item xs={12} sm={4}><TextField fullWidth label="优惠码" value={couponForm.code} onChange={(e) => setCouponForm((v) => ({ ...v, code: e.target.value }))} /></Grid>
                  <Grid item xs={4} sm={2}><TextField fullWidth label="折扣%" value={couponForm.discountPercent} onChange={(e) => setCouponForm((v) => ({ ...v, discountPercent: e.target.value }))} /></Grid>
                  <Grid item xs={4} sm={3}><TextField fullWidth label="赠送分钟" value={couponForm.bonusMinutes} onChange={(e) => setCouponForm((v) => ({ ...v, bonusMinutes: e.target.value }))} /></Grid>
                  <Grid item xs={4} sm={3}><TextField fullWidth label="次数上限" value={couponForm.maxRedemptions} onChange={(e) => setCouponForm((v) => ({ ...v, maxRedemptions: e.target.value }))} /></Grid>
                  <Grid item xs={12}><TextField fullWidth label="备注" value={couponForm.note} onChange={(e) => setCouponForm((v) => ({ ...v, note: e.target.value }))} /></Grid>
                </Grid>
                <Button variant="contained" onClick={() => { void createCoupon(); }}>创建优惠码</Button>
                {(ops?.coupons ?? []).map((coupon) => (
                  <Paper key={coupon.id} variant="outlined" sx={{ p: 1.25 }}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
                      <Typography fontWeight={900}>{coupon.code}</Typography>
                      <Chip size="small" label={`${coupon.discount_percent}%`} />
                      <Chip size="small" label={`赠 ${coupon.bonus_minutes} 分钟`} />
                      <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
                        {coupon.redemptions}/{coupon.max_redemptions} 次
                      </Typography>
                      <Select size="small" value={coupon.status} onChange={(e) => { void updateCouponStatus(coupon.id, e.target.value); }}>
                        <MenuItem value="active">启用</MenuItem>
                        <MenuItem value="paused">暂停</MenuItem>
                        <MenuItem value="expired">过期</MenuItem>
                      </Select>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            </Paper>
          </Grid>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" fontWeight={800} gutterBottom>客服工单</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>用户可联系 xiaosuange@gmail.com，你也可以为当前选中用户手动创建工单。</Typography>
              <Stack spacing={1.2}>
                <TextField label="联系邮箱" value={ticketForm.email} onChange={(e) => setTicketForm((v) => ({ ...v, email: e.target.value }))} />
                <TextField label="标题" value={ticketForm.subject} onChange={(e) => setTicketForm((v) => ({ ...v, subject: e.target.value }))} />
                <TextField label="内容" multiline minRows={2} value={ticketForm.message} onChange={(e) => setTicketForm((v) => ({ ...v, message: e.target.value }))} />
                <Select value={ticketForm.priority} onChange={(e) => setTicketForm((v) => ({ ...v, priority: e.target.value }))}>
                  <MenuItem value="low">低</MenuItem>
                  <MenuItem value="normal">普通</MenuItem>
                  <MenuItem value="high">高</MenuItem>
                  <MenuItem value="urgent">紧急</MenuItem>
                </Select>
                <Button variant="contained" onClick={() => { void createTicket(); }}>创建工单</Button>
                {(ops?.tickets ?? []).map((ticket) => (
                  <Paper key={ticket.id} variant="outlined" sx={{ p: 1.25 }}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
                      <Box sx={{ flex: 1 }}>
                        <Typography fontWeight={900}>{ticket.subject}</Typography>
                        <Typography variant="caption" color="text.secondary">{ticket.email} / {ticket.priority}</Typography>
                      </Box>
                      <Select size="small" value={ticket.status} onChange={(e) => { void updateTicketStatus(ticket.id, e.target.value, ticket.admin_note); }}>
                        <MenuItem value="open">待处理</MenuItem>
                        <MenuItem value="pending">跟进中</MenuItem>
                        <MenuItem value="resolved">已解决</MenuItem>
                        <MenuItem value="closed">关闭</MenuItem>
                      </Select>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            </Paper>
          </Grid>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" fontWeight={800} gutterBottom>套餐 A/B 测试</Typography>
              <Stack spacing={1.2}>
                <TextField label="实验名称" value={experimentForm.name} onChange={(e) => setExperimentForm((v) => ({ ...v, name: e.target.value }))} />
                <Select value={experimentForm.status} onChange={(e) => setExperimentForm((v) => ({ ...v, status: e.target.value }))}>
                  <MenuItem value="draft">草稿</MenuItem>
                  <MenuItem value="running">运行中</MenuItem>
                  <MenuItem value="paused">暂停</MenuItem>
                  <MenuItem value="finished">结束</MenuItem>
                </Select>
                <TextField label="实验方案（每行一个）" multiline minRows={3} value={experimentForm.variants} onChange={(e) => setExperimentForm((v) => ({ ...v, variants: e.target.value }))} />
                <TextField label="备注" value={experimentForm.note} onChange={(e) => setExperimentForm((v) => ({ ...v, note: e.target.value }))} />
                <Button variant="contained" onClick={() => { void saveExperiment(); }}>保存实验</Button>
                {(ops?.experiments ?? []).map((item) => (
                  <Paper key={item.id} variant="outlined" sx={{ p: 1.25 }}>
                    <Chip size="small" label={item.status} sx={{ mr: 1 }} />
                    <Typography component="span" fontWeight={900}>{item.name}</Typography>
                  </Paper>
                ))}
              </Stack>
            </Paper>
          </Grid>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" fontWeight={800} gutterBottom>风控规则</Typography>
              <Stack spacing={1.2}>
                <FormControlLabel control={<Switch checked={riskForm.enabled} onChange={(e) => setRiskForm((v) => ({ ...v, enabled: e.target.checked }))} />} label="启用规则" />
                <TextField label="规则 Key" value={riskForm.ruleKey} onChange={(e) => setRiskForm((v) => ({ ...v, ruleKey: e.target.value }))} />
                <TextField label="阈值" value={riskForm.threshold} onChange={(e) => setRiskForm((v) => ({ ...v, threshold: e.target.value }))} />
                <Select value={riskForm.actionValue} onChange={(e) => setRiskForm((v) => ({ ...v, actionValue: e.target.value }))}>
                  <MenuItem value="alert">预警</MenuItem>
                  <MenuItem value="limit">限制</MenuItem>
                  <MenuItem value="ban">封禁</MenuItem>
                </Select>
                <TextField label="备注" value={riskForm.note} onChange={(e) => setRiskForm((v) => ({ ...v, note: e.target.value }))} />
                <Button variant="contained" onClick={() => { void saveRiskRule(); }}>保存风控规则</Button>
                {(ops?.riskRules ?? []).map((rule) => (
                  <Paper key={rule.id} variant="outlined" sx={{ p: 1.25 }}>
                    <Chip size="small" color={rule.enabled ? 'success' : 'default'} label={rule.enabled ? '启用' : '关闭'} sx={{ mr: 1 }} />
                    <Typography component="span" fontWeight={900}>{rule.key}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>阈值 {rule.threshold} / {rule.action}</Typography>
                  </Paper>
                ))}
              </Stack>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* Tab 6: 审计日志 */}
      {tab === 6 && (
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" fontWeight={800} gutterBottom>后台审计日志</Typography>
          <Stack spacing={1}>
            {logs.map((log) => (
              <Paper key={log.id} variant="outlined" sx={{ p: 1.25 }}>
                <Typography fontWeight={800}>{log.action}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {new Date(log.created_at).toLocaleString('zh-CN')} / 操作人 {log.actor_user_id ?? '-'} / 目标 {log.target_user_id ?? '-'}
                </Typography>
              </Paper>
            ))}
          </Stack>
        </Paper>
      )}

      {/* 弹窗：单张定制卡密创建 */}
      <Dialog open={singleDialogOpen} onClose={() => setSingleDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 900 }}>单张定制卡密创建</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              fullWidth
              size="small"
              label="自定义卡密编码 (留空自动生成)"
              placeholder="例如 VIP-300M-TEST"
              value={singleForm.code}
              onChange={(e) => setSingleForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
            />
            <TextField
              fullWidth
              size="small"
              label="面额时长 (分钟)"
              type="number"
              value={singleForm.minutes}
              onChange={(e) => setSingleForm((prev) => ({ ...prev, minutes: e.target.value }))}
            />
            <TextField
              fullWidth
              size="small"
              label="批次名称"
              value={singleForm.batchNo}
              onChange={(e) => setSingleForm((prev) => ({ ...prev, batchNo: e.target.value }))}
            />
            <TextField
              fullWidth
              size="small"
              label="备注"
              value={singleForm.note}
              onChange={(e) => setSingleForm((prev) => ({ ...prev, note: e.target.value }))}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setSingleDialogOpen(false)}>取消</Button>
          <Button variant="contained" onClick={() => { void handleCreateSingleCardKey(); }}>
            创建卡密
          </Button>
        </DialogActions>
      </Dialog>

      {/* 弹窗：手动为用户代充核销卡密 */}
      <Dialog open={redeemDialogOpen} onClose={() => setRedeemDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 900 }}>卡密手动核销代充</DialogTitle>
        <DialogContent>
          {selectedCardToRedeem && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Alert severity="info">
                即将核销卡密：<strong>{selectedCardToRedeem.code}</strong>（+{selectedCardToRedeem.minutes} 分钟）
              </Alert>
              <TextField
                fullWidth
                label="目标用户邮箱"
                placeholder="例如 user@gmail.com"
                value={targetUserEmail}
                onChange={(e) => setTargetUserEmail(e.target.value)}
                helperText="输入用户注册邮箱，系统将直接核销该卡密并为用户到账时长。"
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setRedeemDialogOpen(false)} disabled={redeemModalLoading}>取消</Button>
          <Button
            variant="contained"
            disabled={!targetUserEmail.trim() || redeemModalLoading}
            onClick={() => { void handleConfirmAdminRedeem(); }}
          >
            {redeemModalLoading ? '正在充值...' : '确认核销充值'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 弹窗：编辑卡密备注 */}
      <Dialog open={noteDialogOpen} onClose={() => setNoteDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 900 }}>编辑卡密备注</DialogTitle>
        <DialogContent>
          {selectedCardForNote && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Typography variant="body2" color="text.secondary">
                卡密：{selectedCardForNote.code}
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="备注信息"
                value={editingNote}
                onChange={(e) => setEditingNote(e.target.value)}
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setNoteDialogOpen(false)}>取消</Button>
          <Button variant="contained" onClick={() => { void handleSaveNote(); }}>
            保存备注
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function SeoConsole({
  insights,
  actionResult,
  onAction,
}: {
  insights: SeoInsightPayload | null;
  actionResult: { ok: boolean; message: string } | null;
  onAction: (action: 'getSeoInsights' | 'submitIndexNow' | 'submitBingUrls' | 'submitGoogleSitemap') => Promise<void>;
}) {
  const [runningAction, setRunningAction] = useState<string | null>(null);
  const run = async (action: 'getSeoInsights' | 'submitIndexNow' | 'submitBingUrls' | 'submitGoogleSitemap') => {
    setRunningAction(action);
    try {
      await onAction(action);
    } finally {
      setRunningAction(null);
    }
  };
  return (
    <Paper sx={{ p: 2 }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
        <TravelExploreIcon />
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" fontWeight={800}>搜索词 / 收录 / GEO 工作台</Typography>
          <Typography variant="body2" color="text.secondary">
            拉 Search Console 和 Bing 搜索词，提交 Sitemap/URL，并检查 AI 搜索可见性基础资产。
          </Typography>
        </Box>
      </Stack>
      {actionResult && (
        <Alert severity={actionResult.ok ? 'success' : 'error'} sx={{ mb: 1.5 }}>
          {actionResult.message}
        </Alert>
      )}
      <Grid container spacing={1}>
        {[
          ['getSeoInsights', '拉取搜索词'],
          ['submitIndexNow', '提交 IndexNow'],
          ['submitBingUrls', '提交 Bing URL'],
          ['submitGoogleSitemap', '提交 Google Sitemap'],
        ].map(([action, label]) => (
          <Grid item xs={12} sm={6} key={action}>
            <Button
              fullWidth
              variant={action === 'getSeoInsights' ? 'contained' : 'outlined'}
              disabled={Boolean(runningAction)}
              onClick={() => { void run(action as 'getSeoInsights' | 'submitIndexNow' | 'submitBingUrls' | 'submitGoogleSitemap'); }}
            >
              {runningAction === action ? '执行中...' : label}
            </Button>
          </Grid>
        ))}
      </Grid>
      <Divider sx={{ my: 2 }} />
      <Typography variant="subtitle1" fontWeight={900} gutterBottom>GEO / AI 搜索检查</Typography>
      <Grid container spacing={1}>
        {(insights?.checklist ?? [
          { label: 'robots.txt', ok: true, detail: '已在站点根目录准备。' },
          { label: 'sitemap.xml', ok: true, detail: '已在站点根目录准备。' },
          { label: 'llms.txt', ok: true, detail: '已为 AI 搜索摘要准备。' },
          { label: 'Search Console', ok: false, detail: '保存 Google Service Account 后可拉搜索词。' },
        ]).map((item) => (
          <Grid item xs={12} sm={6} key={item.label}>
            <Paper variant="outlined" sx={{ p: 1.25, height: '100%' }}>
              <Chip size="small" color={item.ok ? 'success' : 'warning'} label={item.ok ? '就绪' : '待配置'} sx={{ mb: 0.75 }} />
              <Typography fontWeight={900}>{item.label}</Typography>
              <Typography variant="caption" color="text.secondary">{item.detail}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>
      <Divider sx={{ my: 2 }} />
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <SearchRows
            title="Google Search Console 搜索词"
            message={insights?.google.message}
            rows={(insights?.google.rows ?? []).map((row) => ({
              key: `${row.query}-${row.page}`,
              title: row.query || '(空查询)',
              meta: `${row.clicks} 点击 / ${row.impressions} 展示 / CTR ${(row.ctr * 100).toFixed(1)}% / 平均排名 ${row.position.toFixed(1)}`,
              sub: row.page,
            }))}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <SearchRows
            title="Bing Webmaster 搜索词"
            message={insights?.bing.message}
            rows={(insights?.bing.rows ?? []).map((row) => ({
              key: `${row.query}-${row.date}`,
              title: row.query || '(空查询)',
              meta: `${row.clicks} 点击 / ${row.impressions} 展示 / 点击排名 ${row.avgClickPosition}`,
              sub: row.date,
            }))}
          />
        </Grid>
      </Grid>
    </Paper>
  );
}

function SearchRows({
  title,
  message,
  rows,
}: {
  title: string;
  message?: string;
  rows: Array<{ key: string; title: string; meta: string; sub?: string }>;
}) {
  return (
    <Box>
      <Typography variant="subtitle1" fontWeight={900}>{title}</Typography>
      {message && <Typography variant="caption" color="text.secondary">{message}</Typography>}
      <Stack spacing={1} sx={{ mt: 1 }}>
        {rows.length === 0 ? (
          <Alert severity="info">暂无数据。配置并验证站点后再拉取。</Alert>
        ) : rows.slice(0, 12).map((row) => (
          <Paper key={row.key} variant="outlined" sx={{ p: 1.15 }}>
            <Typography fontWeight={800} noWrap>{row.title}</Typography>
            <Typography variant="caption" color="text.secondary">{row.meta}</Typography>
            {row.sub && <Typography variant="caption" color="text.secondary" display="block" noWrap>{row.sub}</Typography>}
          </Paper>
        ))}
      </Stack>
    </Box>
  );
}

function ConfigForm({
  title,
  icon,
  fields,
  values,
  onSubmit,
  onTest,
  testResult,
}: {
  title: string;
  icon: ReactNode;
  fields: Array<[string, string]>;
  values: Record<string, unknown>;
  onSubmit: (form: HTMLFormElement) => Promise<void>;
  onTest: (form: HTMLFormElement) => Promise<void>;
  testResult?: { ok: boolean; message: string };
}) {
  return (
    <Paper
      component="form"
      sx={{ p: 2 }}
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit(event.currentTarget);
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
        {icon}
        <Typography variant="h6" fontWeight={800}>{title}</Typography>
      </Stack>
      <Stack spacing={1.25}>
        {fields.map(([name, label]) => (
          (() => {
            const isMultilineSecret = /json|serviceaccount/i.test(name);
            return (
              <TextField
                key={name}
                name={name}
                label={label}
                type={!isMultilineSecret && /key|token|secret/i.test(name) ? 'password' : 'text'}
                multiline={isMultilineSecret}
                minRows={isMultilineSecret ? 4 : undefined}
                defaultValue={String(values[name] ?? '')}
                placeholder={/key|token|secret/i.test(name) ? '留空不改，填入新值后保存' : undefined}
              />
            );
          })()
        ))}
        {testResult && (
          <Alert severity={testResult.ok ? 'success' : 'error'}>{testResult.message}</Alert>
        )}
        <Divider />
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <Button
            variant="outlined"
            startIcon={<ScienceIcon />}
            onClick={(event) => {
              const form = event.currentTarget.closest('form');
              if (form) void onTest(form);
            }}
          >
            测试配置
          </Button>
          <Button type="submit" variant="contained">保存配置</Button>
        </Stack>
      </Stack>
    </Paper>
  );
}
