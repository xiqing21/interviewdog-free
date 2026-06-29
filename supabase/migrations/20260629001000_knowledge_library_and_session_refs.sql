alter table public.user_profiles
add column if not exists expert_library jsonb not null default '[]'::jsonb;

update public.user_profiles
set expert_library = jsonb_build_array(
  jsonb_build_object(
    'id', 'legacy-expert-knowledge',
    'name', '默认专家知识库',
    'content', expert_knowledge,
    'createdAt', extract(epoch from updated_at) * 1000,
    'updatedAt', extract(epoch from updated_at) * 1000
  )
)
where expert_library = '[]'::jsonb
  and length(trim(coalesce(expert_knowledge, ''))) > 0;

alter table public.interview_sessions
add column if not exists resume_ids text[] not null default '{}',
add column if not exists expert_knowledge text,
add column if not exists expert_knowledge_ids text[] not null default '{}';
