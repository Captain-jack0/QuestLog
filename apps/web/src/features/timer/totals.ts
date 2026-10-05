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

export interface ProjectTimeEntryRow {
  project_id: string
  seconds: number | null
}

/**
 * Seconds per project id — every finished session filed under the project, whether it was
 * clocked on a task or on the project alone. `task_id` is not looked at on purpose: an entry
 * orphaned by a deleted task keeps its `project_id`, so its seconds stay in the total. The
 * running session (`seconds: null`) is left out, as above.
 */
export function sumSecondsByProject(entries: ProjectTimeEntryRow[]): Record<string, number> {
  const totals: Record<string, number> = {}
  for (const entry of entries) {
    if (!entry.project_id || entry.seconds == null) continue
    totals[entry.project_id] = (totals[entry.project_id] ?? 0) + entry.seconds
  }
  return totals
}

/**
 * What TimerBar counts on each of its two lines. The project line is what the project had
 * already banked plus the session running now, so it keeps climbing across a switch between
 * tasks of the same project. The task line is this session alone, and `null` — no line —
 * when the clock runs on the project itself.
 *
 * `?? 0`, for the reason spelled out in sumSecondsByTask: the row comes through an unchecked
 * cast, and against a view that predates `project_seconds_total` the column is simply absent.
 * The bar then counts the session instead of rendering "NaN:NaN".
 */
export function timerBarSeconds(
  timer: { task_id: string | null; project_seconds_total?: number | null },
  elapsed: number,
): { project: number; task: number | null } {
  // A client clock behind the server's puts `elapsed` below zero for the first moments.
  const session = Math.max(elapsed, 0)
  return {
    project: (timer.project_seconds_total ?? 0) + session,
    task: timer.task_id ? session : null,
  }
}
