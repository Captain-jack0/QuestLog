import { describe, expect, it } from 'vitest'
import { aggregateProjectStats } from './queries'
import { areaSchema, projectSchema } from '../../lib/schemas'

describe('aggregateProjectStats', () => {
  const ids = ['p1', 'p2']

  it('counts done vs total per project and leaves untouched projects at zero', () => {
    const stats = aggregateProjectStats(
      ids,
      [
        { project_id: 'p1', status: 'done' },
        { project_id: 'p1', status: 'in_progress' },
        { project_id: 'p1', status: 'done' },
      ],
      [],
    )
    expect(stats.p1).toEqual({ tasksDone: 2, tasksTotal: 3, nextStep: null })
    expect(stats.p2).toEqual({ tasksDone: 0, tasksTotal: 0, nextStep: null })
  })

  it('keeps the newest next_step only', () => {
    const stats = aggregateProjectStats(
      ids,
      [],
      [
        { project_id: 'p1', next_step: 'newest' },
        { project_id: 'p1', next_step: 'older' },
      ],
    )
    expect(stats.p1.nextStep).toBe('newest')
  })

  it('ignores rows for projects outside the requested list', () => {
    const stats = aggregateProjectStats(
      ids,
      [{ project_id: 'other', status: 'done' }],
      [{ project_id: 'other', next_step: 'nope' }],
    )
    expect(Object.keys(stats)).toEqual(ids)
  })
})

describe('form schemas', () => {
  it('rejects a blank area name and a bad colour', () => {
    expect(
      areaSchema.safeParse({ name: '  ', color: '#5B5BD6', icon: '🧭', sort_order: 0 }).success,
    ).toBe(false)
    expect(
      areaSchema.safeParse({ name: 'Work', color: 'indigo', icon: '🧭', sort_order: 0 }).success,
    ).toBe(false)
    expect(
      areaSchema.safeParse({ name: 'Work', color: '#5B5BD6', icon: '🧭', sort_order: 0 }).success,
    ).toBe(true)
  })

  it('accepts a project with an empty description and date', () => {
    const result = projectSchema.safeParse({
      title: 'Ship it',
      description: '',
      priority: 'med',
      status: 'idea',
      target_date: '',
    })
    expect(result.success).toBe(true)
  })
})
