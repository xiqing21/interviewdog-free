import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

export const config = {
  api: {
    bodyParser: false,
  },
};

type ApiRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  on: (event: 'data' | 'end' | 'error', callback: (chunk?: Buffer) => void) => void;
};

type ApiResponse = {
  status: (code: number) => ApiResponse;
  json: (body: unknown) => void;
};

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== 'POST') {
    response.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!webhookSecret || !supabaseUrl || !supabaseServiceRoleKey) {
    response.status(500).json({ error: 'Webhook is not configured.' });
    return;
  }

  const rawBody = await readRawBody(request);
  const signature = firstHeader(request.headers['stripe-signature']);
  if (!signature || !verifyStripeSignature(rawBody, signature, webhookSecret)) {
    response.status(400).json({ error: 'Invalid signature.' });
    return;
  }

  const event = JSON.parse(rawBody.toString('utf8'));
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (event.type === 'checkout.session.completed') {
    const session = event.data?.object ?? {};
    const userId = session.metadata?.user_id as string | undefined;
    const planId = session.metadata?.plan_id as string | undefined;
    const minutes = Number(session.metadata?.minutes ?? 0);
    if (userId && minutes > 0) {
      const { data } = await supabase
        .from('user_entitlements')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      const purchased = Number(data?.purchased_minutes ?? 0) + minutes;
      await supabase.from('user_entitlements').upsert({
        user_id: userId,
        free_trial_minutes: Number(data?.free_trial_minutes ?? 15),
        purchased_minutes: purchased,
        used_seconds: Number(data?.used_seconds ?? 0),
        plan: planId === 'monthly' ? 'monthly' : planId ?? data?.plan ?? 'starter',
        stripe_customer_id: session.customer ?? data?.stripe_customer_id ?? null,
        subscription_status: session.mode === 'subscription' ? 'active' : data?.subscription_status ?? 'none',
        updated_at: new Date().toISOString(),
      });
    }
  }

  if (event.type === 'customer.subscription.deleted' || event.type === 'customer.subscription.updated') {
    const subscription = event.data?.object ?? {};
    const customerId = subscription.customer as string | undefined;
    const status = normalizeSubscriptionStatus(subscription.status);
    if (customerId) {
      await supabase
        .from('user_entitlements')
        .update({
          subscription_status: status,
          plan: status === 'active' || status === 'trialing' ? 'monthly' : 'none',
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_customer_id', customerId);
    }
  }

  response.status(200).json({ received: true });
}

async function readRawBody(request: ApiRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    request.on('data', (chunk) => {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    request.on('end', () => resolve(Buffer.concat(chunks)));
    request.on('error', () => reject(new Error('Failed to read webhook body')));
  });
}

function verifyStripeSignature(body: Buffer, header: string, secret: string): boolean {
  const fields = Object.fromEntries(header.split(',').map((part) => {
    const [key, value] = part.split('=');
    return [key, value];
  }));
  const timestamp = fields.t;
  const expected = fields.v1;
  if (!timestamp || !expected) return false;
  const signedPayload = `${timestamp}.${body.toString('utf8')}`;
  const actual = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.byteLength !== expectedBuffer.byteLength) return false;
  return crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeSubscriptionStatus(status: string | undefined) {
  if (status === 'active' || status === 'trialing' || status === 'past_due' || status === 'canceled') {
    return status;
  }
  return 'none';
}
