import { describe, expect, it } from 'vitest'
import css from '../../index.css?raw'
import { ITEM_STATUSES } from '../../lib/schemas'
import { statusTone } from './StatusChip'

type Rgb = [number, number, number]

/** The "R G B" tokens of one theme block, read straight from index.css so a regressed value fails here. */
function themeTokens(selector: string): Record<string, Rgb> {
  const start = css.indexOf(`${selector} {`)
  expect(start, selector).toBeGreaterThanOrEqual(0)
  const block = css.slice(start, css.indexOf('}', start))
  return Object.fromEntries(
    [...block.matchAll(/--([\w-]+):\s*(\d+) (\d+) (\d+);/g)].map((m) => [m[1], [+m[2], +m[3], +m[4]]]),
  )
}

// WCAG 2.x relative luminance and contrast ratio.
const channel = (c: number) => {
  const s = c / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}
const luminance = ([r, g, b]: Rgb) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
const contrast = (a: Rgb, b: Rgb) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}
const over = (fg: Rgb, alpha: number, bg: Rgb) => fg.map((v, i) => v * alpha + bg[i] * (1 - alpha)) as Rgb

const themes = {
  quest: themeTokens("[data-theme='quest']"),
  calm: themeTokens("[data-theme='calm']"),
}

describe('status chip contrast', () => {
  // Chips are text-2xs (11px), so the large-text 3:1 exception never applies: 4.5:1 everywhere.
  for (const [theme, tokens] of Object.entries(themes)) {
    for (const status of ITEM_STATUSES) {
      it(`${status} meets 4.5:1 on a card in the ${theme} theme`, () => {
        const tone = statusTone(status)
        const bg = tone.match(/(?:^| )bg-([a-z-]+)(?:\/(\d+))?(?: |$)/)
        const fg = tone.match(/(?:^| )text-([a-z-]+)(?: |$)/)
        expect(bg, tone).not.toBeNull()
        expect(fg, tone).not.toBeNull()
        const [, bgToken, bgAlpha] = bg!
        const fgToken = fg![1]
        expect(tokens[bgToken], bgToken).toBeDefined()
        expect(tokens[fgToken], fgToken).toBeDefined()

        // The chip's translucent fill composited over the card's surface is what the eye sees.
        const fill = over(tokens[bgToken], bgAlpha ? +bgAlpha / 100 : 1, tokens.surface)
        expect(contrast(tokens[fgToken], fill)).toBeGreaterThanOrEqual(4.5)
      })
    }
  }
})
