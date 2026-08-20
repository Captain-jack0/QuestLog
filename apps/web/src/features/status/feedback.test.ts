import { describe, expect, it } from 'vitest'
import { statusFeedback, type StatusResult } from './feedback'

const result = (overrides: Partial<StatusResult> = {}): StatusResult => ({
  xp_awarded: 8,
  total_xp: 108,
  level: 1,
  leveled_up: false,
  streak_current: 3,
  streak_best: 9,
  freeze_tokens: 1,
  new_badges: [],
  ...overrides,
})

describe('statusFeedback', () => {
  it('always reports what the action earned', () => {
    expect(statusFeedback(result()).xpToast).toBe('+8 ✨')
  })

  it('stays quiet about levels until one is crossed', () => {
    const quiet = statusFeedback(result())
    expect(quiet.confetti).toBe(false)
    expect(quiet.levelToast).toBeNull()
  })

  it('celebrates a level-up once', () => {
    const loud = statusFeedback(result({ leveled_up: true, level: 2 }))
    expect(loud.confetti).toBe(true)
    expect(loud.levelToast).toBe('Level 2!')
  })

  it('spells badge codes out for humans', () => {
    expect(statusFeedback(result({ new_badges: ['first_quest', 'week_one'] })).badgeToasts).toEqual(
      ['Badge earned: first quest 🏅', 'Badge earned: week one 🏅'],
    )
  })

  it('survives a payload with missing pieces', () => {
    const partial = statusFeedback({ xp_awarded: 0 } as StatusResult)
    expect(partial.xpToast).toBe('+0 ✨')
    expect(partial.badgeToasts).toEqual([])
    expect(partial.confetti).toBe(false)
  })
})
