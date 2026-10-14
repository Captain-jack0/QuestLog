import { describe, expect, it } from 'vitest'
import {
  activeAreasLastWeek,
  barHeights,
  calendarWeeks,
  dailyXpTotals,
  dateKeyIn,
  effectiveStreak,
  intensity,
  startOfWeek,
  weeklyXp,
  xpInLastDays,
} from './aggregate'

// Wednesday 19 August 2026, local time
const now = new Date(2026, 7, 19, 10, 0)
const at = (date: Date, xp: number) => ({ created_at: date.toISOString(), xp })

describe('startOfWeek', () => {
  it('rewinds to Monday at local midnight', () => {
    const monday = startOfWeek(now)
    expect(monday.getDay()).toBe(1)
    expect(monday.getDate()).toBe(17)
    expect(monday.getHours()).toBe(0)
  })

  it('treats Sunday as the end of its week, not the start', () => {
    const sunday = new Date(2026, 7, 23, 23, 0)
    expect(startOfWeek(sunday).getDate()).toBe(17)
  })
})

describe('weeklyXp', () => {
  it('always returns the requested number of buckets, oldest first', () => {
    const buckets = weeklyXp([], 8, now)
    expect(buckets).toHaveLength(8)
    expect(buckets[7].weekStart).toBe('2026-08-17')
    expect(buckets[0].weekStart).toBe('2026-06-29')
    expect(buckets.every((b) => b.xp === 0)).toBe(true)
  })

  it('sums events into the week they belong to', () => {
    const buckets = weeklyXp(
      [
        at(new Date(2026, 7, 19, 9), 10), // this week
        at(new Date(2026, 7, 17, 8), 25), // this week (Monday)
        at(new Date(2026, 7, 12, 8), 8), // last week
      ],
      8,
      now,
    )
    expect(buckets[7].xp).toBe(35)
    expect(buckets[6].xp).toBe(8)
  })

  it('ignores events older than the window', () => {
    const buckets = weeklyXp([at(new Date(2026, 3, 1), 100)], 8, now)
    expect(buckets.reduce((sum, b) => sum + b.xp, 0)).toBe(0)
  })
})

describe('dailyXpTotals', () => {
  it('sums several events on one day into that day', () => {
    const totals = dailyXpTotals([
      at(new Date(2026, 7, 19, 9), 10),
      at(new Date(2026, 7, 19, 17), 8),
      at(new Date(2026, 7, 18, 9), 8),
    ])
    expect(Object.fromEntries(totals)).toEqual({ '2026-08-18': 8, '2026-08-19': 18 })
  })
})

describe('intensity', () => {
  it('maps daily XP onto four shades at the floors', () => {
    expect([0, 1, 24, 25, 59, 60, 300].map(intensity)).toEqual([0, 1, 1, 2, 2, 3, 3])
  })
})

describe('xpInLastDays', () => {
  it('counts today and the six local days before it, nothing older', () => {
    const events = [
      at(new Date(2026, 7, 19, 9), 10), // today
      at(new Date(2026, 7, 13, 0, 30), 25), // six days back, just after midnight
      at(new Date(2026, 7, 12, 23, 30), 50), // seven days back: out
    ]
    expect(xpInLastDays(events, 7, now)).toBe(35)
  })
})

describe('activeAreasLastWeek', () => {
  it('counts distinct areas within the rolling 7 x 24 hours, ignoring area-less events', () => {
    const events = [
      { ...at(new Date(2026, 7, 19, 9), 10), area_id: 'a' },
      { ...at(new Date(2026, 7, 18, 9), 10), area_id: 'a' },
      { ...at(new Date(2026, 7, 13, 11), 10), area_id: 'b' },
      { ...at(new Date(2026, 7, 12, 9), 10), area_id: 'c' }, // older than 7 x 24h
      { ...at(new Date(2026, 7, 19, 8), 5), area_id: null },
    ]
    expect(activeAreasLastWeek(events, now)).toBe(2)
  })
})

describe('barHeights', () => {
  it('gives the biggest value the full height', () => {
    expect(barHeights([10, 40, 20])[1]).toBe(100)
  })

  it('keeps small non-zero values visible at 4% and draws zero as a 2% stub', () => {
    expect(barHeights([1000, 1, 0])).toEqual([100, 4, 2])
  })

  it('draws stubs, not NaN, when every value is zero or there is nothing', () => {
    expect(barHeights([0, 0, 0])).toEqual([2, 2, 2])
    expect(barHeights([])).toEqual([])
  })
})

describe('calendarWeeks', () => {
  it('builds a rectangular grid of weeks x 7 days ending this week', () => {
    const grid = calendarWeeks(12, now)
    expect(grid).toHaveLength(12)
    expect(grid.every((week) => week.length === 7)).toBe(true)
    expect(grid[11][0]).toBe('2026-08-17')
  })

  it('leaves the future blank instead of drawing dots for it', () => {
    const grid = calendarWeeks(12, now)
    const thisWeek = grid[11]
    expect(thisWeek[2]).toBe('2026-08-19') // today, Wednesday
    expect(thisWeek[3]).toBeNull()
    expect(thisWeek[6]).toBeNull()
  })
})

describe('effectiveStreak', () => {
  // 01:30 UTC on 20 Aug: already the 20th in UTC, still the 19th in New York.
  const instant = new Date(Date.UTC(2026, 7, 20, 1, 30))
  const row = (last_active_date: string | null, freeze_tokens = 0) => ({
    current: 9,
    last_active_date,
    freeze_tokens,
  })

  it('keeps the run if the last update was today or yesterday', () => {
    expect(effectiveStreak(row('2026-08-20'), 'UTC', instant)).toBe(9)
    expect(effectiveStreak(row('2026-08-19'), 'UTC', instant)).toBe(9)
  })

  it('drops to 0 once a day is missed with no shield left', () => {
    expect(effectiveStreak(row('2026-08-18'), 'UTC', instant)).toBe(0)
  })

  it('keeps the run while a shield can bridge the gap, however long', () => {
    expect(effectiveStreak(row('2026-08-01', 1), 'UTC', instant)).toBe(9)
  })

  it("counts days in the profile's timezone", () => {
    // In New York it is still the 19th, so the 18th is yesterday.
    expect(effectiveStreak(row('2026-08-18'), 'America/New_York', instant)).toBe(9)
  })

  it('is 0 with no row or no activity yet', () => {
    expect(effectiveStreak(null, 'UTC', instant)).toBe(0)
    expect(effectiveStreak(row(null), 'UTC', instant)).toBe(0)
  })
})

describe('dateKeyIn', () => {
  it('is zero-padded YYYY-MM-DD in the given timezone, whatever the default locale', () => {
    const instant = new Date(Date.UTC(2026, 0, 5, 1, 30))
    expect(dateKeyIn('UTC', instant)).toBe('2026-01-05')
    expect(dateKeyIn('America/New_York', instant)).toBe('2026-01-04')
    expect(dateKeyIn('Asia/Tokyo', instant)).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
