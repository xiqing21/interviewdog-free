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

    // Draw the current frame to a canvas
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('无法创建画布上下文。');
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert to base64 PNG (strip the "data:image/png;base64," prefix)
    const dataUrl = canvas.toDataURL('image/png');
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
