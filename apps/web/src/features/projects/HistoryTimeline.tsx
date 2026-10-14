import { dayLabel, groupByLocalDay, localTime } from '../../lib/time'
import type { ProgressLogWithNextTask } from './queries'

/**
 * The append-only progress log, grouped by the day it happened on in the reader's own timezone,
 * each entry stamped with local wall-clock time. Only what a log holds is drawn: status
 * transitions are not stored on it yet (#81), so none are shown.
 */
export function HistoryTimeline({ logs }: { logs: readonly ProgressLogWithNextTask[] }) {
  if (logs.length === 0) {
    return (
      <p className="text-body text-muted">
        Nothing logged yet. Status changes, resume notes and micro-notes land here.
      </p>
    )
  }

  return (
    <div className="space-y-5">
      {groupByLocalDay(logs).map((day) => (
        <div key={day.key}>
          <h3 className="mb-2 text-micro uppercase text-muted">
            {dayLabel(day.items[0].created_at)}
          </h3>
          <ol className="space-y-3 border-l border-line pl-4">
            {day.items.map((log) => (
              <li key={log.id} className="break-words">
                <p className="text-caption text-muted">
                  <time dateTime={log.created_at}>{localTime(log.created_at)}</time>
                  {log.source === 'ai' && (
                    <span className="ml-2 rounded-full bg-accent/15 px-2 py-0.5 text-accent-ink">
                      via AI
                    </span>
                  )}
                </p>
                {log.left_off && <p className="text-body">{log.left_off}</p>}
                {log.next_step && (
                  <p className="text-body">
                    <span className="text-muted">Next: </span>
                    {log.next_step}
                  </p>
                )}
                {log.note && <p className="text-body italic text-muted">{log.note}</p>}
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  )
}
