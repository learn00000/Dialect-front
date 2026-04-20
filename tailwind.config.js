/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './map.html', './src/**/*.{vue,js,ts}'],
  theme: {
    extend: {
      colors: {
        brand: '#3a8f8a',
        'brand-deep': '#1a5c58',
        'brand-light': '#69c4bf',
        ink: '#152322',
        mist: '#e8f4f2'
      },
      fontFamily: {
        sans: ['"PingFang SC"', '"Hiragino Sans GB"', '"Microsoft YaHei"', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        card: '0 6px 28px rgba(22, 88, 85, 0.055), 0 1px 3px rgba(22, 88, 85, 0.04)'
      }
    }
  },
  plugins: []
}
