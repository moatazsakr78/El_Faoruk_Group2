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
        primary: '#55000F',
        'primary-dark': '#44000C',
        secondary: '#10b981',
        dark: '#1f2937',
      },
    },
  },
  plugins: [],
}; 