/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#5D1F1F',
        'primary-dark': '#300000',
        secondary: '#10b981',
        dark: '#1f2937',
      },
    },
  },
  plugins: [],
}; 