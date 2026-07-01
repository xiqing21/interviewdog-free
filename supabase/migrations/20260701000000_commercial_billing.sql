create table if not exists public.user_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  free_trial_minutes integer not null default 15,
  purchased_minutes integer not null default 0,
  used_seconds integer not null default 0,
  plan text not null default 'none',
  stripe_customer_id text,
  subscription_status text not null default 'none',
  updated_at timestamptz not null default now(),
  constraint user_entitlements_plan_check check (plan in ('none', 'trial', 'starter', 'pro', 'monthly')),
  constraint user_entitlements_subscription_status_check check (subscription_status in ('none', 'active', 'trialing', 'past_due', 'canceled'))
);

alter table public.user_entitlements enable row level security;

grant select, insert, update on public.user_entitlements to authenticated;

drop policy if exists "user_entitlements_select_own" on public.user_entitlements;
create policy "user_entitlements_select_own"
on public.user_entitlements
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "user_entitlements_insert_own" on public.user_entitlements;
create policy "user_entitlements_insert_own"
on public.user_entitlements
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "user_entitlements_update_own_usage" on public.user_entitlements;
create policy "user_entitlements_update_own_usage"
on public.user_entitlements
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create index if not exists user_entitlements_updated_idx
on public.user_entitlements (updated_at desc);
