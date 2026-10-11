/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Elegant wedding palette — warm gold + charcoal + cream
        gold: {
          50: '#faf6ed',
          100: '#f5ecd6',
          200: '#ecd9ad',
          300: '#e0c07a',
          400: '#d4a94a',
          500: '#b8860b', // primary gold
          600: '#9a6f08',
          700: '#7a560a',
          800: '#5c4108',
          900: '#3d2b06',
        },
        ink: {
          50: '#f7f7f6',
          100: '#eeece9',
          200: '#dcd8d2',
          300: '#b8b1a6',
          400: '#8a8273',
          500: '#5c5547',
          600: '#3f3a30',
          700: '#2a261f',
          800: '#1c1915',
          900: '#100e0b',
        },
        cream: '#fdfaf3',
        sage: {
          400: '#7fa088',
          500: '#5a8267',
          600: '#436a52',
        },
        blush: {
          400: '#e8b4b8',
          500: '#d98a91',
        },
      },
      fontFamily: {
        display: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 2px 12px rgba(28, 25, 21, 0.06)',
        card: '0 4px 24px rgba(28, 25, 21, 0.08)',
        lift: '0 12px 40px rgba(28, 25, 21, 0.12)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        'scale-in': 'scaleIn 0.2s ease-out',
      },
      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(12px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        scaleIn: { from: { opacity: '0', transform: 'scale(0.96)' }, to: { opacity: '1', transform: 'scale(1)' } },
      },
    },
  },
  plugins: [],
};
