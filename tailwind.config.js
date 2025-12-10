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
      },
    },
  },
  plugins: [],
}
