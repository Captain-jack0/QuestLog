import { describe, expect, it } from 'vitest'
import { nextTrapIndex } from './BottomSheet'

/**
 * There is no jsdom here, so the DOM half of the trap (querying focusable elements, focusing
 * them, restoring the opener) is only covered by the e2e sheet spec. This covers the wrap
 * arithmetic, which is where an off-by-one would let Tab out of the sheet.
 */
describe('nextTrapIndex', () => {
  it('walks forward and wraps at the last element', () => {
    expect(nextTrapIndex(3, 0, false)).toBe(1)
    expect(nextTrapIndex(3, 1, false)).toBe(2)
    expect(nextTrapIndex(3, 2, false)).toBe(0)
  })

  it('walks backward and wraps at the first element', () => {
    expect(nextTrapIndex(3, 2, true)).toBe(1)
    expect(nextTrapIndex(3, 1, true)).toBe(0)
    expect(nextTrapIndex(3, 0, true)).toBe(2)
  })

  it('pulls focus back in when it sits outside the sheet', () => {
    expect(nextTrapIndex(3, -1, false)).toBe(0)
    expect(nextTrapIndex(3, -1, true)).toBe(2)
  })

  it('stays put in a sheet with a single focusable element', () => {
    expect(nextTrapIndex(1, 0, false)).toBe(0)
    expect(nextTrapIndex(1, 0, true)).toBe(0)
  })

  it('gives up when there is nothing to focus', () => {
    expect(nextTrapIndex(0, -1, false)).toBe(-1)
    expect(nextTrapIndex(0, -1, true)).toBe(-1)
  })
})
