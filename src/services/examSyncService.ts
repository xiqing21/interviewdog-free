/**
 * ExamSyncService — 笔试截图与题目解答记录云端同步服务
 * 1. 上传截图至 Supabase Storage `exam-screenshots` 公开存储桶
 * 2. 同步题目与解答至 Supabase `public.exam_records` 数据表
 * 3. 支持跨设备/重新打开后自动加载历史笔试记录
 */

import type { ExamRecord, ExamType } from '../types';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import { uploadExamScreenshot } from './imageUploadService';

type ExamRecordRow = {
  id: string;
  user_id: string | null;
  image_url: string | null;
  exam_type: string;
  answer: string;
  created_at: string;
  updated_at: string;
};

export function canSyncExam(): boolean {
  return isSupabaseConfigured() && Boolean(supabase);
}

/**
 * 将远端数据库行数据转换为前端 ExamRecord 对象
 */
function rowToExamRecord(row: ExamRecordRow): ExamRecord {
  return {
    id: row.id,
    imageBase64: '',
    imageUrl: row.image_url || undefined,
    examType: (row.exam_type as ExamType) || 'coding',
    answer: row.answer || '',
    timestamp: new Date(row.created_at).getTime(),
    isStreaming: false,
  };
}

/**
 * 从 Supabase `exam_records` 表拉取云端笔试记录
 */
export async function loadRemoteExamRecords(): Promise<ExamRecord[]> {
  if (!supabase || !isSupabaseConfigured()) return [];

  try {
    const { data, error } = await supabase
      .from('exam_records')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.warn('[ExamSyncService] Failed to load remote exam records:', error.message);
      return [];
    }

    return (data || []).map(rowToExamRecord);
  } catch (err) {
    console.warn('[ExamSyncService] loadRemoteExamRecords error:', err);
    return [];
  }
}

/**
 * 同步一条笔试记录（包括上传截图至 Storage + 写入 exam_records 表）
 * @param record 前端笔试记录
 * @returns 远程图片 URL（若成功上传）
 */
export async function syncExamRecord(record: ExamRecord): Promise<string | null> {
  if (!supabase || !isSupabaseConfigured()) return null;

  try {
    let finalImageUrl = record.imageUrl || null;

    // 1. 若尚未获得 imageUrl 且有本地 base64 图片，先上传至 Storage
    if (!finalImageUrl && record.imageBase64) {
      finalImageUrl = await uploadExamScreenshot(record.imageBase64);
    }

    // 2. 获取当前登录用户 ID（若有）
    let userId: string | null = null;
    try {
      const userRes = await supabase.auth.getUser();
      userId = userRes.data.user?.id || null;
    } catch {
      // 未登录状态
    }

    // 3. 写入/更新 exam_records 表
    const payload = {
      id: record.id,
      user_id: userId,
      image_url: finalImageUrl,
      exam_type: record.examType,
      answer: record.answer,
      created_at: new Date(record.timestamp).toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('exam_records')
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      console.warn('[ExamSyncService] Failed to upsert exam_record:', error.message);
    } else {
      console.info('[ExamSyncService] Successfully synced exam record to Supabase:', record.id);
    }

    return finalImageUrl;
  } catch (error) {
    console.warn('[ExamSyncService] syncExamRecord error:', error);
    return null;
  }
}

/**
 * 从云端删除指定的笔试记录
 */
export async function deleteRemoteExamRecord(id: string): Promise<void> {
  if (!supabase || !isSupabaseConfigured()) return;

  try {
    const { error } = await supabase.from('exam_records').delete().eq('id', id);
    if (error) {
      console.warn('[ExamSyncService] Failed to delete remote record:', error.message);
    }
  } catch (err) {
    console.warn('[ExamSyncService] deleteRemoteExamRecord error:', err);
  }
}

/**
 * 清空云端所有笔试记录
 */
export async function clearRemoteExamRecords(): Promise<void> {
  if (!supabase || !isSupabaseConfigured()) return;

  try {
    const userRes = await supabase.auth.getUser();
    const userId = userRes.data.user?.id;
    if (userId) {
      await supabase.from('exam_records').delete().eq('user_id', userId);
    } else {
      await supabase.from('exam_records').delete().is('user_id', null);
    }
  } catch (err) {
    console.warn('[ExamSyncService] clearRemoteExamRecords error:', err);
  }
}
