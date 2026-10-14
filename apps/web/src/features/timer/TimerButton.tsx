import { Button } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'
import { useToast } from '../../components/ui/Toast'
import { useRunningTimer, useStartTimer, useStopTimer } from './queries'
import { atTimerLimit, runningOn, TIMER_LIMIT_REASON } from './stack'

interface TimerButtonProps {
  itemType: 'task' | 'project'
  itemId: string
  title: string
  /** Offers the 25/5 pomodoro alongside the open-ended timer. */
  withPomodoro?: boolean
  /**
   * The resume box's start: the pomodoro alone, as the screen's one filled button and named for
   * what it says ("Start 25m focus on X" contains its visible text). Draws nothing while this
   * item's clock runs — its Stop is the plain timer's, and two Stops for one clock would be two
   * controls with one name.
   */
  focus?: boolean
  disabled?: boolean
}

/** Start/stop for one item. Shows Stop when this very item is one of the clocks running. */
export function TimerButton({
  itemType,
  itemId,
  title,
  withPomodoro = false,
  focus = false,
  disabled,
}: TimerButtonProps) {
  const running = useRunningTimer()
  const start = useStartTimer()
  const stop = useStopTimer()
  const toast = useToast()

  const timers = running.data ?? []
  const thisOne = runningOn(timers, itemType, itemId)

  const busy = start.isPending || stop.isPending
  // `aria-disabled`, not `disabled`: a disabled button swallows the tap, and on a phone there is
  // no hover to show the title — the tap has to reach us so the toast can say why.
  const full = atTimerLimit(timers)
  const begin = (mode?: 'pomodoro') =>
    full ? toast(TIMER_LIMIT_REASON) : start.mutate({ itemType, itemId, mode })

  if (focus) {
    if (thisOne) return null
    return (
      <Button
        type="button"
        aria-label={`Start 25m focus on ${title}`}
        disabled={busy || disabled}
        aria-disabled={full || undefined}
        title={full ? TIMER_LIMIT_REASON : undefined}
        onClick={() => begin('pomodoro')}
        className="aria-disabled:opacity-40"
      >
        <Icon name="play_arrow" /> Start 25m focus
      </Button>
    )
  }

  if (thisOne) {
    return (
      <button
        type="button"
        aria-label={`Stop the timer on ${title}`}
        disabled={busy}
        onClick={() => stop.mutate(thisOne.id)}
        className="btn-primary min-h-[44px] shrink-0 rounded-full border border-accent px-3 text-caption font-semibold disabled:opacity-50"
      >
        <Icon name="stop" /> Stop
      </button>
    )
  }

  return (
    <span className="flex shrink-0 gap-1">
      <button
        type="button"
        aria-label={`Start a timer on ${title}`}
        disabled={busy || disabled}
        aria-disabled={full || undefined}
        title={full ? TIMER_LIMIT_REASON : undefined}
        onClick={() => begin()}
        className="min-h-[44px] rounded-full bg-paper px-3 text-caption font-semibold text-muted hover:bg-line/40 disabled:opacity-40 aria-disabled:opacity-40"
      >
        <Icon name="play_arrow" /> Timer
      </button>
      {withPomodoro && (
        <button
          type="button"
          aria-label={`Start a pomodoro on ${title}`}
          disabled={busy || disabled}
          aria-disabled={full || undefined}
          title={full ? TIMER_LIMIT_REASON : undefined}
          onClick={() => begin('pomodoro')}
          className="min-h-[44px] rounded-full bg-paper px-3 text-caption font-semibold text-muted hover:bg-line/40 disabled:opacity-40 aria-disabled:opacity-40"
        >
          🍅 25m
        </button>
      )}
    </span>
  )
}
