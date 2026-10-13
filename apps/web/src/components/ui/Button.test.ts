import { describe, expect, it } from 'vitest'
import { contrast, themes } from '../../contrast-test-utils'
import { variants } from './Button'

// The one filled control on a screen: its label must stay readable in both themes.
describe('primary button', () => {
  it('is accent ground with paper text', () => {
    expect(variants.primary).toMatch(/(?:^| )bg-accent(?: |$)/)
    expect(variants.primary).toMatch(/(?:^| )text-paper(?: |$)/)
  })

  for (const [theme, tokens] of Object.entries(themes)) {
    it(`paper on accent meets 4.5:1 in the ${theme} theme`, () => {
      expect(contrast(tokens.paper, tokens.accent)).toBeGreaterThanOrEqual(4.5)
    })
  }
})
