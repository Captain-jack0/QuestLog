import { describe, expect, it } from 'vitest'
import { normalizeDescription, withNormalizedDescription } from './description'

describe('normalizeDescription', () => {
  it('keeps a real description', () => {
    expect(normalizeDescription('Ship the thing')).toBe('Ship the thing')
  })

  it('trims the edges rather than storing them', () => {
    expect(normalizeDescription('  Ship the thing  ')).toBe('Ship the thing')
  })

  // Every way an empty description can arrive. They must land on one value, or the same empty
  // task reads differently depending on which door it came through.
  it.each([
    ['the quick-add row', undefined],
    ['an untouched box', ''],
    ['a box of spaces', '   '],
    ['a box of newlines', '\n\n'],
    ['a cleared column', null],
  ])('stores null for %s', (_case, value) => {
    expect(normalizeDescription(value)).toBeNull()
  })
})

describe('withNormalizedDescription', () => {
  it('normalises the description it is given', () => {
    expect(withNormalizedDescription({ title: 'T', description: '  ' })).toEqual({
      title: 'T',
      description: null,
    })
  })

  // The difficulty-only edit from the card: touching `description` here would blank a
  // description the edit never mentioned.
  it('leaves an absent description absent', () => {
    // Typed the way the caller's payload is: every field optional, description among them.
    const fields: { difficulty?: string; description?: string } = { difficulty: 'L' }
    expect(withNormalizedDescription(fields)).not.toHaveProperty('description')
  })

  it('does not mutate what it is handed', () => {
    const fields = { title: 'T', description: '  keep  ' }
    withNormalizedDescription(fields)
    expect(fields.description).toBe('  keep  ')
  })
})
