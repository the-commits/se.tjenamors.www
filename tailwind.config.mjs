import daisyui from 'daisyui';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js}'],
  theme: {
    extend: {
      fontFamily: {
        audiowide: ['Audiowide', 'sans-serif'],
      },
      colors: {
        'dark-glass': 'rgba(0, 0, 0, 0.5)',
        'neon-green': '#00ff66',
      },
    },
    fontFamily: {
      sans: [
        'Figtree',
        'ui-sans-serif',
        'system-ui',
        '-apple-system',
        'BlinkMacSystemFont',
        '"Segoe UI"',
        'Roboto',
        '"Helvetica Neue"',
        'Arial',
        '"Noto Sans"',
        'sans-serif',
        '"Apple Color Emoji"',
        '"Segoe UI Emoji"',
        '"Segoe UI Symbol"',
        '"Noto Color Emoji"',
      ],
      mono: [
        'Inconsolata',
        'ui-monospace',
        'SFMono-Regular',
        'Menlo',
        'Monaco',
        'Consolas',
        '"Liberation Mono"',
        '"Courier New"',
        'monospace',
      ],
    },
  },
  plugins: [
    daisyui,
    function ({ addUtilities }) {
      addUtilities({
        '.text-shadow-neon': {
          'text-shadow': '0 0 10px rgba(0, 255, 102, 0.6)',
        },
      });
    },
  ],
  daisyui: {
    themes: ['synthwave'],
  },
};
