import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { onPageWake } from '../../lib/pageWake'
import { formatDuration, pomodoroPhase } from './pomodoro'
import { useRunningTimer, useStopTimer } from './queries'
import { timerBarSeconds } from './totals'

/**
 * The running clock, pinned above the tab bar so it is visible from every screen. Elapsed
 * time is derived from started_at on every tick, so a sleeping tab cannot drift.
 *
 * Two clocks, nested: the project on top — everything it has banked plus the session running
 * now — and under it the task, counting this session alone. A timer on the project itself has
 * no second clock, so the second line is dropped unless a pomodoro needs it for its phase.
 */
export function TimerBar() {
  const running = useRunningTimer()
  const stop = useStopTimer()
  const [now, setNow] = useState(() => Date.now())

  const timer = running.data
  useEffect(() => {
    if (!timer) return
    const tick = () => setNow(Date.now())
    const id = setInterval(tick, 1000)
    // The interval alone is not enough: a backgrounded tab has it throttled to about once
    // a minute, and iOS suspends it entirely, so on return the clock reads whatever it
    // read when the user left until the next tick lands. Recompute on the way back in.
    const off = onPageWake(tick)
    return () => {
      clearInterval(id)
      off()
    }
  }, [timer])

  if (!timer) return null

  const elapsed = Math.floor((now - new Date(timer.started_at).getTime()) / 1000)
  const pomodoro = timer.mode === 'pomodoro' ? pomodoroPhase(elapsed) : null
  const seconds = timerBarSeconds(timer, elapsed)

  return (
    <div className="fixed inset-x-0 bottom-[72px] z-20 px-4 md:bottom-4 md:left-auto md:right-4 md:w-80 md:px-0">
      <div className="mx-auto flex max-w-md items-center gap-3 rounded-card bg-surface p-3 shadow-quest">
        <span
          aria-hidden
          className="h-8 w-1.5 shrink-0 rounded-full border border-ink/55"
          style={{ backgroundColor: timer.area_color ?? 'rgb(var(--accent))' }}
        />
        {/* Each line is a name that truncates and a clock that does not: `min-w-0` lets the
            name give way, `shrink-0` keeps the digits whole. Two lines of `text-sm` + `text-xs`
            is the height the bar already had, so it sits where it sat above the tab bar. */}
        <div className="min-w-0 flex-1">
          <p className="flex items-baseline gap-2 text-sm font-semibold">
            <Link to={`/projects/${timer.project_id}`} className="min-w-0 flex-1 truncate">
              {timer.project_title}
            </Link>
            <span className="tabular shrink-0">
              {formatDuration(seconds.project)}
              <span className="sr-only"> on this project in total</span>
            </span>
          </p>
          {(seconds.task !== null || pomodoro) && (
            <p className="flex items-baseline gap-2 text-xs text-muted">
              {seconds.task !== null && (
                <span className="min-w-0 flex-1 truncate">{timer.task_title}</span>
              )}
              <span className="tabular shrink-0">
                {pomodoro ? (
                  <>
                    {pomodoro.phase === 'focus' ? '🍅 Focus' : '☕ Break'}{' '}
                    {formatDuration(pomodoro.remaining)}
                    {pomodoro.completed > 0 && ` · ${pomodoro.completed} done`}
                  </>
                ) : (
                  <>
                    {formatDuration(elapsed)}
                    <span className="sr-only"> this session</span>
                  </>
                )}
              </span>
            </p>
          )}
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
