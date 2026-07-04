import { supabase } from './supabaseClient';

export type AdminUserRow = {
  id: string;
  email?: string;
  createdAt?: string;
  lastSignInAt?: string;
  role: 'user' | 'admin';
  bannedAt: string | null;
  banReason: string | null;
  plan: string;
  purchasedMinutes: number;
  freeTrialMinutes: number;
  usedSeconds: number;
  remainingSeconds: number;
  subscriptionStatus: string;
};

export type BillingTransactionRow = {
  id: string;
  user_id: string;
  actor_user_id: string | null;
  type: string;
  minutes: number;
  amount_cents: number | null;
  currency: string | null;
  stripe_session_id: string | null;
  note: string | null;
  created_at: string;
};

export type AdminAuditLogRow = {
  id: string;
  actor_user_id: string | null;
  action: string;
  target_user_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type AdminConfig = {
  key: 'ai' | 'asr' | 'plans';
  value: Record<string, unknown>;
  updatedAt?: string;
};

export type CouponCodeRow = {
  id: string;
  code: string;
  status: 'active' | 'paused' | 'expired';
  discount_percent: number;
  bonus_minutes: number;
  max_redemptions: number;
  redemptions: number;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type SupportTicketRow = {
  id: string;
  user_id: string | null;
  email: string;
  subject: string;
  message: string;
  status: 'open' | 'pending' | 'resolved' | 'closed';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  admin_note: string | null;
  created_at: string;
  updated_at: string;
};

export type GrowthExperimentRow = {
  id: string;
  name: string;
  status: 'draft' | 'running' | 'paused' | 'finished';
  variants: unknown[];
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type RiskRuleRow = {
  id: string;
  key: string;
  enabled: boolean;
  threshold: number;
  action: 'alert' | 'limit' | 'ban';
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type CommercialOpsPayload = {
  coupons: CouponCodeRow[];
  tickets: SupportTicketRow[];
  experiments: GrowthExperimentRow[];
  riskRules: RiskRuleRow[];
  metrics: {
    users: number;
    paidMinutes: number;
    usedMinutes: number;
    openTickets: number;
    activeCoupons: number;
  };
};

export async function adminRequest<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  if (!supabase) throw new Error('Supabase 未配置，无法进入后台。');
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('请先登录管理员账号。');
  const response = await fetch('/api/admin', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ action, ...payload }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body?.error ?? '后台请求失败。');
  }
  return body as T;
}
