import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// Issue #42: lists run "least recently touched first". These read the query and migration
// sources, because the Supabase client and triggers cannot run in a unit test.
const read = (rel: string) => readFileSync(resolve(__dirname, '../..', rel), 'utf8')
const migration = read('../../supabase/migrations/20261005120000_untouched_first_ordering.sql')

describe('untouched-first list queries', () => {
  it('orders areas by updated_at ascending, then created_at', () => {
    const src = read('src/features/areas/queries.ts')
    expect(src).toMatch(/\.order\('updated_at'\)\s*\.order\('created_at'\)/)
  })

  it('orders the projects of an area by updated_at ascending, then created_at', () => {
    const src = read('src/features/projects/queries.ts')
    expect(src).toMatch(/\.order\('updated_at'\)\s*\.order\('created_at'\)/)
  })

  it('orders the tasks of a project by updated_at ascending, then created_at', () => {
    const src = read('src/features/tasks/queries.ts')
    expect(src).toMatch(/\.order\('updated_at'\)\s*\.order\('created_at'\)/)
  })

  it('does not order the project pickers newest-touched first (quick add / move task)', () => {
    expect(read('src/components/QuickAddSheet.tsx')).not.toMatch(
      /\.order\('updated_at',\s*\{\s*ascending:\s*false/,
    )
    expect(read('src/features/projects/queries.ts')).not.toMatch(
      /\.order\('updated_at',\s*\{\s*ascending:\s*false/,
    )
  })

  it('uses the explicit ascending + nullsFirst form from the issue scope', () => {
    for (const f of ['areas', 'projects', 'tasks']) {
      expect(read(`src/features/${f}/queries.ts`)).toContain(
        ".order('updated_at', { ascending: true, nullsFirst: true })",
      )
    }
  })
})

describe('updated_at is touched up the chain (migration)', () => {
  it('a task insert/update touches its project', () => {
    expect(migration).toMatch(/create trigger tasks_touch_project after insert or update on tasks/)
  })
  it('a project insert/update touches its area', () => {
    expect(migration).toMatch(
      /create trigger projects_touch_area after insert or update on projects/,
    )
  })
  it('a finished focus session touches the task (or project)', () => {
    expect(migration).toMatch(/create trigger time_entries_touch_item after update on time_entries/)
    expect(migration).toMatch(/old\.ended_at is null and new\.ended_at is not null/)
  })
  it('areas get an updated_at column with a touch trigger', () => {
    expect(migration).toMatch(/alter table life_areas add column updated_at timestamptz not null/)
    expect(migration).toMatch(/create trigger life_areas_touch_updated_at before update/)
  })
})

describe('manual ordering is gone', () => {
  it('drops sort_order and no UI references it', () => {
    expect(read('../../supabase/migrations/20261020120000_drop_sort_order.sql')).toMatch(
      /sort_order/,
    )
  })
})
