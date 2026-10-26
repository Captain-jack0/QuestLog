import { describe, expect, it } from 'vitest'
import { arrowTarget } from './useRadioGroup'

/**
 * The keydown handler's arithmetic. The DOM half (focus moving, Space/Enter selecting, the
 * status picker not writing on an arrow) is covered by e2e/sheet-keyboard.spec.ts.
 */
describe('arrowTarget', () => {
  it('steps forward on ArrowRight and ArrowDown', () => {
    expect(arrowTarget(0, 'ArrowRight', 3)).toBe(1)
    expect(arrowTarget(0, 'ArrowDown', 3)).toBe(1)
  })

  it('steps back on ArrowLeft and ArrowUp', () => {
    expect(arrowTarget(1, 'ArrowLeft', 3)).toBe(0)
    expect(arrowTarget(1, 'ArrowUp', 3)).toBe(0)
  })

  it('wraps at both ends', () => {
    expect(arrowTarget(2, 'ArrowRight', 3)).toBe(0)
    expect(arrowTarget(0, 'ArrowLeft', 3)).toBe(2)
  })

  it('stays put in a one-option group', () => {
    expect(arrowTarget(0, 'ArrowRight', 1)).toBe(0)
  })

  it('ignores other keys, an unknown start and an empty group', () => {
    expect(arrowTarget(0, 'Enter', 3)).toBeNull()
    expect(arrowTarget(0, ' ', 3)).toBeNull()
    expect(arrowTarget(-1, 'ArrowRight', 3)).toBeNull()
    expect(arrowTarget(0, 'ArrowRight', 0)).toBeNull()
  })
})
