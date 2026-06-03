/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eef8f1',
          100: '#d7efe0',
          200: '#b2dec4',
          300: '#82c69e',
          400: '#4ca870',
          500: '#2c8a55',
          600: '#1f6d43',
          700: '#185637',
          800: '#17462f',
          900: '#123826',
        },
        gold: {
          50: '#fff8e1',
          100: '#ffefb5',
          200: '#ffe27f',
          300: '#f8cc47',
          400: '#e6ad20',
          500: '#c99012',
          600: '#a56f0c',
          700: '#83540f',
          800: '#6d4413',
          900: '#5d3915',
        },
        chess: {
          light: '#f0d9b5',
          dark: '#b58863',
          highlight: '#ffff00',
          move: '#9bc53d',
        },
        background: '#ffffff',
        foreground: '#0f172a',
        border: '#e2e8f0',
        ring: '#c99012',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
  ],
}
