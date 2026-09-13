/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'accent-indigo': '#6366F1',
        'accent-indigo-glow': 'rgba(99, 102, 241, 0.35)',
        'accent-cyan': '#06B6D4',
        'accent-cyan-glow': 'rgba(6, 182, 212, 0.35)',
        'accent-emerald': '#10B981',
        'accent-amber': '#F59E0B',
        'accent-rose': '#EF4444',
        'accent-violet': '#8B5CF6',
        'bg-base': '#0B0F19',
        'bg-surface': '#111827',
        'bg-surface-elevated': '#1A2236',
        'sidebar-bg': '#0D1120',
        'text-primary': '#F9FAFB',
        'text-secondary': '#9CA3AF',
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Courier New', 'monospace'],
      },
      backdropBlur: {
        xs: '2px',
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'waveform': 'waveform-bar 1s ease-in-out infinite',
        'shimmer': 'shimmer 1.6s infinite',
        'float-node': 'float-node 7s ease-in-out infinite',
        'float-slow': 'float-slow 6s ease-in-out infinite',
        'stream-in': 'stream-in 0.3s ease forwards',
        'spin-slow': 'spin-slow 8s linear infinite',
        'blink': 'blink-cursor 1s step-end infinite',
        'aurora': 'aurora 15s ease infinite alternate',
        'laser-scan': 'laser-scan 2.5s ease-in-out infinite',
        'radar-ping': 'radar-ping 2s cubic-bezier(0, 0, 0.2, 1) infinite',
        'fade-in-up': 'fade-in-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'scale-pop': 'scale-pop 0.2s ease-out forwards',
        'gradient-shift': 'gradient-shift 6s ease infinite',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { opacity: '0.7', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.08)' },
        },
        'waveform-bar': {
          '0%, 100%': { transform: 'scaleY(0.2)' },
          '50%': { transform: 'scaleY(1)' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'float-node': {
          '0%, 100%': { transform: 'translate(0, 0)' },
          '33%': { transform: 'translate(14px, -10px)' },
          '66%': { transform: 'translate(-10px, 14px)' },
        },
        'float-slow': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        'stream-in': {
          'from': { opacity: '0', transform: 'translateY(8px)' },
          'to': { opacity: '1', transform: 'translateY(0)' },
        },
        'spin-slow': {
          'from': { transform: 'rotate(0deg)' },
          'to': { transform: 'rotate(360deg)' },
        },
        'blink-cursor': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        'aurora': {
          '0%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' },
        },
        'laser-scan': {
          '0%': { top: '0%', opacity: '0.8' },
          '50%': { top: '95%', opacity: '1' },
          '100%': { top: '0%', opacity: '0.8' },
        },
        'radar-ping': {
          '75%, 100%': { transform: 'scale(2)', opacity: '0' },
        },
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-pop': {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'gradient-shift': {
          '0%': { filter: 'hue-rotate(0deg)' },
          '50%': { filter: 'hue-rotate(30deg)' },
          '100%': { filter: 'hue-rotate(0deg)' },
        },
      },
    },
  },
  plugins: [],
}
