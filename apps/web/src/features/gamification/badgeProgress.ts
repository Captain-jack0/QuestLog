/** Each count is undefined while its query is loading or has failed, which hides that counter. */
export interface BadgeCounts {
  /** effectiveStreak() */
  streak: number | undefined
  level: number | undefined
  /** This user's progress logs. */
  progressLogs: number | undefined
  /** activeAreasLastWeek() */
  activeAreas: number | undefined
}

/**
 * The badges whose rule is a count, as the server grants them in rpc_update_status
 * (latest: supabase/migrations/20261009130000_sharing_role_aware_rpcs.sql, "-- #74" badge block).
 * Keep in step with that SQL. The rest — first_quest, finisher, honest_quitter, necromancer — are
 * a single event with nothing to count, so they show no progress.
 *
 * threadkeeper counts progress_logs by user_id on the server; the client can only count the logs
 * it can still read, so after leaving a shared project it may read lower than the server's count.
 */
const COUNTED: Record<string, (counts: BadgeCounts) => [number | undefined, number]> = {
  week_one: (c) => [c.streak, 7],
  fortnight: (c) => [c.streak, 14],
  monthly_legend: (c) => [c.streak, 30],
  level_10: (c) => [c.level, 10],
  threadkeeper: (c) => [c.progressLogs, 10],
  renaissance: (c) => [c.activeAreas, 4],
}

/** `{ current, target }` for a counted badge, null for event badges or a count still loading. */
export function badgeProgress(
  code: string,
  counts: BadgeCounts,
): { current: number; target: number } | null {
  const rule = COUNTED[code]
  if (!rule) return null
  const [current, target] = rule(counts)
  if (current === undefined) return null
  return { current: Math.min(current, target), target }
}
