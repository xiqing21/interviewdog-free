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

-- Seed initial batch of 20 card keys (30 Minutes for 30 RMB product in Card Delivery Shop)
insert into public.license_card_keys (code, batch_no, minutes, plan, status, note)
values
  ('MSZ-30M-8F3A-7K9Q-2W4E', 'FAKA-20260821-30M', 30, 'pro', 'unused', '发卡平台首批30元商品卡密'),
  ('MSZ-30M-4H9C-1T6X-8P2V', 'FAKA-20260821-30M', 30, 'pro', 'unused', '发卡平台首批30元商品卡密'),
  ('MSZ-30M-9K2L-5N7M-3B8A', 'FAKA-20260821-30M', 30, 'pro', 'unused', '发卡平台首批30元商品卡密'),
  ('MSZ-30M-6W1E-8R4T-9Y2U', 'FAKA-20260821-30M', 30, 'pro', 'unused', '发卡平台首批30元商品卡密'),
  ('MSZ-30M-3X7C-2V9B-5N1M', 'FAKA-20260821-30M', 30, 'pro', 'unused', '发卡平台首批30元商品卡密'),
  ('MSZ-30M-7Q4W-1E8R-6T2Y', 'FAKA-20260821-30M', 30, 'pro', 'unused', '发卡平台首批30元商品卡密'),
  ('MSZ-30M-2U9I-5O3P-8A4S', 'FAKA-20260821-30M', 30, 'pro', 'unused', '发卡平台首批30元商品卡密'),
  ('MSZ-30M-5D8F-2G6H-1J7K', 'FAKA-20260821-30M', 30, 'pro', 'unused', '发卡平台首批30元商品卡密'),
  ('MSZ-30M-1L4Z-7X2C-9V5B', 'FAKA-20260821-30M', 30, 'pro', 'unused', '发卡平台首批30元商品卡密'),
  ('MSZ-30M-8N3M-6Q1W-4E9R', 'FAKA-20260821-30M', 30, 'pro', 'unused', '发卡平台首批30元商品卡密'),
  ('MSZ-30M-4T7Y-9U2I-3O8P', 'FAKA-20260821-30M', 30, 'pro', 'unused', '发卡平台首批30元商品卡密'),
  ('MSZ-30M-9A5S-1D8F-6G2H', 'FAKA-20260821-30M', 30, 'pro', 'unused', '发卡平台首批30元商品卡密'),
  ('MSZ-30M-3J7K-8L2Z-5X1C', 'FAKA-20260821-30M', 30, 'pro', 'unused', '发卡平台首批30元商品卡密'),
  ('MSZ-30M-7V4B-2N9M-6Q3W', 'FAKA-20260821-30M', 30, 'pro', 'unused', '发卡平台首批30元商品卡密'),
  ('MSZ-30M-1E8R-5T2Y-9U4I', 'FAKA-20260821-30M', 30, 'pro', 'unused', '发卡平台首批30元商品卡密'),
  ('MSZ-30M-6O1P-3A7S-8D2F', 'FAKA-20260821-30M', 30, 'pro', 'unused', '发卡平台首批30元商品卡密'),
  ('MSZ-30M-2G9H-7J4K-1L6Z', 'FAKA-20260821-30M', 30, 'pro', 'unused', '发卡平台首批30元商品卡密'),
  ('MSZ-30M-8X3C-5V1B-4N7M', 'FAKA-20260821-30M', 30, 'pro', 'unused', '发卡平台首批30元商品卡密'),
  ('MSZ-30M-5Q2W-9E6R-3T8Y', 'FAKA-20260821-30M', 30, 'pro', 'unused', '发卡平台首批30元商品卡密'),
  ('MSZ-30M-3U7I-1O4P-9A2S', 'FAKA-20260821-30M', 30, 'pro', 'unused', '发卡平台首批30元商品卡密')
on conflict (code) do nothing;
