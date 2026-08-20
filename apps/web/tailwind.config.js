/** @type {import('tailwindcss').Config} */

// Every colour is a CSS variable holding an "R G B" triplet, so switching the theme on
// <html data-theme> repaints the whole app without touching a single class name.
const themed = (name) => `rgb(var(--${name}) / <alpha-value>)`

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: themed('paper'),
        surface: themed('surface'),
        ink: themed('ink'),
        muted: themed('muted'),
        line: themed('line'),
        accent: themed('accent'),
        success: themed('success'),
        flame: themed('flame'),
        alert: themed('alert'),
        'alert-ink': themed('alert-ink'),
        // The bright pair fails contrast as small text, so text uses these.
        'success-ink': themed('success-ink'),
        'flame-ink': themed('flame-ink'),
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Press Start 2P"', 'Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '1rem',
      },
      boxShadow: {
        quest: '0 0 0 1px rgb(var(--line) / 1), 0 8px 24px -12px rgb(var(--accent) / 0.55)',
      },
    },
  },
  plugins: [],
}
