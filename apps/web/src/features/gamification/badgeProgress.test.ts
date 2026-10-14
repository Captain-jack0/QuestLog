import { describe, expect, it } from 'vitest'
import { badgeProgress, type BadgeCounts } from './badgeProgress'

const counts: BadgeCounts = { streak: 18, level: 4, progressLogs: 3, activeAreas: 2 }

describe('badgeProgress', () => {
  it('measures the streak badges against the current streak', () => {
    expect(badgeProgress('week_one', counts)).toEqual({ current: 7, target: 7 })
    expect(badgeProgress('fortnight', counts)).toEqual({ current: 14, target: 14 })
    expect(badgeProgress('monthly_legend', counts)).toEqual({ current: 18, target: 30 })
  })

  it('counts progress logs, level and active areas', () => {
    expect(badgeProgress('threadkeeper', counts)).toEqual({ current: 3, target: 10 })
    expect(badgeProgress('level_10', counts)).toEqual({ current: 4, target: 10 })
    expect(badgeProgress('renaissance', counts)).toEqual({ current: 2, target: 4 })
  })

  it('has no progress for one-off badges or a count still loading', () => {
    expect(badgeProgress('necromancer', counts)).toBeNull()
    expect(badgeProgress('first_quest', counts)).toBeNull()
    expect(badgeProgress('threadkeeper', { ...counts, progressLogs: undefined })).toBeNull()
  })

  it('hides the counter while its source query is loading or failed', () => {
    expect(badgeProgress('week_one', { ...counts, streak: undefined })).toBeNull()
    expect(badgeProgress('level_10', { ...counts, level: undefined })).toBeNull()
    expect(badgeProgress('renaissance', { ...counts, activeAreas: undefined })).toBeNull()
  })
})
