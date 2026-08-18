import { describe, expect, it } from 'vitest'
import { levelForXp, xpForLevel } from './xp'

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
