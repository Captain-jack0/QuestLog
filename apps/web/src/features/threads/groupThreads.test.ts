import { describe, expect, it } from 'vitest'
import { groupThreads } from './groupThreads'

const thread = (id: string, status: 'in_progress' | 'paused' | 'blocked') => ({ id, status })

describe('groupThreads', () => {
  it('splits a mixed list, keeping the incoming (oldest-first) order inside each group', () => {
    const { active, parked } = groupThreads([
      thread('a', 'paused'),
      thread('b', 'in_progress'),
      thread('c', 'blocked'),
      thread('d', 'in_progress'),
    ])
    expect(active.map((t) => t.id)).toEqual(['b', 'd'])
    expect(parked.map((t) => t.id)).toEqual(['a', 'c'])
  })

  it('leaves parked empty when everything is in progress', () => {
    const { active, parked } = groupThreads([thread('a', 'in_progress')])
    expect(active).toHaveLength(1)
    expect(parked).toEqual([])
  })

  it('leaves active empty when everything is paused or blocked', () => {
    const { active, parked } = groupThreads([thread('a', 'paused'), thread('b', 'blocked')])
    expect(active).toEqual([])
    expect(parked.map((t) => t.id)).toEqual(['a', 'b'])
  })

  it('returns two empty groups for no threads', () => {
    expect(groupThreads([])).toEqual({ active: [], parked: [] })
  })
})
