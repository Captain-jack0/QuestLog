/**
 * XP level curve — single source of truth on the client.
 * Mirrors the SQL function level_for_xp (task BE-03).
 * XP needed to *reach* level n: round(100 * n^1.5)
 */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0
  return Math.round(100 * Math.pow(level, 1.5))
}

export function levelForXp(totalXp: number): number {
  let level = 1
  while (xpForLevel(level + 1) <= totalXp) level++
  return level
}

/** XP awards per action — mirrors docs/01 §8. Keep in sync with rpc_update_status (BE-04). */
export const XP = {
  dailyCheckIn: 10,
  taskDone: { S: 10, M: 25, L: 50 },
  progressUpdate: 8,
  projectDone: 100,
  pickFocus: 5,
  groomStale: 15,
} as const
