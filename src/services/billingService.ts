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
  const server = await billingRequest('ensure');
  return server?.entitlement ?? null;
}

type BillingServerPayload = {
  entitlement: BillingEntitlement;
  remainingSeconds: number;
  hasAccess: boolean;
};

async function billingRequest(action: 'ensure' | 'consume', seconds?: number): Promise<BillingServerPayload | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return null;
  const response = await fetch('/api/billing', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ action, seconds }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error ?? '同步账户额度失败。');
  }
  return payload as BillingServerPayload;
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
  const server = await billingRequest('consume', seconds);
  return server?.entitlement ?? null;
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
