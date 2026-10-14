import { describe, expect, it } from 'vitest'
import { focusLeadId, isQuiet, isResume, waitingLine } from './todayLogic'

describe('waitingLine', () => {
  it.each([
    [0, 'Nothing is waiting on you.'],
    [1, '1 thread is waiting.'],
    [7, '7 threads are waiting.'],
    [19, '19 threads are waiting.'],
    [20, '20+ threads are waiting.'],
  ])('%i -> %s', (count, line) => {
    expect(waitingLine(count, 20)).toBe(line)
  })
})

describe('focusLeadId', () => {
  const row = (id: string, o: Partial<Parameters<typeof focusLeadId>[0][number]> = {}) => ({
    id,
    completed: false,
    project_id: null,
    task_id: `t-${id}`,
    ...o,
  })
  const clock = (project_id: string, task_id: string | null) => ({ project_id, task_id })

  it('is the first open card when nothing runs', () => {
    expect(focusLeadId([row('a', { completed: true }), row('b'), row('c')], [])).toBe('b')
  })

  it('is none when every card is done', () => {
    expect(focusLeadId([row('a', { completed: true })], [])).toBeUndefined()
  })

  it('is none while any card clock runs (task or project)', () => {
    const items = [row('a'), row('b', { project_id: 'p1', task_id: null })]
    expect(focusLeadId(items, [clock('px', 't-a')])).toBeUndefined()
    expect(focusLeadId(items, [clock('p1', null)])).toBeUndefined()
  })

  it('ignores clocks on items that are not focus cards', () => {
    expect(focusLeadId([row('a')], [clock('p9', 'other')])).toBe('a')
  })

  it('a task clock does not count as its project row clock', () => {
    expect(focusLeadId([row('b', { project_id: 'p1', task_id: null })], [clock('p1', 't9')])).toBe(
      'b',
    )
  })

  it('a clock on a ticked-off card does not take the lead from the open one', () => {
    const items = [row('a', { completed: true }), row('b')]
    expect(focusLeadId(items, [clock('px', 't-a')])).toBe('b')
  })
})

describe('isResume', () => {
  it.each([
    [0, false],
    [59, false],
    [60, true],
    [3600, true],
  ])('%i s banked -> %s', (seconds, resume) => {
    expect(isResume(seconds)).toBe(resume)
  })
})

describe('isQuiet', () => {
  it('the lead card is not quiet, every other card is', () => {
    expect(isQuiet('a', 'a')).toBe(false)
    expect(isQuiet('b', 'a')).toBe(true)
  })

  it('every card is quiet when there is no lead (a clock runs, or all done)', () => {
    expect(isQuiet('a', undefined)).toBe(true)
  })
})
