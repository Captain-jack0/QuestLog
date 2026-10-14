import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { Icon } from '../components/ui/Icon'
import { CardSkeleton } from '../components/ui/Skeleton'
import { rowFieldClass } from '../components/ui/field'
import { useShell } from '../components/shellContext'
import { NoThreadsYet, ThreadList } from '../features/threads/ThreadList'
import { ALL_THREADS_LIMIT, useAllThreads, useSettledCount } from '../features/threads/queries'
import { areaChips, contextPreserved, filterThreads } from '../features/threads/threadFilter'
import { formatDuration } from '../features/timer/pomodoro'
import { useRunningTimer } from '../features/timer/queries'
import { timerDeck } from '../features/timer/stack'
import { onPageWake } from '../lib/pageWake'

const PILL = 'min-h-[44px] rounded-full px-3 text-caption font-semibold transition'
const PILL_ON = 'bg-accent/15 text-accent-ink ring-2 ring-accent'
const PILL_OFF = 'border border-line bg-surface-sunken text-muted hover:text-ink'
const SECTION_HEADING = 'text-body font-semibold uppercase tracking-wide text-muted'

/**
 * Every hanging thread on its own page — not Today's oldest 20 — narrowed by area (kept in the
 * URL, so a reload keeps it) and by a search over what each thread says. Beside them: the clocks
 * running now, how many threads have settled, and how many waiting ones still name a next step.
 */
export function ThreadsScreen() {
  const { session } = useAuth()
  const shell = useShell()
  const threads = useAllThreads()
  const settled = useSettledCount(session?.user.id)
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState('')

  const all = threads.data ?? []
  const chips = areaChips(all)
  // A stale or foreign ?area= (the area's last thread settled, an old link) counts as All, so
  // the chips never hide behind a filter nothing can clear.
  const requested = params.get('area')
  const areaId = chips.some((chip) => chip.id === requested) ? requested : null
  const shown = filterThreads(all, areaId, query)
  const context = contextPreserved(all)
  const pickArea = (id: string | null) => setParams(id ? { area: id } : {}, { replace: true })

  return (
    <div>
      <header className="mb-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="text-title-lg font-bold">Threads</h1>
          {all.length > 0 && (
            <span className="rounded-full bg-accent/15 px-3 py-1 text-caption font-semibold text-accent-ink tabular">
              {all.length >= ALL_THREADS_LIMIT ? `${all.length}+` : all.length} to revive
            </span>
          )}
        </div>
        <p className="mt-1 text-lead text-muted">
          Everything you set down waits here with where you left off. Pick one back up when
          you&apos;re ready, or let it go.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="min-w-0">
          {chips.length > 0 && (
            // Toggle buttons, one pressed at a time: each is a native button, so Tab and
            // Enter/Space work with no roving-focus code. Wraps rather than scrolling sideways.
            <div role="group" aria-label="Filter by area" className="mb-3 flex flex-wrap gap-1.5">
              <button
                type="button"
                aria-pressed={areaId === null}
                onClick={() => pickArea(null)}
                className={`${PILL} ${areaId === null ? PILL_ON : PILL_OFF}`}
              >
                <span aria-hidden>#</span>All <span className="tabular">({all.length})</span>
              </button>
              {chips.map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  aria-pressed={areaId === chip.id}
                  onClick={() => pickArea(chip.id)}
                  className={`${PILL} ${areaId === chip.id ? PILL_ON : PILL_OFF}`}
                >
                  <span aria-hidden>#</span>
                  {chip.name} <span className="tabular">({chip.count})</span>
                </button>
              ))}
            </div>
          )}

          <label className="relative mb-6 block">
            <span className="sr-only">Search threads</span>
            <Icon
              name="search"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search titles, next steps, where you left off"
              className={`${rowFieldClass} w-full pl-10`}
            />
          </label>

          <RunningNow />

          <section aria-labelledby="threads-waiting">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <h2 id="threads-waiting" className={SECTION_HEADING}>
                Waiting threads
              </h2>
              <p className="flex items-center gap-1 text-caption text-muted">
                <Icon name="sort" /> Sorted: least recently touched first
              </p>
            </div>
            {threads.isPending && <CardSkeleton rows={2} />}
            {threads.isError && <p className="text-body text-muted">Threads could not load.</p>}
            {threads.data?.length === 0 && <NoThreadsYet />}
            {/* Always mounted: a live region that arrives already filled is often not announced. */}
            <div role="status">
              {all.length > 0 && shown.length === 0 && (
                <EmptyState
                  title="Nothing matches"
                  description="Try another word, or show every area."
                />
              )}
            </div>
            <ThreadList threads={shown} showLeftOff />
          </section>
        </div>

        <div className="space-y-4">
          <section aria-labelledby="threads-ledger">
            <Card>
              <h2 id="threads-ledger" className="text-title-md">
                Zero-guilt ledger
              </h2>
              {settled.data !== undefined && (
                <p className="mt-2 text-body text-muted">
                  <span className="block text-display-sm text-ink tabular">{settled.data}</span>
                  {settled.data === 1 ? 'thread' : 'threads'} settled — finished or let go, no guilt
                </p>
              )}
              {context.percent !== null && (
                <div className="mt-4 border-t border-line pt-4">
                  <h3 className="text-micro uppercase text-muted">Context preserved</h3>
                  <p className="text-display-sm tabular">{context.percent}%</p>
                  <p className="text-caption text-muted">
                    {context.withNext} of {context.total} waiting{' '}
                    {context.total === 1 ? 'thread names' : 'threads name'} a next step
                  </p>
                </div>
              )}
            </Card>
          </section>

          {/* The shell's one capture sheet, as Today's capture bar opens it. Never named
              "Quick add": that is the top bar's button, and e2e matches the name as a substring. */}
          {shell && (
            <button
              type="button"
              onClick={shell.openQuickAdd}
              className="btn-quiet flex min-h-[52px] w-full items-center gap-3 rounded-card border border-line bg-surface-sunken px-4 text-left"
            >
              <Icon name="add" className="icon-xl text-accent-ink" />
              <span className="min-w-0 flex-1 text-body text-muted">Stash a thread</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * The clocks running now, newest first, each counting its own session in the timer bar's
 * format. Nothing at all while none runs.
 */
function RunningNow() {
  const running = useRunningTimer()
  const { cards } = timerDeck(running.data ?? [])
  const [now, setNow] = useState(() => Date.now())

  const ticking = cards.length > 0
  useEffect(() => {
    if (!ticking) return
    const tick = () => setNow(Date.now())
    const id = setInterval(tick, 1000)
    // The same catch-up TimerBar does: a backgrounded tab's interval is throttled.
    const off = onPageWake(tick)
    return () => {
      clearInterval(id)
      off()
    }
  }, [ticking])

  if (!ticking) return null

  return (
    <section aria-labelledby="threads-running" className="mb-6">
      <h2 id="threads-running" className={`mb-2 ${SECTION_HEADING}`}>
        Running now
      </h2>
      <ul className="space-y-2">
        {cards.map((timer) => {
          const name = timer.task_title ?? timer.project_title
          const elapsed = Math.floor((now - new Date(timer.started_at).getTime()) / 1000)
          return (
            <li key={timer.id}>
              <Card edgeColor={timer.area_color} className="flex items-center gap-3 pl-5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-lead font-semibold">{name}</p>
                  {timer.task_title && (
                    <p className="truncate text-caption text-muted">{timer.project_title}</p>
                  )}
                </div>
                <span className="shrink-0 text-right">
                  <span className="block text-lead text-accent-ink tabular">
                    {formatDuration(elapsed)}
                  </span>
                  <span className="block text-caption text-muted">this session</span>
                </span>
                <Link
                  to={`/projects/${timer.project_id}`}
                  className="inline-flex min-h-[44px] shrink-0 items-center gap-1 font-semibold text-accent-ink"
                >
                  View<span className="sr-only"> {name}</span>
                  <Icon name="arrow_forward" />
                </Link>
              </Card>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
