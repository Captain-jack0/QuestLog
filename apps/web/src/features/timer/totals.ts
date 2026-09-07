/**
 * Pure part of useTaskTotals: the stacked focus time of a task is the sum of every session
 * ever logged against it. Imports nothing on purpose — a side-effectful import chain here
 * would drag `lib/supabase` into the unit test and take the whole suite down without env.
 */
export interface TimeEntryRow {
  task_id: string | null
  seconds: number | null
}

/**
 * Seconds per task id. A running session carries `seconds: null` until it is stopped, and
 * entries orphaned by a deleted task carry `task_id: null`; both are left out rather than
 * counted as zero, so a task with no finished session never appears in the map at all.
 */
export function sumSecondsByTask(entries: TimeEntryRow[]): Record<string, number> {
  const totals: Record<string, number> = {}
  for (const entry of entries) {
    // `== null`, not `=== null`: the row arrives through an unchecked cast, and an absent
    // `seconds` would otherwise sum to NaN and render as "NaNm" on the card.
    if (!entry.task_id || entry.seconds == null) continue
    totals[entry.task_id] = (totals[entry.task_id] ?? 0) + entry.seconds
  }
  return totals
}
