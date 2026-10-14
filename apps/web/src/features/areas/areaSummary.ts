import { levelForXp, xpForLevel } from '../../lib/xp'
import { startOfWeek } from '../gamification/aggregate'

/** Where an area stands on the XP curve: its level, the XP that reaches the next one, and how
 *  far through the current level it is (0–1), for the ring. */
export function levelProgress(totalXp: number): { level: number; ceiling: number; ratio: number } {
  const level = levelForXp(totalXp)
  const floor = xpForLevel(level)
  const ceiling = xpForLevel(level + 1)
  return { level, ceiling, ratio: (totalXp - floor) / (ceiling - floor) }
}

/** How many threads wait in each area, and the oldest of them — the one the card resumes. */
export function threadsByArea<T extends { area_id: string | null; last_activity_at: string }>(
  threads: readonly T[],
): Map<string, { count: number; oldest: T }> {
  const byArea = new Map<string, { count: number; oldest: T }>()
  for (const thread of threads) {
    if (!thread.area_id) continue
    const seen = byArea.get(thread.area_id)
    const older =
      !seen || Date.parse(thread.last_activity_at) < Date.parse(seen.oldest.last_activity_at)
    byArea.set(thread.area_id, {
      count: (seen?.count ?? 0) + 1,
      oldest: older ? thread : seen.oldest,
    })
  }
  return byArea
}

/** Seconds per area id. A running session (`seconds: null`) and an entry whose project came back
 *  without an area are left out, as in sumSecondsByProject. */
export function sumSecondsByArea(
  rows: readonly { area_id: string | null; seconds: number | null }[],
): Record<string, number> {
  const totals: Record<string, number> = {}
  for (const row of rows) {
    if (!row.area_id || row.seconds == null) continue
    totals[row.area_id] = (totals[row.area_id] ?? 0) + row.seconds
  }
  return totals
}

/** sumSecondsByArea over the sessions that started on or after this week's local Monday 00:00. */
export function sumWeekSecondsByArea(
  rows: readonly { area_id: string | null; seconds: number | null; started_at: string }[],
  now: Date,
): Record<string, number> {
  const weekStart = startOfWeek(now).getTime()
  return sumSecondsByArea(rows.filter((row) => Date.parse(row.started_at) >= weekStart))
}

/**
 * Whole-number percentages that add up to exactly 100 (largest remainder): every share is
 * floored, then the points still missing go one each to the shares that lost the most to the
 * floor. All zeros (or nothing) gives all zeros.
 */
export function sharePercents(values: readonly number[]): number[] {
  const total = values.reduce((sum, v) => sum + v, 0)
  if (total <= 0) return values.map(() => 0)
  const exact = values.map((v) => (v / total) * 100)
  const result = exact.map(Math.floor)
  const missing = 100 - result.reduce((sum, v) => sum + v, 0)
  const byRemainder = exact
    .map((v, i) => ({ i, remainder: v - Math.floor(v) }))
    .sort((a, b) => b.remainder - a.remainder)
  for (let k = 0; k < missing; k++) result[byRemainder[k].i] += 1
  return result
}
