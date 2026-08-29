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
        display: ['"Instrument Serif"', 'Georgia', 'serif'],
      },
      // Two sizes live below Tailwind's smallest (`xs`, 12px): chart axis labels, tab labels,
      // status chips and inline icons. They were spelled `text-[10px]`/`text-[11px]` inline, so
      // the scale had no bottom end written down. Named here as a continuation of Tailwind's own
      // xs → 2xs → 3xs order. Deliberately plain strings, not [size, lineHeight] pairs: that
      // emits font-size alone, exactly like the arbitrary values did, so nothing reflows.
      // This `extend` adds to the default scale, it does not replace it — text-sm/text-2xl etc.
      // are untouched.
      fontSize: {
        '2xs': '0.6875rem',
        '3xs': '0.625rem',
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
