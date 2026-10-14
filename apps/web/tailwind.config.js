import plugin from 'tailwindcss/plugin'

/** @type {import('tailwindcss').Config} */

// Every colour is a CSS variable holding an "R G B" triplet, so switching the theme on
// <html data-theme> repaints the whole app without touching a single class name.
const themed = (name) => `rgb(var(--${name}) / <alpha-value>)`

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    // Type roles from docs/design/stitch/DESIGN.md. Each carries its own line-height, tracking
    // and weight, so a role is one class instead of four; an explicit `font-*`/`tracking-*`/
    // `leading-*` on the element still wins, but only at the same breakpoint: with a prefixed role
    // (`md:text-display-lg`) the override needs the same prefix (`md:font-normal`). `fontSize` is defined here, not under `extend`, so
    // Tailwind's raw names (text-xs, text-sm, ...) are not generated: the scale is roles only, and
    // ESLint (.eslintrc.cjs) rejects the raw names too. Headings in the app stop at `display-sm`;
    // the `display-lg` pair is for the landing page (plus the Progress level number). `micro` is the 11px floor
    // (chart axis labels, tab labels, status chips).
    fontSize: {
      micro: ['0.6875rem', { lineHeight: '0.875rem', letterSpacing: '0.04em', fontWeight: '600' }],
      caption: ['0.75rem', { lineHeight: '1rem', letterSpacing: '0.01em', fontWeight: '500' }],
      body: ['0.875rem', { lineHeight: '1.25rem' }],
      'body-medium': ['0.875rem', { lineHeight: '1.25rem', fontWeight: '500' }],
      lead: ['1.125rem', { lineHeight: '1.625rem', letterSpacing: '-0.005em', fontWeight: '500' }],
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
      },
      // Icon glyph sizes, a scale of their own so icons don't ride the text scale (a type-scale
      // change must not resize icons, nor the reverse). Emitted as `icon-*` by the plugin below.
      // `md` carries the 1rem line-height the old `text-xs` had, so icons that used it don't shift.
      iconSize: {
        sm: '0.625rem',
        md: ['0.75rem', '1rem'],
        lg: '1rem',
        xl: '1.5rem',
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
