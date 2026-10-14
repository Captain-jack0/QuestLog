import { describe, expect, it } from 'vitest'
import { contrast, over, themes, type Rgb } from '../../contrast-test-utils'
import { INTENSITY_SHADES } from './aggregate'
import { TONE } from './WeeklyBarChart'

/** `bg-accent/70` composited over the card surface. */
function fill(cls: string, tokens: Record<string, Rgb>): Rgb {
  const [, token, alpha] = cls.match(/^bg-([a-z-]+)(?:\/(\d+))?$/)!
  expect(tokens[token], token).toBeDefined()
  return over(tokens[token], alpha ? +alpha / 100 : 1, tokens.surface)
}

// Graphical objects: WCAG 1.4.11 asks 3:1 against what they sit on.
for (const [theme, tokens] of Object.entries(themes)) {
  describe(`progress charts in the ${theme} theme`, () => {
    it('draws every active grid shade at 3:1 or more on the card', () => {
      for (const shade of INTENSITY_SHADES.slice(1)) {
        expect(contrast(fill(shade, tokens), tokens.surface), shade).toBeGreaterThanOrEqual(3)
      }
    })

    it('keeps neighbouring grid shades apart, each darker step a visible step', () => {
      const ratios = INTENSITY_SHADES.map((shade) => contrast(fill(shade, tokens), tokens.surface))
      for (let i = 1; i < ratios.length; i++) {
        expect(ratios[i] / ratios[i - 1], INTENSITY_SHADES[i]).toBeGreaterThanOrEqual(1.2)
      }
    })

    it('draws both bar tones at 3:1 or more on the card', () => {
      for (const tone of Object.values(TONE)) {
        expect(contrast(fill(tone, tokens), tokens.surface), tone).toBeGreaterThanOrEqual(3)
      }
    })
  })
}
