import { describe, expect, it } from 'vitest'
import { atTimerLimit, MAX_RUNNING_TIMERS, timerDeck } from './stack'

const at = (id: string, started_at: string) => ({ id, started_at })

describe('timerDeck', () => {
  it('puts the newest clock on top, whatever order the view sent', () => {
    const { cards } = timerDeck([
      at('old', '2026-10-08T09:00:00Z'),
      at('new', '2026-10-08T09:20:00Z'),
      at('mid', '2026-10-08T09:10:00Z'),
    ])
    expect(cards.map((c) => c.id)).toEqual(['new', 'mid', 'old'])
  })

  it('counts the cards under the top one for the badge', () => {
    expect(timerDeck([at('a', '2026-10-08T09:00:00Z')]).hidden).toBe(0)
    expect(
      timerDeck([at('a', '2026-10-08T09:00:00Z'), at('b', '2026-10-08T09:01:00Z')]).hidden,
    ).toBe(1)
  })

  it('is empty with nothing running', () => {
    expect(timerDeck([])).toEqual({ cards: [], hidden: 0 })
  })

  it('leaves the query cache untouched', () => {
    const timers = [at('old', '2026-10-08T09:00:00Z'), at('new', '2026-10-08T09:20:00Z')]
    timerDeck(timers)
    expect(timers.map((t) => t.id)).toEqual(['old', 'new'])
  })
})

describe('atTimerLimit', () => {
  it('lets a start through below the ceiling and refuses it at the ceiling', () => {
    expect(MAX_RUNNING_TIMERS).toBe(3)
    expect(atTimerLimit([1, 2])).toBe(false)
    expect(atTimerLimit([1, 2, 3])).toBe(true)
  })
})
