import { describe, expect, it } from 'vitest'
import { isOptimistic, optimisticId, replaceOptimistic } from './optimistic'

const real = { id: '2f2f2f2f-0000-4000-8000-000000000001', title: 'saved' }

describe('optimistic ids', () => {
  it('recognises its own placeholders and nothing else', () => {
    expect(isOptimistic(optimisticId(0))).toBe(true)
    expect(isOptimistic(real.id)).toBe(false)
  })
})

describe('replaceOptimistic', () => {
  it('swaps the placeholder for the saved row, keeping its position', () => {
    const rows = [
      { id: real.id, title: 'first' },
      { id: optimisticId(1), title: 'saved' },
    ]
    expect(replaceOptimistic(rows, { id: 'real-2', title: 'saved' })).toEqual([
      { id: real.id, title: 'first' },
      { id: 'real-2', title: 'saved' },
    ])
  })

  it('appends when the cache has no placeholder left', () => {
    expect(replaceOptimistic([], real)).toEqual([real])
  })

  it('does not duplicate a row that a refetch already delivered', () => {
    expect(replaceOptimistic([real], real)).toEqual([real])
  })
})
