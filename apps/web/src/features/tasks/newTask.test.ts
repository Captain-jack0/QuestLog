import { describe, expect, it } from 'vitest'
import { newTaskRow, type NewTask } from './newTask'

function input(over: Partial<NewTask> = {}): NewTask {
  return {
    projectId: 'p1',
    userId: 'u1',
    title: 'Write the thing',
    difficulty: 'M',
    sortOrder: 3,
    ...over,
  }
}

describe('newTaskRow', () => {
  it('carries the description the sheet collected', () => {
    expect(newTaskRow(input({ description: 'The long version' })).description).toBe(
      'The long version',
    )
  })

  // The quick-add row sends no description at all; the sheet sends '' when the box is untouched.
  it.each([
    ['the quick-add row', undefined],
    ['an untouched box', ''],
  ])('stores null when the description comes from %s', (_case, description) => {
    expect(newTaskRow(input({ description })).description).toBeNull()
  })

  it('falls back to med priority so the placeholder shows what the insert stores', () => {
    expect(newTaskRow(input()).priority).toBe('med')
    expect(newTaskRow(input({ priority: 'high' })).priority).toBe('high')
  })

  it('maps the rest of the row onto its columns', () => {
    expect(newTaskRow(input({ description: 'why' }))).toEqual({
      project_id: 'p1',
      user_id: 'u1',
      title: 'Write the thing',
      description: 'why',
      difficulty: 'M',
      priority: 'med',
      sort_order: 3,
    })
  })
})
