/**
 * SettingsContext — Manages AI settings and app settings.
 * Uses useReducer for state management with automatic localStorage persistence.
 */

import {
  createContext,
  useEffect,
  useReducer,
  useCallback,
  type ReactNode,
  type Dispatch,
} from 'react';
import type {
  AISettings,
  AppSettings,
  ConnectionTestResult,
  ThemeMode,
  Language,
  AIProvider,
} from '../types';
import {
  DEFAULT_AI_SETTINGS,
  DEFAULT_APP_SETTINGS,
  STORAGE_KEYS,
  PROVIDER_DEFAULTS,
} from '../constants';
import * as storageService from '../services/storageService';
import { obfuscate, deobfuscate } from '../services/cryptoService';
import { testConnection as testConn } from '../services/aiService';

// ===== State Type =====
export interface SettingsState {
  aiSettings: AISettings;
  appSettings: AppSettings;
  connectionStatus: ConnectionTestResult | null;
  isTestingConnection: boolean;
}

// ===== Action Types =====
type SettingsAction =
  | { type: 'UPDATE_AI_SETTINGS'; payload: Partial<AISettings> }
  | { type: 'SET_AI_SETTINGS'; payload: AISettings }
  | { type: 'SET_PROVIDER'; payload: AIProvider }
  | { type: 'SET_THEME'; payload: ThemeMode }
  | { type: 'SET_LANGUAGE'; payload: Language }
  | { type: 'ACKNOWLEDGE_PRIVACY' }
  | { type: 'SET_CONNECTION_STATUS'; payload: ConnectionTestResult | null }
  | { type: 'SET_TESTING'; payload: boolean };

// ===== Initial State =====
function getInitialState(): SettingsState {
  // Load AI settings from storage
  const storedAI = storageService.get<AISettings>(
    STORAGE_KEYS.AI_SETTINGS,
    DEFAULT_AI_SETTINGS,
  );

  // Deobfuscate the API key if it was stored obfuscated
  if (storedAI.apiKey) {
    storedAI.apiKey = deobfuscate(storedAI.apiKey);
  }

  // Merge with defaults to ensure all fields exist
  const aiSettings: AISettings = {
    ...DEFAULT_AI_SETTINGS,
    ...storedAI,
  };

  // Load app settings from storage
  const appSettings: AppSettings = {
    ...DEFAULT_APP_SETTINGS,
    ...storageService.get<AppSettings>(
      STORAGE_KEYS.APP_SETTINGS,
      DEFAULT_APP_SETTINGS,
    ),
  };

  return {
    aiSettings,
    appSettings,
    connectionStatus: null,
    isTestingConnection: false,
  };
}

// ===== Reducer =====
function settingsReducer(
  state: SettingsState,
  action: SettingsAction,
): SettingsState {
  switch (action.type) {
    case 'UPDATE_AI_SETTINGS':
      return {
        ...state,
        aiSettings: { ...state.aiSettings, ...action.payload },
      };

    case 'SET_AI_SETTINGS':
      return { ...state, aiSettings: action.payload };

    case 'SET_PROVIDER': {
      const defaults = PROVIDER_DEFAULTS[action.payload];
      return {
        ...state,
        aiSettings: {
          ...state.aiSettings,
          provider: action.payload,
          baseUrl: defaults.baseUrl || state.aiSettings.baseUrl,
          textModel: defaults.textModel || state.aiSettings.textModel,
          visionModel:
            defaults.visionModel || state.aiSettings.visionModel,
        },
      };
    }

    case 'SET_THEME':
      return {
        ...state,
        appSettings: { ...state.appSettings, theme: action.payload },
      };

    case 'SET_LANGUAGE':
      return {
        ...state,
        appSettings: { ...state.appSettings, language: action.payload },
      };

    case 'ACKNOWLEDGE_PRIVACY':
      return {
        ...state,
        appSettings: {
          ...state.appSettings,
          privacyAcknowledged: true,
        },
      };

    case 'SET_CONNECTION_STATUS':
      return { ...state, connectionStatus: action.payload };

    case 'SET_TESTING':
      return { ...state, isTestingConnection: action.payload };

    default:
      return state;
  }
}

// ===== Context Type =====
export interface SettingsContextValue extends SettingsState {
  updateAISettings: (partial: Partial<AISettings>) => void;
  setProvider: (provider: AIProvider) => void;
  setTheme: (mode: ThemeMode) => void;
  setLanguage: (lang: Language) => void;
  acknowledgePrivacy: () => void;
  testConnection: () => Promise<ConnectionTestResult>;
}

// ===== Context =====
export const SettingsContext = createContext<SettingsContextValue | null>(
  null,
);

// ===== Provider Props =====
interface SettingsProviderProps {
  children: ReactNode;
}

// ===== Provider =====
export function SettingsProvider({ children }: SettingsProviderProps) {
  const [state, dispatch] = useReducer(
    settingsReducer,
    undefined,
    getInitialState,
  );

  // Persist AI settings to localStorage whenever they change
  useEffect(() => {
    const toStore: AISettings = {
      ...state.aiSettings,
      apiKey: obfuscate(state.aiSettings.apiKey),
    };
    storageService.set(STORAGE_KEYS.AI_SETTINGS, toStore);
  }, [state.aiSettings]);

  // Persist app settings to localStorage whenever they change
  useEffect(() => {
    storageService.set(STORAGE_KEYS.APP_SETTINGS, state.appSettings);
  }, [state.appSettings]);

  // Apply theme class to document
  useEffect(() => {
    const root = document.documentElement;
    if (state.appSettings.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [state.appSettings.theme]);

  // ===== Action Creators =====
  const updateAISettings = useCallback((partial: Partial<AISettings>) => {
    dispatch({ type: 'UPDATE_AI_SETTINGS', payload: partial });
  }, []);

  const setProvider = useCallback((provider: AIProvider) => {
    dispatch({ type: 'SET_PROVIDER', payload: provider });
  }, []);

  const setTheme = useCallback((mode: ThemeMode) => {
    dispatch({ type: 'SET_THEME', payload: mode });
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    dispatch({ type: 'SET_LANGUAGE', payload: lang });
  }, []);

  const acknowledgePrivacy = useCallback(() => {
    dispatch({ type: 'ACKNOWLEDGE_PRIVACY' });
  }, []);

  const testConnection = useCallback(async (): Promise<ConnectionTestResult> => {
    dispatch({ type: 'SET_TESTING', payload: true });
    try {
      const result = await testConn(state.aiSettings);
      dispatch({ type: 'SET_CONNECTION_STATUS', payload: result });
      return result;
    } catch (error) {
      const result: ConnectionTestResult = {
        success: false,
        message: `连接测试失败：${error instanceof Error ? error.message : '未知错误'}`,
      };
      dispatch({ type: 'SET_CONNECTION_STATUS', payload: result });
      return result;
    } finally {
      dispatch({ type: 'SET_TESTING', payload: false });
    }
  }, [state.aiSettings]);

  const value: SettingsContextValue = {
    ...state,
    updateAISettings,
    setProvider,
    setTheme,
    setLanguage,
    acknowledgePrivacy,
    testConnection,
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

// ===== Export for external dispatch access (if needed) =====
export type { Dispatch };
