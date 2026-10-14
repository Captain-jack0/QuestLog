import { describe, expect, it } from 'vitest'
import { AREA_COLORS, ITEM_STATUSES } from '../../lib/schemas'
import { AREAS } from './previewData'

describe('preview data', () => {
  it('shows every item status at least once', () => {
    const seen = new Set(
      AREAS.flatMap((a) => a.projects.flatMap((p) => [p.status, ...p.tasks.map((t) => t.status)])),
    )
    expect(ITEM_STATUSES.every((status) => seen.has(status))).toBe(true)
  })

  it('colours areas only from the design half of AREA_COLORS', () => {
    const design: readonly string[] = AREA_COLORS.slice(0, 8)
    expect(AREAS.every((a) => design.includes(a.colour))).toBe(true)
  })
})
