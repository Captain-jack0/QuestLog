import { describe, expect, it } from 'vitest'
import { timeZones } from './timezones'

describe('timeZones', () => {
  it('always offers UTC, which is what new profiles are created with', () => {
    expect(timeZones()).toContain('UTC')
  })

  it('folds in the stored zone even when the platform does not list it', () => {
    const zones = timeZones('Mars/Olympus_Mons')
    expect(zones).toContain('Mars/Olympus_Mons')
  })

  it('returns a sorted list with no duplicates', () => {
    const zones = timeZones('UTC')
    expect(zones).toEqual([...zones].sort())
    expect(new Set(zones).size).toBe(zones.length)
  })
})
