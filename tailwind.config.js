/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts}'],
  theme: {
    extend: {
      colors: {
        brand: '#165DFF'
      },
      boxShadow: {
        card: '0 10px 40px -12px rgba(22, 93, 255, 0.25), 0 4px 18px rgba(15, 23, 42, 0.08)'
      }
    }
  },
  plugins: []
}
