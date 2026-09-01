import { useState } from 'react'
import { NAV_ITEMS } from '../../components/navigation'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { StatusChip } from '../../components/ui/StatusChip'
import { taskProgress } from '../../features/tasks/taskOrder'
import { OPEN_STATUSES } from '../../lib/schemas'
import { AREAS, HANGING, type PreviewTask } from './previewData'

/**
 * What you get after signing in, shown rather than described — and clickable all the way
 * down: Areas → a project list → one project's resume context and tasks. That drill-down is
 * the actual shape of the app, so a visitor can feel the flow before handing over an email.
 * Nothing here talks to the database.
 *
 * Status chips, the task meter and the tab icons are the app's own components, not lookalikes:
 * a copy here would drift the moment the real ones change, and the preview claims to be the
 * real thing. The frame around them (bordered panels rather than filled cards) stays in the
 * landing page's visual language.
 */

/** The app's real tabs, minus Settings — the preview has no settings screen to show. */
const TABS = NAV_ITEMS.filter((item) => item.to !== '/settings')

const WEEKS = [40, 65, 30, 80, 55, 95, 70, 100]

/**
 * `OPEN_STATUSES` rather than `status !== 'done'`: the real split is the complement of that
 * list (taskOrder.ts:33), so borrowing it keeps the preview honest if the list ever changes —
 * the same reason the chips and the meter here are the app's own components.
 */
const isOpen = (task: PreviewTask) => OPEN_STATUSES.includes(task.status)

/** The strike-through is the real one (TaskItem.tsx:89), kept for the closed bucket. */
function taskCard(task: PreviewTask) {
  return (
    <div key={task.title} className="rounded-xl border border-line p-3">
      <div className="flex items-start justify-between gap-2">
        <span
          className={`text-sm font-medium leading-tight ${
            task.status === 'done' ? 'text-muted line-through' : ''
          }`}
        >
          {task.title}
        </span>
        <span className="shrink-0 rounded-lg bg-paper px-2 py-0.5 text-2xs font-semibold text-muted">
          {task.difficulty}
        </span>
      </div>
      <div className="mt-2">
        <StatusChip status={task.status} />
      </div>
    </div>
  )
}

export function AppPreview() {
  const [tab, setTab] = useState('/')
  const [areaId, setAreaId] = useState<string | null>(null)
  const [projectId, setProjectId] = useState<string | null>(null)
  const [done, setDone] = useState<string[]>([])

  const area = AREAS.find((a) => a.id === areaId) ?? null
  const project = area?.projects.find((p) => p.id === projectId) ?? null
  const openTasks = project?.tasks.filter(isOpen) ?? []
  const closedTasks = project?.tasks.filter((task) => !isOpen(task)) ?? []
  // The whole task list, not `openTasks`: the real bar reports the project rather than the
  // current view (taskOrder.ts:83), so the work folded into Closed still counts here.
  const progress = taskProgress(project?.tasks ?? [])

  function openTab(next: string) {
    setTab(next)
    setAreaId(null)
    setProjectId(null)
  }

  const toggle = (title: string) =>
    setDone((current) =>
      current.includes(title) ? current.filter((t) => t !== title) : [...current, title],
    )

  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface shadow-quest">
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
              key={item.to}
              type="button"
              onClick={() => openTab(item.to)}
              aria-pressed={tab === item.to}
              className={`link-quiet flex flex-1 items-center gap-2 rounded-lg px-3 py-2 text-sm transition sm:flex-none ${
                tab === item.to ? 'bg-accent/10 font-semibold text-accent' : 'text-muted'
              }`}
            >
              <span className="text-base leading-none" aria-hidden>
                {item.icon}
              </span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="min-h-[380px] flex-1 p-4 sm:p-5">
          {tab === '/' && (
            <div>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <h3 className="mr-auto text-lg font-semibold">Welcome back, Captain</h3>
                <span className="rounded-full bg-flame/10 px-3 py-1 text-xs font-semibold text-flame-ink">
                  <i className="pi pi-bolt mr-1 text-3xs" aria-hidden />
                  12-day streak
                </span>
                <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
                  <i className="pi pi-star-fill mr-1 text-3xs" aria-hidden />
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

          {tab === '/areas' && !area && (
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

          {tab === '/areas' && area && !project && (
            <div>
              <button
                type="button"
                onClick={() => setAreaId(null)}
                className="link-quiet -ml-2 mb-3 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-muted"
              >
                <i className="pi pi-arrow-left text-3xs" aria-hidden />
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
                        <StatusChip status={item.status} />
                      </div>
                      <p className="mt-2 text-sm">
                        <span className="text-muted">Next: </span>
                        {item.nextStep}
                      </p>
                      <div className="mt-3">
                        <ProgressBar done={finished} total={item.tasks.length} />
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

          {tab === '/areas' && area && project && (
            <div>
              <button
                type="button"
                onClick={() => setProjectId(null)}
                className="link-quiet -ml-2 mb-3 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-muted"
              >
                <i className="pi pi-arrow-left text-3xs" aria-hidden />
                {area.name}
              </button>

              <div className="flex flex-wrap items-center gap-2">
                <h3 className="mr-auto text-lg font-semibold leading-tight">{project.title}</h3>
                <StatusChip status={project.status} />
                <span className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1 text-xs font-semibold text-muted">
                  <i className="pi pi-stopwatch text-3xs" aria-hidden />
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

              {/* The meter the real screen puts over its task list (ProjectDetail.tsx:242) —
                  its own ProgressBar and its own "N/M done" sentence, so the preview claims a
                  number the app would actually show. Only the label keeps the preview's
                  smaller type scale, matching the section headings around it. */}
              <div className="mb-2 mt-4 flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Tasks</p>
                <span className="text-xs text-muted">
                  {progress.done}/{progress.total} done
                </span>
              </div>
              <div className="mb-3">
                <ProgressBar done={progress.done} total={progress.total} />
              </div>

              <div className="grid gap-2 sm:grid-cols-2">{openTasks.map(taskCard)}</div>

              {/* Finished work leaves the list here too, exactly as it does in the real screen
                  (ProjectDetail.tsx:341) — inline strike-throughs stopped being what you sign in
                  to. Closed by default, matching `showCompleted: false` (listPrefs.ts:23). The
                  summary keeps the preview's own type scale; only the behaviour is borrowed. */}
              {closedTasks.length > 0 && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-muted">
                    Closed ({closedTasks.length})
                  </summary>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">{closedTasks.map(taskCard)}</div>
                </details>
              )}
            </div>
          )}

          {tab === '/progress' && (
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
                {/* Not ProgressBar: that one labels itself "N of M tasks done", which is the
                    wrong sentence for an XP meter. Kept as decoration and hidden from readers. */}
                <div className="mt-3 h-1 overflow-hidden rounded-full bg-line/50" aria-hidden>
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
                    <i className="pi pi-verified mr-1 text-3xs text-success" aria-hidden />
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
