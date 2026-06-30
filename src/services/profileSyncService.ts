import type { KnowledgeProfile } from '../types';
import { supabase } from './supabaseClient';

type UserProfileRow = {
  user_id: string;
  resume_library: KnowledgeProfile['resumes'];
  expert_library?: KnowledgeProfile['expertKnowledgeItems'] | null;
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
    .select('user_id,resume_library,expert_library,expert_knowledge,updated_at')
    .maybeSingle();
  if (error && error.message.includes('expert_library')) {
    const fallback = await supabase
      .from('user_profiles')
      .select('user_id,resume_library,expert_knowledge,updated_at')
      .maybeSingle();
    if (fallback.error) throw fallback.error;
    if (!fallback.data) return null;
    return rowToProfile(fallback.data as UserProfileRow);
  }
  if (error) throw error;
  if (!data) return null;
  return rowToProfile(data as UserProfileRow);
}

export async function syncProfile(profile: KnowledgeProfile): Promise<void> {
  if (!supabase) return;
  const userResult = await supabase.auth.getUser();
  const userId = userResult.data.user?.id;
  if (!userId) return;

  const payload = {
    user_id: userId,
    resume_library: profile.resumes,
    expert_library: profile.expertKnowledgeItems,
    expert_knowledge: profile.expertKnowledge,
    updated_at: new Date(profile.updatedAt ?? Date.now()).toISOString(),
  };

  const { error } = await supabase.from('user_profiles').upsert(payload);
  if (error && error.message.includes('expert_library')) {
    const { error: fallbackError } = await supabase.from('user_profiles').upsert({
      user_id: userId,
      resume_library: profile.resumes,
      expert_knowledge: profile.expertKnowledge,
      updated_at: new Date(profile.updatedAt ?? Date.now()).toISOString(),
    });
    if (fallbackError) throw fallbackError;
    return;
  }
  if (error) throw error;
}

function rowToProfile(row: UserProfileRow): KnowledgeProfile {
  return {
    resumes: row.resume_library ?? [],
    expertKnowledgeItems: row.expert_library ?? [],
    expertKnowledge: row.expert_knowledge ?? '',
    updatedAt: new Date(row.updated_at).getTime(),
  };
}
