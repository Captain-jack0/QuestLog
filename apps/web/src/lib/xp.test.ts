import { describe, expect, it } from 'vitest'
import { focusXpTotal, levelForXp, xpForLevel } from './xp'

describe('xp curve', () => {
  it('starts everyone at level 1 with no XP required', () => {
    expect(xpForLevel(1)).toBe(0)
    expect(levelForXp(0)).toBe(1)
  })

  it('levels up exactly at the threshold, not before', () => {
    const threshold = xpForLevel(2) // 283
    expect(levelForXp(threshold - 1)).toBe(1)
    expect(levelForXp(threshold)).toBe(2)
  })

  it('is the inverse of xpForLevel across the early curve', () => {
    for (let level = 1; level <= 20; level++) {
      expect(levelForXp(xpForLevel(level))).toBe(level)
    }
  })
})

describe('focusXpTotal', () => {
  it('adds up focus_time rows only', () => {
    const rows = [
      { xp: 10, action_type: 'focus_time' },
      { xp: 25, action_type: 'task_complete' },
      { xp: 20, action_type: 'focus_time' },
    ]
    expect(focusXpTotal(rows)).toBe(30)
  })

  it('is zero with no rows or no focus rows', () => {
    expect(focusXpTotal([])).toBe(0)
    expect(focusXpTotal([{ xp: 8, action_type: 'progress_update' }])).toBe(0)
  })
})
