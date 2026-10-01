import { describe, expect, it } from 'vitest'
import { bodyLockStyle, nextTrapIndex } from './BottomSheet'

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

/**
 * Only the style arithmetic — `position: fixed` is the half `overflow: hidden` was missing on
 * iOS, and `top` is the only record of where the page was while it is pinned. Applying the
 * lock and handing the scroll position back is DOM work with no jsdom to run it here; the
 * scroll steps of `e2e/sheet-keyboard.spec.ts` assert that half against a real browser — the
 * `mobile` (Chromium) project of it: with scroll anchoring off there, the restore is the only
 * mechanism we know of that puts the offset back — not mutation-tested, on either engine.
 */
describe('bodyLockStyle', () => {
  it('pins the body instead of trusting overflow alone', () => {
    const style = bodyLockStyle(0, 0)
    expect(style.position).toBe('fixed')
    expect(style.overflow).toBe('hidden')
    expect(style.width).toBe('100%')
  })

  it('carries the scroll offset as a negative top', () => {
    expect(bodyLockStyle(1240, 0).top).toBe('-1240px')
  })

  it('pads the gutter a vanishing desktop scrollbar leaves behind', () => {
    expect(bodyLockStyle(0, 15).paddingRight).toBe('15px')
  })

  it('adds no padding where there is no scrollbar to lose', () => {
    expect(bodyLockStyle(0, 0).paddingRight).toBe('')
  })
})
