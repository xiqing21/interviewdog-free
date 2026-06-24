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
  if (audioStream) {
    stop();
  }

  try {
    // 请求屏幕共享（含系统音频）
    audioStream = await navigator.mediaDevices.getDisplayMedia({
      audio: true,
      video: true, // getDisplayMedia 要求至少一个 track，这里 video 用来引导用户，后续可以关掉
    });

    // 关闭视频 track，只保留音频
    audioStream.getVideoTracks().forEach((track) => track.stop());

    const audioTrack = audioStream.getAudioTracks()[0];
    if (!audioTrack) {
      throw new Error('未检测到系统音频，请确保在分享时勾选了"分享音频"选项。');
    }

    // 监听音频轨道结束
    audioTrack.addEventListener('ended', () => {
      callbacks.onEnd();
      cleanup();
    });

    // 创建 AudioContext 处理音频流
    audioContext = new AudioContext({ sampleRate });
    sourceNode = audioContext.createMediaStreamSource(audioStream);

    // 使用 ScriptProcessorNode 获取 PCM 数据
    processor = audioContext.createScriptProcessor(4096, 1, 1);
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

/**
 * 停止系统音频捕获并清理所有资源。
 */
export function stop(): void {
  cleanup();
}

export function isActive(): boolean {
  return audioStream !== null;
}

function cleanup(): void {
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
  if (audioStream) {
    audioStream.getTracks().forEach((track) => track.stop());
    audioStream = null;
  }
}
