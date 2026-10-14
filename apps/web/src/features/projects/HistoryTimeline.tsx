import { dayLabel, groupByLocalDay, localTime } from '../../lib/time'
import type { ProgressLogWithNextTask } from './queries'
import type { TimelineEntry } from './timeline'

/**
 * The project's history — progress logs, the viewer's own XP on it and their finished focus
 * sessions (projectTimeline) — grouped by the day it happened on in the reader's own timezone,
 * each entry stamped with local wall-clock time. Status transitions are not stored yet (#81), so
 * none are shown.
 */
export function HistoryTimeline({ entries }: { entries: readonly TimelineEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="text-body text-muted">
        Nothing logged yet. Status changes, resume notes and micro-notes land here.
      </p>
    )
  }

  return (
    <div className="space-y-5">
      {groupByLocalDay(entries).map((day) => (
        <div key={day.key}>
          <h3 className="mb-2 text-micro uppercase text-muted">
            {dayLabel(day.items[0].created_at)}
          </h3>
          <ol className="space-y-3 border-l border-line pl-4">
            {day.items.map((entry) => (
              <li key={entry.id} className="break-words">
                <p className="text-caption text-muted">
                  <time dateTime={entry.created_at}>{localTime(entry.created_at)}</time>
                  {entry.kind === 'log' && entry.log.source === 'ai' && (
                    <span className="ml-2 rounded-full bg-accent/15 px-2 py-0.5 text-accent-ink">
                      via AI
                    </span>
                  )}
                </p>
                {entry.kind === 'log' ? (
                  <LogBody log={entry.log} xp={entry.xp} xpLabels={entry.xpLabels} />
                ) : (
                  <p className="text-body">
                    {entry.label}
                    {entry.xp !== undefined && (
                      <span className="tabular ml-2 text-body-medium text-success-ink">
                        +{entry.xp} XP
                      </span>
                    )}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  )
}

function LogBody({
  log,
  xp,
  xpLabels,
}: {
  log: ProgressLogWithNextTask
  xp: number
  xpLabels: readonly string[]
}) {
  const empty = !log.left_off && !log.next_step && !log.note
  const labels = xpLabels.join(' · ')
  return (
    <>
      {/* An empty log would be a bare timestamp: the XP it paid names the row instead. */}
      {empty && xp > 0 && <p className="text-body">{labels}</p>}
      {log.left_off && <p className="text-body">{log.left_off}</p>}
      {log.next_step && (
        <p className="text-body">
          <span className="text-muted">Next: </span>
          {log.next_step}
        </p>
      )}
      {log.note && <p className="text-body italic text-muted">{log.note}</p>}
      {xp > 0 && (
        <p className="tabular text-body-medium text-success-ink">
          <span>+{xp} XP</span>
          <span className="sr-only"> ({labels})</span>
        </p>
      )}
    </>
  )
}
