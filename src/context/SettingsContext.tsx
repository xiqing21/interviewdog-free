/**
 * SettingsContext v2 — 扩展管理 AI 设置、应用设置、豆包 ASR 配置
 */

import {
  createContext,
  useEffect,
  useReducer,
  useCallback,
  type ReactNode,
} from 'react';
import type {
  AISettings,
  AppSettings,
  ConnectionTestResult,
  ThemeMode,
  Language,
  AIProvider,
  ASRProvider,
  AudioSource,
  SpeakerAudioSource,
  DoubaoASRConfig,
  LocalQwenASRConfig,
} from '../types';
import {
  DEFAULT_AI_SETTINGS,
  DEFAULT_APP_SETTINGS,
  DEFAULT_DOUBAO_ASR_CONFIG,
  DEFAULT_LOCAL_QWEN_ASR_CONFIG,
  STORAGE_KEYS,
  PROVIDER_DEFAULTS,
} from '../constants';
import * as storageService from '../services/storageService';
import { obfuscate, deobfuscate } from '../services/cryptoService';
import { testConnection as testConn } from '../services/aiService';

// ===== State =====
export interface SettingsState {
  aiSettings: AISettings;
  appSettings: AppSettings;
  doubaoConfig: DoubaoASRConfig;
  localQwenConfig: LocalQwenASRConfig;
  connectionStatus: ConnectionTestResult | null;
  isTestingConnection: boolean;
}

type SettingsAction =
  | { type: 'UPDATE_AI_SETTINGS'; payload: Partial<AISettings> }
  | { type: 'SET_AI_SETTINGS'; payload: AISettings }
  | { type: 'SET_PROVIDER'; payload: AIProvider }
  | { type: 'SET_APP_SETTINGS'; payload: Partial<AppSettings> }
  | { type: 'SET_THEME'; payload: ThemeMode }
  | { type: 'SET_LANGUAGE'; payload: Language }
  | { type: 'ACKNOWLEDGE_PRIVACY' }
  | { type: 'SET_ASR_PROVIDER'; payload: ASRProvider }
  | { type: 'SET_AUDIO_SOURCE'; payload: AudioSource }
  | { type: 'SET_MY_AUDIO_SOURCE'; payload: SpeakerAudioSource }
  | { type: 'SET_INTERVIEWER_AUDIO_SOURCE'; payload: SpeakerAudioSource }
  | { type: 'UPDATE_DOUBAO_CONFIG'; payload: Partial<DoubaoASRConfig> }
  | { type: 'UPDATE_LOCAL_QWEN_CONFIG'; payload: Partial<LocalQwenASRConfig> }
  | { type: 'SET_CONNECTION_STATUS'; payload: ConnectionTestResult | null }
  | { type: 'SET_TESTING'; payload: boolean };

function getInitialState(): SettingsState {
  const storedAI = storageService.get<AISettings>(STORAGE_KEYS.AI_SETTINGS, DEFAULT_AI_SETTINGS);
  if (storedAI.apiKey) storedAI.apiKey = deobfuscate(storedAI.apiKey);
  const aiSettings: AISettings = { ...DEFAULT_AI_SETTINGS, ...storedAI };

  const appSettings: AppSettings = {
    ...DEFAULT_APP_SETTINGS,
    ...storageService.get<AppSettings>(STORAGE_KEYS.APP_SETTINGS, DEFAULT_APP_SETTINGS),
  };

  const doubaoConfig: DoubaoASRConfig = {
    ...DEFAULT_DOUBAO_ASR_CONFIG,
    ...storageService.get<DoubaoASRConfig>(STORAGE_KEYS.DOUBAO_ASR_CONFIG, DEFAULT_DOUBAO_ASR_CONFIG),
  };
  if (doubaoConfig.resourceId === 'volc.seedasr.sauc.duration') {
    doubaoConfig.resourceId = DEFAULT_DOUBAO_ASR_CONFIG.resourceId;
  }
  if (doubaoConfig.accessToken) {
    doubaoConfig.accessToken = deobfuscate(doubaoConfig.accessToken);
  }

  const localQwenConfig: LocalQwenASRConfig = {
    ...DEFAULT_LOCAL_QWEN_ASR_CONFIG,
    ...storageService.get<LocalQwenASRConfig>(STORAGE_KEYS.LOCAL_QWEN_ASR_CONFIG, DEFAULT_LOCAL_QWEN_ASR_CONFIG),
  };

  return { aiSettings, appSettings, doubaoConfig, localQwenConfig, connectionStatus: null, isTestingConnection: false };
}

function settingsReducer(state: SettingsState, action: SettingsAction): SettingsState {
  switch (action.type) {
    case 'UPDATE_AI_SETTINGS':
      return { ...state, aiSettings: { ...state.aiSettings, ...action.payload } };
    case 'SET_AI_SETTINGS':
      return { ...state, aiSettings: action.payload };
    case 'SET_PROVIDER': {
      const d = PROVIDER_DEFAULTS[action.payload];
      return { ...state, aiSettings: { ...state.aiSettings, provider: action.payload, baseUrl: d.baseUrl || state.aiSettings.baseUrl, textModel: d.textModel || state.aiSettings.textModel, visionModel: d.visionModel || state.aiSettings.visionModel } };
    }
    case 'SET_APP_SETTINGS':
      return { ...state, appSettings: { ...state.appSettings, ...action.payload } };
    case 'SET_THEME':
      return { ...state, appSettings: { ...state.appSettings, theme: action.payload } };
    case 'SET_LANGUAGE':
      return { ...state, appSettings: { ...state.appSettings, language: action.payload } };
    case 'ACKNOWLEDGE_PRIVACY':
      return { ...state, appSettings: { ...state.appSettings, privacyAcknowledged: true } };
    case 'SET_ASR_PROVIDER':
      return { ...state, appSettings: { ...state.appSettings, asrProvider: action.payload } };
    case 'SET_AUDIO_SOURCE':
      if (action.payload === 'both') {
        return {
          ...state,
          appSettings: {
            ...state.appSettings,
            audioSource: action.payload,
            myAudioSource: 'microphone',
            interviewerAudioSource: 'system',
          },
        };
      }
      if (action.payload === 'system') {
        return {
          ...state,
          appSettings: {
            ...state.appSettings,
            audioSource: action.payload,
            myAudioSource: 'muted',
            interviewerAudioSource: 'system',
          },
        };
      }
      return {
        ...state,
        appSettings: {
          ...state.appSettings,
          audioSource: action.payload,
          myAudioSource: 'microphone',
          interviewerAudioSource: 'muted',
        },
      };
    case 'SET_MY_AUDIO_SOURCE':
      return { ...state, appSettings: { ...state.appSettings, myAudioSource: action.payload } };
    case 'SET_INTERVIEWER_AUDIO_SOURCE':
      return { ...state, appSettings: { ...state.appSettings, interviewerAudioSource: action.payload } };
    case 'UPDATE_DOUBAO_CONFIG':
      return { ...state, doubaoConfig: { ...state.doubaoConfig, ...action.payload } };
    case 'UPDATE_LOCAL_QWEN_CONFIG':
      return { ...state, localQwenConfig: { ...state.localQwenConfig, ...action.payload } };
    case 'SET_CONNECTION_STATUS':
      return { ...state, connectionStatus: action.payload };
    case 'SET_TESTING':
      return { ...state, isTestingConnection: action.payload };
    default:
      return state;
  }
}

export interface SettingsContextValue extends SettingsState {
  updateAISettings: (p: Partial<AISettings>) => void;
  setProvider: (p: AIProvider) => void;
  setTheme: (m: ThemeMode) => void;
  setLanguage: (l: Language) => void;
  acknowledgePrivacy: () => void;
  setASRProvider: (p: ASRProvider) => void;
  setAudioSource: (s: AudioSource) => void;
  setMyAudioSource: (s: SpeakerAudioSource) => void;
  setInterviewerAudioSource: (s: SpeakerAudioSource) => void;
  updateAppSettings: (p: Partial<AppSettings>) => void;
  updateDoubaoConfig: (p: Partial<DoubaoASRConfig>) => void;
  updateLocalQwenConfig: (p: Partial<LocalQwenASRConfig>) => void;
  testConnection: () => Promise<ConnectionTestResult>;
}

export const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(settingsReducer, undefined, getInitialState);

  useEffect(() => {
    const toStore = { ...state.aiSettings, apiKey: obfuscate(state.aiSettings.apiKey) };
    storageService.set(STORAGE_KEYS.AI_SETTINGS, toStore);
  }, [state.aiSettings]);
  useEffect(() => {
    storageService.set(STORAGE_KEYS.APP_SETTINGS, state.appSettings);
  }, [state.appSettings]);
  useEffect(() => {
    const toStore = { ...state.doubaoConfig, accessToken: obfuscate(state.doubaoConfig.accessToken) };
    storageService.set(STORAGE_KEYS.DOUBAO_ASR_CONFIG, toStore);
  }, [state.doubaoConfig]);
  useEffect(() => {
    storageService.set(STORAGE_KEYS.LOCAL_QWEN_ASR_CONFIG, state.localQwenConfig);
  }, [state.localQwenConfig]);
  useEffect(() => {
    const root = document.documentElement;
    state.appSettings.theme === 'dark' ? root.classList.add('dark') : root.classList.remove('dark');
  }, [state.appSettings.theme]);

  const updateAISettings = useCallback((p: Partial<AISettings>) => dispatch({ type: 'UPDATE_AI_SETTINGS', payload: p }), []);
  const setProvider = useCallback((p: AIProvider) => dispatch({ type: 'SET_PROVIDER', payload: p }), []);
  const setTheme = useCallback((m: ThemeMode) => dispatch({ type: 'SET_THEME', payload: m }), []);
  const setLanguage = useCallback((l: Language) => dispatch({ type: 'SET_LANGUAGE', payload: l }), []);
  const acknowledgePrivacy = useCallback(() => dispatch({ type: 'ACKNOWLEDGE_PRIVACY' }), []);
  const setASRProvider = useCallback((p: ASRProvider) => dispatch({ type: 'SET_ASR_PROVIDER', payload: p }), []);
  const setAudioSource = useCallback((s: AudioSource) => dispatch({ type: 'SET_AUDIO_SOURCE', payload: s }), []);
  const setMyAudioSource = useCallback((s: SpeakerAudioSource) => dispatch({ type: 'SET_MY_AUDIO_SOURCE', payload: s }), []);
  const setInterviewerAudioSource = useCallback((s: SpeakerAudioSource) => dispatch({ type: 'SET_INTERVIEWER_AUDIO_SOURCE', payload: s }), []);
  const updateAppSettings = useCallback((p: Partial<AppSettings>) => dispatch({ type: 'SET_APP_SETTINGS', payload: p }), []);
  const updateDoubaoConfig = useCallback((p: Partial<DoubaoASRConfig>) => dispatch({ type: 'UPDATE_DOUBAO_CONFIG', payload: p }), []);
  const updateLocalQwenConfig = useCallback((p: Partial<LocalQwenASRConfig>) => dispatch({ type: 'UPDATE_LOCAL_QWEN_CONFIG', payload: p }), []);

  const testConnection = useCallback(async (): Promise<ConnectionTestResult> => {
    dispatch({ type: 'SET_TESTING', payload: true });
    try {
      const r = await testConn(state.aiSettings);
      dispatch({ type: 'SET_CONNECTION_STATUS', payload: r });
      return r;
    } catch (e) {
      const r: ConnectionTestResult = { success: false, message: `连接失败：${e instanceof Error ? e.message : '未知错误'}` };
      dispatch({ type: 'SET_CONNECTION_STATUS', payload: r });
      return r;
    } finally {
      dispatch({ type: 'SET_TESTING', payload: false });
    }
  }, [state.aiSettings]);

  const value: SettingsContextValue = {
    ...state, updateAISettings, setProvider, setTheme, setLanguage,
    acknowledgePrivacy, setASRProvider, setAudioSource, setMyAudioSource,
    setInterviewerAudioSource, updateAppSettings, updateDoubaoConfig, updateLocalQwenConfig, testConnection,
  };

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}
