import { describe, expect, it } from 'vitest'
import { tones } from './Toast'

// Vite reads the tree for us, so this needs neither `fs` nor @types/node — the web
// tsconfig pins `types: ["vite/client"]` and node globals are deliberately absent.
const SOURCES = import.meta.glob('../../**/*.{ts,tsx,css,html}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

// Spelled in two halves on purpose: this file scans the source tree for the class,
// and a literal here would make the scanner report itself.
const FIXED_WHITE = new RegExp(`\\btext-${'white'}\\b`)

describe('toast tones', () => {
  it('never hardcodes a colour outside the theme tokens', () => {
    // A fixed colour survives a theme switch and quietly breaks contrast on the light
    // theme. Every tone must read both its colours from a token.
    for (const [tone, classes] of Object.entries(tones)) {
      expect(classes, tone).not.toMatch(/\b(?:text|bg)-(?:white|black)\b/)
      expect(classes, tone).not.toMatch(/#[0-9a-f]{3,8}\b/i)
    }
  })

  it('gives every tone one token background and one token foreground', () => {
    for (const [tone, classes] of Object.entries(tones)) {
      expect(classes, tone).toMatch(/(?:^| )bg-[a-z-]+(?: |$)/)
      expect(classes, tone).toMatch(/(?:^| )text-[a-z-]+(?: |$)/)
    }
  })

  it('paints errors on a background no other tone uses', () => {
    // Colour is only half the signal (Toast.tsx adds a glyph and role="alert"), but the
    // error tone must at least not collide with a neutral one.
    const background = (classes: string) => classes.split(' ').find((c) => c.startsWith('bg-'))
    const errorBg = background(tones.error)
    const others = Object.entries(tones)
      .filter(([tone]) => tone !== 'error')
      .map(([, classes]) => background(classes))

    expect(errorBg).toBeDefined()
    expect(others).not.toContain(errorBg)
  })
})

describe('theme tokens', () => {
  it('keeps the fixed white class out of the whole source tree', () => {
    // Regression barrier: the tone fix above is worthless if the next edit reintroduces
    // a hardcoded white somewhere else on the screen.
    const scanned = Object.keys(SOURCES)
    expect(scanned.length).toBeGreaterThan(20) // the glob actually resolved something

    const offenders = scanned.filter((file) => FIXED_WHITE.test(SOURCES[file]))
    expect(offenders).toEqual([])
  })
})
