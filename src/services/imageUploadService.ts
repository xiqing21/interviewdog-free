/**
 * ImageUploadService — 上传笔试截图到 Supabase Storage 对象存储
 * 若未配置 Supabase 或上传失败，自动降级为 Canvas 轻量压缩缩略图，
 * 避免超大 Base64 塞爆浏览器 localStorage (5MB 限额)。
 */

import { supabase, isSupabaseConfigured } from './supabaseClient';

const BUCKET_NAME = 'exam-screenshots';

/**
 * 将 base64 转换为 Blob
 */
function base64ToBlob(base64: string, contentType = 'image/png'): Blob {
  const cleanBase64 = base64.replace(/^data:image\/\w+;base64,/, '');
  const byteCharacters = atob(cleanBase64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: contentType });
}

/**
 * 本地 Canvas 压缩图片为小尺寸 WebP/JPEG Base64（~30KB）用于防爆仓兜底
 */
export async function compressImageBase64(base64: string, maxWidth = 640, quality = 0.65): Promise<string> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return base64;
  }

  return new Promise((resolve) => {
    const img = new Image();
    const src = base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`;
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(base64);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        // 尝试转成 webp，不支持则 jpeg
        const compressed = canvas.toDataURL('image/webp', quality);
        resolve(compressed);
      } catch (err) {
        console.warn('[ImageUploadService] Canvas compress failed, fallback to original:', err);
        resolve(base64);
      }
    };

    img.onerror = () => {
      resolve(base64);
    };

    img.src = src;
  });
}

/**
 * 上传题目截图至对象存储
 * @param base64 - 图片的完整 Base64 字符串
 * @returns 远程图片 URL；如果上传失败或未配置，返回 null
 */
export async function uploadExamScreenshot(base64: string): Promise<string | null> {
  if (!isSupabaseConfigured() || !supabase) {
    return null;
  }

  try {
    const blob = base64ToBlob(base64, 'image/png');
    const filename = `exam_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
    const filePath = `screenshots/${filename}`;

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, blob, {
        contentType: 'image/png',
        upsert: true,
      });

    if (error) {
      console.warn('[ImageUploadService] Supabase Storage upload error:', error.message);
      return null;
    }

    if (data?.path) {
      const { data: publicUrlData } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(data.path);
      return publicUrlData.publicUrl;
    }

    return null;
  } catch (error) {
    console.warn('[ImageUploadService] Upload exam screenshot failed:', error);
    return null;
  }
}
