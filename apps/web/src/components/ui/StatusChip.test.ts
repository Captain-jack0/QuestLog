import { describe, expect, it } from 'vitest'
import { contrast, over, themes } from '../../contrast-test-utils'
import { ITEM_STATUSES } from '../../lib/schemas'
import { statusTone } from './StatusChip'

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
