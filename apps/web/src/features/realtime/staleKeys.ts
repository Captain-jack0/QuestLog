/**
 * The query-key prefixes (features/<name>/queries.ts and QuickAddSheet) a change to each streamed
 * table can make stale. Kept apart from the hook so the test needs no Supabase client.
 */
export const STALE_KEYS: Record<string, string[][]> = {
  tasks: [['tasks'], ['projects'], ['areas'], ['focus'], ['threads']],
  projects: [['project'], ['projects'], ['areas'], ['focus'], ['threads'], ['quick-add']],
  // ['projects']: the area cards' stats read the latest next step out of progress_logs.
  progress_logs: [['project'], ['projects'], ['threads']],
  project_members: [['project'], ['projects'], ['tasks'], ['areas']],
  area_members: [['areas'], ['projects']],
}

/** Every prefix the given tables make stale, each once. */
export function staleKeys(tables: Iterable<string>): string[][] {
  const unique = new Map<string, string[]>()
  for (const table of tables) {
    for (const key of STALE_KEYS[table] ?? []) unique.set(key.join('\u0000'), key)
  }
  return [...unique.values()]
}
