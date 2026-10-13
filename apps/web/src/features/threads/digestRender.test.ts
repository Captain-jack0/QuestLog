import { describe, expect, it } from 'vitest'
// The digest template is a Deno edge function, but render.ts is plain TS with no imports, so the
// web test runner covers it rather than CI growing a Deno step for one file.
import {
  groupThreads,
  renderDigest,
  type DigestPayload,
} from '../../../../../supabase/functions/send-digest/render'

const thread = (
  title: string,
  status?: string,
  display_status?: string,
): DigestPayload['threads'][number] => ({
  title,
  project_title: 'Proj',
  area_name: 'Work',
  next_step: null,
  last_activity_at: '2026-10-01T00:00:00Z',
  status,
  display_status,
})

const payload = (threads: DigestPayload['threads']): DigestPayload => ({
  display_name: 'Jack',
  streak: { current: 1, best: 1 },
  focus: [],
  threads,
})

describe('digest thread grouping', () => {
  it('splits in_progress from paused/blocked, keeping incoming order', () => {
    const { active, parked } = groupThreads([
      thread('a', 'paused'),
      thread('b', 'in_progress'),
      thread('c', 'blocked'),
      thread('d', 'in_progress'),
    ])
    expect(active.map((t) => t.title)).toEqual(['b', 'd'])
    expect(parked.map((t) => t.title)).toEqual(['a', 'c'])
  })

  it('keeps a pre-#44 payload without status under Active', () => {
    const { active, parked } = groupThreads([thread('old')])
    expect(active).toHaveLength(1)
    expect(parked).toEqual([])
  })

  it('renders both headings, active first, with the status only on parked rows', () => {
    const html = renderDigest(
      payload([thread('Parked one', 'blocked'), thread('Moving one', 'in_progress')]),
      'https://x/unsub',
    )
    expect(html.indexOf('>Active<')).toBeGreaterThan(-1)
    expect(html.indexOf('Moving one')).toBeLessThan(html.indexOf('>Paused &amp; blocked<'))
    expect(html.indexOf('>Paused &amp; blocked<')).toBeLessThan(html.indexOf('Parked one'))
    expect(html).toContain('Blocked · Work · Proj')
    expect(html.match(/· Work · Proj/g)).toHaveLength(1)
  })

  it('groups by display_status: an in_progress task of a paused project is parked', () => {
    const { active, parked } = groupThreads([
      thread('moving', 'in_progress', 'in_progress'),
      thread('held', 'in_progress', 'paused'),
    ])
    expect(active.map((t) => t.title)).toEqual(['moving'])
    expect(parked.map((t) => t.title)).toEqual(['held'])
  })

  it('falls back to status for a payload without display_status', () => {
    const { active, parked } = groupThreads([thread('a', 'in_progress'), thread('b', 'paused')])
    expect(active.map((t) => t.title)).toEqual(['a'])
    expect(parked.map((t) => t.title)).toEqual(['b'])
  })

  it('labels a parked row by display_status', () => {
    const html = renderDigest(
      payload([thread('Held one', 'in_progress', 'paused')]),
      'https://x/unsub',
    )
    expect(html).not.toContain('>Active<')
    expect(html).toContain('Paused · Work · Proj')
  })

  it('leaves out an empty heading', () => {
    const html = renderDigest(payload([thread('Moving one', 'in_progress')]), 'https://x/unsub')
    expect(html).toContain('>Active<')
    expect(html).not.toContain('Paused &amp; blocked')
  })
})
