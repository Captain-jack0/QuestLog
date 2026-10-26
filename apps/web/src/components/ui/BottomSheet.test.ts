import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { bodyLockStyle, lockBody, nextTrapIndex, tabStops, unlockBody } from './BottomSheet'

/**
 * There is no jsdom here, so the DOM half of the trap (querying focusable elements, focusing
 * them, restoring the opener) is only covered by the e2e sheet spec. This covers the wrap
 * arithmetic, which is where an off-by-one would let Tab out of the sheet.
 */
describe('tabStops', () => {
  it("drops a radio group's parked options, so the group is one Tab stop", () => {
    const chosen = { tabIndex: 0 }
    const parked = { tabIndex: -1 }
    const field = { tabIndex: 0 }
    expect(tabStops([field, parked, chosen, parked])).toEqual([field, chosen])
  })

  it('keeps a positive tabIndex', () => {
    expect(tabStops([{ tabIndex: 2 }])).toEqual([{ tabIndex: 2 }])
  })
})

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

/** No jsdom: a bare `document.body.style` and `window` stand in for the browser. */
describe('lockBody / unlockBody', () => {
  let style: Record<string, string>
  let scrollTo: ReturnType<typeof vi.fn>
  let win: { scrollY: number; innerWidth: number; scrollTo: typeof scrollTo }

  beforeEach(() => {
    style = { position: '', top: '', width: '', overflow: 'auto', paddingRight: '' }
    scrollTo = vi.fn()
    win = { scrollY: 640, innerWidth: 390, scrollTo }
    vi.stubGlobal('document', { body: { style }, documentElement: { clientWidth: 390 } })
    vi.stubGlobal('window', win)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('pins the body at the current scroll offset on open', () => {
    lockBody()
    expect(style.position).toBe('fixed')
    expect(style.top).toBe('-640px')
    expect(style.width).toBe('100%')
    expect(style.overflow).toBe('hidden')
    unlockBody()
  })

  it('restores the previous styles and scroll offset on close', () => {
    lockBody()
    unlockBody()
    expect(style).toEqual({
      position: '',
      top: '',
      width: '',
      overflow: 'auto',
      paddingRight: '',
    })
    expect(scrollTo).toHaveBeenCalledOnce()
    expect(scrollTo).toHaveBeenCalledWith(0, 640)
  })

  it('pins once and hands back once when two sheets nest', () => {
    lockBody()
    win.scrollY = 0 // what a pinned page reports to the second sheet
    lockBody()
    expect(style.top).toBe('-640px')

    unlockBody() // outer-first or inner-first, the first close must not unpin
    expect(style.position).toBe('fixed')
    expect(scrollTo).not.toHaveBeenCalled()

    unlockBody()
    expect(style.position).toBe('')
    expect(style.overflow).toBe('auto')
    expect(scrollTo).toHaveBeenCalledOnce()
    expect(scrollTo).toHaveBeenCalledWith(0, 640)
  })
})
