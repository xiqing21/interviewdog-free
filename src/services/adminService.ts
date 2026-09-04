import { supabase } from './supabaseClient';
import { getApiUrl } from './apiHelper';

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
  key: 'ai' | 'asr' | 'plans' | 'seo';
  value: Record<string, unknown>;
  updatedAt?: string;
};

export type SeoInsightPayload = {
  google: {
    ok: boolean;
    message: string;
    latencyMs?: number;
    rows: Array<{
      query: string;
      page: string;
      clicks: number;
      impressions: number;
      ctr: number;
      position: number;
    }>;
  };
  bing: {
    ok: boolean;
    message: string;
    latencyMs?: number;
    rows: Array<{
      query: string;
      clicks: number;
      impressions: number;
      avgClickPosition: number;
      avgImpressionPosition: number;
      date: string;
    }>;
  };
  checklist: Array<{ label: string; ok: boolean; detail: string }>;
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

export type CardKeyStatus = 'unused' | 'redeemed' | 'revoked' | 'expired';

export type CardKeyRow = {
  id: string;
  code: string;
  batch_no: string;
  minutes: number;
  plan: string;
  status: CardKeyStatus;
  note: string | null;
  created_by?: string | null;
  redeemed_by?: string | null;
  redeemed_by_email?: string | null;
  redeemed_at?: string | null;
  expires_at?: string | null;
  listed_at?: string | null;
  listed_channel?: string | null;
  created_at: string;
  updated_at: string;
};

export type CardKeyBatchStat = {
  batchNo: string;
  count: number;
  unused: number;
  redeemed: number;
  revoked: number;
  minutes: number;
  isCampaign: boolean;
};

export type CardKeySummary = {
  total: number;
  unused: number;
  listedUnused: number;
  unlistedUnused: number;
  redeemed: number;
  revoked: number;
  expired: number;
  totalMinutesRedeemed: number;
  todayRedeemedCount: number;
  lowStockThreshold: number;
  lowStock: boolean;
  batches: CardKeyBatchStat[];
};

export type CardKeysPayload = {
  cardKeys: CardKeyRow[];
  summary: CardKeySummary;
};

export type GenerateCardKeysResponse = {
  ok: boolean;
  count: number;
  batchNo: string;
  minutes: number;
  cardKeys: CardKeyRow[];
  plainTextList: string;
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
  const response = await fetch(getApiUrl('/api/admin'), {
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
