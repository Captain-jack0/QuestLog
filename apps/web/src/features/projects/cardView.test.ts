import { describe, expect, it } from 'vitest'
import { projectCardView } from './cardView'

describe('projectCardView', () => {
  it('shows the next step and real progress for an active project', () => {
    const view = projectCardView('in_progress', {
      tasksDone: 2,
      tasksTotal: 5,
      nextStep: 'Call the vet',
    })
    expect(view).toMatchObject({
      showNext: true,
      showStats: true,
      showProgress: true,
      barDone: 2,
      barTotal: 5,
      barFull: false,
      label: '2/5 tasks done',
      tone: 'accent',
    })
  })

  it('hides "Next" and visually fills the bar for a done project with open tasks, keeping real counts', () => {
    const view = projectCardView('done', { tasksDone: 2, tasksTotal: 5, nextStep: 'Call the vet' })
    expect(view).toMatchObject({
      showNext: false,
      showStats: true,
      showProgress: true,
      barDone: 2,
      barTotal: 5,
      barFull: true,
      label: 'Completed',
      tone: 'success',
    })
  })

  it('still shows "Completed" for a done project with zero tasks, with no bar', () => {
    const view = projectCardView('done', { tasksDone: 0, tasksTotal: 0, nextStep: null })
    expect(view).toMatchObject({
      showStats: true,
      showProgress: false,
      label: 'Completed',
    })
  })

  it('shows nothing for an active project with no tasks yet', () => {
    const view = projectCardView('idea', { tasksDone: 0, tasksTotal: 0, nextStep: null })
    expect(view).toMatchObject({
      showNext: false,
      showStats: false,
      showProgress: false,
      label: null,
    })
  })

  it('treats a missing stats entry the same as zero tasks', () => {
    const view = projectCardView('done', undefined)
    expect(view).toMatchObject({
      showStats: true,
      showProgress: false,
      barDone: 0,
      barTotal: 0,
      label: 'Completed',
    })
  })
})
