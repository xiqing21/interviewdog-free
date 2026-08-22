-- Migration: 20260821000000_card_keys.sql
-- Description: License card keys table for commercial card delivery platform integration

create table if not exists public.license_card_keys (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  batch_no text not null default 'DEFAULT',
  minutes integer not null default 30,
  plan text not null default 'pro',
  status text not null default 'unused',
  note text,
  created_by uuid references auth.users(id) on delete set null,
  redeemed_by uuid references auth.users(id) on delete set null,
  redeemed_by_email text,
  redeemed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint license_card_keys_status_check check (status in ('unused', 'redeemed', 'revoked', 'expired')),
  constraint license_card_keys_minutes_check check (minutes > 0)
);

alter table public.license_card_keys enable row level security;

-- Grants
grant select, insert, update, delete on public.license_card_keys to service_role;

-- Indexes for high performance lookup and filtering
create index if not exists license_card_keys_code_idx on public.license_card_keys (code);
create index if not exists license_card_keys_batch_idx on public.license_card_keys (batch_no, created_at desc);
create index if not exists license_card_keys_status_idx on public.license_card_keys (status, created_at desc);
create index if not exists license_card_keys_created_idx on public.license_card_keys (created_at desc);
create index if not exists license_card_keys_redeemed_idx on public.license_card_keys (redeemed_at desc);

-- Do not seed plaintext card keys in git. Generate them from the admin console
-- so they never appear in the public repository.
