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
    action?: 'ensure' | 'consume' | 'redeemCardKey';
    seconds?: number;
    code?: string;
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

    if (action === 'redeemCardKey') {
      const code = String(body.code || '').trim().toUpperCase();
      if (!code) {
        response.status(400).json({ error: '请输入卡密兑换码。' });
        return;
      }

      const { data: card, error: cardError } = await supabase
        .from('license_card_keys')
        .select('*')
        .eq('code', code)
        .maybeSingle();

      if (cardError) throw cardError;
      if (!card) {
        response.status(404).json({ error: '无效的卡密，请检查是否输入正确。' });
        return;
      }
      if (card.status === 'redeemed') {
        response.status(400).json({ error: '该卡密已被使用，无法重复兑换。' });
        return;
      }
      if (card.status === 'revoked') {
        response.status(400).json({ error: '该卡密已被管理员作废，请联系客服处理。' });
        return;
      }
      if (card.expires_at && new Date(card.expires_at).getTime() < Date.now()) {
        await supabase
          .from('license_card_keys')
          .update({ status: 'expired', updated_at: new Date().toISOString() })
          .eq('id', card.id);
        response.status(400).json({ error: '该卡密已过期。' });
        return;
      }
      if (card.status !== 'unused') {
        response.status(400).json({ error: '卡密状态异常，无法兑换。' });
        return;
      }

      // 原子更新卡密状态为已兑换
      const { data: updatedCard, error: updateCardError } = await supabase
        .from('license_card_keys')
        .update({
          status: 'redeemed',
          redeemed_by: data.user.id,
          redeemed_by_email: data.user.email ?? null,
          redeemed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', card.id)
        .eq('status', 'unused')
        .select('*')
        .single();

      if (updateCardError || !updatedCard) {
        response.status(409).json({ error: '卡密兑换并发冲突或已被使用，请重试。' });
        return;
      }

      // 累加用户权益分钟
      const minutesToAdd = Number(card.minutes ?? 30);
      const nextPurchased = Number(current.purchased_minutes ?? 0) + minutesToAdd;
      const { data: updatedEntitlement, error: entitlementError } = await supabase
        .from('user_entitlements')
        .update({
          purchased_minutes: nextPurchased,
          plan: card.plan || (current.plan === 'none' || current.plan === 'trial' ? 'pro' : current.plan),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', data.user.id)
        .select('*')
        .single();

      if (entitlementError) throw entitlementError;

      // 记录充值流水
      await supabase.from('billing_transactions').insert({
        user_id: data.user.id,
        type: 'card_key_redemption',
        minutes: minutesToAdd,
        note: `卡密兑换: ${card.code} (${card.batch_no || '默认批次'})`,
      });

      response.status(200).json({
        ...toPayload(updatedEntitlement as EntitlementRow),
        redeemedCard: {
          code: card.code,
          minutes: minutesToAdd,
          batchNo: card.batch_no,
          plan: card.plan,
        },
        message: `恭喜！成功兑换 ${minutesToAdd} 分钟面试时长。`,
      });
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
