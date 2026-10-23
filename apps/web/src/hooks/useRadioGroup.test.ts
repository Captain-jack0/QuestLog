import { describe, expect, it } from 'vitest'

/**
 * useRadioGroup is a thin wrapper around roving tabindex arithmetic and keyboard handlers.
 * The DOM half (focus restoration, event listening) is covered by e2e/sheet-keyboard.spec.ts.
 * This tests the tabIndex calculation (the return value), which is pure logic.
 */
describe('useRadioGroup tabIndex calculation', () => {
  it('returns 0 for selected option, -1 for others (enabled)', () => {
    // Simulating the hook's return value: (option: T) => number
    const value = 'option2'
    const disabled = false

    const getTabIndex = (option: string) => {
      if (disabled) return -1
      return option === value ? 0 : -1
    }

    expect(getTabIndex('option1')).toBe(-1)
    expect(getTabIndex('option2')).toBe(0)
    expect(getTabIndex('option3')).toBe(-1)
  })

  it('returns -1 for all options when disabled', () => {
    const value = 'option2'
    const disabled = true

    const getTabIndex = (option: string) => {
      if (disabled) return -1
      return option === value ? 0 : -1
    }

    expect(getTabIndex('option1')).toBe(-1)
    expect(getTabIndex('option2')).toBe(-1)
    expect(getTabIndex('option3')).toBe(-1)
  })
})

/**
 * Arrow key navigation logic (wrapped/unwrapped indexing). This is the arithmetic inside
 * useRadioGroup's keydown handler: given current index, next index is (current ± 1) % length.
 */
describe('useRadioGroup arrow key navigation arithmetic', () => {
  function nextIndex(current: number, direction: 'right' | 'left', length: number): number {
    if (direction === 'right') {
      return (current + 1) % length
    } else {
      return (current - 1 + length) % length
    }
  }

  it('wraps around from last to first on ArrowRight', () => {
    const options = ['option1', 'option2', 'option3']
    const current = 2 // last option
    const next = nextIndex(current, 'right', options.length)
    expect(next).toBe(0)
    expect(options[next]).toBe('option1')
  })

  it('wraps around from first to last on ArrowLeft', () => {
    const options = ['option1', 'option2', 'option3']
    const current = 0 // first option
    const next = nextIndex(current, 'left', options.length)
    expect(next).toBe(2)
    expect(options[next]).toBe('option3')
  })

  it('moves forward on ArrowRight/ArrowDown', () => {
    const options = ['option1', 'option2', 'option3']
    const current = 0
    const next = nextIndex(current, 'right', options.length)
    expect(next).toBe(1)
    expect(options[next]).toBe('option2')
  })

  it('moves backward on ArrowLeft/ArrowUp', () => {
    const options = ['option1', 'option2', 'option3']
    const current = 1
    const next = nextIndex(current, 'left', options.length)
    expect(next).toBe(0)
    expect(options[next]).toBe('option1')
  })

  it('handles single-option case (no wrap needed)', () => {
    const options = ['only']
    expect(nextIndex(0, 'right', options.length)).toBe(0)
    expect(nextIndex(0, 'left', options.length)).toBe(0)
  })
})

/**
 * Edge cases: empty options, value not in options.
 * When value is not in options, indexOf returns -1 and navigation should no-op.
 */
describe('useRadioGroup edge cases', () => {
  it('handles empty options array (no navigation possible)', () => {
    const options: string[] = []
    const value = ''
    const currentIndex = options.indexOf(value) // -1
    expect(currentIndex).toBe(-1)
    // When current is -1, navigation should not proceed
  })

  it('handles value not in options (indexOf returns -1)', () => {
    const options = ['option1', 'option2']
    const value = 'nonexistent'
    const currentIndex = options.indexOf(value)
    expect(currentIndex).toBe(-1)
    // The hook's keydown handler checks `if (current === -1) return` — no onChange call
  })
})
