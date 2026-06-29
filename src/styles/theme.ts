import type { PaletteMode } from '@mui/material';
import { createTheme, type Theme } from '@mui/material/styles';
import type { ThemeMode } from '../types';

type ThemePreset = {
  paletteMode: PaletteMode;
  primary: string;
  primaryLight: string;
  primaryDark: string;
  secondary: string;
  secondaryLight: string;
  secondaryDark: string;
  defaultBg: string;
  paperBg: string;
  textPrimary: string;
  textSecondary: string;
  divider: string;
  bodyBg: string;
  inputBg: string;
  paperBorder: string;
  thumb: string;
  shadow: string;
  shadowHover: string;
  inset: string;
};

const presets: Record<ThemeMode, ThemePreset> = {
  dark: {
    paletteMode: 'dark',
    primary: '#7dd3fc',
    primaryLight: '#9fe7ff',
    primaryDark: '#2767b0',
    secondary: '#f9a8a8',
    secondaryLight: '#ffc3b8',
    secondaryDark: '#cf5b4e',
    defaultBg: '#202938',
    paperBg: '#263244',
    textPrimary: '#ecf6ff',
    textSecondary: '#aebccd',
    divider: 'rgba(255,255,255,0.10)',
    bodyBg: 'linear-gradient(135deg, #202938 0%, #263244 48%, #1f3540 100%)',
    inputBg: '#202b3b',
    paperBorder: 'rgba(255,255,255,0.08)',
    thumb: 'rgba(125,211,252,0.34)',
    shadow: '8px 8px 18px rgba(3,8,20,0.45), -6px -6px 16px rgba(63,79,110,0.22)',
    shadowHover: '5px 5px 12px rgba(3,8,20,0.48), -4px -4px 12px rgba(76,94,126,0.20)',
    inset: 'inset 4px 4px 10px rgba(4,10,24,0.45), inset -4px -4px 10px rgba(72,88,119,0.20)',
  },
  light: {
    paletteMode: 'light',
    primary: '#4f8fdf',
    primaryLight: '#86b7f0',
    primaryDark: '#2767b0',
    secondary: '#ff7f6e',
    secondaryLight: '#ffc3b8',
    secondaryDark: '#cf5b4e',
    defaultBg: '#edf4f8',
    paperBg: '#f5f9fb',
    textPrimary: '#253344',
    textSecondary: '#647587',
    divider: 'rgba(82,104,130,0.14)',
    bodyBg: 'linear-gradient(135deg, #edf4f8 0%, #f7fbf6 46%, #eef6f2 100%)',
    inputBg: '#eef5f8',
    paperBorder: 'rgba(255,255,255,0.76)',
    thumb: 'rgba(79,143,223,0.24)',
    shadow: '8px 8px 18px rgba(104,126,153,0.20), -7px -7px 18px rgba(255,255,255,0.92)',
    shadowHover: '5px 5px 12px rgba(104,126,153,0.22), -5px -5px 14px rgba(255,255,255,0.95)',
    inset: 'inset 4px 4px 10px rgba(112,133,158,0.16), inset -4px -4px 10px rgba(255,255,255,0.95)',
  },
  clay: {
    paletteMode: 'light',
    primary: '#5b8def',
    primaryLight: '#8eb4ff',
    primaryDark: '#2f62bf',
    secondary: '#e26d5a',
    secondaryLight: '#ffa08e',
    secondaryDark: '#b64b3f',
    defaultBg: '#eef2f1',
    paperBg: '#f8faf6',
    textPrimary: '#26313a',
    textSecondary: '#697782',
    divider: 'rgba(96,111,126,0.16)',
    bodyBg: 'linear-gradient(135deg, #eef2f1 0%, #f7f8f2 46%, #e9f0f4 100%)',
    inputBg: '#eef3f2',
    paperBorder: 'rgba(255,255,255,0.82)',
    thumb: 'rgba(91,141,239,0.26)',
    shadow: '9px 9px 20px rgba(112,124,138,0.20), -8px -8px 18px rgba(255,255,255,0.95)',
    shadowHover: '6px 6px 14px rgba(112,124,138,0.22), -5px -5px 14px rgba(255,255,255,0.96)',
    inset: 'inset 4px 4px 10px rgba(114,124,136,0.14), inset -4px -4px 10px rgba(255,255,255,0.95)',
  },
  midnight: {
    paletteMode: 'dark',
    primary: '#38bdf8',
    primaryLight: '#7dd3fc',
    primaryDark: '#0369a1',
    secondary: '#fbbf24',
    secondaryLight: '#fde68a',
    secondaryDark: '#b45309',
    defaultBg: '#0d1321',
    paperBg: '#151f32',
    textPrimary: '#e5f3ff',
    textSecondary: '#9fb4ca',
    divider: 'rgba(148,163,184,0.18)',
    bodyBg: 'linear-gradient(135deg, #0d1321 0%, #172033 55%, #10232e 100%)',
    inputBg: '#101827',
    paperBorder: 'rgba(148,163,184,0.14)',
    thumb: 'rgba(56,189,248,0.36)',
    shadow: '8px 8px 18px rgba(0,0,0,0.42), -5px -5px 14px rgba(58,74,103,0.16)',
    shadowHover: '5px 5px 14px rgba(0,0,0,0.46), -4px -4px 12px rgba(58,74,103,0.18)',
    inset: 'inset 4px 4px 10px rgba(0,0,0,0.36), inset -4px -4px 10px rgba(58,74,103,0.15)',
  },
  forest: {
    paletteMode: 'dark',
    primary: '#8bd3a6',
    primaryLight: '#b6e8c6',
    primaryDark: '#3b8c5c',
    secondary: '#f6c177',
    secondaryLight: '#ffe0aa',
    secondaryDark: '#b7791f',
    defaultBg: '#18251f',
    paperBg: '#22342c',
    textPrimary: '#edf8f0',
    textSecondary: '#b2c4b9',
    divider: 'rgba(210,230,214,0.12)',
    bodyBg: 'linear-gradient(135deg, #18251f 0%, #22342c 52%, #1c2d35 100%)',
    inputBg: '#1b2b24',
    paperBorder: 'rgba(210,230,214,0.10)',
    thumb: 'rgba(139,211,166,0.34)',
    shadow: '8px 8px 18px rgba(4,13,9,0.40), -5px -5px 14px rgba(68,95,78,0.18)',
    shadowHover: '5px 5px 13px rgba(4,13,9,0.44), -4px -4px 12px rgba(68,95,78,0.18)',
    inset: 'inset 4px 4px 10px rgba(4,13,9,0.36), inset -4px -4px 10px rgba(68,95,78,0.16)',
  },
  mono: {
    paletteMode: 'dark',
    primary: '#e5e7eb',
    primaryLight: '#ffffff',
    primaryDark: '#9ca3af',
    secondary: '#a7f3d0',
    secondaryLight: '#d1fae5',
    secondaryDark: '#059669',
    defaultBg: '#171717',
    paperBg: '#242424',
    textPrimary: '#f4f4f5',
    textSecondary: '#b5b5b8',
    divider: 'rgba(255,255,255,0.12)',
    bodyBg: 'linear-gradient(135deg, #171717 0%, #242424 52%, #1f2933 100%)',
    inputBg: '#1c1c1f',
    paperBorder: 'rgba(255,255,255,0.10)',
    thumb: 'rgba(229,231,235,0.28)',
    shadow: '8px 8px 18px rgba(0,0,0,0.42), -5px -5px 14px rgba(80,80,84,0.16)',
    shadowHover: '5px 5px 13px rgba(0,0,0,0.46), -4px -4px 12px rgba(80,80,84,0.18)',
    inset: 'inset 4px 4px 10px rgba(0,0,0,0.34), inset -4px -4px 10px rgba(80,80,84,0.16)',
  },
};

export function createAppTheme(mode: ThemeMode): Theme {
  const preset = presets[mode] ?? presets.dark;

  return createTheme({
    palette: {
      mode: preset.paletteMode,
      primary: {
        main: preset.primary,
        light: preset.primaryLight,
        dark: preset.primaryDark,
        contrastText: preset.paletteMode === 'dark' ? '#082033' : '#ffffff',
      },
      secondary: {
        main: preset.secondary,
        light: preset.secondaryLight,
        dark: preset.secondaryDark,
        contrastText: '#ffffff',
      },
      background: {
        default: preset.defaultBg,
        paper: preset.paperBg,
      },
      text: {
        primary: preset.textPrimary,
        secondary: preset.textSecondary,
      },
      divider: preset.divider,
      error: { main: '#ef5f5f' },
      warning: { main: '#f0a43a' },
      success: { main: '#43b883' },
      info: { main: preset.primary },
    },
    typography: {
      fontFamily: '"Avenir Next", "Nunito Sans", "Trebuchet MS", system-ui, sans-serif',
      fontSize: 14,
      h1: { fontWeight: 800, letterSpacing: 0 },
      h2: { fontWeight: 800, letterSpacing: 0 },
      h3: { fontWeight: 750, letterSpacing: 0 },
      h4: { fontWeight: 750, letterSpacing: 0 },
      h5: { fontWeight: 750, letterSpacing: 0 },
      h6: { fontWeight: 750, letterSpacing: 0 },
      button: { textTransform: 'none', fontWeight: 700, letterSpacing: 0 },
    },
    shape: { borderRadius: 8 },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            background: preset.bodyBg,
            scrollbarColor: `${preset.thumb} ${preset.defaultBg}`,
            '&::-webkit-scrollbar, & *::-webkit-scrollbar': {
              width: 8,
              height: 8,
            },
            '&::-webkit-scrollbar-thumb, & *::-webkit-scrollbar-thumb': {
              borderRadius: 8,
              backgroundColor: preset.thumb,
            },
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            boxShadow: preset.shadow,
            backgroundImage: 'none',
            '&:hover': { boxShadow: preset.shadowHover },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            border: `1px solid ${preset.paperBorder}`,
            boxShadow: preset.shadow,
          },
        },
      },
      MuiTextField: {
        defaultProps: {
          variant: 'outlined',
          size: 'small',
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            backgroundColor: preset.inputBg,
            boxShadow: preset.inset,
            '& fieldset': { borderColor: 'transparent' },
            '&:hover fieldset': { borderColor: preset.primary },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            fontWeight: 700,
            borderRadius: 8,
            boxShadow: preset.paletteMode === 'dark'
              ? '3px 3px 8px rgba(3,8,20,0.35), -2px -2px 7px rgba(72,88,119,0.15)'
              : '3px 3px 8px rgba(104,126,153,0.16), -3px -3px 9px rgba(255,255,255,0.90)',
          },
        },
      },
    },
  });
}
