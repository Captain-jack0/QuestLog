import { useEffect, useState, type MouseEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { BottomSheet } from '../../components/ui/BottomSheet'
import { Button } from '../../components/ui/Button'
import { onPageWake } from '../../lib/pageWake'
import type { AwaitingPomodoro } from './autoStop'
import { formatDuration, pomodoroPhase } from './pomodoro'
import { useRunningTimer, useStopTimer, useTimerSafetyNet, type RunningTimer } from './queries'
import { timerDeck } from './stack'
import { timerBarSeconds } from './totals'

/**
 * The running clocks, pinned above the tab bar so they are visible from every screen. Elapsed
 * time is derived from started_at on every tick, so a sleeping tab cannot drift.
 *
 * Up to three clocks run at once (issue #45). Closed, they sit as a deck: the newest whole on
 * top, the others as edges peeking out above it, and a "+N" badge — one card tall, so the tab
 * bar stays clear. A tap on the deck opens it into a list where every card has its own Stop;
 * another tap closes it.
 */
export function TimerBar() {
  const running = useRunningTimer()
  const stop = useStopTimer()
  const safetyNet = useTimerSafetyNet(running.data ?? [])
  const [now, setNow] = useState(() => Date.now())
  const [open, setOpen] = useState(false)

  const { cards, hidden } = timerDeck(running.data ?? [])
  const ticking = cards.length > 0
  useEffect(() => {
    if (!ticking) return
    const tick = () => setNow(Date.now())
    const id = setInterval(tick, 1000)
    // The interval alone is not enough: a backgrounded tab has it throttled to about once
    // a minute, and iOS suspends it entirely, so on return the clock reads whatever it
    // read when the user left until the next tick lands. Recompute on the way back in —
    // one `now` for every card, so they all catch up together.
    const off = onPageWake(tick)
    return () => {
      clearInterval(id)
      off()
    }
  }, [ticking])

  // Down to one clock, the deck is shut for good: the next clock to start must land on a
  // closed deck, not reopen a list nobody asked for.
  useEffect(() => {
    if (hidden === 0) setOpen(false)
  }, [hidden])

  // The awaiting pomodoro is off v_running_timers, so it may be the only clock: ask either way.
  const awaiting = safetyNet.awaiting
  const question = awaiting && (
    <PomodoroQuestion
      key={awaiting.id}
      pomodoro={awaiting}
      busy={safetyNet.answering}
      onAnswer={(continued) => safetyNet.answer(awaiting.id, continued)}
    />
  )

  if (!ticking) return question || null

  const expanded = open && hidden > 0
  const toggle = () => setOpen((o) => !o)
  // The card's own link and Stop keep their meaning; a tap anywhere else on it is a tap on the
  // deck. Keyboard users have the badge, a real button.
  const onDeckClick = (e: MouseEvent) => {
    if (hidden > 0 && !(e.target as Element).closest('a, button')) toggle()
  }
  const card = (timer: RunningTimer, badge?: ReactNode) => (
    <TimerCard
      timer={timer}
      now={now}
      stopping={stop.isPending && stop.variables === timer.id}
      onStop={() => stop.mutate(timer.id)}
      onClick={onDeckClick}
      badge={badge}
    />
  )
  const badge = hidden > 0 && (
    <button
      type="button"
      aria-expanded={expanded}
      aria-label={expanded ? 'Stack the timers' : `Show all ${cards.length} timers`}
      onClick={toggle}
      className="absolute -right-2 -top-2 min-h-[24px] min-w-[24px] rounded-full border border-ink/55 bg-accent px-1.5 text-caption font-semibold text-paper"
    >
      {expanded ? '−' : `+${hidden}`}
    </button>
  )

  return (
    <>
      {question}
      <section
        aria-label="Running timers"
        className="fixed inset-x-0 bottom-[72px] z-20 px-4 md:bottom-4 md:left-auto md:right-4 md:w-80 md:px-0"
      >
        {expanded ? (
          <ul className="mx-auto flex max-w-md flex-col gap-2">
            {cards.map((timer, i) => (
              <li key={timer.id}>{card(timer, i === 0 && badge)}</li>
            ))}
          </ul>
        ) : (
          <div className="relative mx-auto max-w-md">
            {/* Farthest edge first, so the nearer one paints over it. Each sits a few px higher
              and a little narrower than the card in front. */}
            {cards
              .slice(1)
              .map((timer, i) => (
                <div
                  key={timer.id}
                  aria-hidden
                  onClick={toggle}
                  className="absolute inset-0 rounded-card border border-line bg-surface shadow-quest"
                  style={{
                    transform: `translateY(-${(i + 1) * 5}px) scale(${1 - (i + 1) * 0.04})`,
                  }}
                />
              ))
              .reverse()}
            {card(cards[0], badge)}
          </div>
        )}
      </section>
    </>
  )
}

/**
 * "Did your pomodoro keep going?" — asked on return about a pomodoro whose beats stopped, a
 * locked phone being the usual reason (issue #48, decision D). It has to be answered: Escape and
 * the backdrop do nothing, and the sheet's focus trap keeps the keyboard on the two buttons.
 */
function PomodoroQuestion({
  pomodoro,
  busy,
  onAnswer,
}: {
  pomodoro: AwaitingPomodoro
  busy: boolean
  onAnswer: (continued: boolean) => void
}) {
  const lastSeen = new Date(pomodoro.last_seen_at).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
  const name = pomodoro.task_title ?? pomodoro.project_title

  return (
    <BottomSheet open onClose={() => {}} title="Did your pomodoro keep going?">
      <p className="mb-4 text-body text-muted">
        {name ? `🍅 ${name} — ` : '🍅 '}the app lost sight of it at {lastSeen}, likely when the
        screen locked.
      </p>
      <div className="flex flex-col gap-2">
        <Button block disabled={busy} onClick={() => onAnswer(true)}>
          Yes, it kept going
        </Button>
        <Button variant="ghost" block disabled={busy} onClick={() => onAnswer(false)}>
          No, end it at {lastSeen}
        </Button>
      </div>
    </BottomSheet>
  )
}

interface TimerCardProps {
  timer: RunningTimer
  now: number
  stopping: boolean
  onStop: () => void
  onClick: (e: MouseEvent) => void
  badge?: ReactNode
}

/**
 * One clock. Two lines, nested: the project on top — everything it has banked plus the session
 * running now — and under it the task, counting this session alone. A timer on the project
 * itself has no second clock, so the second line is dropped unless a pomodoro needs it for its
 * phase.
 */
function TimerCard({ timer, now, stopping, onStop, onClick, badge }: TimerCardProps) {
  const elapsed = Math.floor((now - new Date(timer.started_at).getTime()) / 1000)
  const pomodoro = timer.mode === 'pomodoro' ? pomodoroPhase(elapsed) : null
  const seconds = timerBarSeconds(timer, elapsed)

  return (
    <div
      onClick={onClick}
      className="relative flex items-center gap-3 rounded-card bg-surface p-3 shadow-quest"
    >
      <span
        aria-hidden
        className="h-8 w-1.5 shrink-0 rounded-full border border-ink/55"
        style={{ backgroundColor: timer.area_color ?? 'rgb(var(--accent))' }}
      />
      {/* Each line is a name that truncates and a clock that does not: `min-w-0` lets the
          name give way, `shrink-0` keeps the digits whole. Two lines of `text-body` + `text-caption`
          is the height the bar already had, so it sits where it sat above the tab bar. */}
      <div className="min-w-0 flex-1">
        <p className="flex items-baseline gap-2 text-body font-semibold">
          <Link to={`/projects/${timer.project_id}`} className="min-w-0 flex-1 truncate">
            {timer.project_title}
          </Link>
          <span className="tabular shrink-0">
            {formatDuration(seconds.project)}
            <span className="sr-only"> on this project in total</span>
          </span>
        </p>
        {(seconds.task !== null || pomodoro) && (
          <p className="flex items-baseline gap-2 text-caption text-muted">
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
        className="shrink-0 px-3 py-2 text-body"
        disabled={stopping}
        onClick={onStop}
      >
        Stop
      </Button>
      {badge}
    </div>
  )
}
