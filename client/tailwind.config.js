/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ポーカーテーブルのカスタムカラー
        table: {
          felt: '#0d3f4a',
          feltLight: '#135d6e',
          feltDark: '#0a303a',
          rail: '#1a1a1a',
        },
        poker: {
          red: '#dc2626',
          black: '#1a1a1a',
        }
      },
      animation: {
        'pulse-glow': 'pulse-glow 1.5s ease-in-out infinite',
        'timer-bar': 'timer-bar 15s linear forwards',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 5px currentColor' },
          '50%': { boxShadow: '0 0 20px currentColor' },
        },
        'timer-bar': {
          '0%': { width: '100%' },
          '100%': { width: '0%' },
        }
      },
    },
  },
  plugins: [],
}
