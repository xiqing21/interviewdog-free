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

type EntitlementRow = {
  user_id: string;
  free_trial_minutes: number;
  purchased_minutes: number;
  used_seconds: number;
  plan: string;
  stripe_customer_id: string | null;
  subscription_status: string;
  updated_at: string;
};

const FREE_TRIAL_MINUTES = 15;

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== 'POST') {
    response.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    response.status(500).json({ error: '计费服务未配置。' });
    return;
  }

  const supabase: any = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  }) as any;

  const token = firstHeader(request.headers.authorization)?.replace(/^Bearer\s+/i, '');
  if (!token) {
    response.status(401).json({ error: '请先登录。' });
    return;
  }
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    response.status(401).json({ error: '登录状态无效。' });
    return;
  }

  const body = (typeof request.body === 'string' ? JSON.parse(request.body) : request.body) as {
    action?: 'ensure' | 'consume';
    seconds?: number;
  };
  const action = body.action ?? 'ensure';

  try {
    const current = await ensureEntitlement(supabase, data.user.id);
    if (action === 'ensure') {
      response.status(200).json(toPayload(current));
      return;
    }

    if (action === 'consume') {
      const seconds = Math.max(0, Math.min(60, Math.floor(Number(body.seconds ?? 0))));
      const totalSeconds = entitlementTotalSeconds(current);
      const nextUsedSeconds = Math.min(totalSeconds, Number(current.used_seconds ?? 0) + seconds);
      const { data: updated, error: updateError } = await supabase
        .from('user_entitlements')
        .update({
          used_seconds: nextUsedSeconds,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', data.user.id)
        .select('*')
        .single();
      if (updateError) throw updateError;
      response.status(200).json(toPayload(updated as EntitlementRow));
      return;
    }

    response.status(400).json({ error: '未知计费操作。' });
  } catch (err) {
    response.status(500).json({ error: err instanceof Error ? err.message : '计费操作失败。' });
  }
}

async function ensureEntitlement(supabase: any, userId: string): Promise<EntitlementRow> {
  const { data } = await supabase
    .from('user_entitlements')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (data) return data as EntitlementRow;

  const { data: created, error } = await supabase
    .from('user_entitlements')
    .insert({
      user_id: userId,
      free_trial_minutes: FREE_TRIAL_MINUTES,
      purchased_minutes: 0,
      used_seconds: 0,
      plan: 'trial',
      subscription_status: 'none',
      updated_at: new Date().toISOString(),
    })
    .select('*')
    .single();
  if (error) throw error;
  return created as EntitlementRow;
}

function entitlementTotalSeconds(row: EntitlementRow): number {
  return (Number(row.free_trial_minutes ?? FREE_TRIAL_MINUTES) + Number(row.purchased_minutes ?? 0)) * 60;
}

function toPayload(row: EntitlementRow) {
  const totalSeconds = entitlementTotalSeconds(row);
  const usedSeconds = Math.min(totalSeconds, Number(row.used_seconds ?? 0));
  return {
    entitlement: {
      userId: row.user_id,
      freeTrialMinutes: Number(row.free_trial_minutes ?? FREE_TRIAL_MINUTES),
      purchasedMinutes: Number(row.purchased_minutes ?? 0),
      usedSeconds,
      plan: row.plan ?? 'none',
      stripeCustomerId: row.stripe_customer_id ?? undefined,
      subscriptionStatus: row.subscription_status ?? 'none',
      updatedAt: new Date(row.updated_at).getTime(),
    },
    remainingSeconds: Math.max(0, totalSeconds - usedSeconds),
    hasAccess: totalSeconds - usedSeconds > 0,
  };
}

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
