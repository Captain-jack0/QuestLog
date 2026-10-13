/**
 * The Threads screen's pure parts: the area chips, the filter and search over them, and how much
 * of the waiting work still carries its next step. Kept out of queries.ts for the reason
 * groupThreads.ts gives: that module builds a Supabase client on import.
 */

interface FilterableThread {
  area_id: string | null
  area_name: string | null
  title: string
  next_step: string | null
  left_off: string | null
}

export interface AreaChip {
  id: string
  name: string
  count: number
}

/** One chip per area that has something waiting, with its count, by name. */
export function areaChips(threads: readonly FilterableThread[]): AreaChip[] {
  const byId = new Map<string, AreaChip>()
  for (const t of threads) {
    if (!t.area_id) continue
    const chip = byId.get(t.area_id)
    if (chip) chip.count += 1
    else byId.set(t.area_id, { id: t.area_id, name: t.area_name ?? '', count: 1 })
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * The threads in `areaId` (all of them when null) whose title, next step or where-you-left-off
 * contains `query`, case-insensitively. Order is kept: the query already sorts oldest first.
 */
export function filterThreads<T extends FilterableThread>(
  threads: readonly T[],
  areaId: string | null,
  query: string,
): T[] {
  const needle = query.trim().toLowerCase()
  return threads.filter(
    (t) =>
      (areaId === null || t.area_id === areaId) &&
      (needle === '' ||
        [t.title, t.next_step, t.left_off].some((text) => text?.toLowerCase().includes(needle))),
  )
}

/**
 * Of the waiting threads (in progress, paused, blocked — all the view returns), how many still
 * say what comes next. `percent` is null when nothing is waiting: 0 of 0 is not 0%.
 */
export function contextPreserved(threads: readonly { next_step: string | null }[]): {
  withNext: number
  total: number
  percent: number | null
} {
  const total = threads.length
  const withNext = threads.filter((t) => t.next_step?.trim()).length
  return { withNext, total, percent: total === 0 ? null : Math.round((withNext / total) * 100) }
}
