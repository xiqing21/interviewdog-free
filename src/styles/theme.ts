import { createTheme, type Theme } from '@mui/material/styles';

/**
 * Creates an MUI theme based on the given mode.
 * @param mode - 'dark' or 'light'
 * @returns Configured MUI Theme
 */
export function createAppTheme(mode: 'dark' | 'light'): Theme {
  const isDark = mode === 'dark';

  return createTheme({
    palette: {
      mode,
      primary: {
        main: '#6c63ff',
        light: '#8b85ff',
        dark: '#5751d9',
        contrastText: '#ffffff',
      },
      secondary: {
        main: '#00d4ff',
        light: '#5ce0ff',
        dark: '#00a8cc',
        contrastText: '#ffffff',
      },
      background: {
        default: isDark ? '#1a1a2e' : '#f5f5fa',
        paper: isDark ? '#16213e' : '#ffffff',
      },
      text: {
        primary: isDark ? '#e0e0e0' : '#1a1a2e',
        secondary: isDark ? '#a0a0b0' : '#666680',
      },
      divider: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
      error: {
        main: '#f44336',
      },
      warning: {
        main: '#ff9800',
      },
      success: {
        main: '#4caf50',
      },
      info: {
        main: '#2196f3',
      },
    },
    typography: {
      fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
      fontSize: 14,
      h1: { fontWeight: 700 },
      h2: { fontWeight: 700 },
      h3: { fontWeight: 600 },
      h4: { fontWeight: 600 },
      h5: { fontWeight: 600 },
      h6: { fontWeight: 600 },
      button: {
        textTransform: 'none',
        fontWeight: 500,
      },
    },
    shape: {
      borderRadius: 10,
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            scrollbarColor: isDark ? '#3a3a5c #16213e' : '#ccc #f5f5fa',
            '&::-webkit-scrollbar, & *::-webkit-scrollbar': {
              width: 8,
              height: 8,
            },
            '&::-webkit-scrollbar-thumb, & *::-webkit-scrollbar-thumb': {
              borderRadius: 8,
              backgroundColor: isDark
                ? 'rgba(108,99,255,0.3)'
                : 'rgba(0,0,0,0.15)',
            },
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            boxShadow: 'none',
            '&:hover': {
              boxShadow: 'none',
            },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
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
            '& fieldset': {
              borderColor: isDark
                ? 'rgba(255,255,255,0.1)'
                : 'rgba(0,0,0,0.1)',
            },
            '&:hover fieldset': {
              borderColor: '#6c63ff',
            },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            fontWeight: 500,
          },
        },
      },
    },
  });
}
