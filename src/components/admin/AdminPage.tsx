import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Grid,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
  FormControlLabel,
} from '@mui/material';
import BlockIcon from '@mui/icons-material/Block';
import AddCardIcon from '@mui/icons-material/AddCard';
import SettingsSuggestIcon from '@mui/icons-material/SettingsSuggest';
import RefreshIcon from '@mui/icons-material/Refresh';
import ScienceIcon from '@mui/icons-material/Science';
import TravelExploreIcon from '@mui/icons-material/TravelExplore';
import {
  adminRequest,
  type AdminAuditLogRow,
  type AdminConfig,
  type AdminUserRow,
  type BillingTransactionRow,
  type CommercialOpsPayload,
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

  const aiConfig = useMemo(() => configs.find((item) => item.key === 'ai')?.value ?? {}, [configs]);
  const asrConfig = useMemo(() => configs.find((item) => item.key === 'asr')?.value ?? {}, [configs]);
  const seoConfig = useMemo(() => configs.find((item) => item.key === 'seo')?.value ?? {}, [configs]);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      await adminRequest('me');
      setIsAdmin(true);
      const [userResult, txResult, configResult, logResult, opsResult] = await Promise.all([
        adminRequest<{ users: AdminUserRow[] }>('listUsers'),
        adminRequest<{ transactions: BillingTransactionRow[] }>('listTransactions'),
        adminRequest<{ configs: AdminConfig[] }>('getConfig'),
        adminRequest<{ logs: AdminAuditLogRow[] }>('listAuditLogs'),
        adminRequest<CommercialOpsPayload>('listCommercialOps'),
      ]);
      setUsers(userResult.users);
      setTransactions(txResult.transactions);
      setConfigs(configResult.configs);
      setLogs(logResult.logs);
      setOps(opsResult);
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
            管理账号、封禁、充值流水、模型配置、语音服务配置和后台操作日志。
          </Typography>
        </Box>
        <Button startIcon={<RefreshIcon />} variant="outlined" onClick={() => { void refresh(); }} disabled={loading}>
          刷新
        </Button>
      </Stack>
      {error && <Alert severity="error">{error}</Alert>}

      <Tabs value={tab} onChange={(_, value) => setTab(value)} variant="scrollable" scrollButtons="auto">
        <Tab label="用户与充值" />
        <Tab label="消费/充值记录" />
        <Tab label="模型与语音配置" />
        <Tab label="SEO/GEO" />
        <Tab label="增长/工单/风控" />
        <Tab label="审计日志" />
      </Tabs>

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

      {tab === 1 && (
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" fontWeight={800} gutterBottom>消费/充值记录</Typography>
          <Stack spacing={1}>
            {transactions.map((item) => (
              <Paper key={item.id} variant="outlined" sx={{ p: 1.25 }}>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ md: 'center' }}>
                  <Chip size="small" label={item.type} />
                  <Typography sx={{ flex: 1 }} variant="body2">{item.user_id}</Typography>
                  <Typography variant="body2">{item.minutes} 分钟</Typography>
                  <Typography variant="caption" color="text.secondary">{new Date(item.created_at).toLocaleString('zh-CN')}</Typography>
                </Stack>
                {item.note && <Typography variant="caption" color="text.secondary">{item.note}</Typography>}
              </Paper>
            ))}
          </Stack>
        </Paper>
      )}

      {tab === 2 && (
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

      {tab === 3 && (
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

      {tab === 4 && (
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
      {tab === 5 && (
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
