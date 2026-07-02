import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Grid,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import BlockIcon from '@mui/icons-material/Block';
import AddCardIcon from '@mui/icons-material/AddCard';
import SettingsSuggestIcon from '@mui/icons-material/SettingsSuggest';
import RefreshIcon from '@mui/icons-material/Refresh';
import ScienceIcon from '@mui/icons-material/Science';
import {
  adminRequest,
  type AdminAuditLogRow,
  type AdminConfig,
  type AdminUserRow,
  type BillingTransactionRow,
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
  const [selectedUserId, setSelectedUserId] = useState('');
  const [adjustMinutes, setAdjustMinutes] = useState('60');
  const [adjustNote, setAdjustNote] = useState('后台手动赠送');
  const [configTestResult, setConfigTestResult] = useState<Record<string, { ok: boolean; message: string }>>({});

  const aiConfig = useMemo(() => configs.find((item) => item.key === 'ai')?.value ?? {}, [configs]);
  const asrConfig = useMemo(() => configs.find((item) => item.key === 'asr')?.value ?? {}, [configs]);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      await adminRequest('me');
      setIsAdmin(true);
      const [userResult, txResult, configResult, logResult] = await Promise.all([
        adminRequest<{ users: AdminUserRow[] }>('listUsers'),
        adminRequest<{ transactions: BillingTransactionRow[] }>('listTransactions'),
        adminRequest<{ configs: AdminConfig[] }>('getConfig'),
        adminRequest<{ logs: AdminAuditLogRow[] }>('listAuditLogs'),
      ]);
      setUsers(userResult.users);
      setTransactions(txResult.transactions);
      setConfigs(configResult.configs);
      setLogs(logResult.logs);
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

  const updateConfig = async (key: 'ai' | 'asr', form: HTMLFormElement) => {
    const data = new FormData(form);
    const value = Object.fromEntries([...data.entries()].map(([name, item]) => [name, String(item)]));
    await adminRequest('updateConfig', { key, value });
    await refresh();
  };

  const testConfig = async (key: 'ai' | 'asr', form: HTMLFormElement) => {
    const data = new FormData(form);
    const value = Object.fromEntries([...data.entries()].map(([name, item]) => [name, String(item)]));
    const result = await adminRequest<{ ok: boolean; message: string }>('testConfig', { key, value });
    setConfigTestResult((current) => ({ ...current, [key]: result }));
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
        <Tab label="审计与规划" />
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
          <Grid item xs={12} md={7}>
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
          </Grid>
          <Grid item xs={12} md={5}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" fontWeight={800} gutterBottom>后续建议预留</Typography>
              <Stack spacing={1.25}>
                {[
                  ['优惠券和邀请码', '渠道投放、首单折扣、老带新邀请返分钟。'],
                  ['套餐 A/B 测试', '不同价格、赠送分钟、月卡权益做转化对比。'],
                  ['风控', '同账号多设备并发限制、异常转写用量预警。'],
                  ['客服工单', '支付失败、额度异常、识别失败可按用户和面试记录追踪。'],
                  ['运营数据看板', '注册、试用转化、付费率、ARPU、识别成本和毛利。'],
                ].map(([title, desc]) => (
                  <Paper key={title} variant="outlined" sx={{ p: 1.25 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip size="small" color="primary" label="预留" />
                      <Typography fontWeight={800}>{title}</Typography>
                    </Stack>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>{desc}</Typography>
                  </Paper>
                ))}
              </Stack>
            </Paper>
          </Grid>
        </Grid>
      )}
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
          <TextField
            key={name}
            name={name}
            label={label}
            type={/key|token|secret/i.test(name) ? 'password' : 'text'}
            defaultValue={String(values[name] ?? '')}
            placeholder={/key|token|secret/i.test(name) ? '留空不改，填入新值后保存' : undefined}
          />
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
