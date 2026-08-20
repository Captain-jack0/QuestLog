import { useRunningTimer, useStartTimer, useStopTimer } from './queries'

interface TimerButtonProps {
  itemType: 'task' | 'project'
  itemId: string
  title: string
  /** Offers the 25/5 pomodoro alongside the open-ended timer. */
  withPomodoro?: boolean
  disabled?: boolean
}

/** Start/stop for one item. Shows Stop when this very item is the one running. */
export function TimerButton({
  itemType,
  itemId,
  title,
  withPomodoro = false,
  disabled,
}: TimerButtonProps) {
  const running = useRunningTimer()
  const start = useStartTimer()
  const stop = useStopTimer()

  const current = running.data
  const isThisOne =
    current !== null &&
    current !== undefined &&
    (itemType === 'task'
      ? current.task_id === itemId
      : current.project_id === itemId && !current.task_id)

  const busy = start.isPending || stop.isPending

  if (isThisOne) {
    return (
      <button
        type="button"
        aria-label={`Stop the timer on ${title}`}
        disabled={busy}
        onClick={() => stop.mutate()}
        className="min-h-[36px] shrink-0 rounded-full bg-accent px-3 text-xs font-semibold text-white disabled:opacity-50"
      >
        ⏹ Stop
      </button>
    )
  }

  return (
    <span className="flex shrink-0 gap-1">
      <button
        type="button"
        aria-label={`Start a timer on ${title}`}
        disabled={busy || disabled}
        onClick={() => start.mutate({ itemType, itemId })}
        className="min-h-[36px] rounded-full bg-paper px-3 text-xs font-semibold text-muted hover:bg-line/40 disabled:opacity-40"
      >
        ▶ Timer
      </button>
      {withPomodoro && (
        <button
          type="button"
          aria-label={`Start a pomodoro on ${title}`}
          disabled={busy || disabled}
          onClick={() => start.mutate({ itemType, itemId, mode: 'pomodoro' })}
          className="min-h-[36px] rounded-full bg-paper px-3 text-xs font-semibold text-muted hover:bg-line/40 disabled:opacity-40"
        >
          🍅 25m
        </button>
      )}
    </span>
  )
}
