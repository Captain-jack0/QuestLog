import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  dayLabel,
  formatDateKey,
  groupByLocalDay,
  localTime,
  localDateKey,
  relativeTime,
  stardate,
  startOfLocalDay,
  untouchedLabel,
} from './time'

describe('stardate', () => {
  it('is the year and the local day of the year, padded to three digits', () => {
    expect(stardate(new Date(2026, 0, 1, 0, 5))).toBe('2026.001')
    expect(stardate(new Date(2026, 9, 13, 23, 30))).toBe('2026.286')
    expect(stardate(new Date(2024, 11, 31, 12, 0))).toBe('2024.366')
  })
})

describe('untouchedLabel', () => {
  const now = new Date('2026-08-19T12:00:00Z')
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString()

  it('counts whole days once a day has passed', () => {
    expect(untouchedLabel(ago(86_400_000), now)).toBe('1d untouched')
    expect(untouchedLabel(ago(3.5 * 86_400_000), now)).toBe('3d untouched')
  })

  it('says when it was touched inside the first day instead of "0d"', () => {
    expect(untouchedLabel(ago(5 * 3_600_000), now)).toBe('Touched 5h ago')
    expect(untouchedLabel(ago(0), now)).toBe('Touched just now')
  })
})

describe('timeline day labels', () => {
  const now = new Date(2026, 7, 19, 9, 0)

  it('names today and yesterday by local midnight, not by 24-hour distance', () => {
    expect(dayLabel(new Date(2026, 7, 19, 0, 5).toISOString(), now)).toBe('Today')
    // 10 hours ago, but before midnight: that is yesterday.
    expect(dayLabel(new Date(2026, 7, 18, 23, 0).toISOString(), now)).toBe('Yesterday')
    expect(dayLabel(new Date(2026, 7, 18, 0, 1).toISOString(), now)).toBe('Yesterday')
  })

  it('falls back to a date that keeps its own day of the month', () => {
    expect(dayLabel(new Date(2026, 7, 12, 22, 0).toISOString(), now)).toMatch(/12/)
  })
})

describe('groupByLocalDay', () => {
  const at = (...args: [number, number, number, number, number]) => ({
    created_at: new Date(...args).toISOString(),
  })

  it('splits at local midnight: 23:59 and 00:01 are different days', () => {
    const rows = [at(2026, 7, 19, 0, 1), at(2026, 7, 18, 23, 59), at(2026, 7, 18, 8, 0)]
    const days = groupByLocalDay(rows)
    expect(days.map((d) => d.key)).toEqual(['2026-08-19', '2026-08-18'])
    expect(days.map((d) => d.items.length)).toEqual([1, 2])
  })

  it('keeps the incoming newest-first order inside and across days', () => {
    const rows = [at(2026, 7, 20, 9, 0), at(2026, 7, 19, 22, 0), at(2026, 7, 19, 7, 0)]
    const days = groupByLocalDay(rows)
    expect(days.map((d) => d.key)).toEqual(['2026-08-20', '2026-08-19'])
    expect(days[1].items).toEqual([rows[1], rows[2]])
  })

  it('is empty for no rows', () => {
    expect(groupByLocalDay([])).toEqual([])
  })
})

describe('English-only formatting', () => {
  // Output alone proves nothing: a CI machine whose default locale is en-US passes either way.
  // So pin the argument — every toLocale* call must be handed 'en-US' explicitly.
  afterEach(() => vi.restoreAllMocks())

  it('formats dates and times as en-US whatever the browser language', () => {
    const dates = vi.spyOn(Date.prototype, 'toLocaleDateString')
    const times = vi.spyOn(Date.prototype, 'toLocaleTimeString')

    expect(formatDateKey('2026-08-19')).toBe('Aug 19, 2026')
    expect(localTime(new Date(2026, 7, 19, 14, 5).toISOString())).toMatch(/^02:05\sPM$/)
    expect(dayLabel(new Date(2026, 7, 12, 22, 0).toISOString(), new Date(2026, 7, 19, 12))).toBe(
      'Wed, Aug 12',
    )

    expect(dates).toHaveBeenCalledTimes(2)
    expect(times).toHaveBeenCalledTimes(1)
    for (const call of [...dates.mock.calls, ...times.mock.calls]) expect(call[0]).toBe('en-US')
  })
})

describe('formatDateKey', () => {
  it('reads a stored date as that calendar day, not UTC midnight', () => {
    expect(formatDateKey('2026-08-19')).toMatch(/19/)
    expect(formatDateKey('2026-08-19')).not.toMatch(/18/)
  })

  it('hands back anything unparsable untouched', () => {
    expect(formatDateKey('soon')).toBe('soon')
  })
})

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
