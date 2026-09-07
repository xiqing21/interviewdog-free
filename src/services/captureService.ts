/**
 * CaptureService — Screen capture using getDisplayMedia API.
 * Captures a screenshot from the user's screen and returns it as base64.
 */

import { captureDesktopScreen, isDesktopApp } from './desktopWindowService';

/**
 * Checks whether the browser or desktop app supports screen capture.
 * @returns true if desktop native capture or getDisplayMedia is supported
 */
export function isSupported(): boolean {
  if (isDesktopApp()) return true;
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices?.getDisplayMedia === 'function'
  );
}

/**
 * Captures a screenshot from the user's screen or window.
 * In desktop app, uses native desktopCapturer silently without popup.
 * In browser, uses getDisplayMedia.
 * @param sourceId Optional target window or screen source ID (desktop only)
 * @returns Base64-encoded PNG image data (without the data URI prefix)
 * @throws Error with a user-friendly message if capture fails
 */
export async function capture(sourceId?: string): Promise<string> {
  if (isDesktopApp()) {
    return await captureDesktopScreen(sourceId);
  }

  if (!isSupported()) {
    throw new Error('当前浏览器不支持屏幕截图功能。');
  }

  let videoStream: MediaStream;
  try {
    videoStream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: 1 },
      audio: false,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'NotAllowedError') {
      throw new Error('屏幕共享权限被拒绝，请允许后重试。');
    }
    throw new Error(
      `无法获取屏幕访问权限：${error instanceof Error ? error.message : '未知错误'}`,
    );
  }

  try {
    // Create a video element and wait for metadata to load
    const video = document.createElement('video');
    video.srcObject = videoStream;
    video.muted = true;

    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => {
        video.play().then(() => resolve()).catch(reject);
      };
      video.onerror = () =>
        reject(new Error('无法播放屏幕共享视频流。'));
      // Timeout safety
      setTimeout(() => reject(new Error('加载屏幕画面超时。')), 5000);
    });

    // Wait one frame to ensure the video is rendering
    await new Promise((resolve) => requestAnimationFrame(resolve));

    // 限制截图最大尺寸为 1440px，兼顾高清文字与微秒级传输
    const MAX_DIM = 1440;
    let targetW = video.videoWidth || 1440;
    let targetH = video.videoHeight || 900;
    if (targetW > MAX_DIM || targetH > MAX_DIM) {
      if (targetW >= targetH) {
        targetH = Math.round((targetH * MAX_DIM) / targetW);
        targetW = MAX_DIM;
      } else {
        targetW = Math.round((targetW * MAX_DIM) / targetH);
        targetH = MAX_DIM;
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('无法创建画布上下文。');
    }

    ctx.drawImage(video, 0, 0, targetW, targetH);

    // 采用 JPEG 0.85 高清压缩，体积从 10MB 降低到 200KB
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    const base64 = dataUrl.split(',')[1];

    if (!base64) {
      throw new Error('截图转换失败：无法生成图像数据。');
    }

    return base64;
  } finally {
    // Always stop all video tracks to release the screen share
    videoStream.getTracks().forEach((track) => track.stop());
  }
}
