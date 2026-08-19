import { describe, expect, it } from 'vitest'
import { activeDayKeys, calendarWeeks, startOfWeek, weeklyXp } from './aggregate'

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

describe('activeDayKeys', () => {
  it('collapses several events on one day into a single key', () => {
    const keys = activeDayKeys([
      at(new Date(2026, 7, 19, 9), 10),
      at(new Date(2026, 7, 19, 17), 8),
      at(new Date(2026, 7, 18, 9), 8),
    ])
    expect([...keys].sort()).toEqual(['2026-08-18', '2026-08-19'])
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
