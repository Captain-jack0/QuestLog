import { describe, expect, it } from 'vitest'
import {
  levelProgress,
  sharePercents,
  sumSecondsByArea,
  sumWeekSecondsByArea,
  threadsByArea,
} from './areaSummary'

describe('sharePercents', () => {
  it('adds up to exactly 100, the missing point going to the largest remainder', () => {
    // 33.33 / 33.33 / 33.33 floors to 99; the tie goes to the first.
    expect(sharePercents([1, 1, 1])).toEqual([34, 33, 33])
    // 12.5 / 37.5 / 50 → 12 / 37 / 50 = 99; both remainders are .5, the first wins.
    expect(sharePercents([1, 3, 4])).toEqual([13, 37, 50])
    // 66.67 / 16.67 / 16.67 → remainders .67 / .67 / .67, one point missing.
    expect(sharePercents([4, 1, 1]).reduce((a, b) => a + b)).toBe(100)
    // 0.9 / 99.1: the small share takes the point its .9 remainder earns.
    expect(sharePercents([9, 991])).toEqual([1, 99])
  })

  it('is all zeros when nothing was logged', () => {
    expect(sharePercents([0, 0])).toEqual([0, 0])
    expect(sharePercents([])).toEqual([])
  })
})

describe('levelProgress', () => {
  it('reports the level, the next threshold and the ratio through the level', () => {
    expect(levelProgress(0)).toEqual({ level: 1, ceiling: 283, ratio: 0 })
    // Level 2 starts at 283, level 3 at 520.
    const mid = levelProgress(400)
    expect(mid.level).toBe(2)
    expect(mid.ceiling).toBe(520)
    expect(mid.ratio).toBeCloseTo((400 - 283) / (520 - 283))
    expect(levelProgress(520)).toEqual({ level: 3, ceiling: 800, ratio: 0 })
  })
})

describe('threadsByArea', () => {
  it('counts per area and keeps the oldest, whatever order the rows come in', () => {
    const rows = [
      { id: 'b', area_id: 'work', last_activity_at: '2026-10-05T00:00:00Z' },
      { id: 'a', area_id: 'work', last_activity_at: '2026-10-01T00:00:00Z' },
      { id: 'c', area_id: 'home', last_activity_at: '2026-10-03T00:00:00Z' },
      { id: 'x', area_id: null, last_activity_at: '2026-09-01T00:00:00Z' },
    ]
    const byArea = threadsByArea(rows)
    expect(byArea.get('work')).toEqual({ count: 2, oldest: rows[1] })
    expect(byArea.get('home')).toEqual({ count: 1, oldest: rows[2] })
    expect(byArea.size).toBe(2)
  })
})

describe('sumSecondsByArea', () => {
  it('sums finished sessions per area, skipping running ones and area-less rows', () => {
    expect(
      sumSecondsByArea([
        { area_id: 'work', seconds: 600 },
        { area_id: 'work', seconds: 300 },
        { area_id: 'work', seconds: null },
        { area_id: null, seconds: 900 },
        { area_id: 'home', seconds: 60 },
      ]),
    ).toEqual({ work: 900, home: 60 })
  })
})

describe('sumWeekSecondsByArea', () => {
  // Wednesday 2026-10-14 noon, local; that week's Monday is 2026-10-12 00:00 local.
  const now = new Date(2026, 9, 14, 12)
  const at = (d: Date) => d.toISOString()
  const row = (started: Date, seconds = 60) => ({ area_id: 'a', seconds, started_at: at(started) })

  it('counts from Monday 00:00 local, inclusive, and not the Sunday before', () => {
    const rows = [
      row(new Date(2026, 9, 12, 0, 0, 0)), // Monday 00:00 — in
      row(new Date(2026, 9, 11, 23, 59, 59)), // Sunday 23:59:59 — out
      row(new Date(2026, 9, 14, 11)), // Wednesday — in
    ]
    expect(sumWeekSecondsByArea(rows, now)).toEqual({ a: 120 })
  })

  it('on a Sunday still reaches back to that week’s Monday', () => {
    const sunday = new Date(2026, 9, 18, 20)
    expect(sumWeekSecondsByArea([row(new Date(2026, 9, 12, 8))], sunday)).toEqual({ a: 60 })
    expect(sumWeekSecondsByArea([row(new Date(2026, 9, 11, 8))], sunday)).toEqual({})
  })
})
