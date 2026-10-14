/** UI is English; locale support comes later. Every toLocale* / Intl call passes this. */
export const LOCALE = 'en-US'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const WEEK = 7 * DAY

/** Midnight in the browser's timezone — the client's view of "today". */
export function startOfLocalDay(now: Date = new Date()): Date {
  const day = new Date(now)
  day.setHours(0, 0, 0, 0)
  return day
}

/** Today as YYYY-MM-DD in local time, which is what focus_items.date stores. */
export function localDateKey(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/**
 * A stored YYYY-MM-DD (a calendar date, not an instant — `projects.target_date`) as a short local
 * date. Read by parts: `new Date('2026-08-19')` is UTC midnight, which is the 18th everywhere west
 * of Greenwich.
 */
export function formatDateKey(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  if (!y || !m || !d) return key
  return new Date(y, m - 1, d).toLocaleDateString(LOCALE, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/** Day heading for a timeline: "Today", "Yesterday", else a short local date. */
export function dayLabel(iso: string, now: Date = new Date()): string {
  const day = startOfLocalDay(new Date(iso))
  const today = startOfLocalDay(now)
  // Rounded, not floored: a day that crosses a DST change is 23 or 25 hours long.
  const days = Math.round((today.getTime() - day.getTime()) / DAY)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return day.toLocaleDateString(LOCALE, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: day.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  })
}

/** Wall-clock time in the browser's timezone — never UTC on screen. */
export function localTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' })
}

/** Newest-first rows into newest-first runs sharing one local calendar day. */
export function groupByLocalDay<T extends { created_at: string }>(
  rows: readonly T[],
): { key: string; items: T[] }[] {
  const days: { key: string; items: T[] }[] = []
  for (const row of rows) {
    const key = localDateKey(new Date(row.created_at))
    const last = days[days.length - 1]
    if (last?.key === key) last.items.push(row)
    else days.push({ key, items: [row] })
  }
  return days
}

/**
 * "2026.286": the year and the local day of the year, for Today's decorative stardate label —
 * always shown beside the real date, never instead of it. Rounded for the same DST reason as
 * dayLabel.
 */
export function stardate(now: Date = new Date()): string {
  const newYear = new Date(now.getFullYear(), 0, 1)
  const day = Math.round((startOfLocalDay(now).getTime() - newYear.getTime()) / DAY) + 1
  return `${now.getFullYear()}.${String(day).padStart(3, '0')}`
}

/**
 * How long a thread has sat, in a neutral voice: "3d untouched" from the first full day, and
 * "Touched 5h ago" inside it — "0d untouched" would read as a typo.
 */
export function untouchedLabel(iso: string, now: Date = new Date()): string {
  const days = Math.floor((now.getTime() - new Date(iso).getTime()) / DAY)
  return days >= 1 ? `${days}d untouched` : `Touched ${relativeTime(iso, now)}`
}

/** Compact relative time for timelines: "just now", "5m ago", "3d ago", "2w ago". */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const diff = now.getTime() - new Date(iso).getTime()
  if (Number.isNaN(diff)) return ''
  if (diff < 0) return 'just now'
  if (diff < MINUTE) return 'just now'
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m ago`
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`
  if (diff < WEEK) return `${Math.floor(diff / DAY)}d ago`
  return `${Math.floor(diff / WEEK)}w ago`
}
