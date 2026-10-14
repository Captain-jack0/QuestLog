import { localDateKey, startOfLocalDay } from '../../lib/time'

export interface XpEvent {
  created_at: string
  xp: number
  area_id?: string | null
}

export interface WeekBucket {
  /** Local date key of the Monday that starts the week. */
  weekStart: string
  label: string
  xp: number
}

/** Monday-based start of the week containing `date`, at local midnight. */
export function startOfWeek(date: Date): Date {
  const day = startOfLocalDay(date)
  const weekday = (day.getDay() + 6) % 7 // Monday = 0
  day.setDate(day.getDate() - weekday)
  return day
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * XP totalled per week, oldest first, always exactly `weeks` buckets so the chart keeps
 * its shape on a quiet month.
 */
export function weeklyXp(events: XpEvent[], weeks = 8, now: Date = new Date()): WeekBucket[] {
  const thisWeek = startOfWeek(now)

  const buckets: WeekBucket[] = []
  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date(thisWeek)
    start.setDate(start.getDate() - i * 7)
    buckets.push({
      weekStart: localDateKey(start),
      label: `${start.getDate()} ${MONTHS[start.getMonth()]}`,
      xp: 0,
    })
  }

  const index = new Map(buckets.map((bucket, i) => [bucket.weekStart, i]))
  for (const event of events) {
    const key = localDateKey(startOfWeek(new Date(event.created_at)))
    const at = index.get(key)
    if (at !== undefined) buckets[at].xp += event.xp
  }
  return buckets
}

/** XP earned per local day, keyed by date key; days without XP are absent. */
export function dailyXpTotals(events: XpEvent[]): Map<string, number> {
  const totals = new Map<string, number>()
  for (const event of events) {
    const key = localDateKey(new Date(event.created_at))
    totals.set(key, (totals.get(key) ?? 0) + event.xp)
  }
  return totals
}

/**
 * Activity grid shades: the lowest daily XP for shades 1, 2 and 3; below the first is shade 0,
 * a quiet day, drawn neutral (never red). Picked against the award table in lib/xp.ts:
 * 1 = showed up at all (a check-in alone is 10), 25 = a medium task or a few updates on top,
 * 60 = a full focus-time day (its daily cap) or a large task and more.
 */
export const INTENSITY_FLOORS = [1, 25, 60] as const

export function intensity(xp: number): 0 | 1 | 2 | 3 {
  return INTENSITY_FLOORS.filter((floor) => xp >= floor).length as 0 | 1 | 2 | 3
}

/**
 * Grid fill per intensity(). Quiet days stay neutral, never red; every active shade is at least
 * 3:1 against the card and a step apart from its neighbour in both themes (contrast.test.ts).
 */
export const INTENSITY_SHADES = ['bg-line/50', 'bg-accent/70', 'bg-accent/85', 'bg-accent'] as const

/** `now` as YYYY-MM-DD in `timeZone` (browser's if unset), built from parts so no locale can reshape it. */
export function dateKeyIn(timeZone: string | undefined, now: Date): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  )
  return `${parts.year}-${parts.month}-${parts.day}`
}

/**
 * The streak as it stands today. streaks.current only moves when rpc_update_status runs, so a
 * row can still say 12 after a week away. The server's rule on the next update: last active
 * today or yesterday keeps the run; an older date spends a shield (freeze_tokens) to keep it,
 * whatever the gap; no shield resets it. So the run is alive unless it is older than yesterday
 * with no shield left. Days are the profile's timezone, as on the server (browser's if unset).
 */
export function effectiveStreak(
  streak: { current: number; last_active_date: string | null; freeze_tokens: number } | null,
  timeZone?: string,
  now: Date = new Date(),
): number {
  if (!streak?.last_active_date) return 0
  const today = dateKeyIn(timeZone, now)
  const yesterday = new Date(`${today}T00:00:00Z`)
  yesterday.setUTCDate(yesterday.getUTCDate() - 1)
  const alive =
    streak.last_active_date >= yesterday.toISOString().slice(0, 10) || streak.freeze_tokens > 0
  return alive ? streak.current : 0
}

/** XP earned today and the `days - 1` local days before it. */
export function xpInLastDays(events: XpEvent[], days = 7, now: Date = new Date()): number {
  const since = startOfLocalDay(now)
  since.setDate(since.getDate() - (days - 1))
  return events
    .filter((event) => new Date(event.created_at) >= since)
    .reduce((sum, event) => sum + event.xp, 0)
}

/**
 * Distinct life areas with XP in the last 7 x 24 hours — the same rolling window the
 * renaissance badge checks (`created_at > now() - interval '7 days'` in rpc_update_status).
 */
export function activeAreasLastWeek(events: XpEvent[], now: Date = new Date()): number {
  const since = now.getTime() - 7 * 24 * 60 * 60 * 1000
  const areas = new Set<string>()
  for (const event of events) {
    if (event.area_id && new Date(event.created_at).getTime() > since) areas.add(event.area_id)
  }
  return areas.size
}

/**
 * Bar heights in percent of the chart: the biggest value fills it, any non-zero value shows at
 * least 4% so it stays visible next to a big week, and zero draws a 2% stub so the week still
 * has a slot. All-zero input gives stubs, never NaN.
 */
export function barHeights(values: number[]): number[] {
  const peak = Math.max(0, ...values)
  return values.map((value) => (value > 0 && peak > 0 ? Math.max((value / peak) * 100, 4) : 2))
}

/**
 * A GitHub-style grid: `weeks` columns of 7 days (Monday..Sunday), ending with the
 * current week. Days after today are returned as null so the grid stays rectangular.
 */
export function calendarWeeks(weeks = 12, now: Date = new Date()): (string | null)[][] {
  const today = localDateKey(now)
  const thisWeek = startOfWeek(now)

  const grid: (string | null)[][] = []
  for (let w = weeks - 1; w >= 0; w--) {
    const start = new Date(thisWeek)
    start.setDate(start.getDate() - w * 7)
    const column: (string | null)[] = []
    for (let d = 0; d < 7; d++) {
      const day = new Date(start)
      day.setDate(day.getDate() + d)
      const key = localDateKey(day)
      column.push(key > today ? null : key)
    }
    grid.push(column)
  }
  return grid
}

export interface FocusWeek {
  weekStart: string
  label: string
  seconds: number
}

/** Focus seconds per week, same window and shape as weeklyXp so the two charts line up. */
export function weeklyFocus(
  days: { day: string; seconds: number }[],
  weeks = 8,
  now: Date = new Date(),
): FocusWeek[] {
  const buckets = weeklyXp([], weeks, now).map((bucket) => ({
    weekStart: bucket.weekStart,
    label: bucket.label,
    seconds: 0,
  }))
  const index = new Map(buckets.map((bucket, i) => [bucket.weekStart, i]))

  for (const entry of days) {
    // "2026-08-19" is a local calendar day already; parse it as such, not as UTC
    const [year, month, day] = entry.day.split('-').map(Number)
    const key = localDateKey(startOfWeek(new Date(year, month - 1, day)))
    const at = index.get(key)
    if (at !== undefined) buckets[at].seconds += entry.seconds
  }
  return buckets
}
