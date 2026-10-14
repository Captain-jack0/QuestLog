import { describe, expect, it } from 'vitest'
import { areaChips, contextPreserved, filterThreads } from './threadFilter'

const thread = (
  title: string,
  area: [string, string] | null,
  next_step: string | null = null,
  left_off: string | null = null,
) => ({
  title,
  area_id: area?.[0] ?? null,
  area_name: area?.[1] ?? null,
  next_step,
  left_off,
})

const WORK: [string, string] = ['w', 'Work']
const HOME: [string, string] = ['h', 'Home']
const threads = [
  thread('Tax folder', HOME, 'Photograph the receipts', 'Downloaded the PDFs'),
  thread('Hiring page', WORK, null, 'Perks list done'),
  thread('Onboarding email', WORK, 'Cut the second paragraph'),
  thread('Loose end', null),
]

describe('areaChips', () => {
  it('counts each area once, sorted by name, and skips threads without one', () => {
    expect(areaChips(threads)).toEqual([
      { id: 'h', name: 'Home', count: 1 },
      { id: 'w', name: 'Work', count: 2 },
    ])
  })
})

describe('filterThreads', () => {
  const titles = (list: { title: string }[]) => list.map((t) => t.title)

  it('returns everything, in order, with no area and no query', () => {
    expect(titles(filterThreads(threads, null, '  '))).toEqual(titles(threads))
  })

  it('keeps only the chosen area', () => {
    expect(titles(filterThreads(threads, 'w', ''))).toEqual(['Hiring page', 'Onboarding email'])
  })

  it('searches title, next step and left off, ignoring case', () => {
    expect(titles(filterThreads(threads, null, 'TAX'))).toEqual(['Tax folder'])
    expect(titles(filterThreads(threads, null, 'paragraph'))).toEqual(['Onboarding email'])
    expect(titles(filterThreads(threads, null, 'perks'))).toEqual(['Hiring page'])
  })

  it('combines area and search, and can come up empty', () => {
    expect(titles(filterThreads(threads, 'w', 'receipts'))).toEqual([])
    expect(titles(filterThreads(threads, 'h', 'receipts'))).toEqual(['Tax folder'])
  })
})

describe('contextPreserved', () => {
  it('counts threads whose next step has words in it', () => {
    expect(
      contextPreserved([{ next_step: 'a' }, { next_step: null }, { next_step: '  ' }]),
    ).toEqual({ withNext: 1, total: 3, percent: 33 })
  })

  it('has no percent when nothing is waiting', () => {
    expect(contextPreserved([])).toEqual({ withNext: 0, total: 0, percent: null })
  })
})
