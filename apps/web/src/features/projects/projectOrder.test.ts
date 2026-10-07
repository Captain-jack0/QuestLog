import { describe, expect, it } from 'vitest'
import type { ItemStatus } from '../../lib/schemas'
import { orderProjects } from './projectOrder'

type Row = { id: string; status: ItemStatus; updated_at: string; created_at: string }

function project(id: string, over: Partial<Row> = {}): Row {
  return {
    id,
    status: 'planned',
    updated_at: '2026-01-01T00:00:00.000Z',
    created_at: '2026-01-01T00:00:00.000Z',
    ...over,
  }
}

const ids = (rows: readonly Row[]) => rows.map((row) => row.id)

describe('orderProjects', () => {
  it('keeps open projects in server order and moves closed ones after them', () => {
    // Server order: updated_at asc. The closed ones sit in the middle of it.
    const rows = [
      project('open-old', { updated_at: '2026-01-01T00:00:00.000Z' }),
      project('done-old', { status: 'done', updated_at: '2026-01-02T00:00:00.000Z' }),
      project('open-mid', { status: 'in_progress', updated_at: '2026-01-03T00:00:00.000Z' }),
      project('dropped-new', { status: 'dropped', updated_at: '2026-01-04T00:00:00.000Z' }),
      project('open-new', { status: 'blocked', updated_at: '2026-01-05T00:00:00.000Z' }),
    ]
    expect(ids(orderProjects(rows))).toEqual([
      'open-old',
      'open-mid',
      'open-new',
      'dropped-new',
      'done-old',
    ])
  })

  it('leaves an all-open list exactly as the server ordered it', () => {
    const rows = [
      project('c', { status: 'idea', updated_at: '2026-01-03T00:00:00.000Z' }),
      project('a', { status: 'paused', updated_at: '2026-01-01T00:00:00.000Z' }),
      project('b', { status: 'planned', updated_at: '2026-01-02T00:00:00.000Z' }),
    ]
    expect(ids(orderProjects(rows))).toEqual(['c', 'a', 'b'])
  })

  it('orders an all-closed list most recently touched first', () => {
    const rows = [
      project('finished-first', { status: 'done', updated_at: '2026-01-01T00:00:00.000Z' }),
      project('finished-last', { status: 'done', updated_at: '2026-01-03T00:00:00.000Z' }),
      project('dropped-between', { status: 'dropped', updated_at: '2026-01-02T00:00:00.000Z' }),
    ]
    expect(ids(orderProjects(rows))).toEqual(['finished-last', 'dropped-between', 'finished-first'])
  })

  it('breaks an updated_at tie between closed projects on created_at, newest first', () => {
    const rows = [
      project('older', { status: 'done', created_at: '2025-12-01T00:00:00.000Z' }),
      project('newer', { status: 'done', created_at: '2025-12-02T00:00:00.000Z' }),
    ]
    expect(ids(orderProjects(rows))).toEqual(['newer', 'older'])
  })

  it('returns an empty list for an empty list', () => {
    expect(orderProjects([])).toEqual([])
  })

  it('does not mutate the argument', () => {
    const rows = [project('done', { status: 'done' }), project('open')]
    const before = ids(rows)
    orderProjects(rows)
    expect(ids(rows)).toEqual(before)
  })
})
