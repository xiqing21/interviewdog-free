/**
 * SpeechService — Web Speech API wrapper for voice recognition.
 * Provides speech-to-text capability for the interview mode.
 */

import type {
  SpeechRecognitionLike,
  SpeechRecognitionEventLike,
} from '../types';

/**
 * Checks whether the browser supports the Web Speech API.
 * @returns true if speech recognition is supported
 */
export function isSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    (typeof window.SpeechRecognition === 'function' ||
      typeof window.webkitSpeechRecognition === 'function')
  );
}

/**
 * Creates a SpeechRecognition instance using the available constructor.
 */
function createRecognition(): SpeechRecognitionLike {
  const Ctor =
    window.SpeechRecognition ?? window.webkitSpeechRecognition;
  if (!Ctor) {
    throw new Error('当前浏览器不支持语音识别功能。');
  }
  return new Ctor();
}

/** Callbacks for speech recognition events. */
export interface SpeechCallbacks {
  onResult: (transcript: string, isFinal: boolean) => void;
  onError: (error: string) => void;
  onEnd: () => void;
}

let activeRecognition: SpeechRecognitionLike | null = null;

/**
 * Starts listening for speech input.
 * @param callbacks - Callbacks for results, errors, and end events
 * @param lang - Language code (default: 'zh-CN')
 */
export function start(
  callbacks: SpeechCallbacks,
  lang: string = 'zh-CN',
): void {
  if (activeRecognition) {
    stop();
  }

  const recognition = createRecognition();
  recognition.lang = lang;
  recognition.continuous = true;
  recognition.interimResults = true;

  recognition.onresult = (event: SpeechRecognitionEventLike) => {
    let interimText = '';
    let finalText = '';

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const transcript = result[0].transcript;
      if (result.isFinal) {
        finalText += transcript;
      } else {
        interimText += transcript;
      }
    }

    if (finalText) {
      callbacks.onResult(finalText.trim(), true);
    } else if (interimText) {
      callbacks.onResult(interimText.trim(), false);
    }
  };

  recognition.onerror = (event: { error: string }) => {
    const errorMessages: Record<string, string> = {
      'no-speech': '未检测到语音输入。',
      'audio-capture': '无法访问麦克风，请检查权限设置。',
      'not-allowed': '麦克风权限被拒绝，请在浏览器设置中允许。',
      network: '网络错误，语音识别服务不可用。',
      aborted: '语音识别已中止。',
    };
    const message = errorMessages[event.error] ?? `语音识别错误：${event.error}`;
    callbacks.onError(message);
  };

  recognition.onend = () => {
    activeRecognition = null;
    callbacks.onEnd();
  };

  activeRecognition = recognition;
  recognition.start();
}

/**
 * Stops the active speech recognition session.
 */
export function stop(): void {
  if (activeRecognition) {
    try {
      activeRecognition.stop();
    } catch {
      // Recognition may have already stopped
    }
    activeRecognition = null;
  }
}

/**
 * Returns whether speech recognition is currently active.
 */
export function isListening(): boolean {
  return activeRecognition !== null;
}
