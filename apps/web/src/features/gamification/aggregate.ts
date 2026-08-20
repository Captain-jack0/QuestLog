import { localDateKey, startOfLocalDay } from '../../lib/time'

export interface XpEvent {
  created_at: string
  xp: number
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

/** Local days that earned at least one XP event. */
export function activeDayKeys(events: XpEvent[]): Set<string> {
  return new Set(events.map((event) => localDateKey(new Date(event.created_at))))
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
