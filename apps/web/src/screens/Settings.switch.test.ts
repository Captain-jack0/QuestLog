import { describe, expect, it } from 'vitest'
import { contrast, themes } from '../contrast-test-utils'
import source from './Settings.tsx?raw'

// The Switch is a non-text control: WCAG 1.4.11 asks 3:1 for the parts that show its state.
// Off = muted outline and thumb on a sunken track; on = accent track. The card behind is surface.
const NON_TEXT = 3

describe('settings switch', () => {
  it('is drawn with the tokens checked below', () => {
    expect(source).toMatch(/border-2 border-muted bg-surface-sunken/)
    expect(source).toMatch(/peer-checked:border-accent peer-checked:bg-accent/)
    expect(source).toMatch(/h-5 w-5 rounded-full bg-muted/)
  })

  for (const [theme, t] of Object.entries(themes)) {
    describe(`${theme} theme`, () => {
      it('off outline (muted) meets 3:1 on the card surface', () => {
        expect(contrast(t.muted, t.surface)).toBeGreaterThanOrEqual(NON_TEXT)
      })
      it('off thumb (muted) meets 3:1 on the sunken track', () => {
        expect(contrast(t.muted, t['surface-sunken'])).toBeGreaterThanOrEqual(NON_TEXT)
      })
      it('on track (accent) meets 3:1 on the card surface', () => {
        expect(contrast(t.accent, t.surface)).toBeGreaterThanOrEqual(NON_TEXT)
      })
      it('on thumb (paper) meets 3:1 on the accent track', () => {
        expect(contrast(t.paper, t.accent)).toBeGreaterThanOrEqual(NON_TEXT)
      })
    })
  }

  it('keeps its state visible in forced-colors mode', () => {
    expect(source).toMatch(/forced-colors:peer-checked:bg-\[Highlight\]/)
    expect(source).toMatch(/forced-colors:bg-\[CanvasText\]/)
  })
})
