import { createClient } from '@supabase/supabase-js';

type ApiRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
};

type ApiResponse = {
  status: (code: number) => ApiResponse;
  json: (body: unknown) => void;
};

type AdminAction =
  | 'me'
  | 'listUsers'
  | 'setBan'
  | 'adjustMinutes'
  | 'listTransactions'
  | 'getConfig'
  | 'updateConfig'
  | 'testConfig'
  | 'listAuditLogs';

type AdminUser = {
  id: string;
  email: string;
};

type AppConfigKey = 'ai' | 'asr' | 'plans';
type AdminSupabaseClient = any;
type ConfigTestResult = { ok: boolean; message: string; latencyMs?: number };

const CONFIG_KEYS = ['ai', 'asr', 'plans'] as const;

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== 'POST') {
    response.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    response.status(500).json({ error: '后台服务未配置 Supabase service role。' });
    return;
  }

  const supabase: AdminSupabaseClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  }) as AdminSupabaseClient;
  const token = firstHeader(request.headers.authorization)?.replace(/^Bearer\s+/i, '');
  if (!token) {
    response.status(401).json({ error: '请先登录。' });
    return;
  }
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user?.email) {
    response.status(401).json({ error: '登录状态无效。' });
    return;
  }
  const actor = { id: data.user.id, email: data.user.email };
  if (!(await isAdmin(supabase, actor))) {
    response.status(403).json({ error: '没有后台权限。' });
    return;
  }

  const body = (typeof request.body === 'string' ? JSON.parse(request.body) : request.body) as {
    action?: AdminAction;
    userId?: string;
    banned?: boolean;
    reason?: string;
    minutes?: number;
    note?: string;
    key?: AppConfigKey;
    value?: Record<string, unknown>;
  };

  try {
    if (body.action === 'me') {
      response.status(200).json({ admin: true, actor });
      return;
    }
    if (body.action === 'listUsers') {
      response.status(200).json(await listUsers(supabase));
      return;
    }
    if (body.action === 'setBan') {
      response.status(200).json(await setBan(supabase, actor, body.userId, Boolean(body.banned), body.reason));
      return;
    }
    if (body.action === 'adjustMinutes') {
      response.status(200).json(await adjustMinutes(supabase, actor, body.userId, Number(body.minutes ?? 0), body.note));
      return;
    }
    if (body.action === 'listTransactions') {
      response.status(200).json(await listTransactions(supabase, body.userId));
      return;
    }
    if (body.action === 'getConfig') {
      response.status(200).json(await getConfig(supabase));
      return;
    }
    if (body.action === 'updateConfig') {
      response.status(200).json(await updateConfig(supabase, actor, body.key, body.value ?? {}));
      return;
    }
    if (body.action === 'testConfig') {
      response.status(200).json(await testConfig(supabase, actor, body.key, body.value ?? {}));
      return;
    }
    if (body.action === 'listAuditLogs') {
      response.status(200).json(await listAuditLogs(supabase));
      return;
    }
    response.status(400).json({ error: '未知后台操作。' });
  } catch (err) {
    response.status(500).json({ error: err instanceof Error ? err.message : '后台操作失败。' });
  }
}

async function isAdmin(supabase: AdminSupabaseClient, user: AdminUser): Promise<boolean> {
  const adminEmails = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  if (adminEmails.includes(user.email.toLowerCase())) return true;

  const { data } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();
  return data?.role === 'admin';
}

async function listUsers(supabase: AdminSupabaseClient) {
  const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (usersError) throw usersError;
  const userIds = usersData.users.map((user: { id: string }) => user.id);
  const [{ data: entitlements }, { data: roles }] = await Promise.all([
    supabase.from('user_entitlements').select('*').in('user_id', userIds),
    supabase.from('user_roles').select('*').in('user_id', userIds),
  ]);
  const entitlementByUser = new Map<string, any>((entitlements ?? []).map((item: any) => [item.user_id, item]));
  const roleByUser = new Map<string, any>((roles ?? []).map((item: any) => [item.user_id, item]));
  return {
    users: usersData.users.map((user: any) => {
      const entitlement = entitlementByUser.get(user.id);
      const role = roleByUser.get(user.id);
      const totalSeconds = ((entitlement?.free_trial_minutes ?? 15) + (entitlement?.purchased_minutes ?? 0)) * 60;
      const usedSeconds = entitlement?.used_seconds ?? 0;
      return {
        id: user.id,
        email: user.email,
        createdAt: user.created_at,
        lastSignInAt: user.last_sign_in_at,
        role: role?.role ?? 'user',
        bannedAt: role?.banned_at ?? null,
        banReason: role?.ban_reason ?? null,
        plan: entitlement?.plan ?? 'none',
        purchasedMinutes: entitlement?.purchased_minutes ?? 0,
        freeTrialMinutes: entitlement?.free_trial_minutes ?? 15,
        usedSeconds,
        remainingSeconds: Math.max(0, totalSeconds - usedSeconds),
        subscriptionStatus: entitlement?.subscription_status ?? 'none',
      };
    }),
  };
}

async function setBan(
  supabase: AdminSupabaseClient,
  actor: AdminUser,
  userId: string | undefined,
  banned: boolean,
  reason?: string,
) {
  if (!userId) throw new Error('缺少用户 ID。');
  const { data: currentRole } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle();
  await supabase.from('user_roles').upsert({
    user_id: userId,
    role: currentRole?.role ?? 'user',
    banned_at: banned ? new Date().toISOString() : null,
    ban_reason: banned ? reason ?? '后台封禁' : null,
    updated_at: new Date().toISOString(),
  });
  await supabase.auth.admin.updateUserById(userId, {
    ban_duration: banned ? '876000h' : 'none',
  });
  await audit(supabase, actor.id, banned ? 'ban_user' : 'unban_user', userId, { reason });
  return { ok: true };
}

async function adjustMinutes(
  supabase: AdminSupabaseClient,
  actor: AdminUser,
  userId: string | undefined,
  minutes: number,
  note?: string,
) {
  if (!userId) throw new Error('缺少用户 ID。');
  if (!Number.isFinite(minutes) || minutes === 0) throw new Error('请输入非 0 分钟数。');
  const { data: current } = await supabase
    .from('user_entitlements')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  const purchased = Math.max(0, Number(current?.purchased_minutes ?? 0) + minutes);
  const payload = {
    user_id: userId,
    free_trial_minutes: Number(current?.free_trial_minutes ?? 15),
    purchased_minutes: purchased,
    used_seconds: Number(current?.used_seconds ?? 0),
    plan: minutes > 0 ? 'pro' : current?.plan ?? 'none',
    subscription_status: current?.subscription_status ?? 'none',
    stripe_customer_id: current?.stripe_customer_id ?? null,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from('user_entitlements').upsert(payload);
  if (error) throw error;
  await supabase.from('billing_transactions').insert({
    user_id: userId,
    actor_user_id: actor.id,
    type: minutes > 0 ? 'manual_grant' : 'manual_deduct',
    minutes: Math.abs(minutes),
    note: note ?? '后台手动调整',
  });
  await audit(supabase, actor.id, 'adjust_minutes', userId, { minutes, note });
  return { ok: true, entitlement: payload };
}

async function listTransactions(supabase: AdminSupabaseClient, userId?: string) {
  let query = supabase
    .from('billing_transactions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);
  if (userId) query = query.eq('user_id', userId);
  const { data, error } = await query;
  if (error) throw error;
  return { transactions: data ?? [] };
}

async function getConfig(supabase: AdminSupabaseClient) {
  const { data, error } = await supabase.from('admin_app_config').select('*').in('key', CONFIG_KEYS);
  if (error) throw error;
  return {
    configs: (data ?? []).map((item: any) => ({
      key: item.key,
      value: maskSecrets(item.key, item.value),
      updatedAt: item.updated_at,
    })),
  };
}

async function updateConfig(
  supabase: AdminSupabaseClient,
  actor: AdminUser,
  key: AppConfigKey | undefined,
  value: Record<string, unknown>,
) {
  if (!key || !CONFIG_KEYS.includes(key)) throw new Error('未知配置项。');
  const { data: current } = await supabase.from('admin_app_config').select('value').eq('key', key).maybeSingle();
  const merged = mergeConfig(current?.value ?? {}, value);
  const { error } = await supabase.from('admin_app_config').upsert({
    key,
    value: merged,
    is_secret: key === 'ai' || key === 'asr',
    updated_by: actor.id,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
  await audit(supabase, actor.id, 'update_config', undefined, { key, changedKeys: Object.keys(value) });
  return { ok: true, value: maskSecrets(key, merged) };
}

async function testConfig(
  supabase: AdminSupabaseClient,
  actor: AdminUser,
  key: AppConfigKey | undefined,
  value: Record<string, unknown>,
): Promise<ConfigTestResult> {
  if (!key || !CONFIG_KEYS.includes(key)) throw new Error('未知配置项。');
  const { data: current } = await supabase.from('admin_app_config').select('value').eq('key', key).maybeSingle();
  const merged = mergeConfig(current?.value ?? {}, value);
  const startedAt = Date.now();
  const result = key === 'ai' ? await testAiConfig(merged) : await testAsrConfig(merged);
  await audit(supabase, actor.id, `test_${key}_config`, undefined, {
    ok: result.ok,
    latencyMs: result.latencyMs,
    provider: merged.provider,
    baseUrl: key === 'ai' ? merged.baseUrl : undefined,
  });
  return {
    ...result,
    latencyMs: result.latencyMs ?? Date.now() - startedAt,
  };
}

async function testAiConfig(config: Record<string, unknown>): Promise<ConfigTestResult> {
  const apiKey = str(config.apiKey);
  const baseUrl = (str(config.baseUrl) || 'https://api.deepseek.com/v1').replace(/\/+$/, '');
  const model = str(config.textModel) || 'deepseek-chat';
  if (!apiKey) return { ok: false, message: '未配置 AI API Key。' };
  const startedAt = Date.now();
  const upstream = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: 'Hi' }],
      max_tokens: 5,
      stream: false,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const latencyMs = Date.now() - startedAt;
  if (upstream.ok) return { ok: true, message: `AI 连接成功，延迟 ${latencyMs}ms。`, latencyMs };
  const text = await upstream.text().catch(() => '');
  return { ok: false, message: text || `AI 测试失败：HTTP ${upstream.status}`, latencyMs };
}

async function testAsrConfig(config: Record<string, unknown>): Promise<ConfigTestResult> {
  const provider = str(config.provider) || 'gateway-doubao';
  if (provider === 'gateway-doubao') {
    const missing = requiredMissing(config, ['doubaoAppId', 'doubaoAccessToken', 'doubaoResourceId']);
    return missing.length
      ? { ok: false, message: `豆包 Gateway 缺少：${missing.join('、')}` }
      : { ok: true, message: '豆包 Gateway 配置完整。保存后可在面试页进行实时流式测试。' };
  }
  if (provider === 'gateway-iflytek') {
    const missing = requiredMissing(config, ['iflytekAppId', 'iflytekApiKey', 'iflytekApiSecret']);
    return missing.length
      ? { ok: false, message: `讯飞 Gateway 缺少：${missing.join('、')}` }
      : { ok: true, message: '讯飞 Gateway 配置完整。' };
  }
  if (provider === 'gateway-alibaba') {
    const missing = requiredMissing(config, ['alibabaAppKey', 'alibabaToken']);
    return missing.length
      ? { ok: false, message: `阿里 Gateway 缺少：${missing.join('、')}` }
      : { ok: true, message: '阿里 Gateway 配置完整。' };
  }
  return { ok: true, message: `已保存 ${provider} 配置。商业版建议优先使用 gateway-doubao / gateway-iflytek / gateway-alibaba。` };
}

async function listAuditLogs(supabase: AdminSupabaseClient) {
  const { data, error } = await supabase
    .from('admin_audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return { logs: data ?? [] };
}

async function audit(
  supabase: AdminSupabaseClient,
  actorUserId: string,
  action: string,
  targetUserId?: string,
  metadata: Record<string, unknown> = {},
) {
  await supabase.from('admin_audit_logs').insert({
    actor_user_id: actorUserId,
    action,
    target_user_id: targetUserId ?? null,
    metadata,
  });
}

function mergeConfig(current: unknown, patch: Record<string, unknown>) {
  const base = typeof current === 'object' && current ? { ...(current as Record<string, unknown>) } : {};
  for (const [key, value] of Object.entries(patch)) {
    if (typeof value === 'string' && value.trim() === '********') continue;
    base[key] = value;
  }
  return base;
}

function maskSecrets(key: string, value: Record<string, unknown>) {
  const secretKeys = key === 'ai'
    ? ['apiKey']
    : ['doubaoAccessToken', 'iflytekApiKey', 'iflytekApiSecret', 'alibabaToken'];
  const masked = { ...value };
  for (const secretKey of secretKeys) {
    if (masked[secretKey]) masked[secretKey] = '********';
  }
  return masked;
}

function requiredMissing(config: Record<string, unknown>, keys: string[]): string[] {
  return keys.filter((key) => !str(config[key]));
}

function str(value: unknown): string {
  return typeof value === 'string' && value !== '********' ? value.trim() : '';
}

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
