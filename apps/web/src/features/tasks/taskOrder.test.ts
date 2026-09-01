import { describe, expect, it } from 'vitest'
import type { ItemStatus, Priority } from '../../lib/schemas'
import { localDateKey } from '../../lib/time'
import { DEFAULT_PREFS, parsePrefs, type TaskListPrefs } from './listPrefs'
import { compareTasks, isStale, partitionTasks, taskProgress } from './taskOrder'

type Row = {
  id: string
  status: ItemStatus
  priority: Priority
  created_at: string
  sort_order: number
  updated_at: string
  snoozed_until: string | null
}

const DAY = 86_400_000
const NOW = Date.parse('2026-01-15T12:00:00.000Z')

function task(id: string, over: Partial<Row> = {}): Row {
  return {
    id,
    status: 'planned',
    priority: 'med',
    created_at: '2026-01-01T00:00:00.000Z',
    sort_order: 0,
    updated_at: '2026-01-01T00:00:00.000Z',
    snoozed_until: null,
    ...over,
  }
}

const ids = (rows: readonly Row[]) => rows.map((row) => row.id)
const prefs = (over: Partial<TaskListPrefs> = {}): TaskListPrefs => ({ ...DEFAULT_PREFS, ...over })

describe('compareTasks', () => {
  it('puts in_progress first under the created sort, whatever the dates say', () => {
    const rows = [
      task('old', { created_at: '2025-01-01T00:00:00.000Z' }),
      task('running', { status: 'in_progress', created_at: '2026-06-01T00:00:00.000Z' }),
      task('new', { created_at: '2026-03-01T00:00:00.000Z' }),
    ]
    expect(ids([...rows].sort(compareTasks('created')))).toEqual(['running', 'old', 'new'])
  })

  it('puts in_progress first under the priority sort, even at the lowest priority', () => {
    const rows = [
      task('urgent', { priority: 'high' }),
      task('running', { status: 'in_progress', priority: 'low' }),
      task('normal', { priority: 'med' }),
    ]
    expect(ids([...rows].sort(compareTasks('priority')))).toEqual(['running', 'urgent', 'normal'])
  })

  it('orders high over med over low', () => {
    const rows = [task('l', { priority: 'low' }), task('h', { priority: 'high' }), task('m')]
    expect(ids([...rows].sort(compareTasks('priority')))).toEqual(['h', 'm', 'l'])
  })

  it('breaks a priority tie with the oldest created_at', () => {
    const rows = [
      task('second', { priority: 'high', created_at: '2026-02-01T00:00:00.000Z' }),
      task('first', { priority: 'high', created_at: '2026-01-01T00:00:00.000Z' }),
      task('third', { priority: 'high', created_at: '2026-03-01T00:00:00.000Z' }),
    ]
    expect(ids([...rows].sort(compareTasks('priority')))).toEqual(['first', 'second', 'third'])
  })

  it('ignores priority under the created sort and falls back to sort_order when tied', () => {
    const rows = [
      task('b', { priority: 'high', sort_order: 2 }),
      task('a', { priority: 'low', sort_order: 1 }),
    ]
    expect(ids([...rows].sort(compareTasks('created')))).toEqual(['a', 'b'])
  })
})

describe('isStale', () => {
  it('needs more than the threshold: exactly N days is not stale, N + 1 days is', () => {
    // in_progress, not the factory default: only started work can go stale.
    const at = (ms: number) =>
      task('t', { status: 'in_progress', updated_at: new Date(ms).toISOString() })
    expect(isStale(at(NOW - 14 * DAY), 14, NOW)).toBe(false)
    expect(isStale(at(NOW - 14 * DAY - 1), 14, NOW)).toBe(true)
    expect(isStale(at(NOW - 15 * DAY), 14, NOW)).toBe(true)
  })

  it('never calls a snoozed task stale until the snooze date has arrived', () => {
    const forgotten = {
      status: 'in_progress' as const,
      updated_at: new Date(NOW - 60 * DAY).toISOString(),
    }
    const tomorrow = localDateKey(new Date(NOW + DAY))
    const today = localDateKey(new Date(NOW))

    expect(isStale(task('t', { ...forgotten, snoozed_until: tomorrow }), 14, NOW)).toBe(false)
    // snoozed_until <= current_date is over, same as the server view
    expect(isStale(task('t', { ...forgotten, snoozed_until: today }), 14, NOW)).toBe(true)
  })

  it('never calls a closed task stale', () => {
    const forgotten = { updated_at: new Date(NOW - 60 * DAY).toISOString() }
    expect(isStale(task('t', { ...forgotten, status: 'done' }), 14, NOW)).toBe(false)
    expect(isStale(task('t', { ...forgotten, status: 'dropped' }), 14, NOW)).toBe(false)
    expect(isStale(task('t', { ...forgotten, status: 'paused' }), 14, NOW)).toBe(true)
  })

  it('counts only the three statuses the server hangs, so backlog is never stale', () => {
    const forgotten = { updated_at: new Date(NOW - 60 * DAY).toISOString() }
    // idea/planned are open but not started — v_hanging_threads leaves them out too, and the
    // chip must not claim work Today never lists.
    expect(isStale(task('t', { ...forgotten, status: 'idea' }), 14, NOW)).toBe(false)
    expect(isStale(task('t', { ...forgotten, status: 'planned' }), 14, NOW)).toBe(false)
    expect(isStale(task('t', { ...forgotten, status: 'in_progress' }), 14, NOW)).toBe(true)
    expect(isStale(task('t', { ...forgotten, status: 'blocked' }), 14, NOW)).toBe(true)
  })
})

describe('taskProgress', () => {
  it('counts done against the whole list, open statuses included in the denominator', () => {
    const rows = [
      task('a', { status: 'done' }),
      task('b', { status: 'done' }),
      task('c', { status: 'in_progress' }),
    ]
    expect(taskProgress(rows)).toEqual({ done: 2, total: 3 })
  })

  it('reports the project, not the view: the filtered list must never be what it is given', () => {
    // The regression this guards: wiring the bar to partitionTasks().open makes a project whose
    // work is finished read "0/1" — the two done tasks have left for the closed bucket.
    const rows = [
      task('done1', { status: 'done' }),
      task('done2', { status: 'done' }),
      task('todo', { status: 'planned' }),
    ]
    const { open } = partitionTasks(rows, prefs(), 14, NOW)

    expect(taskProgress(rows)).toEqual({ done: 2, total: 3 })
    expect(taskProgress(open)).not.toEqual({ done: 2, total: 3 })
  })

  it('counts dropped as not done, so it can never disagree with the Closed section', () => {
    const rows = [task('a', { status: 'done' }), task('b', { status: 'dropped' })]
    const { closed } = partitionTasks(rows, prefs(), 14, NOW)

    expect(taskProgress(rows)).toEqual({ done: 1, total: 2 })
    expect(closed).toHaveLength(2)
  })

  it('is zero over zero on an empty list', () => {
    expect(taskProgress([])).toEqual({ done: 0, total: 0 })
  })
})

describe('partitionTasks', () => {
  it('sends done and dropped to the closed bucket and keeps the rest open', () => {
    const rows = [
      task('done', { status: 'done' }),
      task('idea', { status: 'idea' }),
      task('dropped', { status: 'dropped' }),
      task('blocked', { status: 'blocked' }),
    ]
    const result = partitionTasks(rows, prefs(), 14, NOW)

    expect(ids(result.open).sort()).toEqual(['blocked', 'idea'])
    expect(ids(result.closed).sort()).toEqual(['done', 'dropped'])
  })

  it('leaves the input array untouched — it is the query cache', () => {
    const rows = [
      task('c', { status: 'done' }),
      task('a', { status: 'in_progress', created_at: '2026-05-01T00:00:00.000Z' }),
      task('b', { created_at: '2026-01-01T00:00:00.000Z' }),
    ]
    const before = [...rows]
    const snapshot = JSON.stringify(rows)

    const result = partitionTasks(rows, prefs({ sort: 'priority' }), 14, NOW)

    expect(rows).not.toBe(result.open)
    expect(rows.map((row) => row.id)).toEqual(['c', 'a', 'b'])
    rows.forEach((row, i) => expect(row).toBe(before[i]))
    expect(JSON.stringify(rows)).toBe(snapshot)
  })

  it('counts what the filters hid, closed tasks excluded', () => {
    const rows = [
      task('running', { status: 'in_progress' }),
      task('waiting', { status: 'planned' }),
      task('finished', { status: 'done' }),
    ]
    const result = partitionTasks(rows, prefs({ status: ['in_progress'] }), 14, NOW)

    expect(ids(result.open)).toEqual(['running'])
    expect(result.hiddenByFilter).toBe(1)
    expect(ids(result.closed)).toEqual(['finished'])
  })

  it('shows everything when no status chip is pressed', () => {
    const rows = [task('a'), task('b', { status: 'blocked' })]
    const result = partitionTasks(rows, prefs({ status: [] }), 14, NOW)

    expect(result.open).toHaveLength(2)
    expect(result.hiddenByFilter).toBe(0)
  })
})

describe('parsePrefs', () => {
  it('keeps a valid record and drops statuses that are not statuses', () => {
    expect(
      parsePrefs({
        status: ['paused', 'nonsense'],
        staleOnly: true,
        showCompleted: true,
        sort: 'priority',
        view: 'row',
      }),
    ).toEqual({
      status: ['paused'],
      staleOnly: true,
      showCompleted: true,
      sort: 'priority',
      view: 'row',
    })
  })

  it('falls back per field, so a stale localStorage value cannot break the list', () => {
    expect(parsePrefs(null)).toEqual(DEFAULT_PREFS)
    expect(parsePrefs('card')).toEqual(DEFAULT_PREFS)
    expect(parsePrefs({})).toEqual(DEFAULT_PREFS)
    expect(parsePrefs({ sort: 'alphabetical', view: 'grid', status: 'paused' })).toEqual(
      DEFAULT_PREFS,
    )
    expect(parsePrefs({ view: 'row', staleOnly: 'yes' })).toEqual({ ...DEFAULT_PREFS, view: 'row' })
  })
})
