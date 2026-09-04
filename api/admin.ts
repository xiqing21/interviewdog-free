import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

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
  | 'listAuditLogs'
  | 'listCommercialOps'
  | 'createCoupon'
  | 'updateCoupon'
  | 'createTicket'
  | 'updateTicket'
  | 'saveExperiment'
  | 'saveRiskRule'
  | 'getSeoInsights'
  | 'submitIndexNow'
  | 'submitBingUrls'
  | 'submitGoogleSitemap'
  | 'listCardKeys'
  | 'generateCardKeys'
  | 'createSingleCardKey'
  | 'revokeCardKey'
  | 'deleteCardKey'
  | 'batchDeleteCardKeys'
  | 'batchDeleteRevokedCards'
  | 'batchRevokeByBatch'
  | 'batchDeleteUnusedByBatch'
  | 'adminRedeemCardKey'
  | 'updateCardKeyNote'
  | 'markCardKeysListed';

type AdminUser = {
  id: string;
  email: string;
};

type AppConfigKey = 'ai' | 'asr' | 'plans' | 'seo';
type AdminSupabaseClient = any;
type ConfigTestResult = { ok: boolean; message: string; latencyMs?: number };

const CONFIG_KEYS = ['ai', 'asr', 'plans', 'seo'] as const;
const DEFAULT_SITE_URL = 'https://mianshizhu.cn';
const DEFAULT_INDEXNOW_KEY = 'b3e625447e10bd10977cdc2faafa3b38';
const DEFAULT_SEO_PATHS = ['/', '/interview', '/knowledge', '/billing'];

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
    id?: string;
    code?: string;
    status?: string;
    discountPercent?: number;
    bonusMinutes?: number;
    maxRedemptions?: number;
    email?: string;
    subject?: string;
    message?: string;
    priority?: string;
    adminNote?: string;
    name?: string;
    variants?: unknown;
    enabled?: boolean;
    threshold?: number;
    ruleKey?: string;
    actionValue?: string;
    days?: number;
    urls?: string[];
    batchNo?: string;
    count?: number;
    expiresAt?: string;
    search?: string;
    limit?: number;
    plan?: string;
    listed?: string;
    listedChannel?: string;
    ids?: string[];
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
    if (body.action === 'listCommercialOps') {
      response.status(200).json(await listCommercialOps(supabase));
      return;
    }
    if (body.action === 'createCoupon') {
      response.status(200).json(await createCoupon(supabase, actor, body));
      return;
    }
    if (body.action === 'updateCoupon') {
      response.status(200).json(await updateCoupon(supabase, actor, body));
      return;
    }
    if (body.action === 'createTicket') {
      response.status(200).json(await createTicket(supabase, actor, body));
      return;
    }
    if (body.action === 'updateTicket') {
      response.status(200).json(await updateTicket(supabase, actor, body));
      return;
    }
    if (body.action === 'saveExperiment') {
      response.status(200).json(await saveExperiment(supabase, actor, body));
      return;
    }
    if (body.action === 'saveRiskRule') {
      response.status(200).json(await saveRiskRule(supabase, actor, body));
      return;
    }
    if (body.action === 'getSeoInsights') {
      response.status(200).json(await getSeoInsights(supabase, actor, body.value ?? {}, body.days));
      return;
    }
    if (body.action === 'submitIndexNow') {
      response.status(200).json(await submitIndexNow(supabase, actor, body.value ?? {}, body.urls));
      return;
    }
    if (body.action === 'submitBingUrls') {
      response.status(200).json(await submitBingUrls(supabase, actor, body.value ?? {}, body.urls));
      return;
    }
    if (body.action === 'submitGoogleSitemap') {
      response.status(200).json(await submitGoogleSitemap(supabase, actor, body.value ?? {}));
      return;
    }
    if (body.action === 'listCardKeys') {
      response.status(200).json(await listCardKeys(supabase, {
        status: body.status,
        batchNo: body.batchNo,
        search: body.search,
        listed: body.listed,
        limit: body.limit,
      }));
      return;
    }
    if (body.action === 'generateCardKeys') {
      response.status(200).json(await generateCardKeys(supabase, actor, body));
      return;
    }
    if (body.action === 'createSingleCardKey') {
      response.status(200).json(await createSingleCardKey(supabase, actor, body));
      return;
    }
    if (body.action === 'revokeCardKey') {
      response.status(200).json(await revokeCardKey(supabase, actor, body.id, body.status));
      return;
    }
    if (body.action === 'deleteCardKey') {
      response.status(200).json(await deleteCardKey(supabase, actor, body.id));
      return;
    }
    if (body.action === 'batchDeleteCardKeys') {
      response.status(200).json(await batchDeleteCardKeys(supabase, actor, body.ids));
      return;
    }
    if (body.action === 'batchDeleteRevokedCards') {
      response.status(200).json(await batchDeleteRevokedCards(supabase, actor, body.batchNo));
      return;
    }
    if (body.action === 'batchRevokeByBatch') {
      response.status(200).json(await batchRevokeByBatch(supabase, actor, body.batchNo, body.status));
      return;
    }
    if (body.action === 'batchDeleteUnusedByBatch') {
      response.status(200).json(await batchDeleteUnusedByBatch(supabase, actor, body.batchNo));
      return;
    }
    if (body.action === 'adminRedeemCardKey') {
      response.status(200).json(await adminRedeemCardKey(supabase, actor, body));
      return;
    }
    if (body.action === 'updateCardKeyNote') {
      response.status(200).json(await updateCardKeyNote(supabase, actor, body.id, body.note));
      return;
    }
    if (body.action === 'markCardKeysListed') {
      response.status(200).json(await markCardKeysListed(supabase, actor, body));
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
  const result = key === 'ai'
    ? await testAiConfig(merged)
    : key === 'asr'
      ? await testAsrConfig(merged)
      : key === 'seo'
        ? await testSeoConfig(merged)
        : { ok: true, message: '套餐配置已保存。' };
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

async function testSeoConfig(config: Record<string, unknown>): Promise<ConfigTestResult> {
  const startedAt = Date.now();
  const siteUrl = normalizedSiteUrl(config);
  const messages: string[] = [];
  const indexNowKey = str(config.indexNowKey) || DEFAULT_INDEXNOW_KEY;
  messages.push(`站点：${siteUrl}`);
  messages.push(indexNowKey ? 'IndexNow Key 已配置。' : 'IndexNow Key 未配置。');
  if (str(config.googleServiceAccountJson)) {
    try {
      await getGoogleAccessToken(config);
      messages.push('Google Service Account 可换取访问令牌。');
    } catch (err) {
      messages.push(`Google 令牌测试失败：${err instanceof Error ? err.message : '未知错误'}`);
    }
  } else {
    messages.push('未填 Google Service Account JSON，暂不能拉 Search Console 搜索词。');
  }
  if (str(config.bingApiKey)) {
    messages.push('Bing Webmaster API Key 已配置，可拉取 query stats / 提交 URL。');
  } else {
    messages.push('未填 Bing Webmaster API Key，仍可使用 IndexNow。');
  }
  return { ok: true, message: messages.join(' '), latencyMs: Date.now() - startedAt };
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

async function listCommercialOps(supabase: AdminSupabaseClient) {
  const [couponResult, ticketResult, experimentResult, riskResult, userResult, txResult] = await Promise.all([
    supabase.from('coupon_codes').select('*').order('created_at', { ascending: false }).limit(100),
    supabase.from('support_tickets').select('*').order('created_at', { ascending: false }).limit(100),
    supabase.from('growth_experiments').select('*').order('created_at', { ascending: false }).limit(50),
    supabase.from('risk_rules').select('*').order('created_at', { ascending: false }).limit(50),
    supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    supabase.from('billing_transactions').select('*').order('created_at', { ascending: false }).limit(1000),
  ]);
  const firstError = couponResult.error || ticketResult.error || experimentResult.error || riskResult.error || userResult.error || txResult.error;
  if (firstError) throw firstError;
  const users = userResult.data?.users ?? [];
  const transactions = txResult.data ?? [];
  const paidMinutes = transactions
    .filter((item: any) => ['stripe_purchase', 'subscription_grant', 'manual_grant'].includes(item.type))
    .reduce((sum: number, item: any) => sum + Number(item.minutes ?? 0), 0);
  const usedSeconds = await totalUsedSeconds(supabase);
  return {
    coupons: couponResult.data ?? [],
    tickets: ticketResult.data ?? [],
    experiments: experimentResult.data ?? [],
    riskRules: riskResult.data ?? [],
    metrics: {
      users: users.length,
      paidMinutes,
      usedMinutes: Math.floor(usedSeconds / 60),
      openTickets: (ticketResult.data ?? []).filter((ticket: any) => ticket.status === 'open').length,
      activeCoupons: (couponResult.data ?? []).filter((coupon: any) => coupon.status === 'active').length,
    },
  };
}

async function createCoupon(supabase: AdminSupabaseClient, actor: AdminUser, body: any) {
  const code = str(body.code).toUpperCase();
  if (!code) throw new Error('请输入优惠码。');
  const payload = {
    code,
    status: str(body.status) || 'active',
    discount_percent: clampInt(body.discountPercent, 0, 100),
    bonus_minutes: Math.max(0, int(body.bonusMinutes, 0)),
    max_redemptions: Math.max(0, int(body.maxRedemptions, 100)),
    note: str(body.note),
    created_by: actor.id,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase.from('coupon_codes').insert(payload).select('*').single();
  if (error) throw error;
  await audit(supabase, actor.id, 'create_coupon', undefined, { code });
  return { ok: true, coupon: data };
}

async function updateCoupon(supabase: AdminSupabaseClient, actor: AdminUser, body: any) {
  if (!body.id) throw new Error('缺少优惠码 ID。');
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.status !== undefined) patch.status = str(body.status) || 'active';
  if (body.discountPercent !== undefined) patch.discount_percent = clampInt(body.discountPercent, 0, 100);
  if (body.bonusMinutes !== undefined) patch.bonus_minutes = Math.max(0, int(body.bonusMinutes, 0));
  if (body.maxRedemptions !== undefined) patch.max_redemptions = Math.max(0, int(body.maxRedemptions, 0));
  if (body.note !== undefined) patch.note = str(body.note);
  const { data, error } = await supabase.from('coupon_codes').update(patch).eq('id', body.id).select('*').single();
  if (error) throw error;
  await audit(supabase, actor.id, 'update_coupon', undefined, { id: body.id, patch });
  return { ok: true, coupon: data };
}

async function createTicket(supabase: AdminSupabaseClient, actor: AdminUser, body: any) {
  const email = str(body.email) || actor.email;
  const subject = str(body.subject);
  const message = str(body.message);
  if (!subject || !message) throw new Error('请输入工单标题和内容。');
  const { data, error } = await supabase.from('support_tickets').insert({
    user_id: body.userId ?? null,
    email,
    subject,
    message,
    priority: str(body.priority) || 'normal',
    status: 'open',
  }).select('*').single();
  if (error) throw error;
  await audit(supabase, actor.id, 'create_ticket', body.userId, { subject, email });
  return { ok: true, ticket: data };
}

async function updateTicket(supabase: AdminSupabaseClient, actor: AdminUser, body: any) {
  if (!body.id) throw new Error('缺少工单 ID。');
  const patch = {
    status: str(body.status) || 'open',
    priority: str(body.priority) || 'normal',
    admin_note: str(body.adminNote),
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase.from('support_tickets').update(patch).eq('id', body.id).select('*').single();
  if (error) throw error;
  await audit(supabase, actor.id, 'update_ticket', undefined, { id: body.id, patch });
  return { ok: true, ticket: data };
}

async function saveExperiment(supabase: AdminSupabaseClient, actor: AdminUser, body: any) {
  const name = str(body.name);
  if (!name) throw new Error('请输入实验名称。');
  const payload = {
    id: body.id || undefined,
    name,
    status: str(body.status) || 'draft',
    variants: parseJsonArray(body.variants),
    note: str(body.note),
    updated_by: actor.id,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase.from('growth_experiments').upsert(payload).select('*').single();
  if (error) throw error;
  await audit(supabase, actor.id, 'save_experiment', undefined, { id: data.id, name });
  return { ok: true, experiment: data };
}

async function saveRiskRule(supabase: AdminSupabaseClient, actor: AdminUser, body: any) {
  const key = str(body.ruleKey);
  if (!key) throw new Error('请输入风控规则 key。');
  const payload = {
    key,
    enabled: Boolean(body.enabled),
    threshold: Math.max(0, int(body.threshold, 0)),
    action: str(body.actionValue) || 'alert',
    note: str(body.note),
    updated_by: actor.id,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase.from('risk_rules').upsert(payload, { onConflict: 'key' }).select('*').single();
  if (error) throw error;
  await audit(supabase, actor.id, 'save_risk_rule', undefined, { key });
  return { ok: true, rule: data };
}

async function getSeoInsights(
  supabase: AdminSupabaseClient,
  actor: AdminUser,
  patch: Record<string, unknown>,
  days = 28,
) {
  const config = await loadMergedConfig(supabase, 'seo', patch);
  const google = await fetchGoogleSearchAnalytics(config, Math.max(1, Math.min(180, int(days, 28))));
  const bing = await fetchBingQueryStats(config);
  const checklist = buildGeoChecklist(config);
  await audit(supabase, actor.id, 'get_seo_insights', undefined, {
    googleRows: google.rows.length,
    bingRows: bing.rows.length,
    days,
  });
  return { google, bing, checklist };
}

async function submitIndexNow(
  supabase: AdminSupabaseClient,
  actor: AdminUser,
  patch: Record<string, unknown>,
  urls?: string[],
) {
  const config = await loadMergedConfig(supabase, 'seo', patch);
  const siteUrl = normalizedSiteUrl(config);
  const host = str(config.indexNowHost) || new URL(siteUrl).host;
  const key = str(config.indexNowKey) || DEFAULT_INDEXNOW_KEY;
  const urlList = normalizeUrlList(siteUrl, urls);
  const keyLocation = str(config.indexNowKeyLocation) || `https://${host}/${key}.txt`;
  const startedAt = Date.now();
  const upstream = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host, key, keyLocation, urlList }),
    signal: AbortSignal.timeout(15_000),
  });
  const text = await upstream.text().catch(() => '');
  const ok = upstream.status === 200 || upstream.status === 202;
  await audit(supabase, actor.id, 'submit_indexnow', undefined, {
    ok,
    status: upstream.status,
    count: urlList.length,
    latencyMs: Date.now() - startedAt,
  });
  return {
    ok,
    status: upstream.status,
    message: ok ? `IndexNow 已接收 ${urlList.length} 个 URL。` : text || `IndexNow 提交失败：HTTP ${upstream.status}`,
    urlList,
    latencyMs: Date.now() - startedAt,
  };
}

async function submitBingUrls(
  supabase: AdminSupabaseClient,
  actor: AdminUser,
  patch: Record<string, unknown>,
  urls?: string[],
) {
  const config = await loadMergedConfig(supabase, 'seo', patch);
  const apiKey = str(config.bingApiKey);
  if (!apiKey) throw new Error('请先配置 Bing Webmaster API Key。');
  const siteUrl = normalizedSiteUrl(config);
  const urlList = normalizeUrlList(siteUrl, urls);
  const startedAt = Date.now();
  const upstream = await fetch(`https://ssl.bing.com/webmaster/api.svc/json/SubmitUrlBatch?apikey=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ siteUrl, urlList }),
    signal: AbortSignal.timeout(15_000),
  });
  const text = await upstream.text().catch(() => '');
  const ok = upstream.ok;
  await audit(supabase, actor.id, 'submit_bing_urls', undefined, {
    ok,
    status: upstream.status,
    count: urlList.length,
    latencyMs: Date.now() - startedAt,
  });
  return {
    ok,
    status: upstream.status,
    message: ok ? `Bing Webmaster 已提交 ${urlList.length} 个 URL。` : text || `Bing 提交失败：HTTP ${upstream.status}`,
    urlList,
    latencyMs: Date.now() - startedAt,
  };
}

async function submitGoogleSitemap(
  supabase: AdminSupabaseClient,
  actor: AdminUser,
  patch: Record<string, unknown>,
) {
  const config = await loadMergedConfig(supabase, 'seo', patch);
  const siteUrl = str(config.googleSiteUrl) || normalizedSiteUrl(config);
  const sitemapUrl = str(config.sitemapUrl) || `${normalizedSiteUrl(config).replace(/\/$/, '')}/sitemap.xml`;
  const token = await getGoogleAccessToken(config);
  const startedAt = Date.now();
  const upstream = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/sitemaps/${encodeURIComponent(sitemapUrl)}`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15_000),
    },
  );
  const text = await upstream.text().catch(() => '');
  const ok = upstream.ok;
  await audit(supabase, actor.id, 'submit_google_sitemap', undefined, {
    ok,
    status: upstream.status,
    sitemapUrl,
    latencyMs: Date.now() - startedAt,
  });
  return {
    ok,
    status: upstream.status,
    message: ok ? `Google Sitemap 已提交：${sitemapUrl}` : text || `Google Sitemap 提交失败：HTTP ${upstream.status}`,
    sitemapUrl,
    latencyMs: Date.now() - startedAt,
  };
}

async function loadMergedConfig(
  supabase: AdminSupabaseClient,
  key: AppConfigKey,
  patch: Record<string, unknown>,
) {
  const { data: current } = await supabase.from('admin_app_config').select('value').eq('key', key).maybeSingle();
  return mergeConfig(current?.value ?? {}, patch);
}

async function fetchGoogleSearchAnalytics(config: Record<string, unknown>, days: number) {
  const siteUrl = str(config.googleSiteUrl) || normalizedSiteUrl(config);
  if (!str(config.googleServiceAccountJson)) {
    return {
      ok: false,
      message: '未配置 Google Service Account JSON。',
      rows: [],
    };
  }
  const end = new Date();
  end.setDate(end.getDate() - 2);
  const start = new Date(end);
  start.setDate(start.getDate() - days);
  const body = {
    startDate: toDateString(start),
    endDate: toDateString(end),
    dimensions: ['query', 'page'],
    rowLimit: 50,
    startRow: 0,
  };
  const token = await getGoogleAccessToken(config);
  const startedAt = Date.now();
  const upstream = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    },
  );
  const json: any = await upstream.json().catch(async () => ({ error: await upstream.text().catch(() => '') }));
  if (!upstream.ok) {
    return {
      ok: false,
      message: json?.error?.message || `Google Search Console 请求失败：HTTP ${upstream.status}`,
      rows: [],
      latencyMs: Date.now() - startedAt,
    };
  }
  return {
    ok: true,
    message: `已拉取最近 ${days} 天 Google 搜索词。`,
    rows: (json.rows ?? []).map((row: any) => ({
      query: row.keys?.[0] ?? '',
      page: row.keys?.[1] ?? '',
      clicks: row.clicks ?? 0,
      impressions: row.impressions ?? 0,
      ctr: row.ctr ?? 0,
      position: row.position ?? 0,
    })),
    latencyMs: Date.now() - startedAt,
  };
}

async function fetchBingQueryStats(config: Record<string, unknown>) {
  const apiKey = str(config.bingApiKey);
  if (!apiKey) {
    return { ok: false, message: '未配置 Bing Webmaster API Key。', rows: [] };
  }
  const siteUrl = normalizedSiteUrl(config);
  const startedAt = Date.now();
  const upstream = await fetch(
    `https://ssl.bing.com/webmaster/api.svc/json/GetQueryStats?siteUrl=${encodeURIComponent(siteUrl)}&apikey=${encodeURIComponent(apiKey)}`,
    { signal: AbortSignal.timeout(20_000) },
  );
  const json: any = await upstream.json().catch(async () => ({ error: await upstream.text().catch(() => '') }));
  if (!upstream.ok) {
    return {
      ok: false,
      message: json?.error || `Bing Webmaster 请求失败：HTTP ${upstream.status}`,
      rows: [],
      latencyMs: Date.now() - startedAt,
    };
  }
  return {
    ok: true,
    message: '已拉取 Bing 搜索词数据。',
    rows: (json.d ?? []).map((row: any) => ({
      query: row.Query ?? '',
      clicks: row.Clicks ?? 0,
      impressions: row.Impressions ?? 0,
      avgClickPosition: row.AvgClickPosition ?? 0,
      avgImpressionPosition: row.AvgImpressionPosition ?? 0,
      date: row.Date ?? '',
    })),
    latencyMs: Date.now() - startedAt,
  };
}

async function getGoogleAccessToken(config: Record<string, unknown>) {
  const rawJson = str(config.googleServiceAccountJson).replace(/\\n/g, '\n');
  if (!rawJson) throw new Error('未配置 Google Service Account JSON。');
  let account: { client_email?: string; private_key?: string };
  try {
    account = JSON.parse(rawJson);
  } catch {
    throw new Error('Google Service Account JSON 格式不正确。');
  }
  if (!account.client_email || !account.private_key) {
    throw new Error('Google Service Account JSON 缺少 client_email 或 private_key。');
  }
  const now = Math.floor(Date.now() / 1000);
  const assertion = signJwt(
    { alg: 'RS256', typ: 'JWT' },
    {
      iss: account.client_email,
      scope: 'https://www.googleapis.com/auth/webmasters https://www.googleapis.com/auth/webmasters.readonly',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    },
    account.private_key,
  );
  const upstream = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const json: any = await upstream.json().catch(async () => ({ error_description: await upstream.text().catch(() => '') }));
  if (!upstream.ok || !json.access_token) {
    throw new Error(json.error_description || json.error || `Google OAuth 失败：HTTP ${upstream.status}`);
  }
  return String(json.access_token);
}

function signJwt(header: Record<string, unknown>, payload: Record<string, unknown>, privateKey: string) {
  const encodedHeader = base64Url(JSON.stringify(header));
  const encodedPayload = base64Url(JSON.stringify(payload));
  const input = `${encodedHeader}.${encodedPayload}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(input);
  signer.end();
  return `${input}.${signer.sign(privateKey, 'base64url')}`;
}

function base64Url(value: string) {
  return Buffer.from(value).toString('base64url');
}

function normalizedSiteUrl(config: Record<string, unknown>) {
  const raw = str(config.siteUrl) || DEFAULT_SITE_URL;
  try {
    const url = new URL(raw);
    return `${url.protocol}//${url.host}${url.pathname === '/' ? '' : url.pathname.replace(/\/$/, '')}`;
  } catch {
    return DEFAULT_SITE_URL;
  }
}

function normalizeUrlList(siteUrl: string, urls?: string[]) {
  const base = siteUrl.replace(/\/$/, '');
  const candidates = urls?.length ? urls : DEFAULT_SEO_PATHS.map((path) => `${base}${path === '/' ? '' : path}`);
  return Array.from(new Set(candidates.map((url) => {
    if (/^https?:\/\//i.test(url)) return url;
    return `${base}/${url.replace(/^\/+/, '')}`;
  })));
}

function buildGeoChecklist(config: Record<string, unknown>) {
  const siteUrl = normalizedSiteUrl(config).replace(/\/$/, '');
  return [
    { label: 'robots.txt', ok: true, detail: `${siteUrl}/robots.txt 已声明 sitemap。` },
    { label: 'sitemap.xml', ok: true, detail: `${siteUrl}/sitemap.xml 可提交给 Google/Bing。` },
    { label: 'llms.txt', ok: true, detail: `${siteUrl}/llms.txt 已为 AI 搜索/答案引擎提供产品摘要。` },
    { label: '结构化数据', ok: true, detail: '首页已包含 SoftwareApplication JSON-LD、OG 和 Twitter Card。' },
    { label: 'Search Console', ok: Boolean(str(config.googleServiceAccountJson)), detail: str(config.googleServiceAccountJson) ? '已配置 Google Service Account。' : '需要填 Service Account JSON，并把服务账号邮箱加入 Search Console 资源。' },
    { label: 'Bing Webmaster', ok: Boolean(str(config.bingApiKey)), detail: str(config.bingApiKey) ? '已配置 Bing API Key。' : '需要在 Bing Webmaster Tools 生成 API Key。' },
    { label: 'IndexNow', ok: Boolean(str(config.indexNowKey) || DEFAULT_INDEXNOW_KEY), detail: `Key 文件路径：${siteUrl}/${str(config.indexNowKey) || DEFAULT_INDEXNOW_KEY}.txt` },
  ];
}

function toDateString(date: Date) {
  return date.toISOString().slice(0, 10);
}

async function listCardKeys(
  supabase: AdminSupabaseClient,
  params: { status?: string; batchNo?: string; search?: string; listed?: string; limit?: number } = {},
) {
  let query = supabase
    .from('license_card_keys')
    .select('*')
    .order('created_at', { ascending: false });

  if (params.status && params.status !== 'all') {
    query = query.eq('status', params.status);
  }
  if (params.batchNo && params.batchNo !== 'all') {
    query = query.eq('batch_no', params.batchNo);
  }
  if (params.listed === 'yes') {
    query = query.not('listed_at', 'is', null);
  } else if (params.listed === 'no') {
    query = query.is('listed_at', null);
  }
  if (params.search) {
    const search = params.search.trim();
    query = query.or(`code.ilike.%${search}%,redeemed_by_email.ilike.%${search}%,note.ilike.%${search}%,batch_no.ilike.%${search}%`);
  }
  const limit = Math.min(500, Math.max(1, params.limit ?? 200));
  query = query.limit(limit);

  const { data: cardKeys, error } = await query;
  if (error) throw error;

  // 全量汇总指标
  const { data: allKeys, error: statsError } = await supabase
    .from('license_card_keys')
    .select('id, batch_no, status, minutes, redeemed_at, listed_at');
  if (statsError) throw statsError;

  const list = allKeys ?? [];
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const lowStockThreshold = 20;

  const batchStatsMap = new Map<string, {
    batchNo: string;
    count: number;
    unused: number;
    redeemed: number;
    revoked: number;
    minutes: number;
    isCampaign: boolean;
  }>();

  for (const k of list) {
    const b = k.batch_no || 'DEFAULT';
    const isCampaign =
      b.toUpperCase().startsWith('EVENT-') ||
      b.toUpperCase().startsWith('ACT-') ||
      b.toUpperCase().startsWith('CAMPAIGN-');
    let entry = batchStatsMap.get(b);
    if (!entry) {
      entry = {
        batchNo: b,
        count: 0,
        unused: 0,
        redeemed: 0,
        revoked: 0,
        minutes: Number(k.minutes ?? 30),
        isCampaign,
      };
      batchStatsMap.set(b, entry);
    }
    entry.count += 1;
    if (k.status === 'unused') entry.unused += 1;
    else if (k.status === 'redeemed') entry.redeemed += 1;
    else if (k.status === 'revoked') entry.revoked += 1;
  }

  const unused = list.filter((k: any) => k.status === 'unused');
  const listedUnused = unused.filter((k: any) => Boolean(k.listed_at)).length;
  const unlistedUnused = unused.length - listedUnused;
  const summary = {
    total: list.length,
    unused: unused.length,
    listedUnused,
    unlistedUnused,
    redeemed: list.filter((k: any) => k.status === 'redeemed').length,
    revoked: list.filter((k: any) => k.status === 'revoked').length,
    expired: list.filter((k: any) => k.status === 'expired').length,
    totalMinutesRedeemed: list
      .filter((k: any) => k.status === 'redeemed')
      .reduce((sum: number, k: any) => sum + Number(k.minutes ?? 0), 0),
    todayRedeemedCount: list.filter(
      (k: any) => k.status === 'redeemed' && k.redeemed_at && new Date(k.redeemed_at) >= startOfToday,
    ).length,
    lowStockThreshold,
    lowStock: listedUnused < lowStockThreshold,
    batches: Array.from(batchStatsMap.values()),
  };

  return {
    cardKeys: cardKeys ?? [],
    summary,
  };
}

async function generateCardKeys(
  supabase: AdminSupabaseClient,
  actor: AdminUser,
  body: {
    minutes?: number;
    count?: number;
    batchNo?: string;
    plan?: string;
    note?: string;
    expiresAt?: string;
    isCampaign?: boolean;
  },
) {
  const minutes = Math.max(1, int(body.minutes, 30));
  const count = Math.min(500, Math.max(1, int(body.count, 20)));
  const now = new Date();
  const dateTag = now.toISOString().slice(0, 10).replace(/-/g, '');
  const isCampaign = Boolean(body.isCampaign);

  let batchNo = str(body.batchNo);
  if (isCampaign) {
    if (!batchNo) {
      batchNo = `EVENT-${dateTag}-${minutes}M`;
    } else if (
      !batchNo.toUpperCase().startsWith('EVENT-') &&
      !batchNo.toUpperCase().startsWith('ACT-') &&
      !batchNo.toUpperCase().startsWith('CAMPAIGN-')
    ) {
      batchNo = `EVENT-${batchNo}`;
    }
  } else {
    batchNo = batchNo || `FAKA-${dateTag}-${minutes}M`;
  }

  const plan = str(body.plan) || 'pro';
  let note = str(body.note);
  if (isCampaign) {
    note = note ? `${note} [每人限领1张]` : `宣传活动福利卡密 (${count} 笔) [每人限领1张]`;
  } else {
    note = note || `批量生成 ${minutes} 分钟卡密 (${count} 笔)`;
  }
  const expiresAt = body.expiresAt ? new Date(body.expiresAt).toISOString() : null;

  const { data: existingRows, error: existingError } = await supabase
    .from('license_card_keys')
    .select('code');
  if (existingError) throw existingError;
  const generatedCodes = new Set<string>((existingRows ?? []).map((item: { code: string }) => item.code));
  const rows: Array<{
    code: string;
    batch_no: string;
    minutes: number;
    plan: string;
    status: string;
    note: string;
    created_by: string;
    expires_at: string | null;
  }> = [];

  let guard = 0;
  while (rows.length < count) {
    guard += 1;
    if (guard > count * 20) throw new Error('卡密编码生成冲突过多，请重试。');
    const part1 = crypto.randomBytes(2).toString('hex').toUpperCase();
    const part2 = crypto.randomBytes(2).toString('hex').toUpperCase();
    const part3 = crypto.randomBytes(2).toString('hex').toUpperCase();
    const prefix = isCampaign ? `MSZ-ACT-${minutes}M` : `MSZ-${minutes}M`;
    const code = `${prefix}-${part1}-${part2}-${part3}`;
    if (!generatedCodes.has(code)) {
      generatedCodes.add(code);
      rows.push({
        code,
        batch_no: batchNo,
        minutes,
        plan,
        status: 'unused',
        note,
        created_by: actor.id,
        expires_at: expiresAt,
      });
    }
  }

  const { data, error } = await supabase.from('license_card_keys').insert(rows).select('*');
  if (error) throw error;

  await audit(supabase, actor.id, 'generate_card_keys', undefined, {
    batchNo,
    minutes,
    count,
    note,
  });

  return {
    ok: true,
    count: data.length,
    batchNo,
    minutes,
    cardKeys: data,
    plainTextList: data.map((item: any) => item.code).join('\n'),
  };
}

async function createSingleCardKey(
  supabase: AdminSupabaseClient,
  actor: AdminUser,
  body: {
    code?: string;
    minutes?: number;
    batchNo?: string;
    plan?: string;
    note?: string;
    expiresAt?: string;
  },
) {
  const code = str(body.code).toUpperCase();
  if (!code) throw new Error('请输入卡密编码。');
  const minutes = Math.max(1, int(body.minutes, 30));
  const batchNo = str(body.batchNo) || 'CUSTOM_SINGLE';
  const plan = str(body.plan) || 'pro';
  const note = str(body.note) || '手动单张创建卡密';
  const expiresAt = body.expiresAt ? new Date(body.expiresAt).toISOString() : null;

  const { data, error } = await supabase
    .from('license_card_keys')
    .insert({
      code,
      batch_no: batchNo,
      minutes,
      plan,
      status: 'unused',
      note,
      created_by: actor.id,
      expires_at: expiresAt,
    })
    .select('*')
    .single();

  if (error) throw error;
  await audit(supabase, actor.id, 'create_single_card_key', undefined, { code, minutes, batchNo });
  return { ok: true, cardKey: data };
}

async function revokeCardKey(supabase: AdminSupabaseClient, actor: AdminUser, id?: string, status = 'revoked') {
  if (!id) throw new Error('缺少卡密 ID。');
  const targetStatus = status === 'unused' ? 'unused' : 'revoked';
  const { data, error } = await supabase
    .from('license_card_keys')
    .update({ status: targetStatus, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  await audit(supabase, actor.id, 'revoke_card_key', undefined, { id, status: targetStatus });
  return { ok: true, cardKey: data };
}

async function deleteCardKey(supabase: AdminSupabaseClient, actor: AdminUser, id?: string) {
  if (!id) throw new Error('缺少卡密 ID。');
  const { data, error } = await supabase
    .from('license_card_keys')
    .delete()
    .eq('id', id)
    .neq('status', 'redeemed')
    .select('id, code');
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error('未找到该卡密或已被兑换（已兑换入账的卡密不可删除，需保留财务凭据）。');
  }
  await audit(supabase, actor.id, 'delete_card_key', undefined, { id, code: data[0]?.code });
  return { ok: true };
}

async function batchDeleteCardKeys(supabase: AdminSupabaseClient, actor: AdminUser, ids?: string[]) {
  if (!Array.isArray(ids) || ids.length === 0) throw new Error('请提供要删除的卡密 ID 列表。');
  const { data, error } = await supabase
    .from('license_card_keys')
    .delete()
    .in('id', ids)
    .neq('status', 'redeemed')
    .select('id, code');
  if (error) throw error;
  await audit(supabase, actor.id, 'batch_delete_card_keys', undefined, { count: data?.length ?? 0, ids });
  return { ok: true, count: data?.length ?? 0 };
}

async function batchDeleteRevokedCards(supabase: AdminSupabaseClient, actor: AdminUser, batchNo?: string) {
  let query = supabase.from('license_card_keys').delete().eq('status', 'revoked');
  if (batchNo && batchNo !== 'all') {
    query = query.eq('batch_no', batchNo);
  }
  const { data, error } = await query.select('id, code');
  if (error) throw error;
  await audit(supabase, actor.id, 'batch_delete_revoked_cards', undefined, { count: data?.length ?? 0, batchNo });
  return { ok: true, count: data?.length ?? 0 };
}

async function batchRevokeByBatch(supabase: AdminSupabaseClient, actor: AdminUser, batchNo?: string, status = 'revoked') {
  if (!batchNo || batchNo === 'all') throw new Error('请指定要批量操作的批次号。');
  const targetStatus = status === 'unused' ? 'unused' : 'revoked';
  const { data, error } = await supabase
    .from('license_card_keys')
    .update({ status: targetStatus, updated_at: new Date().toISOString() })
    .eq('batch_no', batchNo)
    .eq('status', status === 'unused' ? 'revoked' : 'unused')
    .select('id, code');

  if (error) throw error;
  await audit(supabase, actor.id, 'batch_revoke_card_keys', undefined, { batchNo, targetStatus, count: data.length });
  return { ok: true, count: data.length, batchNo };
}

async function batchDeleteUnusedByBatch(supabase: AdminSupabaseClient, actor: AdminUser, batchNo?: string) {
  if (!batchNo || batchNo === 'all') throw new Error('请指定要批量删除的批次号。');
  const { data, error } = await supabase
    .from('license_card_keys')
    .delete()
    .eq('batch_no', batchNo)
    .eq('status', 'unused')
    .select('id');

  if (error) throw error;
  await audit(supabase, actor.id, 'batch_delete_card_keys', undefined, { batchNo, count: data?.length ?? 0 });
  return { ok: true, count: data?.length ?? 0, batchNo };
}

async function adminRedeemCardKey(
  supabase: AdminSupabaseClient,
  actor: AdminUser,
  body: { id?: string; code?: string; userId?: string; email?: string },
) {
  const code = str(body.code).toUpperCase();
  const userId = str(body.userId);
  const email = str(body.email);

  if (!code && !body.id) throw new Error('请提供卡密编码或 ID。');
  if (!userId && !email) throw new Error('请提供目标用户的 ID 或邮箱。');

  let targetUserId = userId;
  let targetEmail = email;

  if (!targetUserId && targetEmail) {
    const { data: userData } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const match = (userData?.users ?? []).find((u: any) => u.email?.toLowerCase() === targetEmail.toLowerCase());
    if (!match) throw new Error(`未找到邮箱为 ${targetEmail} 的用户。`);
    targetUserId = match.id;
    targetEmail = match.email;
  }

  const query = supabase.from('license_card_keys').select('*');
  if (body.id) query.eq('id', body.id);
  else query.eq('code', code);
  const { data: card, error: cardError } = await query.maybeSingle();

  if (cardError) throw cardError;
  if (!card) throw new Error('卡密不存在。');
  if (card.status !== 'unused') throw new Error(`卡密状态为 ${card.status}，无法核销。`);

  // 原子锁定
  const { data: updatedCard, error: updateError } = await supabase
    .from('license_card_keys')
    .update({
      status: 'redeemed',
      redeemed_by: targetUserId,
      redeemed_by_email: targetEmail,
      redeemed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', card.id)
    .eq('status', 'unused')
    .select('*')
    .single();

  if (updateError || !updatedCard) throw new Error('卡密核销并发冲突。');

  // 累加用户权益
  const minutesToAdd = Number(card.minutes ?? 30);
  const { data: currentEntitlement } = await supabase
    .from('user_entitlements')
    .select('*')
    .eq('user_id', targetUserId)
    .maybeSingle();

  const nextPurchased = Number(currentEntitlement?.purchased_minutes ?? 0) + minutesToAdd;
  await supabase
    .from('user_entitlements')
    .upsert({
      user_id: targetUserId,
      free_trial_minutes: Number(currentEntitlement?.free_trial_minutes ?? 15),
      purchased_minutes: nextPurchased,
      used_seconds: Number(currentEntitlement?.used_seconds ?? 0),
      plan: card.plan || 'pro',
      subscription_status: currentEntitlement?.subscription_status ?? 'none',
      updated_at: new Date().toISOString(),
    });

  // 写入流水
  await supabase.from('billing_transactions').insert({
    user_id: targetUserId,
    actor_user_id: actor.id,
    type: 'card_key_redemption',
    minutes: minutesToAdd,
    note: `后台手动代充核销: ${card.code} (${card.batch_no})`,
  });

  await audit(supabase, actor.id, 'admin_redeem_card_key', targetUserId, { code: card.code, minutes: minutesToAdd });
  return { ok: true, cardKey: updatedCard, message: `已成功为 ${targetEmail || targetUserId} 充值 ${minutesToAdd} 分钟！` };
}

async function updateCardKeyNote(supabase: AdminSupabaseClient, actor: AdminUser, id?: string, note?: string) {
  if (!id) throw new Error('缺少卡密 ID。');
  const { data, error } = await supabase
    .from('license_card_keys')
    .update({ note: str(note), updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  await audit(supabase, actor.id, 'update_card_key_note', undefined, { id, note });
  return { ok: true, cardKey: data };
}

async function markCardKeysListed(
  supabase: AdminSupabaseClient,
  actor: AdminUser,
  body: {
    ids?: string[];
    batchNo?: string;
    listed?: boolean | string;
    listedChannel?: string;
  },
) {
  const listed = body.listed !== false && body.listed !== 'false';
  const channel = listed ? (str(body.listedChannel) || 'houfaka') : null;
  const listedAt = listed ? new Date().toISOString() : null;
  const ids = Array.isArray(body.ids) ? body.ids.filter(Boolean) : [];
  const batchNo = str(body.batchNo);

  if (ids.length === 0 && !batchNo) {
    throw new Error('请提供卡密 ID 或批次号。');
  }

  let query = supabase
    .from('license_card_keys')
    .update({
      listed_at: listedAt,
      listed_channel: channel,
      updated_at: new Date().toISOString(),
    })
    .eq('status', 'unused');

  if (ids.length > 0) query = query.in('id', ids);
  if (batchNo) query = query.eq('batch_no', batchNo);

  const { data, error } = await query.select('id, code, batch_no, listed_at, listed_channel');
  if (error) throw error;

  await audit(supabase, actor.id, listed ? 'mark_card_keys_listed' : 'unmark_card_keys_listed', undefined, {
    batchNo: batchNo || null,
    ids,
    count: data?.length ?? 0,
    channel,
  });

  return {
    ok: true,
    count: data?.length ?? 0,
    listed,
    channel,
    cardKeys: data ?? [],
  };
}

async function totalUsedSeconds(supabase: AdminSupabaseClient): Promise<number> {
  const { data, error } = await supabase.from('user_entitlements').select('used_seconds');
  if (error) return 0;
  return (data ?? []).reduce((sum: number, item: any) => sum + Number(item.used_seconds ?? 0), 0);
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
    : key === 'asr'
      ? ['doubaoAccessToken', 'iflytekApiKey', 'iflytekApiSecret', 'alibabaToken']
      : key === 'seo'
        ? ['googleServiceAccountJson', 'bingApiKey', 'indexNowKey']
        : [];
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

function int(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number) : fallback;
}

function clampInt(value: unknown, min: number, max: number): number {
  return Math.max(min, Math.min(max, int(value, min)));
}

function parseJsonArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return value.split('\n').map((item) => item.trim()).filter(Boolean);
  }
}

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
