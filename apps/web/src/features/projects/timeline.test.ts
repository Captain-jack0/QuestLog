import { describe, expect, it } from 'vitest'
import type { ProgressLogWithNextTask } from './queries'
import { projectTimeline, xpLabel } from './timeline'

const log = (id: string, created_at: string, task_id: string | null = null, user_id = 'u1') =>
  ({
    id,
    created_at,
    user_id,
    task_id,
    left_off: id,
    next_step_task: null,
  }) as unknown as ProgressLogWithNextTask
const xp = (
  id: string,
  created_at: string,
  action_type: string,
  amount: number,
  task_id: string | null = null,
  user_id = 'u1',
) => ({ id, created_at, action_type, xp: amount, user_id, task_id })
const session = (id: string, ended_at: string, seconds: number, mode = 'timer') => ({
  id,
  ended_at,
  seconds,
  mode,
})

describe('projectTimeline', () => {
  it('merges logs, XP and sessions newest first', () => {
    const entries = projectTimeline(
      [log('l1', '2026-10-13T09:00:00Z')],
      [xp('x1', '2026-10-13T10:00:00Z', 'task_done', 25)],
      [session('s1', '2026-10-13T11:00:00Z', 1500, 'pomodoro')],
    )
    expect(entries.map((e) => e.id)).toEqual(['focus-s1', 'xp-x1', 'l1'])
    expect(entries[0]).toMatchObject({ kind: 'event', label: 'Pomodoro · 25m' })
    expect(entries[1]).toMatchObject({ kind: 'event', label: 'Task completed', xp: 25 })
    expect(entries[2]).toMatchObject({ kind: 'log' })
  })

  it('labels a plain timer session as a focus session and orders across +offset timestamps', () => {
    const entries = projectTimeline(
      [log('l1', '2026-10-13T12:30:00+03:00')], // 09:30Z
      [],
      [session('s1', '2026-10-13T09:45:00Z', 600)],
    )
    expect(entries.map((e) => e.id)).toEqual(['focus-s1', 'l1'])
    expect(entries[0]).toMatchObject({ label: 'Focus session · 10m' })
  })

  it('folds XP written microseconds after the log (clock_timestamp) into that log', () => {
    const entries = projectTimeline(
      [log('l1', '2026-10-13T17:32:42.679938+00:00')],
      [
        xp('x1', '2026-10-13T17:32:42.680223+00:00', 'daily_check_in', 10),
        xp('x2', '2026-10-13T17:32:42.680396+00:00', 'task_done', 25),
      ],
      [],
    )
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({
      kind: 'log',
      id: 'l1',
      xp: 35,
      xpLabels: ['Daily check-in', 'Task completed'],
    })
  })

  it('leaves XP outside the fold window, or before the log, as its own row', () => {
    const entries = projectTimeline(
      [log('l1', '2026-10-13T09:00:00.000000+00:00')],
      [
        xp('late', '2026-10-13T09:00:02.001000+00:00', 'progress_update', 8),
        xp('early', '2026-10-13T08:59:59.999000+00:00', 'progress_update', 8),
      ],
      [],
    )
    expect(entries.map((e) => e.id)).toEqual(['xp-late', 'l1', 'xp-early'])
    expect(entries[1]).toMatchObject({ kind: 'log', xp: 0 })
  })

  it('folds XP into the nearest earlier of two consecutive logs', () => {
    const entries = projectTimeline(
      [
        log('l2', '2026-10-13T09:00:01.000000+00:00'),
        log('l1', '2026-10-13T09:00:00.000000+00:00'),
      ],
      [xp('x1', '2026-10-13T09:00:01.000500+00:00', 'progress_update', 8)],
      [],
    )
    expect(entries.map((e) => e.id)).toEqual(['l2', 'l1'])
    expect(entries[0]).toMatchObject({ id: 'l2', xp: 8 })
    expect(entries[1]).toMatchObject({ id: 'l1', xp: 0 })
  })

  it('does not fold XP of another task or another user, even inside the window', () => {
    const at = '2026-10-13T09:00:00.000000+00:00'
    const soon = '2026-10-13T09:00:00.000300+00:00'
    const entries = projectTimeline(
      [log('l1', at, 't1')],
      [
        xp('other-task', soon, 'progress_update', 8, 't2'),
        xp('project-level', soon, 'project_done', 100, null),
        xp('other-user', soon, 'progress_update', 8, 't1', 'u2'),
        xp('mine', soon, 'task_done', 25, 't1'),
      ],
      [],
    )
    expect(entries.find((e) => e.id === 'l1')).toMatchObject({
      xp: 25,
      xpLabels: ['Task completed'],
    })
    expect(entries.map((e) => e.id).sort()).toEqual(
      ['l1', 'xp-other-task', 'xp-other-user', 'xp-project-level'].sort(),
    )
  })

  it('leaves XP from another instant as its own row, above an older log', () => {
    const entries = projectTimeline(
      [log('l1', '2026-10-13T09:00:00Z')],
      [xp('x1', '2026-10-13T09:30:00Z', 'focus_time', 5)],
      [],
    )
    expect(entries.map((e) => e.id)).toEqual(['xp-x1', 'l1'])
    expect(entries[1]).toMatchObject({ kind: 'log', xp: 0, xpLabels: [] })
  })

  it('labels an empty log by the XP folded into it', () => {
    const at = '2026-10-13T09:00:00Z'
    const empty = {
      id: 'l1',
      created_at: at,
      user_id: 'u1',
      task_id: null,
      next_step_task: null,
    } as unknown as ProgressLogWithNextTask
    const [entry] = projectTimeline([empty], [xp('x1', at, 'progress_update', 8)], [])
    expect(entry).toMatchObject({ kind: 'log', xp: 8, xpLabels: ['Progress update'] })
  })

  it('stops at the oldest row of a source that hit the limit', () => {
    const entries = projectTimeline(
      [log('l2', '2026-10-13T10:00:00Z'), log('l1', '2026-10-12T10:00:00Z')],
      [
        xp('new', '2026-10-13T11:00:00Z', 'daily_check_in', 10),
        xp('old', '2026-10-01T10:00:00Z', 'task_done', 10),
      ],
      [],
      2,
    )
    expect(entries.map((e) => e.id)).toEqual(['xp-new', 'l2', 'l1'])
  })

  it('keeps everything when no source was cut', () => {
    const entries = projectTimeline(
      [log('l1', '2026-10-12T10:00:00Z')],
      [xp('old', '2026-10-01T10:00:00Z', 'task_done', 10)],
      [],
      2,
    )
    expect(entries.map((e) => e.id)).toEqual(['l1', 'xp-old'])
  })

  it('is empty for three empty sources', () => {
    expect(projectTimeline([], [], [])).toEqual([])
  })
})

describe('xpLabel', () => {
  it('reads the known action types and spells out an unknown one', () => {
    expect(xpLabel('project_done')).toBe('Project completed')
    expect(xpLabel('daily_check_in')).toBe('Daily check-in')
    expect(xpLabel('focus_time')).toBe('Focus time')
    expect(xpLabel('some_new_thing')).toBe('Some new thing')
  })
})
