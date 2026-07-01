import type { BillingEntitlement, CommercialPlanId } from '../types';
import { FREE_TRIAL_MINUTES } from '../config/commercial';
import { supabase } from './supabaseClient';

type EntitlementRow = {
  user_id: string;
  free_trial_minutes: number;
  purchased_minutes: number;
  used_seconds: number;
  plan: CommercialPlanId | 'none';
  stripe_customer_id: string | null;
  subscription_status: BillingEntitlement['subscriptionStatus'];
  updated_at: string;
};

export function canSyncBilling(): boolean {
  return Boolean(supabase);
}

export async function ensureEntitlement(): Promise<BillingEntitlement | null> {
  if (!supabase) return null;
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return null;

  const loaded = await loadEntitlement();
  if (loaded) return loaded;

  const { data, error } = await supabase
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
  return rowToEntitlement(data as EntitlementRow);
}

export async function loadEntitlement(): Promise<BillingEntitlement | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('user_entitlements')
    .select('*')
    .maybeSingle();
  if (error) throw error;
  return data ? rowToEntitlement(data as EntitlementRow) : null;
}

export async function consumeSeconds(seconds: number): Promise<BillingEntitlement | null> {
  if (!supabase || seconds <= 0) return null;
  const entitlement = await ensureEntitlement();
  if (!entitlement) return null;
  const nextUsedSeconds = entitlement.usedSeconds + seconds;
  const { data, error } = await supabase
    .from('user_entitlements')
    .update({
      used_seconds: nextUsedSeconds,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', entitlement.userId)
    .select('*')
    .single();
  if (error) throw error;
  return rowToEntitlement(data as EntitlementRow);
}

export async function createCheckoutSession(planId: CommercialPlanId): Promise<string> {
  if (!supabase) throw new Error('请先登录后再购买。');
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('登录状态已过期，请重新登录。');

  const response = await fetch('/api/create-checkout-session', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ planId }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.url) {
    throw new Error(payload?.error ?? '创建支付订单失败。');
  }
  return payload.url as string;
}

export function remainingSeconds(entitlement: BillingEntitlement | null): number {
  if (!entitlement) return FREE_TRIAL_MINUTES * 60;
  const totalSeconds = (entitlement.freeTrialMinutes + entitlement.purchasedMinutes) * 60;
  return Math.max(0, totalSeconds - entitlement.usedSeconds);
}

function rowToEntitlement(row: EntitlementRow): BillingEntitlement {
  return {
    userId: row.user_id,
    freeTrialMinutes: row.free_trial_minutes,
    purchasedMinutes: row.purchased_minutes,
    usedSeconds: row.used_seconds,
    plan: row.plan,
    stripeCustomerId: row.stripe_customer_id ?? undefined,
    subscriptionStatus: row.subscription_status ?? 'none',
    updatedAt: new Date(row.updated_at).getTime(),
  };
}
