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
  /** Tracked time: per completed 25-minute block, at most 60 a day (finish_time_entry, timer_heartbeat.sql). */
  focus: { xp: 10, minutes: 25, dailyCap: 60 },
} as const

/** Focus XP a day can earn: 10 per finished 25-minute block, capped at 60 (finish_time_entry,
 *  20261011130000_timer_heartbeat.sql). Keep in sync with that function. */
export const FOCUS_XP_DAILY_CAP = 60

/** The focus_time share of a day's XP rows — the part FOCUS_XP_DAILY_CAP limits. */
export const focusXpTotal = (rows: { xp: number; action_type: string }[]) =>
  rows.filter((row) => row.action_type === 'focus_time').reduce((sum, row) => sum + row.xp, 0)
