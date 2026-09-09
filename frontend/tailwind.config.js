/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // Support toggling or permanent dark theme
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f3ff',
          100: '#e4e8ff',
          200: '#ccd4ff',
          300: '#a7b4ff',
          400: '#7c8aff',
          500: '#4f5eff', // Primary HSL Brand Accent
          600: '#353fff',
          700: '#2329eb',
          800: '#1b1ec4',
          900: '#1b1fa1',
          950: '#10115e',
        },
        slate: {
          900: '#0f172a',
          950: '#020617', // Elegant contrast
        }
      },
      fontFamily: {
        sans: ['Outfit', 'Inter', 'sans-serif'],
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
        'glow': '0 0 15px 2px rgba(79, 94, 255, 0.4)',
      },
      backdropBlur: {
        'xs': '2px',
      }
    },
  },
  plugins: [],
}
