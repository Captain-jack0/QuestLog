import { OPEN_STATUSES, type Difficulty, type ItemStatus, type Priority } from '../../lib/schemas'
import { localDateKey } from '../../lib/time'
import type { TaskListPrefs } from './listPrefs'

export const SORT_KEYS = ['untouched', 'priority'] as const
export type SortKey = (typeof SORT_KEYS)[number]

/**
 * Structural shapes, not `Task` itself: this module compiles and is tested before the
 * `priority` column exists on `tasks`. Anything carrying these fields sorts here.
 */
type Sortable = {
  id: string
  status: ItemStatus
  priority: Priority
  /** Filtered on, never sorted on — nothing ranks S over L. */
  difficulty: Difficulty
  created_at: string
  updated_at: string
}

type Staleable = {
  status: ItemStatus
  updated_at: string
  snoozed_until: string | null
}

const DAY_MS = 86_400_000

/** high first. Only used when the sort key is `priority`. */
const PRIORITY_RANK: Record<Priority, number> = { high: 0, med: 1, low: 2 }

/** `done` / `dropped` — the complement of OPEN_STATUSES, which is the single source of truth. */
function isOpen(status: ItemStatus): boolean {
  return OPEN_STATUSES.includes(status)
}

/**
 * Narrower than OPEN_STATUSES on purpose. The server's hanging-threads view counts exactly
 * these three (`20260818120400_focus_snooze_views.sql:155`), and `idea`/`planned` are backlog,
 * not neglect — an idea you noted three weeks ago and never started is not a dropped thread.
 * Counting them would make the chip claim work that Today never lists.
 */
const STALE_STATUSES: ItemStatus[] = ['in_progress', 'paused', 'blocked']

/** In-progress work outranks everything under both sort keys — it is the list's spine. */
function focusRank(task: Pick<Sortable, 'status'>): number {
  return task.status === 'in_progress' ? 0 : 1
}

/**
 * `created` is not in SORT_KEYS — no control offers it. It is the order the closed bucket had
 * before `untouched` became the default, and `partitionTasks` keeps it there.
 */
export function compareTasks(sort: SortKey | 'created'): (a: Sortable, b: Sortable) => number {
  return (a, b) => {
    const focus = focusRank(a) - focusRank(b)
    if (focus !== 0) return focus

    if (sort === 'priority') {
      const rank = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
      if (rank !== 0) return rank
    }

    // Least recently touched first: the work nobody has looked at for longest is what the list
    // exists to put in front of you. Editing a task sends it to the bottom.
    if (sort === 'untouched') {
      const touched = Date.parse(a.updated_at) - Date.parse(b.updated_at)
      if (touched) return touched
    }

    // Oldest first, so a list read top to bottom is the order the work arrived in.
    // An unparsable timestamp yields NaN, which is falsy and falls through to the id.
    const created = Date.parse(a.created_at) - Date.parse(b.created_at)
    if (created) return created

    // Ids are unique, so two rows never compare equal and the result cannot depend on the
    // order the server happened to return them in.
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  }
}

/**
 * "Active item without updates for N days" (docs/01 §11, default 14). Mirrors the server:
 * `updated_at < now() - N days` (focus_snooze_views.sql:124 — strictly older, so exactly N
 * days is not yet stale) and snoozed items are excluded while their date is still ahead
 * (`snoozed_until is null or snoozed_until <= current_date`, :156).
 */
export function isStale(task: Staleable, staleDays: number, now: number): boolean {
  if (!STALE_STATUSES.includes(task.status)) return false
  if (task.snoozed_until && task.snoozed_until > localDateKey(new Date(now))) return false
  return Date.parse(task.updated_at) < now - staleDays * DAY_MS
}

/**
 * The progress bar reports the project, not the current view, so this must be handed the whole
 * task list — never `partitionTasks(...).open`, which the filters and the closed bucket have
 * both already thinned. Same count as `aggregateProjectStats`, one project at a time.
 */
export function taskProgress(tasks: readonly { status: ItemStatus }[]): {
  done: number
  total: number
} {
  let done = 0
  for (const task of tasks) if (task.status === 'done') done += 1
  return { done, total: tasks.length }
}

function matchesFilters(
  task: Sortable & Staleable,
  prefs: TaskListPrefs,
  staleDays: number,
  now: number,
): boolean {
  if (prefs.status.length > 0 && !prefs.status.includes(task.status)) return false
  if (prefs.staleOnly && !isStale(task, staleDays, now)) return false
  // Both filter on a value the list draws for itself: `high` has the ▲ mark, `S` the letter.
  if (prefs.highPriorityOnly && task.priority !== 'high') return false
  if (prefs.quickOnly && task.difficulty !== 'S') return false
  return true
}

/**
 * Splits a task list into the open list (filtered + sorted) and the completed bucket.
 * Never touches the argument — it is the React Query cache array, and sorting it in place
 * would reorder the cache. `hiddenByFilter` feeds the "Showing 4 of 12" line; the filters
 * apply to the open bucket only, since the closed bucket is its own collapsible section.
 */
export function partitionTasks<T extends Sortable & Staleable>(
  tasks: readonly T[],
  prefs: TaskListPrefs,
  staleDays: number,
  now: number,
): { open: T[]; closed: T[]; hiddenByFilter: number } {
  const compare = compareTasks(prefs.sort)
  const open: T[] = []
  const closed: T[] = []

  for (const task of tasks) {
    if (isOpen(task.status)) open.push(task)
    else closed.push(task)
  }

  const visible = open.filter((task) => matchesFilters(task, prefs, staleDays, now))

  return {
    open: visible.sort(compare),
    // The closed bucket keeps the order it always had: "untouched first" is a nudge towards
    // neglected open work, and finished work has nothing left to be nudged about.
    closed: closed.sort(prefs.sort === 'untouched' ? compareTasks('created') : compare),
    hiddenByFilter: open.length - visible.length,
  }
}
