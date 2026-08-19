import { describe, expect, it } from 'vitest'
import { localDateKey, relativeTime, startOfLocalDay } from './time'

describe('relativeTime', () => {
  const now = new Date('2026-08-19T12:00:00Z')
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString()

  it('collapses anything under a minute to "just now"', () => {
    expect(relativeTime(ago(0), now)).toBe('just now')
    expect(relativeTime(ago(59_000), now)).toBe('just now')
  })

  it('steps through minutes, hours, days and weeks', () => {
    expect(relativeTime(ago(5 * 60_000), now)).toBe('5m ago')
    expect(relativeTime(ago(3 * 3_600_000), now)).toBe('3h ago')
    expect(relativeTime(ago(2 * 86_400_000), now)).toBe('2d ago')
    expect(relativeTime(ago(20 * 86_400_000), now)).toBe('2w ago')
  })

  it('does not go negative when a clock is slightly ahead', () => {
    expect(relativeTime(new Date(now.getTime() + 5_000).toISOString(), now)).toBe('just now')
  })
})

describe('local day helpers', () => {
  it('starts the day at local midnight, not UTC midnight', () => {
    const day = startOfLocalDay(new Date(2026, 7, 19, 23, 30))
    expect([day.getHours(), day.getMinutes(), day.getSeconds()]).toEqual([0, 0, 0])
    expect(day.getDate()).toBe(19)
  })

  it('formats the local date without drifting a day through UTC', () => {
    // 23:30 local on the 19th is already the 20th in UTC east of Greenwich — the key must stay local.
    expect(localDateKey(new Date(2026, 7, 19, 23, 30))).toBe('2026-08-19')
    expect(localDateKey(new Date(2026, 0, 5, 0, 15))).toBe('2026-01-05')
  })
})
