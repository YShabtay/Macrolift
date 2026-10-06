/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Athletic neon accents
        lime: {
          400: '#a3e635',
          500: '#84cc16',
        },
        orange: {
          400: '#fb923c',
          500: '#f97316',
        },
      },
      fontFamily: {
        sans: ['"Assistant"', '"Rubik"', 'system-ui', 'sans-serif'],
        // Heavy display face (welcome screen headline); falls back to the body font if it can't load.
        display: ['"Secular One"', '"Assistant"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 20px 0 rgba(163, 230, 53, 0.25)',
        'glow-orange': '0 0 20px 0 rgba(251, 146, 60, 0.25)',
      },
      backgroundImage: {
        'glass-gradient':
          'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)',
      },
      animation: {
        'fade-in': 'fade-in 0.4s ease-out',
        'slide-up': 'slide-up 0.4s ease-out',
        'tab-in': 'tab-in 0.28s ease-out',
        'slide-in-right': 'slide-in-right 0.35s ease-out',
        'bounce-dot': 'bounce-dot 1.2s ease-in-out infinite',
        'toast-in': 'toast-in 0.3s ease-out',
        'toast-out': 'toast-out 0.3s ease-in forwards',
        'glow-pulse': 'glow-pulse 0.9s ease-in-out 3',
        'rest-flash': 'rest-flash 1.4s ease-out forwards',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'tab-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-right': {
          '0%': { opacity: '0', transform: 'translateX(100%)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'bounce-dot': {
          '0%, 60%, 100%': { transform: 'translateY(0)', opacity: '0.5' },
          '30%': { transform: 'translateY(-4px)', opacity: '1' },
        },
        'toast-in': {
          '0%': { opacity: '0', transform: 'translateY(-16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'toast-out': {
          '0%': { opacity: '1', transform: 'translateY(0)' },
          '100%': { opacity: '0', transform: 'translateY(-16px)' },
        },
        'rest-flash': {
          '0%': { opacity: '0' },
          '12%': { opacity: '0.55' },
          '32%': { opacity: '0.05' },
          '52%': { opacity: '0.5' },
          '100%': { opacity: '0' },
        },
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(163, 230, 53, 0.5)' },
          '50%': { boxShadow: '0 0 32px 8px rgba(163, 230, 53, 0.55)' },
        },
      },
    },
  },
  plugins: [],
}
