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

const PLAN_CONFIG = {
  starter: { minutes: 60, amount: 2900, name: '面试猪首面体验包', mode: 'payment', priceEnv: 'STRIPE_PRICE_STARTER' },
  pro: { minutes: 180, amount: 6900, name: '面试猪冲刺加量包', mode: 'payment', priceEnv: 'STRIPE_PRICE_PRO' },
  monthly: { minutes: 600, amount: 12900, name: '面试猪求职月卡', mode: 'subscription', priceEnv: 'STRIPE_PRICE_MONTHLY' },
} as const;

type PlanId = keyof typeof PLAN_CONFIG;

type StripeCheckoutResponse = {
  url?: string;
  error?: { message?: string };
};

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== 'POST') {
    response.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!stripeKey || !supabaseUrl || !supabaseServiceRoleKey) {
    response.status(500).json({ error: '支付服务还没有配置完成。' });
    return;
  }

  const body = (typeof request.body === 'string' ? JSON.parse(request.body) : request.body) as { planId?: string };
  const planId = isPlanId(body?.planId) ? body.planId : undefined;
  const plan = planId ? PLAN_CONFIG[planId] : undefined;
  if (!plan || !planId) {
    response.status(400).json({ error: '未知套餐。' });
    return;
  }

  const authorization = firstHeader(request.headers.authorization);
  const token = authorization?.replace(/^Bearer\s+/i, '');
  if (!token) {
    response.status(401).json({ error: '请先登录。' });
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    response.status(401).json({ error: '登录状态无效，请重新登录。' });
    return;
  }

  const origin = process.env.PUBLIC_APP_URL ?? requestOrigin(request.headers) ?? 'https://interviewdog-free.vercel.app';
  const priceId = process.env[plan.priceEnv];
  const form = new URLSearchParams();
  form.set('mode', plan.mode);
  form.set('success_url', `${origin}/billing?checkout=success`);
  form.set('cancel_url', `${origin}/billing?checkout=cancel`);
  form.set('client_reference_id', data.user.id);
  form.set('customer_email', data.user.email ?? '');
  form.set('metadata[user_id]', data.user.id);
  form.set('metadata[plan_id]', planId);
  form.set('metadata[minutes]', String(plan.minutes));
  form.set('allow_promotion_codes', 'true');

  if (priceId) {
    form.set('line_items[0][price]', priceId);
  } else {
    form.set('line_items[0][price_data][currency]', 'cny');
    form.set('line_items[0][price_data][product_data][name]', plan.name);
    form.set('line_items[0][price_data][unit_amount]', String(plan.amount));
    if (plan.mode === 'subscription') {
      form.set('line_items[0][price_data][recurring][interval]', 'month');
    }
  }
  form.set('line_items[0][quantity]', '1');

  const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Stripe-Version': '2026-02-25.clover',
    },
    body: form,
  });
  const payload = await stripeResponse.json() as StripeCheckoutResponse;
  if (!stripeResponse.ok) {
    response.status(stripeResponse.status).json({ error: payload?.error?.message ?? '创建支付订单失败。' });
    return;
  }
  response.status(200).json({ url: payload.url });
}

function isPlanId(value: unknown): value is PlanId {
  return typeof value === 'string' && value in PLAN_CONFIG;
}

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function requestOrigin(headers: ApiRequest['headers']): string | undefined {
  const host = firstHeader(headers.host);
  if (!host) return undefined;
  const proto = firstHeader(headers['x-forwarded-proto']) ?? 'https';
  return `${proto}://${host}`;
}
