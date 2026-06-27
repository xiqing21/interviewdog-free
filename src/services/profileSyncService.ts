import type { KnowledgeProfile } from '../types';
import { supabase } from './supabaseClient';

type UserProfileRow = {
  user_id: string;
  resume_library: KnowledgeProfile['resumes'];
  expert_knowledge: string | null;
  updated_at: string;
};

export function canSyncProfile(): boolean {
  return Boolean(supabase);
}

export async function loadRemoteProfile(): Promise<KnowledgeProfile | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return rowToProfile(data as UserProfileRow);
}

export async function syncProfile(profile: KnowledgeProfile): Promise<void> {
  if (!supabase) return;
  const userResult = await supabase.auth.getUser();
  const userId = userResult.data.user?.id;
  if (!userId) return;

  const { error } = await supabase.from('user_profiles').upsert({
    user_id: userId,
    resume_library: profile.resumes,
    expert_knowledge: profile.expertKnowledge,
    updated_at: new Date(profile.updatedAt ?? Date.now()).toISOString(),
  });
  if (error) throw error;
}

function rowToProfile(row: UserProfileRow): KnowledgeProfile {
  return {
    resumes: row.resume_library ?? [],
    expertKnowledge: row.expert_knowledge ?? '',
    updatedAt: new Date(row.updated_at).getTime(),
  };
}
