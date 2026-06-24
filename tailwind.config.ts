import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'id-bg': '#1a1a2e',
        'id-surface': '#16213e',
        'id-primary': '#6c63ff',
        'id-secondary': '#00d4ff',
        'id-accent': '#9d50bb',
        'id-text': '#e0e0e0',
        'id-text-secondary': '#a0a0b0',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['Fira Code', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
