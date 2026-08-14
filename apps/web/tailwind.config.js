/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#FAFAF7',
        surface: '#FFFFFF',
        ink: '#1F2933',
        muted: '#6B7280',
        accent: '#5B5BD6',
        success: '#2F9E69',
        flame: '#E8833A',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '1rem',
      },
    },
  },
  plugins: [],
}
