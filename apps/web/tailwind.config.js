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
        canvas: {
          DEFAULT: '#0d1117',
          subtle: '#161b22',
          muted: '#21262d',
        },
      },
    },
  },
  plugins: [],
}
