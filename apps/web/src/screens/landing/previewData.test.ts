import { describe, expect, it } from 'vitest'
import { ITEM_STATUSES } from '../../lib/schemas'
import { AREAS } from './previewData'

describe('preview data', () => {
  it('shows every item status at least once', () => {
    const seen = new Set(
      AREAS.flatMap((a) => a.projects.flatMap((p) => [p.status, ...p.tasks.map((t) => t.status)])),
    )
    expect(ITEM_STATUSES.every((status) => seen.has(status))).toBe(true)
  })
})
