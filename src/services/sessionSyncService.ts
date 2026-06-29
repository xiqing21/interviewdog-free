import type { InterviewSession } from '../types';
import { supabase } from './supabaseClient';

type SessionRow = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  answer_mode: InterviewSession['answerMode'];
  resume: string | null;
  resume_ids?: string[] | null;
  jd: string | null;
  target_role: string | null;
  focus_areas: string[];
  expert_knowledge?: string | null;
  expert_knowledge_ids?: string[] | null;
  qa_list: InterviewSession['qaList'];
  transcript_lines: NonNullable<InterviewSession['transcriptLines']>;
  review: InterviewSession['review'] | null;
};

export function canSyncSessions(): boolean {
  return Boolean(supabase);
}

export async function loadRemoteSessions(): Promise<InterviewSession[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('interview_sessions')
    .select('*')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToSession);
}

export async function syncSession(session: InterviewSession): Promise<void> {
  if (!supabase) return;
  const userResult = await supabase.auth.getUser();
  const userId = userResult.data.user?.id;
  if (!userId) return;

  const payload = {
    id: session.id,
    user_id: userId,
    name: session.name,
    created_at: new Date(session.createdAt).toISOString(),
    updated_at: new Date(session.updatedAt ?? Date.now()).toISOString(),
    archived_at: session.archivedAt ? new Date(session.archivedAt).toISOString() : null,
    answer_mode: session.answerMode,
    resume: session.resume ?? null,
    resume_ids: session.resumeIds ?? [],
    jd: session.jd ?? null,
    target_role: session.targetRole ?? null,
    focus_areas: session.focusAreas ?? [],
    expert_knowledge: session.expertKnowledge ?? null,
    expert_knowledge_ids: session.expertKnowledgeIds ?? [],
    qa_list: session.qaList,
    transcript_lines: session.transcriptLines ?? [],
    review: session.review ?? null,
  };

  const { error } = await supabase.from('interview_sessions').upsert(payload);
  if (error && (
    error.message.includes('resume_ids') ||
    error.message.includes('expert_knowledge')
  )) {
    const { error: fallbackError } = await supabase.from('interview_sessions').upsert({
      id: session.id,
      user_id: userId,
      name: session.name,
      created_at: new Date(session.createdAt).toISOString(),
      updated_at: new Date(session.updatedAt ?? Date.now()).toISOString(),
      archived_at: session.archivedAt ? new Date(session.archivedAt).toISOString() : null,
      answer_mode: session.answerMode,
      resume: session.resume ?? null,
      jd: session.jd ?? null,
      target_role: session.targetRole ?? null,
      focus_areas: session.focusAreas ?? [],
      qa_list: session.qaList,
      transcript_lines: session.transcriptLines ?? [],
      review: session.review ?? null,
    });
    if (fallbackError) throw fallbackError;
    return;
  }
  if (error) throw error;
}

export async function deleteRemoteSession(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('interview_sessions').delete().eq('id', id);
  if (error) throw error;
}

function rowToSession(row: SessionRow): InterviewSession {
  return {
    id: row.id,
    name: row.name,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
    archivedAt: row.archived_at ? new Date(row.archived_at).getTime() : undefined,
    answerMode: row.answer_mode,
    resume: row.resume ?? undefined,
    resumeIds: row.resume_ids ?? [],
    jd: row.jd ?? undefined,
    targetRole: row.target_role ?? undefined,
    focusAreas: row.focus_areas ?? [],
    expertKnowledge: row.expert_knowledge ?? undefined,
    expertKnowledgeIds: row.expert_knowledge_ids ?? [],
    qaList: row.qa_list ?? [],
    transcriptLines: row.transcript_lines ?? [],
    review: row.review ?? undefined,
  };
}
