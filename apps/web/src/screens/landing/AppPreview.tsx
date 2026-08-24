import { useState } from 'react'

/**
 * What you get after signing in, shown rather than described. The tabs really switch and
 * the focus items really tick off — a visitor can poke at the product before deciding to
 * hand over an email address. It is a mock: nothing here talks to the database.
 */

type Tab = 'today' | 'areas' | 'progress'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'today', label: 'Today', icon: 'pi-home' },
  { id: 'areas', label: 'Areas', icon: 'pi-th-large' },
  { id: 'progress', label: 'Progress', icon: 'pi-chart-line' },
]

const THREADS = [
  {
    title: 'Rewrite the onboarding email',
    context: 'Work · Lifecycle emails',
    next: 'Cut the second paragraph, then send to Ada',
    waited: '6 days',
  },
  {
    title: 'Tax folder',
    context: 'Home · Admin',
    next: 'Photograph the last two receipts',
    waited: '11 days',
  },
  {
    title: 'Chapter 3 — the middle section',
    context: 'Writing · Novel',
    next: 'Decide whether Mira leaves before the storm',
    waited: '3 weeks',
  },
]

const AREAS = [
  { name: 'Work', icon: 'pi-briefcase', open: 4, colour: 'rgb(76 141 255)' },
  { name: 'Home', icon: 'pi-home', open: 2, colour: 'rgb(62 213 152)' },
  { name: 'Writing', icon: 'pi-pencil', open: 3, colour: 'rgb(255 168 76)' },
  { name: 'Learning', icon: 'pi-book', open: 1, colour: 'rgb(168 132 255)' },
]

const WEEKS = [40, 65, 30, 80, 55, 95, 70, 100]

export function AppPreview() {
  const [tab, setTab] = useState<Tab>('today')
  const [done, setDone] = useState<string[]>([])

  const toggle = (title: string) =>
    setDone((current) =>
      current.includes(title) ? current.filter((t) => t !== title) : [...current, title],
    )

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-quest">
      {/* window chrome, so it reads as a screen and not as page content */}
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <span className="flex gap-1.5" aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full bg-line" />
          <span className="h-2.5 w-2.5 rounded-full bg-line" />
          <span className="h-2.5 w-2.5 rounded-full bg-line" />
        </span>
        <span className="ml-2 truncate text-xs text-muted">quest.captainmery.com</span>
      </div>

      <div className="flex flex-col sm:flex-row">
        <nav
          aria-label="Preview navigation"
          className="flex shrink-0 gap-1 border-b border-line p-2 sm:w-40 sm:flex-col sm:border-b-0 sm:border-r sm:p-3"
        >
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              aria-pressed={tab === item.id}
              className={`link-quiet flex flex-1 items-center gap-2 rounded-lg px-3 py-2 text-sm transition sm:flex-none ${
                tab === item.id ? 'bg-accent/12 font-semibold text-accent' : 'text-muted'
              }`}
            >
              <i className={`pi ${item.icon} text-xs`} aria-hidden />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="min-h-[320px] flex-1 p-4 sm:p-5">
          {tab === 'today' && (
            <div>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <h3 className="mr-auto text-lg font-semibold">Welcome back, Captain</h3>
                <span className="rounded-full bg-flame/15 px-3 py-1 text-xs font-semibold text-flame-ink">
                  <i className="pi pi-bolt mr-1 text-[10px]" aria-hidden />
                  12-day streak
                </span>
                <span className="rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold text-accent">
                  <i className="pi pi-star-fill mr-1 text-[10px]" aria-hidden />
                  48 XP today
                </span>
              </div>

              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                Today&apos;s focus — tap to tick off
              </p>
              <div className="mb-5 space-y-2">
                {THREADS.slice(0, 2).map((thread) => (
                  <button
                    key={thread.title}
                    type="button"
                    onClick={() => toggle(thread.title)}
                    className="card-hover flex w-full items-center gap-3 rounded-xl border border-line px-3 py-2 text-left"
                  >
                    <i
                      className={`pi ${
                        done.includes(thread.title)
                          ? 'pi-check-circle text-success'
                          : 'pi-circle text-muted'
                      }`}
                      aria-hidden
                    />
                    <span
                      className={
                        done.includes(thread.title) ? 'text-muted line-through' : 'font-medium'
                      }
                    >
                      {thread.title}
                    </span>
                  </button>
                ))}
              </div>

              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                Hanging threads
              </p>
              <div className="space-y-2">
                {THREADS.map((thread) => (
                  <div key={thread.title} className="rounded-xl border border-line p-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium leading-tight">{thread.title}</span>
                      <span className="shrink-0 text-xs text-muted">{thread.waited}</span>
                    </div>
                    <p className="text-xs text-muted">{thread.context}</p>
                    <p className="mt-2 text-sm">
                      <span className="text-muted">Next: </span>
                      {thread.next}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'areas' && (
            <div>
              <h3 className="mb-4 text-lg font-semibold">Areas</h3>
              <div className="grid grid-cols-2 gap-3">
                {AREAS.map((area) => (
                  <div
                    key={area.name}
                    className="card-hover relative overflow-hidden rounded-xl border border-line p-3"
                  >
                    <span
                      aria-hidden
                      className="absolute inset-y-0 left-0 w-1"
                      style={{ backgroundColor: area.colour }}
                    />
                    <i className={`pi ${area.icon} text-accent`} aria-hidden />
                    <p className="mt-2 font-semibold leading-tight">{area.name}</p>
                    <p className="text-xs text-muted">{area.open} open</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'progress' && (
            <div>
              <h3 className="mb-4 text-lg font-semibold">Progress</h3>
              <div className="mb-5 rounded-xl border border-line p-4">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-xs text-muted">Level</p>
                    <p className="text-3xl font-bold leading-none">7</p>
                  </div>
                  <p className="text-xs text-muted">1 852 / 2 263 XP</p>
                </div>
                <div className="mt-3 h-1 overflow-hidden rounded-full bg-line/50">
                  <div className="h-full w-[72%] rounded-full bg-accent" />
                </div>
              </div>

              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                XP per week
              </p>
              <div className="flex h-24 items-end gap-1.5">
                {WEEKS.map((height, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-t bg-accent/80"
                    style={{ height: `${height}%` }}
                  />
                ))}
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {['First Quest', 'Threadkeeper', 'Week One'].map((badge) => (
                  <span
                    key={badge}
                    className="rounded-full border border-line px-3 py-1 text-xs font-semibold"
                  >
                    <i className="pi pi-verified mr-1 text-[10px] text-success" aria-hidden />
                    {badge}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
