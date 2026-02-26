/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'brand-blue': 'var(--color-brand-blue)',
        'brand-light': 'var(--color-brand-light)',
        'accent-pink': 'var(--color-accent-pink)',
        'beige': {
          50: '#ffffff',
          100: '#faf8f5',
          200: '#f0ebe3',
        },
        'dpurple': {
          950: '#0d0a1a',
          900: '#15102b',
          800: '#1e1740',
          700: '#2d2255',
          600: '#382a65',
          500: '#4a3a7a',
        },
      },
    },
  },
  plugins: [],
}
