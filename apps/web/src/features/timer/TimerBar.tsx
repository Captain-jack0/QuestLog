import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { formatDuration, pomodoroPhase } from './pomodoro'
import { useRunningTimer, useStopTimer } from './queries'

/**
 * The running clock, pinned above the tab bar so it is visible from every screen. Elapsed
 * time is derived from started_at on every tick, so a sleeping tab cannot drift.
 */
export function TimerBar() {
  const running = useRunningTimer()
  const stop = useStopTimer()
  const [now, setNow] = useState(() => Date.now())

  const timer = running.data
  useEffect(() => {
    if (!timer) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [timer])

  if (!timer) return null

  const elapsed = Math.floor((now - new Date(timer.started_at).getTime()) / 1000)
  const pomodoro = timer.mode === 'pomodoro' ? pomodoroPhase(elapsed) : null
  const label = timer.task_title ?? timer.project_title

  return (
    <div className="fixed inset-x-0 bottom-[72px] z-20 px-4 md:bottom-4 md:left-auto md:right-4 md:w-80 md:px-0">
      <div className="mx-auto flex max-w-md items-center gap-3 rounded-card bg-surface p-3 shadow-quest">
        <span
          aria-hidden
          className="h-8 w-1.5 shrink-0 rounded-full border border-ink/55"
          style={{ backgroundColor: timer.area_color ?? 'rgb(var(--accent))' }}
        />
        <div className="min-w-0 flex-1">
          <Link
            to={`/projects/${timer.project_id}`}
            className="block truncate text-sm font-semibold"
          >
            {label}
          </Link>
          <p className="tabular text-xs text-muted">
            {pomodoro ? (
              <>
                {pomodoro.phase === 'focus' ? '🍅 Focus' : '☕ Break'}{' '}
                {formatDuration(pomodoro.remaining)}
                {pomodoro.completed > 0 && ` · ${pomodoro.completed} done`}
              </>
            ) : (
              formatDuration(elapsed)
            )}
          </p>
        </div>
        <Button
          variant="ghost"
          className="shrink-0 px-3 py-2 text-sm"
          disabled={stop.isPending}
          onClick={() => stop.mutate()}
        >
          Stop
        </Button>
      </div>
    </div>
  )
}
