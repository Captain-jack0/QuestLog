import { describe, expect, it } from 'vitest'
import { sumSecondsByTask, type TimeEntryRow } from './totals'

describe('sumSecondsByTask', () => {
  it('stacks every finished session of the same task', () => {
    expect(
      sumSecondsByTask([
        { task_id: 'a', seconds: 600 },
        { task_id: 'b', seconds: 90 },
        { task_id: 'a', seconds: 1500 },
      ]),
    ).toEqual({ a: 2100, b: 90 })
  })

  it('leaves the running session out instead of counting it as zero', () => {
    expect(sumSecondsByTask([{ task_id: 'a', seconds: null }])).toEqual({})
    expect(
      sumSecondsByTask([
        { task_id: 'a', seconds: 300 },
        { task_id: 'a', seconds: null },
      ]),
    ).toEqual({ a: 300 })
  })

  // The rows arrive through an unchecked cast, so a missing column reaches here as undefined
  // rather than null. Summing it would put "NaNm" on the card.
  it('drops an entry whose seconds are absent, not just null', () => {
    expect(
      sumSecondsByTask([{ task_id: 'a', seconds: 120 }, { task_id: 'a' } as TimeEntryRow]),
    ).toEqual({ a: 120 })
  })

  it('drops entries orphaned by a deleted task', () => {
    expect(
      sumSecondsByTask([
        { task_id: null, seconds: 900 },
        { task_id: 'a', seconds: 60 },
      ]),
    ).toEqual({ a: 60 })
  })

  it('returns an empty map for no entries', () => {
    expect(sumSecondsByTask([])).toEqual({})
  })
})
