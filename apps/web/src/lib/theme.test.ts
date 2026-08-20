import { describe, expect, it } from 'vitest'
import { isTheme, THEMES } from './theme'

describe('isTheme', () => {
  it('accepts the themes that exist', () => {
    expect(THEMES.every(isTheme)).toBe(true)
  })

  it('rejects anything else, so a stale localStorage value cannot break the paint', () => {
    expect(isTheme('dark')).toBe(false)
    expect(isTheme(null)).toBe(false)
    expect(isTheme(undefined)).toBe(false)
    expect(isTheme(1)).toBe(false)
  })
})
