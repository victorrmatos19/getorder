import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: 'var(--primary)',
        'primary-dk': 'var(--primary-dk)',
        accent: 'var(--accent)',
        'accent-dk': 'var(--accent-dk)',
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        line: 'var(--line)',
        muted: 'var(--muted)',
        'text-mid': 'var(--text-mid)',
        ink: 'var(--ink)',
        'status-new': 'var(--status-new)',
        'status-prep': 'var(--status-prep)',
        'status-ready': 'var(--status-ready)',
      },
      fontFamily: {
        serif: ['var(--font-serif)', 'serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        xs: ['12px', { lineHeight: '1.4' }],
        sm: ['14px', { lineHeight: '1.4' }],
        base: ['16px', { lineHeight: '1.5' }],
        lg: ['20px', { lineHeight: '1.3' }],
        xl: ['24px', { lineHeight: '1.2' }],
        '2xl': ['32px', { lineHeight: '1.1' }],
        '4xl': ['36px', { lineHeight: '1.1' }],
      },
      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        pulse: { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.55' } },
        spin: { to: { transform: 'rotate(360deg)' } },
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease both',
        'slide-up': 'slideUp 0.35s cubic-bezier(0.22,1,0.36,1) both',
        'pulse-soft': 'pulse 2s ease infinite',
        spin: 'spin 0.9s linear infinite',
      },
    },
  },
  plugins: [],
}

export default config
