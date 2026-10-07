import { describe, expect, it } from 'vitest'
import {
  sumSecondsByProject,
  sumSecondsByTask,
  timerBarSeconds,
  type ProjectTimeEntryRow,
  type TimeEntryRow,
} from './totals'

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

describe('sumSecondsByProject', () => {
  it('stacks task-level and project-level sessions of the same project', () => {
    // Rows as the table holds them, `task_id` included: the function must not care whether a
    // session was clocked on a task, on the project alone, or on a task that is gone since.
    const rows = [
      { project_id: 'p', task_id: 'a', seconds: 600 },
      { project_id: 'p', task_id: null, seconds: 300 },
      { project_id: 'q', task_id: 'b', seconds: 90 },
      { project_id: 'p', task_id: 'c', seconds: 1500 },
    ]
    expect(sumSecondsByProject(rows)).toEqual({ p: 2400, q: 90 })
  })

  it('keeps the seconds of a deleted task, whose entry stays behind with task_id null', () => {
    const before = [{ project_id: 'p', task_id: 'a' as string | null, seconds: 900 }]
    const after = [{ project_id: 'p', task_id: null, seconds: 900 }]
    expect(sumSecondsByProject(after)).toEqual(sumSecondsByProject(before))
    expect(sumSecondsByProject(after)).toEqual({ p: 900 })
  })

  it('leaves the running session out instead of counting it as zero', () => {
    expect(sumSecondsByProject([{ project_id: 'p', seconds: null }])).toEqual({})
    expect(
      sumSecondsByProject([
        { project_id: 'p', seconds: 300 },
        { project_id: 'p', seconds: null },
      ]),
    ).toEqual({ p: 300 })
  })

  it('drops an entry whose seconds are absent, not just null', () => {
    expect(
      sumSecondsByProject([
        { project_id: 'p', seconds: 120 },
        { project_id: 'p' } as ProjectTimeEntryRow,
      ]),
    ).toEqual({ p: 120 })
  })

  it('returns an empty map for no entries', () => {
    expect(sumSecondsByProject([])).toEqual({})
  })
})

describe('timerBarSeconds', () => {
  it('counts banked plus running on the project line and the session on the task line', () => {
    expect(timerBarSeconds({ task_id: 't', project_seconds_total: 12_000 }, 75)).toEqual({
      project: 12_075,
      task: 75,
    })
  })

  it('has no task line when the clock runs on the project itself', () => {
    expect(timerBarSeconds({ task_id: null, project_seconds_total: 12_000 }, 75)).toEqual({
      project: 12_075,
      task: null,
    })
  })

  // What the view hands over across a switch: the stopped session moves into the banked total
  // and the new entry starts from zero, so the project line reads the same and keeps climbing.
  it('carries the project line across a switch to another task of the same project', () => {
    const beforeSwitch = timerBarSeconds({ task_id: 'a', project_seconds_total: 2100 }, 600)
    const afterSwitch = timerBarSeconds({ task_id: 'b', project_seconds_total: 2700 }, 0)
    expect(afterSwitch.project).toBe(beforeSwitch.project)
    expect(afterSwitch.task).toBe(0)
  })

  it('shows only the session for a project with nothing banked yet', () => {
    expect(timerBarSeconds({ task_id: 't', project_seconds_total: 0 }, 42)).toEqual({
      project: 42,
      task: 42,
    })
  })

  // Against a view that predates the column the field is absent; null is what a typed read of
  // a view column allows. Neither may reach the bar as NaN.
  it('falls back to the session alone when the banked total is missing', () => {
    expect(timerBarSeconds({ task_id: 't' }, 30).project).toBe(30)
    expect(timerBarSeconds({ task_id: 't', project_seconds_total: null }, 30).project).toBe(30)
  })

  it('never lets a client clock behind the server eat into the banked total', () => {
    expect(timerBarSeconds({ task_id: 't', project_seconds_total: 500 }, -4)).toEqual({
      project: 500,
      task: 0,
    })
  })
})
