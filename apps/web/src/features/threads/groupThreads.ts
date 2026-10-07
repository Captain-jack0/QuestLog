import type { ItemStatus } from '../../lib/schemas'

/**
 * Today's two lists: what you are working on, and what you deliberately set aside. The view
 * only returns in_progress, paused and blocked, so "not in progress" is exactly the parked two.
 * Order is whatever came in — the query already sorts oldest activity first.
 *
 * Kept out of queries.ts on purpose: that module builds a Supabase client on import, and a pure
 * split should not need env vars to be tested.
 */
export function groupThreads<T extends { status: ItemStatus }>(
  threads: readonly T[],
): { active: T[]; parked: T[] } {
  return {
    active: threads.filter((thread) => thread.status === 'in_progress'),
    parked: threads.filter((thread) => thread.status !== 'in_progress'),
  }
}
