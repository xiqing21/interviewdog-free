create table if not exists public.coupon_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  status text not null default 'active',
  discount_percent integer not null default 0,
  bonus_minutes integer not null default 0,
  max_redemptions integer not null default 100,
  redemptions integer not null default 0,
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coupon_codes_status_check check (status in ('active', 'paused', 'expired')),
  constraint coupon_codes_discount_check check (discount_percent >= 0 and discount_percent <= 100),
  constraint coupon_codes_bonus_check check (bonus_minutes >= 0),
  constraint coupon_codes_max_redemptions_check check (max_redemptions >= 0)
);

alter table public.coupon_codes enable row level security;
grant select, insert, update, delete on public.coupon_codes to service_role;
create index if not exists coupon_codes_created_idx on public.coupon_codes (created_at desc);

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email text not null,
  subject text not null,
  message text not null,
  status text not null default 'open',
  priority text not null default 'normal',
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint support_tickets_status_check check (status in ('open', 'pending', 'resolved', 'closed')),
  constraint support_tickets_priority_check check (priority in ('low', 'normal', 'high', 'urgent'))
);

alter table public.support_tickets enable row level security;
grant select, insert, update, delete on public.support_tickets to service_role;
create index if not exists support_tickets_created_idx on public.support_tickets (created_at desc);
create index if not exists support_tickets_user_idx on public.support_tickets (user_id, created_at desc);

create table if not exists public.growth_experiments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'draft',
  variants jsonb not null default '[]'::jsonb,
  note text,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint growth_experiments_status_check check (status in ('draft', 'running', 'paused', 'finished'))
);

alter table public.growth_experiments enable row level security;
grant select, insert, update, delete on public.growth_experiments to service_role;
create index if not exists growth_experiments_created_idx on public.growth_experiments (created_at desc);

create table if not exists public.risk_rules (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  enabled boolean not null default false,
  threshold integer not null default 0,
  action text not null default 'alert',
  note text,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint risk_rules_action_check check (action in ('alert', 'limit', 'ban'))
);

alter table public.risk_rules enable row level security;
grant select, insert, update, delete on public.risk_rules to service_role;
create index if not exists risk_rules_created_idx on public.risk_rules (created_at desc);
