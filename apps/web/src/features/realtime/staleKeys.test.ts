import { describe, expect, it } from 'vitest'
import { staleKeys } from './staleKeys'

const sorted = (keys: string[][]) => keys.map((k) => k.join('/')).sort()

describe('staleKeys', () => {
  it.each([
    ['tasks', ['areas', 'focus', 'projects', 'tasks', 'threads']],
    ['projects', ['areas', 'focus', 'project', 'projects', 'quick-add', 'threads']],
    ['progress_logs', ['focus', 'project', 'projects', 'threads']],
    ['project_members', ['areas', 'project', 'projects', 'tasks']],
    ['area_members', ['areas', 'projects']],
  ])('%s refreshes exactly its screens', (table, expected) => {
    expect(sorted(staleKeys([table]))).toEqual(expected)
  })

  it('a burst across tables refreshes each prefix once', () => {
    expect(sorted(staleKeys(['tasks', 'progress_logs', 'tasks']))).toEqual([
      'areas',
      'focus',
      'project',
      'projects',
      'tasks',
      'threads',
    ])
  })

  it('an unknown table refreshes nothing', () => {
    expect(staleKeys(['focus_items'])).toEqual([])
  })
})
