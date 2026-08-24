import { useState } from 'react'
import { AREAS, HANGING, type PreviewProject, type PreviewTask } from './previewData'

/**
 * What you get after signing in, shown rather than described — and clickable all the way
 * down: Areas → a project list → one project's resume context and tasks. That drill-down is
 * the actual shape of the app, so a visitor can feel the flow before handing over an email.
 * Nothing here talks to the database.
 */

type Tab = 'today' | 'areas' | 'progress'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'today', label: 'Today', icon: 'pi-home' },
  { id: 'areas', label: 'Areas', icon: 'pi-th-large' },
  { id: 'progress', label: 'Progress', icon: 'pi-chart-line' },
]

const STATUS_STYLE: Record<PreviewProject['status'] | PreviewTask['status'], string> = {
  idea: 'bg-line/50 text-muted',
  in_progress: 'bg-accent text-white',
  paused: 'bg-flame/20 text-flame-ink',
  blocked: 'bg-alert/20 text-alert-ink',
  done: 'bg-success/20 text-success-ink',
}

const STATUS_LABEL: Record<string, string> = {
  idea: 'Idea',
  in_progress: 'In progress',
  paused: 'Paused',
  blocked: 'Blocked',
  done: 'Done',
}

function Chip({ status }: { status: keyof typeof STATUS_STYLE }) {
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  )
}

const WEEKS = [40, 65, 30, 80, 55, 95, 70, 100]

export function AppPreview() {
  const [tab, setTab] = useState<Tab>('today')
  const [areaId, setAreaId] = useState<string | null>(null)
  const [projectId, setProjectId] = useState<string | null>(null)
  const [done, setDone] = useState<string[]>([])

  const area = AREAS.find((a) => a.id === areaId) ?? null
  const project = area?.projects.find((p) => p.id === projectId) ?? null

  function openTab(next: Tab) {
    setTab(next)
    setAreaId(null)
    setProjectId(null)
  }

  const toggle = (title: string) =>
    setDone((current) =>
      current.includes(title) ? current.filter((t) => t !== title) : [...current, title],
    )

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-quest">
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
              onClick={() => openTab(item.id)}
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

        <div className="min-h-[380px] flex-1 p-4 sm:p-5">
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
                {HANGING.slice(0, 2).map((thread) => (
                  <button
                    key={thread.id}
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
                {HANGING.slice(0, 3).map((thread) => (
                  <div key={thread.id} className="rounded-xl border border-line p-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium leading-tight">{thread.title}</span>
                      <span className="shrink-0 text-xs text-muted">{thread.waited}</span>
                    </div>
                    <p className="text-xs text-muted">{thread.areaName}</p>
                    <p className="mt-2 text-sm">
                      <span className="text-muted">Next: </span>
                      {thread.nextStep}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'areas' && !area && (
            <div>
              <h3 className="mb-1 text-lg font-semibold">Areas</h3>
              <p className="mb-4 text-xs text-muted">Open one to see its projects.</p>
              <div className="grid grid-cols-2 gap-3">
                {AREAS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setAreaId(item.id)}
                    className="card-hover relative overflow-hidden rounded-xl border border-line p-3 text-left"
                  >
                    <span
                      aria-hidden
                      className="absolute inset-y-0 left-0 w-1"
                      style={{ backgroundColor: item.colour }}
                    />
                    <i className={`pi ${item.icon} text-accent`} aria-hidden />
                    <p className="mt-2 font-semibold leading-tight">{item.name}</p>
                    <p className="text-xs text-muted">
                      {item.projects.length} project{item.projects.length === 1 ? '' : 's'}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {tab === 'areas' && area && !project && (
            <div>
              <button
                type="button"
                onClick={() => setAreaId(null)}
                className="link-quiet -ml-2 mb-3 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-muted"
              >
                <i className="pi pi-arrow-left text-[10px]" aria-hidden />
                Areas
              </button>
              <h3 className="text-lg font-semibold">
                <i className={`pi ${area.icon} mr-2 text-accent`} aria-hidden />
                {area.name}
              </h3>
              <p className="mb-4 text-xs text-muted">Open a project to see where you left off.</p>

              <div className="space-y-2">
                {area.projects.map((item) => {
                  const finished = item.tasks.filter((t) => t.status === 'done').length
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setProjectId(item.id)}
                      className="card-hover block w-full rounded-xl border border-line p-3 text-left"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-medium leading-tight">{item.title}</span>
                        <Chip status={item.status} />
                      </div>
                      <p className="mt-2 text-sm">
                        <span className="text-muted">Next: </span>
                        {item.nextStep}
                      </p>
                      <div className="mt-3 h-1 overflow-hidden rounded-full bg-line/50">
                        <div
                          className="h-full rounded-full bg-accent"
                          style={{ width: `${(finished / item.tasks.length) * 100}%` }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-muted">
                        {finished}/{item.tasks.length} tasks done · waiting {item.waited}
                      </p>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {tab === 'areas' && area && project && (
            <div>
              <button
                type="button"
                onClick={() => setProjectId(null)}
                className="link-quiet -ml-2 mb-3 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-muted"
              >
                <i className="pi pi-arrow-left text-[10px]" aria-hidden />
                {area.name}
              </button>

              <div className="flex flex-wrap items-center gap-2">
                <h3 className="mr-auto text-lg font-semibold leading-tight">{project.title}</h3>
                <Chip status={project.status} />
                <span className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1 text-xs font-semibold text-muted">
                  <i className="pi pi-stopwatch text-[10px]" aria-hidden />
                  25m
                </span>
              </div>

              <div className="mt-4 rounded-xl border border-line p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Where you left off
                </p>
                <p className="mt-1 leading-snug">{project.leftOff}</p>
                <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted">
                  Next step
                </p>
                <p className="mt-1 font-medium leading-snug text-accent">{project.nextStep}</p>
                <p className="mt-3 text-xs text-muted">last touched {project.waited} ago</p>
              </div>

              <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-muted">
                Tasks
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {project.tasks.map((task) => (
                  <div key={task.title} className="rounded-xl border border-line p-3">
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className={`text-sm font-medium leading-tight ${
                          task.status === 'done' ? 'text-muted line-through' : ''
                        }`}
                      >
                        {task.title}
                      </span>
                      <span className="shrink-0 rounded-lg bg-paper px-2 py-0.5 text-[11px] font-semibold text-muted">
                        {task.difficulty}
                      </span>
                    </div>
                    <div className="mt-2">
                      <Chip status={task.status} />
                    </div>
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
