import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import type { LifeArea } from '../lib/schemas'
import { AreaCard, WeeklySplit } from '../features/areas/AreaCard'

const area = { id: 'a1', user_id: 'u1', name: 'Work', color: '#123456', icon: null } as LifeArea
const oldest = {
  project_id: 'p1',
  project_title: 'Launch',
  title: 'Draft',
  next_step: 'Write intro',
  left_off: null,
  last_activity_at: '2026-10-01T00:00:00Z',
}

const card = (props: { threadsKnown: boolean; waiting?: { count: number; oldest: unknown } }) =>
  renderToStaticMarkup(
    createElement(
      MemoryRouter,
      null,
      createElement(AreaCard, {
        area,
        openProjects: 1,
        totalXp: undefined,
        focusSeconds: undefined,
        onResume: () => {},
        waiting: undefined,
        ...props,
      } as Parameters<typeof AreaCard>[0]),
    ),
  )

describe('AreaCard thread hiding', () => {
  it('renders no thread row, source box or Resume when threads are not known', () => {
    const html = card({ threadsKnown: false, waiting: { count: 1, oldest } })
    expect(html).not.toContain('No waiting threads')
    expect(html).not.toContain('From Launch')
    expect(html).not.toContain('Resume')
  })

  it('says "No waiting threads" only when threads are known', () => {
    expect(card({ threadsKnown: true })).toContain('No waiting threads')
  })
})

describe('WeeklySplit', () => {
  const render = (week: Record<string, number> | undefined) =>
    renderToStaticMarkup(createElement(WeeklySplit, { areas: [area], week }))

  it('hides the empty-week message until the focus query has answered', () => {
    expect(render(undefined)).not.toContain('No focus time logged this week yet')
    expect(render({})).toContain('No focus time logged this week yet')
  })
})
