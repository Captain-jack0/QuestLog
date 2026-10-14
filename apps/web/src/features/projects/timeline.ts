import { formatMinutes } from '../timer/pomodoro'
import type { ProjectXpEvent } from '../gamification/queries'
import type { FocusSession } from '../timer/queries'
import type { ProgressLogWithNextTask } from './queries'

/** How many rows each History source fetches (progress logs, focus sessions). */
export const HISTORY_LIMIT = 50

export type TimelineEntry =
  | {
      kind: 'log'
      id: string
      created_at: string
      log: ProgressLogWithNextTask
      /** XP paid in the same transaction as this log (summed) and what each part was for. */
      xp: number
      xpLabels: string[]
    }
  | { kind: 'event'; id: string; created_at: string; label: string; xp?: number }

/** xp_events.action_type as History reads it. pick_focus carries no project, so it never shows. */
const XP_LABELS: Record<string, string> = {
  task_done: 'Task completed',
  project_done: 'Project completed',
  progress_update: 'Progress update',
  daily_check_in: 'Daily check-in',
  focus_time: 'Focus time',
  groom_stale: 'Stale thread groomed',
}

export const xpLabel = (actionType: string) =>
  XP_LABELS[actionType] ??
  actionType.charAt(0).toUpperCase() + actionType.slice(1).replaceAll('_', ' ')

// rpc_update_status writes the log then award_xp in one transaction; clock_timestamp() spreads them
// over microseconds.
export const FOLD_WINDOW_MS = 2000

const time = (iso: string) => Date.parse(iso)

/** Oldest instant a source cut at `limit` still vouches for; -Infinity when it wasn't cut. */
const horizonOf = (instants: string[], limit: number) =>
  instants.length >= limit ? Math.min(...instants.map(time)) : -Infinity

/**
 * Progress logs, XP events and finished focus sessions as one newest-first list. xp_events has no
 * link to the log it came from, but rpc_update_status writes both in one transaction, so XP stamped
 * at or just after a log (within FOLD_WINDOW_MS) folds into the nearest such log's row, provided
 * both belong to the same user and the same item. rpc_update_status stamps every award (check-in
 * included) with the log's own user and task_id (null for a project), so the match is strict. Other
 * XP (focus time, a heartbeat close) and sessions stay rows of their own.
 *
 * A source that hit `limit` knows nothing before its oldest row, so the list stops there rather
 * than letting the other sources run on alone into a stretch that looks log-free.
 */
export function projectTimeline(
  logs: readonly ProgressLogWithNextTask[],
  xp: readonly ProjectXpEvent[],
  sessions: readonly FocusSession[],
  limit = HISTORY_LIMIT,
): TimelineEntry[] {
  const horizon = Math.max(
    horizonOf(
      logs.map((log) => log.created_at),
      limit,
    ),
    horizonOf(
      sessions.map((session) => session.ended_at),
      limit,
    ),
  )
  const logEntries = logs.map((log) => ({
    kind: 'log' as const,
    id: log.id,
    created_at: log.created_at,
    log,
    xp: 0,
    xpLabels: [] as string[],
  }))
  const looseXp = xp.filter((event) => {
    const at = time(event.created_at)
    let owner: (typeof logEntries)[number] | undefined
    let ownerAt = -Infinity
    for (const entry of logEntries) {
      const logAt = time(entry.created_at)
      if (
        entry.log.user_id === event.user_id &&
        entry.log.task_id === event.task_id &&
        logAt <= at &&
        at - logAt <= FOLD_WINDOW_MS &&
        logAt > ownerAt
      ) {
        owner = entry
        ownerAt = logAt
      }
    }
    if (!owner) return true
    owner.xp += event.xp
    owner.xpLabels.push(xpLabel(event.action_type))
    return false
  })
  const entries: TimelineEntry[] = [
    ...logEntries,
    ...looseXp.map((event) => ({
      kind: 'event' as const,
      id: `xp-${event.id}`,
      created_at: event.created_at,
      label: xpLabel(event.action_type),
      xp: event.xp,
    })),
    ...sessions.map((session) => ({
      kind: 'event' as const,
      id: `focus-${session.id}`,
      created_at: session.ended_at,
      label: `${session.mode === 'pomodoro' ? 'Pomodoro' : 'Focus session'} · ${formatMinutes(session.seconds)}`,
    })),
  ]
  return entries
    .filter((entry) => time(entry.created_at) >= horizon)
    .sort((a, b) => time(b.created_at) - time(a.created_at))
}
