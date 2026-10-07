import { OPEN_STATUSES, type ItemStatus } from '../../lib/schemas'

/** Structural shape, not `Project` itself — anything carrying these fields sorts here. */
type Orderable = {
  status: ItemStatus
  updated_at: string
  created_at: string
}

function isOpen(status: ItemStatus): boolean {
  return OPEN_STATUSES.includes(status)
}

/**
 * Open projects first, in the order the server handed them over (least recently touched first,
 * queries.ts:77). Closed ones (`done` / `dropped`) go to the end of the grid: "untouched first"
 * is a nudge towards neglected work, and a finished project has nothing left to be nudged
 * about. Inside that bucket the most recently finished comes first, so the last thing you
 * closed is the first closed thing you see; created_at breaks ties, newest first.
 *
 * Never touches the argument — it is the React Query cache array, and sorting it in place
 * would reorder the cache.
 */
export function orderProjects<T extends Orderable>(projects: readonly T[]): T[] {
  const open = projects.filter((project) => isOpen(project.status))
  // An unparsable timestamp yields NaN, which is falsy and falls through to created_at.
  const closed = projects
    .filter((project) => !isOpen(project.status))
    .sort(
      (a, b) =>
        Date.parse(b.updated_at) - Date.parse(a.updated_at) ||
        Date.parse(b.created_at) - Date.parse(a.created_at),
    )
  return [...open, ...closed]
}
