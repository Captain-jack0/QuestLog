import { OPEN_STATUSES, type ItemStatus, type Priority } from '../../lib/schemas'
import { localDateKey } from '../../lib/time'
import type { TaskListPrefs } from './listPrefs'

export const SORT_KEYS = ['created', 'priority'] as const
export type SortKey = (typeof SORT_KEYS)[number]

/**
 * Structural shapes, not `Task` itself: this module compiles and is tested before the
 * `priority` column exists on `tasks`. Anything carrying these fields sorts here.
 */
type Sortable = {
  status: ItemStatus
  priority: Priority
  created_at: string
  sort_order: number
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

/** In-progress work outranks everything under both sort keys — it is the list's spine. */
function focusRank(task: Pick<Sortable, 'status'>): number {
  return task.status === 'in_progress' ? 0 : 1
}

export function compareTasks(sort: SortKey): (a: Sortable, b: Sortable) => number {
  return (a, b) => {
    const focus = focusRank(a) - focusRank(b)
    if (focus !== 0) return focus

    if (sort === 'priority') {
      const rank = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
      if (rank !== 0) return rank
    }

    // Oldest first, so a list read top to bottom is the order the work arrived in.
    // An unparsable timestamp yields NaN, which is falsy and falls through to sort_order.
    const created = Date.parse(a.created_at) - Date.parse(b.created_at)
    if (created) return created

    return a.sort_order - b.sort_order
  }
}

/**
 * "Active item without updates for N days" (docs/01 §11, default 14). Mirrors the server:
 * `updated_at < now() - N days` (focus_snooze_views.sql:124 — strictly older, so exactly N
 * days is not yet stale) and snoozed items are excluded while their date is still ahead
 * (`snoozed_until is null or snoozed_until <= current_date`, :156).
 */
export function isStale(task: Staleable, staleDays: number, now: number): boolean {
  if (!isOpen(task.status)) return false
  if (task.snoozed_until && task.snoozed_until > localDateKey(new Date(now))) return false
  return Date.parse(task.updated_at) < now - staleDays * DAY_MS
}

function matchesFilters(
  task: Sortable & Staleable,
  prefs: TaskListPrefs,
  staleDays: number,
  now: number,
): boolean {
  if (prefs.status.length > 0 && !prefs.status.includes(task.status)) return false
  if (prefs.staleOnly && !isStale(task, staleDays, now)) return false
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
    closed: closed.sort(compare),
    hiddenByFilter: open.length - visible.length,
  }
}
