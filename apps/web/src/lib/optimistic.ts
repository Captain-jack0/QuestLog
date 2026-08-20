const PREFIX = 'optimistic-'

/**
 * Optimistic rows carry a placeholder id until the insert comes back. Anything that talks
 * to the server — RPCs, links, edits — must wait for the real one, or Postgres rejects the
 * fake uuid.
 */
export function optimisticId(seed: number): string {
  return `${PREFIX}${seed}`
}

export function isOptimistic(id: string): boolean {
  return id.startsWith(PREFIX)
}

/** Swaps the first placeholder for the row the database actually created. */
export function replaceOptimistic<T extends { id: string }>(rows: T[], row: T): T[] {
  const at = rows.findIndex((candidate) => isOptimistic(candidate.id))
  if (at === -1) return rows.some((candidate) => candidate.id === row.id) ? rows : [...rows, row]
  return rows.map((candidate, i) => (i === at ? row : candidate))
}
