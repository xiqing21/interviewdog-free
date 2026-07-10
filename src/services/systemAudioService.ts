/**
 * SystemAudioService — 系统音频捕获服务
 *
 * 通过 Chrome getDisplayMedia({ audio: true }) 捕获系统音频（会议软件中面试官的声音）。
 * 将捕获的音频流转换为 PCM 格式，供语音识别服务使用。
 */

let audioStream: MediaStream | null = null;
let audioContext: AudioContext | null = null;
let processor: ScriptProcessorNode | null = null;
let sourceNode: MediaStreamAudioSourceNode | null = null;
let currentCallbacks: SystemAudioCallbacks | null = null;

let isDesktopCapturing = false;
let desktopCleanup: (() => void) | null = null;
let desktopGeneration = 0;

/** 音频数据回调 */
export interface SystemAudioCallbacks {
  onPcmData: (pcm: Int16Array) => void;
  onError: (error: string) => void;
  onEnd: () => void;
}

/**
 * 检测浏览器是否支持系统音频捕获。
 * Chrome 74+ 支持 getDisplayMedia({ audio: true })。
 */
export function isSupported(): boolean {
  if (window.desktopWindow?.startSystemAudio) {
    return true;
  }
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices?.getDisplayMedia === 'function'
  );
}

/**
 * 开始捕获系统音频。
 * 引导用户选择「整个屏幕」或「标签页」并勾选「分享音频」。
 */
export async function start(
  callbacks: SystemAudioCallbacks,
  sampleRate: number = 16000,
): Promise<void> {
  if (window.desktopWindow?.startSystemAudio) {
    const bridge = window.desktopWindow;
    try {
      cleanup();
      const generation = desktopGeneration;
      currentCallbacks = callbacks;
      
      const unsubscribeData = bridge.onSystemAudioData((pcm) => {
        if (generation !== desktopGeneration) return;
        callbacks.onPcmData(pcm);
      });
      
      const unsubscribeEnded = bridge.onSystemAudioEnded(() => {
        if (generation !== desktopGeneration) return;
        callbacks.onEnd();
        cleanup();
      });
      
      desktopCleanup = () => {
        unsubscribeData();
        unsubscribeEnded();
        bridge.stopSystemAudio();
      };
      
      await bridge.startSystemAudio();
      isDesktopCapturing = true;
      return;
    } catch (error) {
      const msg = error instanceof Error ? error.message : '原生系统音频捕获失败';
      callbacks.onError(msg);
      cleanup();
      return;
    }
  }

  try {
    await prepare(callbacks);
    cleanupAudioNodes();

    // 创建 AudioContext 处理音频流
    if (!audioStream) {
      throw new Error('系统音频流未准备好，请先共享系统音频。');
    }
    audioContext = new AudioContext({ sampleRate });
    void audioContext.resume().catch(() => {});
    sourceNode = audioContext.createMediaStreamSource(audioStream);

    // 使用 ScriptProcessorNode 获取 PCM 数据
    processor = audioContext.createScriptProcessor(1024, 1, 1);
    processor.onaudioprocess = (event) => {
      const input = event.inputBuffer.getChannelData(0);
      const pcm = new Int16Array(input.length);
      for (let i = 0; i < input.length; i++) {
        const s = Math.max(-1, Math.min(1, input[i]));
        pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }
      callbacks.onPcmData(pcm);
    };

    sourceNode.connect(processor);
    processor.connect(audioContext.destination);
  } catch (error) {
    const msg = error instanceof Error ? error.message : '系统音频捕获失败';
    callbacks.onError(msg);
    cleanup();
  }
}

export async function prepare(callbacks?: Pick<SystemAudioCallbacks, 'onError' | 'onEnd'>): Promise<boolean> {
  if (window.desktopWindow?.startSystemAudio) {
    return true; // 桌面端原生捕获不需要提前授权弹窗
  }

  if (audioStream?.getAudioTracks().some((track) => track.readyState === 'live')) {
    return true;
  }

  cleanup();

  try {
    audioStream = await navigator.mediaDevices.getDisplayMedia({
      audio: true,
      video: true,
    });

    audioStream.getVideoTracks().forEach((track) => track.stop());

    const audioTrack = audioStream.getAudioTracks()[0];
    if (!audioTrack) {
      throw new Error('未检测到系统音频，请确保在分享时勾选了"分享音频"选项。');
    }

    audioTrack.addEventListener('ended', () => {
      currentCallbacks?.onEnd();
      callbacks?.onEnd();
      cleanup();
    });
    return true;
  } catch (error) {
    const msg = error instanceof Error ? error.message : '系统音频捕获失败';
    callbacks?.onError(msg);
    cleanup();
    return false;
  }
}

/**
 * 停止系统音频捕获并清理所有资源。
 */
export function stop(): void {
  cleanup();
}

export function isActive(): boolean {
  return audioStream !== null || isDesktopCapturing;
}

export function isProcessing(): boolean {
  return processor !== null || isDesktopCapturing;
}

export function getStream(): MediaStream | null {
  if (window.desktopWindow?.startSystemAudio) {
    return null; // 原生流不通过 MediaStream 传递
  }
  if (!audioStream?.getAudioTracks().some((track) => track.readyState === 'live')) {
    return null;
  }
  return audioStream;
}

function cleanup(): void {
  desktopGeneration += 1;
  cleanupAudioNodes();
  if (audioStream) {
    audioStream.getTracks().forEach((track) => track.stop());
    audioStream = null;
  }
  if (desktopCleanup) {
    desktopCleanup();
    desktopCleanup = null;
  }
  isDesktopCapturing = false;
  currentCallbacks = null;
}

function cleanupAudioNodes(): void {
  if (processor) {
    processor.disconnect();
    processor = null;
  }
  if (sourceNode) {
    sourceNode.disconnect();
    sourceNode = null;
  }
  if (audioContext) {
    audioContext.close().catch(() => {});
    audioContext = null;
  }
}
