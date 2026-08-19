import { describe, expect, it } from 'vitest'
import { areaSchema, profileSchema, projectSchema } from './schemas'

const validProfile = {
  display_name: 'Captain',
  timezone: 'Europe/Istanbul',
  digest_enabled: true,
  digest_time: '08:00',
  push_enabled: false,
  stale_days: 14,
}

describe('profileSchema', () => {
  it('accepts a filled-in profile', () => {
    expect(profileSchema.safeParse(validProfile).success).toBe(true)
  })

  it('keeps stale_days inside the 7–30 range the slider offers', () => {
    expect(profileSchema.safeParse({ ...validProfile, stale_days: 6 }).success).toBe(false)
    expect(profileSchema.safeParse({ ...validProfile, stale_days: 31 }).success).toBe(false)
    expect(profileSchema.safeParse({ ...validProfile, stale_days: 7 }).success).toBe(true)
  })

  it('rejects a digest time the database cannot store', () => {
    expect(profileSchema.safeParse({ ...validProfile, digest_time: '8am' }).success).toBe(false)
  })

  it('rejects a blank display name, spaces included', () => {
    expect(profileSchema.safeParse({ ...validProfile, display_name: '   ' }).success).toBe(false)
  })
})

describe('areaSchema', () => {
  it('demands a real colour', () => {
    const base = { name: 'Work', icon: '💼', sort_order: 0 }
    expect(areaSchema.safeParse({ ...base, color: '#A5B4FC' }).success).toBe(true)
    expect(areaSchema.safeParse({ ...base, color: 'blue' }).success).toBe(false)
  })
})

describe('projectSchema', () => {
  it('allows an empty description and target date', () => {
    const parsed = projectSchema.safeParse({
      title: 'Ship it',
      description: '',
      priority: 'med',
      status: 'idea',
      target_date: '',
    })
    expect(parsed.success).toBe(true)
  })

  it('rejects a title of only whitespace', () => {
    const parsed = projectSchema.safeParse({
      title: '   ',
      priority: 'med',
      status: 'idea',
    })
    expect(parsed.success).toBe(false)
  })
})
