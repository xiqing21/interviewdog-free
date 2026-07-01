create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'user',
  banned_at timestamptz,
  ban_reason text,
  updated_at timestamptz not null default now(),
  constraint user_roles_role_check check (role in ('user', 'admin'))
);

alter table public.user_roles enable row level security;
grant select on public.user_roles to authenticated;

drop policy if exists "user_roles_select_own" on public.user_roles;
create policy "user_roles_select_own"
on public.user_roles
for select
to authenticated
using ((select auth.uid()) = user_id);

create table if not exists public.admin_app_config (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  is_secret boolean not null default false,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.admin_app_config enable row level security;

create table if not exists public.billing_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  type text not null,
  minutes integer not null default 0,
  amount_cents integer,
  currency text default 'cny',
  stripe_session_id text,
  note text,
  created_at timestamptz not null default now(),
  constraint billing_transactions_type_check check (type in ('trial', 'stripe_purchase', 'subscription_grant', 'manual_grant', 'manual_deduct', 'usage_adjustment'))
);

alter table public.billing_transactions enable row level security;
grant select on public.billing_transactions to authenticated;

drop policy if exists "billing_transactions_select_own" on public.billing_transactions;
create policy "billing_transactions_select_own"
on public.billing_transactions
for select
to authenticated
using ((select auth.uid()) = user_id);

create index if not exists billing_transactions_user_created_idx
on public.billing_transactions (user_id, created_at desc);

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_user_id uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.admin_audit_logs enable row level security;

create index if not exists admin_audit_logs_created_idx
on public.admin_audit_logs (created_at desc);

insert into public.admin_app_config (key, value, is_secret)
values
  ('ai', '{"baseUrl":"https://api.deepseek.com/v1","textModel":"deepseek-chat","visionModel":"deepseek-chat","apiKey":""}'::jsonb, true),
  ('asr', '{"provider":"gateway-doubao","doubaoAppId":"","doubaoAccessToken":"","doubaoResourceId":"volc.bigasr.sauc.duration","iflytekAppId":"","iflytekApiKey":"","iflytekApiSecret":"","alibabaAppKey":"","alibabaToken":"","alibabaEndpoint":"wss://nls-gateway-cn-shanghai.aliyuncs.com/ws/v1"}'::jsonb, true),
  ('plans', '{"starterMinutes":60,"proMinutes":180,"monthlyMinutes":600,"freeTrialMinutes":15}'::jsonb, false)
on conflict (key) do nothing;
