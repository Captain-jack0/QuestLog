import type { ItemStatus } from '../../lib/schemas'

/**
 * Today's two lists: what you are working on, and what you deliberately set aside. The view
 * only returns in_progress, paused and blocked, so "not in progress" is exactly the parked two.
 * Order is whatever came in — the query already sorts oldest activity first.
 *
 * Split by display_status, not status: an in_progress task whose project is paused or blocked
 * belongs with the parked work (#44). The task's own status is untouched and still drives writes.
 *
 * Kept out of queries.ts on purpose: that module builds a Supabase client on import, and a pure
 * split should not need env vars to be tested.
 */
export function groupThreads<T extends { display_status: ItemStatus }>(
  threads: readonly T[],
): { active: T[]; parked: T[] } {
  return {
    active: threads.filter((thread) => thread.display_status === 'in_progress'),
    parked: threads.filter((thread) => thread.display_status !== 'in_progress'),
  }
}
