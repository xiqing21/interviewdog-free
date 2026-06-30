create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  resume_library jsonb not null default '[]'::jsonb,
  expert_knowledge text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.user_profiles to authenticated;

drop policy if exists "user_profiles_select_own" on public.user_profiles;
create policy "user_profiles_select_own"
on public.user_profiles
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "user_profiles_insert_own" on public.user_profiles;
create policy "user_profiles_insert_own"
on public.user_profiles
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "user_profiles_update_own" on public.user_profiles;
create policy "user_profiles_update_own"
on public.user_profiles
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "user_profiles_delete_own" on public.user_profiles;
create policy "user_profiles_delete_own"
on public.user_profiles
for delete
to authenticated
using ((select auth.uid()) = user_id);

create index if not exists user_profiles_updated_idx
on public.user_profiles (updated_at desc);
