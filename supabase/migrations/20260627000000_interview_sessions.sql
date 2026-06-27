create table if not exists public.interview_sessions (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  answer_mode text not null default 'concise',
  resume text,
  jd text,
  target_role text,
  focus_areas text[] not null default '{}',
  qa_list jsonb not null default '[]'::jsonb,
  transcript_lines jsonb not null default '[]'::jsonb,
  review jsonb,
  constraint interview_sessions_answer_mode_check check (answer_mode in ('concise', 'detailed'))
);

alter table public.interview_sessions enable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.interview_sessions to authenticated;

drop policy if exists "interview_sessions_select_own" on public.interview_sessions;
create policy "interview_sessions_select_own"
on public.interview_sessions
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "interview_sessions_insert_own" on public.interview_sessions;
create policy "interview_sessions_insert_own"
on public.interview_sessions
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "interview_sessions_update_own" on public.interview_sessions;
create policy "interview_sessions_update_own"
on public.interview_sessions
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "interview_sessions_delete_own" on public.interview_sessions;
create policy "interview_sessions_delete_own"
on public.interview_sessions
for delete
to authenticated
using ((select auth.uid()) = user_id);

create index if not exists interview_sessions_user_updated_idx
on public.interview_sessions (user_id, updated_at desc);
