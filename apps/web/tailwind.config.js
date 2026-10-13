import plugin from 'tailwindcss/plugin'

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
        'surface-raised': themed('surface-raised'),
        'surface-sunken': themed('surface-sunken'),
        ink: themed('ink'),
        muted: themed('muted'),
        line: themed('line'),
        accent: themed('accent'),
        'accent-ink': themed('accent-ink'),
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
      // One size lives below Tailwind's smallest (`xs`, 12px): chart axis labels, tab labels and
      // status chips. It was spelled `text-[11px]` inline, so the scale had no bottom end written
      // down; the scale now ends xs → 2xs; the old 10px step was folded into it. A plain
      // string, not a [size, lineHeight] pair: that emits font-size alone, exactly like the
      // arbitrary value did, so nothing reflows.
      // This `extend` adds to the default scale, it does not replace it — text-sm/text-2xl etc.
      // are untouched.
      // After `2xs` come the type roles from docs/design/stitch/DESIGN.md. Each carries its own
      // line-height, tracking and weight, so a role is one class instead of four. Nothing uses
      // them yet — screens move over in one pass (#57), and `2xs` goes once `micro` replaces it.
      // Headings in the app stop at `display-sm`; the `display-lg` pair is for the landing page.
      fontSize: {
        '2xs': '0.6875rem',
        micro: [
          '0.6875rem',
          { lineHeight: '0.875rem', letterSpacing: '0.04em', fontWeight: '600' },
        ],
        caption: ['0.75rem', { lineHeight: '1rem', letterSpacing: '0.01em', fontWeight: '500' }],
        body: ['0.875rem', { lineHeight: '1.25rem' }],
        'body-medium': ['0.875rem', { lineHeight: '1.25rem', fontWeight: '500' }],
        lead: [
          '1.125rem',
          { lineHeight: '1.625rem', letterSpacing: '-0.005em', fontWeight: '500' },
        ],
        'lead-mobile': ['1rem', { lineHeight: '1.5rem', fontWeight: '500' }],
        'title-md': [
          '1.25rem',
          { lineHeight: '1.625rem', letterSpacing: '-0.01em', fontWeight: '600' },
        ],
        'title-lg': [
          '1.5rem',
          { lineHeight: '1.875rem', letterSpacing: '-0.015em', fontWeight: '700' },
        ],
        'display-sm': [
          '1.875rem',
          { lineHeight: '2.25rem', letterSpacing: '-0.02em', fontWeight: '700' },
        ],
        'display-lg': [
          '3rem',
          { lineHeight: '3.25rem', letterSpacing: '-0.03em', fontWeight: '800' },
        ],
        'display-lg-mobile': [
          '2rem',
          { lineHeight: '2.375rem', letterSpacing: '-0.025em', fontWeight: '800' },
        ],
      },
      // Icon glyph sizes, a scale of their own so icons don't ride the text scale (a type-scale
      // change must not resize icons, nor the reverse). Emitted as `icon-*` by the plugin below.
      // `md` carries the 1rem line-height `text-xs` had, so icons that used it don't shift.
      iconSize: {
        sm: '0.625rem',
        md: ['0.75rem', '1rem'],
        lg: '1rem',
      },
      borderRadius: {
        card: '1rem',
      },
      boxShadow: {
        quest: '0 0 0 1px rgb(var(--line) / 1), 0 8px 24px -12px rgb(var(--accent) / 0.55)',
        // Whole values live in index.css: the themes differ in shape (a halo on the sky, a
        // ring on paper), which a colour token alone cannot express.
        float: 'var(--shadow-float)',
        'glow-accent': 'var(--shadow-glow-accent)',
        'glow-flame': 'var(--shadow-glow-flame)',
      },
    },
  },
  plugins: [
    plugin(({ matchUtilities, theme }) =>
      matchUtilities(
        {
          icon: (value) => {
            const [fontSize, lineHeight] = Array.isArray(value) ? value : [value]
            return lineHeight ? { fontSize, lineHeight } : { fontSize }
          },
        },
        { values: theme('iconSize') },
      ),
    ),
  ],
}
