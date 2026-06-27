import { createTheme, type Theme } from '@mui/material/styles';

/**
 * Creates an MUI theme based on the given mode.
 * @param mode - 'dark' or 'light'
 * @returns Configured MUI Theme
 */
export function createAppTheme(mode: 'dark' | 'light'): Theme {
  const isDark = mode === 'dark';
  const clayShadow = isDark
    ? '8px 8px 18px rgba(3, 8, 20, 0.45), -6px -6px 16px rgba(63, 79, 110, 0.22)'
    : '8px 8px 18px rgba(104, 126, 153, 0.20), -7px -7px 18px rgba(255, 255, 255, 0.92)';
  const insetClay = isDark
    ? 'inset 4px 4px 10px rgba(4, 10, 24, 0.45), inset -4px -4px 10px rgba(72, 88, 119, 0.20)'
    : 'inset 4px 4px 10px rgba(112, 133, 158, 0.16), inset -4px -4px 10px rgba(255, 255, 255, 0.95)';

  return createTheme({
    palette: {
      mode,
      primary: {
        main: isDark ? '#7dd3fc' : '#4f8fdf',
        light: '#9fe7ff',
        dark: '#2767b0',
        contrastText: isDark ? '#082033' : '#ffffff',
      },
      secondary: {
        main: isDark ? '#f9a8a8' : '#ff7f6e',
        light: '#ffc3b8',
        dark: '#cf5b4e',
        contrastText: '#ffffff',
      },
      background: {
        default: isDark ? '#202938' : '#edf4f8',
        paper: isDark ? '#263244' : '#f5f9fb',
      },
      text: {
        primary: isDark ? '#ecf6ff' : '#253344',
        secondary: isDark ? '#aebccd' : '#647587',
      },
      divider: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(82,104,130,0.14)',
      error: {
        main: '#ef5f5f',
      },
      warning: {
        main: '#f0a43a',
      },
      success: {
        main: '#43b883',
      },
      info: {
        main: '#4f8fdf',
      },
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
      button: {
        textTransform: 'none',
        fontWeight: 700,
        letterSpacing: 0,
      },
    },
    shape: {
      borderRadius: 8,
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            background: isDark
              ? 'linear-gradient(135deg, #202938 0%, #263244 48%, #1f3540 100%)'
              : 'linear-gradient(135deg, #edf4f8 0%, #f7fbf6 46%, #eef6f2 100%)',
            scrollbarColor: isDark ? '#52677d #263244' : '#aac0d3 #edf4f8',
            '&::-webkit-scrollbar, & *::-webkit-scrollbar': {
              width: 8,
              height: 8,
            },
            '&::-webkit-scrollbar-thumb, & *::-webkit-scrollbar-thumb': {
              borderRadius: 8,
              backgroundColor: isDark
                ? 'rgba(125,211,252,0.34)'
                : 'rgba(79,143,223,0.24)',
            },
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            boxShadow: clayShadow,
            backgroundImage: 'none',
            '&:hover': {
              boxShadow: isDark
                ? '5px 5px 12px rgba(3, 8, 20, 0.48), -4px -4px 12px rgba(76, 94, 126, 0.20)'
                : '5px 5px 12px rgba(104, 126, 153, 0.22), -5px -5px 14px rgba(255,255,255,0.95)',
            },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.76)'}`,
            boxShadow: clayShadow,
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
            backgroundColor: isDark ? '#202b3b' : '#eef5f8',
            boxShadow: insetClay,
            '& fieldset': {
              borderColor: 'transparent',
            },
            '&:hover fieldset': {
              borderColor: isDark ? '#7dd3fc' : '#4f8fdf',
            },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            fontWeight: 700,
            borderRadius: 8,
            boxShadow: isDark
              ? '3px 3px 8px rgba(3,8,20,0.35), -2px -2px 7px rgba(72,88,119,0.15)'
              : '3px 3px 8px rgba(104,126,153,0.16), -3px -3px 9px rgba(255,255,255,0.90)',
          },
        },
      },
    },
  });
}
