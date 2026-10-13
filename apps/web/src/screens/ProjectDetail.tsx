import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Card } from '../components/ui/Card'
import { CardSkeleton } from '../components/ui/Skeleton'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { Icon } from '../components/ui/Icon'
import { StatusChip } from '../components/ui/StatusChip'
import { StatusPicker } from '../components/ui/StatusPicker'
import { PickerSheet } from '../components/ui/PickerSheet'
import { PriorityBadge } from '../components/ui/PriorityBadge'
import { ProgressBar } from '../components/ui/ProgressBar'
import { useToast } from '../components/ui/Toast'
import { compactFieldClass, rowFieldClass } from '../components/ui/field'
import { useAuth } from '../auth/AuthProvider'
import { useArea, useAreas } from '../features/areas/queries'
import { useProfile, useProjectXp, useProjectXpEvents } from '../features/gamification/queries'
import { HistoryTimeline } from '../features/projects/HistoryTimeline'
import { ProjectSheet } from '../features/projects/ProjectSheet'
import { HISTORY_LIMIT, projectTimeline } from '../features/projects/timeline'
import {
  useMoveProject,
  useProgressLogs,
  useProject,
  useProjectOptions,
  useUpdateProject,
} from '../features/projects/queries'
import { useCreateTask, useMoveTask, useTasks, useUpdateTask } from '../features/tasks/queries'
import { TaskItem } from '../features/tasks/TaskItem'
import { TaskListControls } from '../features/tasks/TaskListControls'
import { TaskSheet } from '../features/tasks/TaskSheet'
import {
  clearedFilters,
  savePrefs,
  storedPrefs,
  type TaskListPrefs,
} from '../features/tasks/listPrefs'
import { partitionTasks, taskProgress } from '../features/tasks/taskOrder'
import { UpdateStatusSheet, type PendingStatusChange } from '../features/status/UpdateStatusSheet'
import { ResumeCard } from '../features/status/ResumeCard'
import { needsResumeContext } from '../features/status/statusChange'
import { useUpdateStatus } from '../features/status/useUpdateStatus'
import { isOptimistic } from '../lib/optimistic'
import { formatDateKey } from '../lib/time'
import { formatMinutes } from '../features/timer/pomodoro'
import { TimerButton } from '../features/timer/TimerButton'
import { useProjectSessions, useProjectTotals, useTaskTotals } from '../features/timer/queries'
import {
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  PRIORITIES,
  PRIORITY_LABELS,
  type Difficulty,
  type ItemStatus,
  type Priority,
  type Task,
} from '../lib/schemas'

/** Micro labels: the task groups and the closed bucket's toggle speak the same small caps. */
const GROUP_CLASS = 'mb-2 text-micro uppercase text-muted'
const SUMMARY_CLASS = 'min-h-[44px] cursor-pointer py-3 text-micro uppercase text-muted'

/**
 * Header chips beside StatusChip — Idea's quiet pair, so the contrast is already tested. Allowed
 * to wrap, unlike a status: an area name runs to 60 characters, wider than a 320px card.
 */
const CHIP_CLASS =
  'inline-flex max-w-full items-center gap-1.5 break-words rounded-full bg-line/30 px-2 py-0.5 text-micro text-muted'

export function ProjectDetailScreen() {
  const { projectId = '' } = useParams()
  const { session } = useAuth()
  const toast = useToast()

  const project = useProject(projectId)
  const area = useArea(project.data?.area_id ?? undefined)
  const tasks = useTasks(projectId)
  const logs = useProgressLogs(projectId)
  // The unfiltered list: a task hidden behind a filter costs nothing here, and re-querying
  // every time the filter chips move would be a refetch per keystroke. The optimistic row is
  // dropped — its fake id is not a uuid and Postgres rejects the whole query over it
  // (lib/optimistic.ts:3-7), which would blank every badge on the screen until the insert lands.
  const taskIds = useMemo(
    () => (tasks.data ?? []).map((t) => t.id).filter((id) => !isOptimistic(id)),
    [tasks.data],
  )
  const taskTotals = useTaskTotals(taskIds)
  // Not the sum of the badges above: time clocked on the project itself and on tasks deleted
  // since belongs to the project too, and no task card carries it.
  const focusSeconds = useProjectTotals(projectId ? [projectId] : []).data?.[projectId]

  const updateProject = useUpdateProject(project.data?.area_id ?? '')
  const createTask = useCreateTask(projectId, session?.user.id)
  const updateTask = useUpdateTask(projectId)
  const updateStatus = useUpdateStatus(projectId)
  const areas = useAreas()
  const moveProject = useMoveProject()
  const moveTask = useMoveTask()
  const projectOptions = useProjectOptions()
  const profile = useProfile()

  const [editing, setEditing] = useState(false)
  const [pending, setPending] = useState<PendingStatusChange | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [newDifficulty, setNewDifficulty] = useState<Difficulty>('M')
  // 'med' is the same value useCreateTask falls back to, so touching nothing here still
  // produces the row this form produced before the select existed.
  const [newPriority, setNewPriority] = useState<Priority>('med')
  // The long form of the same add. The quick row stays exactly as it was: this is the second
  // door, not a replacement, so a one-line task still costs one line.
  const [addingTask, setAddingTask] = useState(false)
  const [movingProject, setMovingProject] = useState(false)
  const [movingTask, setMovingTask] = useState<{ id: string; title: string } | null>(null)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  // Hydrated once, on mount: the list should already be in the shape you left it in when it
  // first paints, not reflow into it after an effect.
  const [prefs, setPrefs] = useState<TaskListPrefs>(storedPrefs)

  const latest = logs.data?.[0]
  // Deliberately the unfiltered query data: the bar reports the project, not the current view,
  // so hiding a done task behind a filter must not move it. taskOrder.test.ts guards the count.
  const progress = taskProgress(tasks.data ?? [])
  const earnedXp = useProjectXp(projectId).data ?? 0
  const xpEvents = useProjectXpEvents(projectId)
  const sessions = useProjectSessions(projectId, HISTORY_LIMIT)
  const staleDays = profile.data?.stale_days ?? 14

  const {
    open: openTasks,
    closed: closedTasks,
    hiddenByFilter,
  } = useMemo(
    () => partitionTasks(tasks.data ?? [], prefs, staleDays, Date.now()),
    [tasks.data, prefs, staleDays],
  )

  function changePrefs(next: TaskListPrefs) {
    setPrefs(next)
    savePrefs(next)
  }

  /** Paused/blocked/done need the resume sheet; everything else goes straight to the RPC. */
  function requestStatus(
    itemType: 'task' | 'project',
    itemId: string,
    title: string,
    status: ItemStatus,
  ) {
    if (needsResumeContext(status) || status === 'done') {
      setPending({
        itemType,
        itemId,
        title,
        status,
        leftOff: status === 'done' ? latest?.left_off : '',
        nextStep: status === 'done' ? latest?.next_step : '',
        // Prefilled alongside the text it belongs to: confirming the sheet writes a new log,
        // and without this the task the last one pointed at would quietly not be in it.
        nextStepTaskId: status === 'done' ? latest?.next_step_task_id : null,
        nextStepTaskTitle: status === 'done' ? (latest?.next_step_task?.title ?? null) : null,
      })
      return
    }
    updateStatus.mutate({ itemType, itemId, status, leftOff: '', nextStep: '' })
  }

  /** Rows share one card and its dividers; cards are grid items with a card each. */
  function taskList(items: Task[]) {
    const handlers = (task: Task) => ({
      task,
      onStatusChange: (status: ItemStatus) => requestStatus('task', task.id, task.title, status),
      onUpdate: (fields: { title?: string; description?: string; difficulty?: Difficulty }) =>
        updateTask.mutate({ id: task.id, ...fields }),
      onMove: () => setMovingTask({ id: task.id, title: task.title }),
      onOpen: () => setEditingTask(task),
      focusSeconds: taskTotals.data?.[task.id],
    })

    // `!p-0`, not `p-0`: Card hardcodes `p-4` (Card.tsx:13) and Tailwind emits `.p-4` after
    // `.p-0`, so at equal specificity the plain class lost and this list has been rendering
    // at 16px all along. The list wants none: each row carries its own `px-3 py-2`
    // (TaskItem.tsx:103), so 16px on top of that insets the text 28px, and the dividers are
    // meant to run edge to edge — which is what Card's `overflow-hidden rounded-card` is
    // there to clip. The `!` is the override made visible; a bare `p-0` would be a class
    // that reads as intent and does nothing.
    if (prefs.view === 'row') {
      return (
        <Card className="divide-y divide-line !p-0">
          {items.map((task) => (
            <TaskItem key={task.id} view="row" {...handlers(task)} />
          ))}
        </Card>
      )
    }

    return (
      // Two columns from `lg`, not `sm`: a column split has to wait for the *container*, and
      // the container does not grow at `sm` at all. The shell's column is `max-w-md` until
      // `md` (App.tsx:56), so every viewport from 448px to 767px leaves the same 416px of
      // content. Splitting it at 640px gave 202px columns — 170px inside the card's `p-4`
      // (Card.tsx:13) — and the compact picker needs 218px to stay within two rows. It went
      // to three: the picker block 94px → 144px, on a card that is 190px at its shortest.
      //
      // `md` is the trap, not the fix: the 224px side rail arrives at exactly that breakpoint
      // (SideNav.tsx:10), so 768px yields 480px of content and 202px inside the card — still
      // three rows. `lg` is the first step that pays for a second column: 314px inside, and
      // the picker is back to the two rows a 390px phone gets at 326px inside.
      //
      // `xl:grid-cols-3` stays: 280px inside at 1280px, 323px from 1440px up, two-row picker
      // at both. It can never reach the phone's 326px — three 358px columns want 1098px and
      // the shell caps content at 1088px — but nothing measurably worse happens in those 3px.
      //
      // Measured in headless Chromium against the real Inter face, as StatusPicker.tsx:16-22.
      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {items.map((task) => (
          <TaskItem key={task.id} view="card" {...handlers(task)} />
        ))}
      </div>
    )
  }

  if (project.isPending) return <CardSkeleton rows={3} />
  if (project.isError || !project.data) return <p className="text-alert-ink">Project not found.</p>

  const inProgressTasks = openTasks.filter((task) => task.status === 'in_progress')
  const queuedTasks = openTasks.filter((task) => task.status !== 'in_progress')

  return (
    <div>
      {/* inline-flex, not a bare min-height: min-height does not apply to an inline box, so on
          an <a> the utility alone would have measured the same 17px it was meant to fix. Centred,
          unlike the thread title in Today, because this link stands alone with nothing beside it
          to keep level. From md the top bar's breadcrumb does this job instead. */}
      <Link
        to={`/areas/${project.data.area_id ?? ''}`}
        className="inline-flex min-h-[44px] items-center gap-1 text-body font-medium text-muted md:hidden"
      >
        <Icon name="arrow_back" /> {area.data?.name ?? 'Area'}
      </Link>

      <div className="mt-2 space-y-6">
        {/* One card for what the project *is*: name, chips, the numbers, its status. The resume
            box follows as a card of its own — it is what you came back for, so it gets its own
            boundary rather than a band in here. */}
        <Card>
          <header>
            <div className="flex items-start justify-between gap-3">
              {/* The role alone, no font/leading overrides: with a `md:` role an unprefixed
                  override loses at md+ (lessons/tailwind-rol-onek-tuzagi). */}
              <h1 className="min-w-0 break-words text-title-lg md:text-display-sm">
                {project.data.title}
              </h1>
              <span className="flex shrink-0 gap-2">
                <Button
                  variant="ghost"
                  className="px-3 py-2"
                  onClick={() => setMovingProject(true)}
                >
                  Move
                </Button>
                <Button variant="ghost" className="px-3 py-2" onClick={() => setEditing(true)}>
                  Edit
                </Button>
              </span>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {area.data && (
                <span className={CHIP_CLASS}>
                  <span
                    aria-hidden
                    className="h-2 w-2 rounded-full border border-ink/55"
                    style={{ backgroundColor: area.data.color }}
                  />
                  {area.data.icon} {area.data.name}
                </span>
              )}
              <StatusChip status={project.data.status} />
              <PriorityBadge priority={project.data.priority} />
              {project.data.target_date && (
                <span className={CHIP_CLASS}>
                  <Icon name="calendar_today" /> Due {formatDateKey(project.data.target_date)}
                </span>
              )}
            </div>

            {project.data.description && (
              <p className="mt-3 text-body text-muted">{project.data.description}</p>
            )}

            {/* The project's numbers, from the unfiltered task list and the timer totals. The
                "N/M done" wording stays as it was: smoke.spec.ts reads it. */}
            {(progress.total > 0 || Boolean(focusSeconds) || earnedXp > 0) && (
              <div className="mt-4">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-caption text-muted">
                  {progress.total > 0 && (
                    <span>
                      {progress.done}/{progress.total} done
                    </span>
                  )}
                  <span className="flex flex-wrap gap-x-3">
                    {earnedXp > 0 && (
                      <span>
                        <span aria-hidden>
                          <Icon name="stars" /> {earnedXp} XP
                        </span>
                        <span className="sr-only">You earned {earnedXp} XP here</span>
                      </span>
                    )}
                    {/* What is banked, in minutes; the live count is TimerBar's job, so this
                        moves when a timer stops. */}
                    {focusSeconds ? (
                      <span>
                        <span aria-hidden>
                          <Icon name="timer" /> {formatMinutes(focusSeconds)}
                        </span>
                        <span className="sr-only">
                          {formatMinutes(focusSeconds)} focused on this project
                        </span>
                      </span>
                    ) : null}
                  </span>
                </div>
                {progress.total > 0 && (
                  <div className="mt-2">
                    <ProgressBar done={progress.done} total={progress.total} />
                  </div>
                )}
              </div>
            )}

            {/* The open-ended timer stays here: it is the only way to time a project that has
                not been cut into tasks yet (docs/02:26). Its 25-minute twin moved to the resume
                box as that box's start, so the pair is not offered twice. */}
            <div className="mt-4">
              <TimerButton itemType="project" itemId={projectId} title={project.data.title} />
            </div>
          </header>

          <div className="mt-4 border-t border-line pt-4">
            <p className="mb-2 text-body font-medium">Project status</p>
            <StatusPicker
              label="Project status"
              value={project.data.status}
              onChange={(status) =>
                requestStatus('project', projectId, project.data!.title, status)
              }
            />
          </div>
        </Card>

        <ResumeCard
          leftOff={latest?.left_off ?? null}
          nextStep={latest?.next_step ?? null}
          loggedAt={latest?.created_at ?? null}
          fromAi={latest?.source === 'ai'}
          saving={updateStatus.isPending}
          edgeColor={area.data?.color}
          focusAction={
            <TimerButton focus itemType="project" itemId={projectId} title={project.data.title} />
          }
          onSave={({ leftOff, nextStep }) =>
            updateStatus.mutate({
              itemType: 'project',
              itemId: projectId,
              // an edit is a progress update, not a status change
              status: project.data!.status,
              leftOff,
              nextStep,
              // The card edits prose only, so the task the thread points at rides along
              // untouched. Dropping it here would unpick the choice on every wording fix.
              nextStepTaskId: latest?.next_step_task_id ?? null,
            })
          }
          // The same progress update as an edit, with the context carried over word for word
          // and the note riding along — the one write path that stores `progress_logs.note`.
          onAddNote={(note, done) =>
            updateStatus.mutate(
              {
                itemType: 'project',
                itemId: projectId,
                status: project.data!.status,
                leftOff: latest?.left_off ?? '',
                nextStep: latest?.next_step ?? '',
                nextStepTaskId: latest?.next_step_task_id ?? null,
                note,
              },
              { onSuccess: done },
            )
          }
        />
      </div>

      <section aria-labelledby="tasks-heading" className="mt-8">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-2">
          <h2 id="tasks-heading" className="text-title-md">
            Tasks
          </h2>
          {progress.total > 0 && (
            <span className="text-caption text-muted">
              {openTasks.length + hiddenByFilter} open · {closedTasks.length} closed
            </span>
          )}
        </div>

        {/* Wraps instead of sharing one line: with two labelled selects beside it the input
            measured 69px at 320px wide — narrower than its own placeholder. On its own row it
            gets the full 288px there, and the selects keep their labels at every width. The
            "More…" button is the fourth control and wraps with the rest; the input's own row is
            what the measurement above protects, and that is `w-full` regardless. */}
        <form
          className="mb-3 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            const title = newTitle.trim()
            if (!title) return
            createTask.mutate(
              { title, difficulty: newDifficulty, priority: newPriority },
              {
                onSuccess: () => setNewTitle(''),
                onError: (error) => toast(error.message, 'error'),
              },
            )
          }}
        >
          <input
            aria-label="New task"
            placeholder="Add a task…"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className={`w-full ${rowFieldClass}`}
          />
          {/* The full labels, not the bare enum values: this is where a task's difficulty and
              priority are chosen for the first time, so it is the one place "M" and "med" have
              nothing to stand for yet. The card select can stay a letter — by then the task
              already has a value to read. */}
          <select
            aria-label="New task difficulty"
            value={newDifficulty}
            onChange={(e) => setNewDifficulty(e.target.value as Difficulty)}
            className={`shrink-0 ${compactFieldClass}`}
          >
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {DIFFICULTY_LABELS[d]}
              </option>
            ))}
          </select>
          <select
            aria-label="New task priority"
            value={newPriority}
            onChange={(e) => setNewPriority(e.target.value as Priority)}
            className={`shrink-0 ${compactFieldClass}`}
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABELS[p]}
              </option>
            ))}
          </select>
          {/* Ghost since the Celestial pass: the screen's one filled button is the resume box's
              "Start 25m focus". Enter in the field still submits, so the quick path costs the
              same keystrokes it always did. */}
          <Button type="submit" variant="ghost" className="px-4">
            Add
          </Button>
          {/* `type="button"`: inside a form, an unqualified button submits it, and this one has
              to hand the half-typed row to the sheet rather than insert it. The label is
              spelled out for the screen reader the way its three neighbours are; "More…" alone
              names nothing. */}
          <Button
            type="button"
            variant="ghost"
            aria-label="Add task with description"
            className="px-4"
            onClick={() => setAddingTask(true)}
          >
            More…
          </Button>
        </form>

        {progress.total > 0 && (
          <TaskListControls
            prefs={prefs}
            onChange={changePrefs}
            staleDays={staleDays}
            hiddenCount={hiddenByFilter}
            totalCount={openTasks.length + hiddenByFilter}
          />
        )}

        {tasks.data && tasks.data.length === 0 && (
          <EmptyState title="No tasks yet." description="Add the first one above." />
        )}

        {/* Two groups, one sort: compareTasks already puts in-progress work first, so the split
            only names what the order was saying. The queued group is labelled by the sort that
            orders it. */}
        {inProgressTasks.length > 0 && (
          <div className="mb-4">
            <h3 className={GROUP_CLASS}>In progress</h3>
            {taskList(inProgressTasks)}
          </div>
        )}
        {queuedTasks.length > 0 && (
          <div>
            <h3 className={GROUP_CLASS}>
              {prefs.sort === 'untouched' ? 'Untouched first' : 'By priority'}
            </h3>
            {taskList(queuedTasks)}
          </div>
        )}

        {/* Two ways to lose sight of an open task, two different ways out. */}
        {progress.total > 0 &&
          openTasks.length === 0 &&
          (hiddenByFilter > 0 ? (
            <EmptyState
              title="No open task matches these filters."
              description={`${hiddenByFilter} hidden. Show all.`}
              onAction={() => changePrefs(clearedFilters(prefs))}
            />
          ) : (
            <EmptyState title="Nothing open here." description="They're waiting in Closed below." />
          ))}

        {closedTasks.length > 0 && (
          <details
            className="mt-4"
            open={prefs.showCompleted}
            onToggle={(e) => changePrefs({ ...prefs, showCompleted: e.currentTarget.open })}
          >
            {/* "Closed", not "Completed": the bucket is done + dropped, and calling it
                Completed contradicted the "1/2 done" counter directly above it. */}
            <summary className={SUMMARY_CLASS}>Closed ({closedTasks.length})</summary>
            {/* No dimming: these rows keep their status controls, and a finished task you
                meant to keep open is exactly the one you need to be able to read. */}
            <div className="mt-3">{taskList(closedTasks)}</div>
          </details>
        )}
      </section>

      {/* Open, not a collapsed <details> any more: the log is the project's memory, and the
          day headings make it scannable without hiding it. */}
      <section aria-labelledby="history-heading" className="mt-8">
        <h2 id="history-heading" className="mb-3 text-title-md">
          History
        </h2>
        {logs.data && (
          <HistoryTimeline
            entries={projectTimeline(logs.data, xpEvents.data ?? [], sessions.data ?? [])}
          />
        )}
        {(xpEvents.isError || sessions.isError) && (
          <p className="mt-3 text-caption text-muted">Some history could not load.</p>
        )}
      </section>

      <PickerSheet
        open={movingProject}
        title="Move project to…"
        loading={areas.isPending}
        onClose={() => setMovingProject(false)}
        options={(areas.data ?? []).map((option) => ({
          id: option.id,
          label: `${option.icon ?? ''} ${option.name}`.trim(),
          current: option.id === project.data?.area_id,
        }))}
        onPick={(areaId) =>
          moveProject.mutate(
            { id: projectId, areaId },
            {
              onSuccess: () => {
                setMovingProject(false)
                toast('Project moved')
              },
              onError: (error) => toast(error.message, 'error'),
            },
          )
        }
      />

      <PickerSheet
        open={movingTask !== null}
        title={movingTask ? `Move "${movingTask.title}" to…` : 'Move task to…'}
        loading={projectOptions.isPending}
        emptyText="No other open project to move into."
        onClose={() => setMovingTask(null)}
        options={(projectOptions.data ?? []).map((option) => ({
          id: option.id,
          label: option.title,
          hint: option.life_areas
            ? `${option.life_areas.icon ?? ''} ${option.life_areas.name}`.trim()
            : undefined,
          current: option.id === projectId,
        }))}
        onPick={(targetProjectId) =>
          movingTask &&
          moveTask.mutate(
            { id: movingTask.id, projectId: targetProjectId },
            {
              onSuccess: () => {
                setMovingTask(null)
                toast('Task moved')
              },
              onError: (error) => toast(error.message, 'error'),
            },
          )
        }
      />

      <ProjectSheet
        open={editing}
        project={project.data}
        onClose={() => setEditing(false)}
        saving={updateProject.isPending}
        onSubmit={(values) =>
          updateProject.mutate(
            { ...values, id: projectId },
            {
              onSuccess: () => {
                setEditing(false)
                toast('Project updated')
              },
              onError: (error) => toast(error.message, 'error'),
            },
          )
        }
      />

      {/* Mounted only while open, unlike the edit sheet below: there is no `task` for `values`
          to re-sync against, so a sheet that survived the close would reopen holding the last
          task you added. Unmounting is the reset. */}
      {addingTask && (
        <TaskSheet
          open
          mode="create"
          initial={{ title: newTitle, difficulty: newDifficulty, priority: newPriority }}
          onClose={() => setAddingTask(false)}
          saving={createTask.isPending}
          onSubmit={(values) =>
            createTask.mutate(values, {
              onSuccess: () => {
                setAddingTask(false)
                // The quick row seeded this sheet, so leaving its title behind would offer the
                // task you just created a second time.
                setNewTitle('')
                toast('Task added')
              },
              onError: (error) => toast(error.message, 'error'),
            })
          }
        />
      )}

      <TaskSheet
        open={editingTask !== null}
        task={editingTask}
        onClose={() => setEditingTask(null)}
        // The same `requestStatus` the card's picker uses, so the sheet offers the whole set and
        // each status takes the route it needs: `in_progress` and `dropped` go straight to the
        // RPC, while `paused`, `blocked` and `done` are handed to UpdateStatusSheet for their
        // resume context. The sheet closes itself first (TaskSheet.tsx), so the two never stack.
        onStatusChange={(status) =>
          editingTask && requestStatus('task', editingTask.id, editingTask.title, status)
        }
        saving={updateTask.isPending}
        // Closed from onSuccess only. Closing here would dismiss the sheet before the write
        // is known to have landed — and the form's own validation never gets this far.
        onSubmit={(values) =>
          editingTask &&
          updateTask.mutate(
            { ...values, id: editingTask.id },
            {
              onSuccess: () => {
                setEditingTask(null)
                toast('Task updated')
              },
              onError: (error) => toast(error.message, 'error'),
            },
          )
        }
      />

      <UpdateStatusSheet
        pending={pending}
        saving={updateStatus.isPending}
        onClose={() => setPending(null)}
        onSubmit={({ leftOff, nextStep, note, nextStepTaskId }) =>
          pending &&
          updateStatus.mutate(
            {
              itemType: pending.itemType,
              itemId: pending.itemId,
              status: pending.status,
              leftOff,
              nextStep,
              nextStepTaskId,
              note,
            },
            { onSuccess: () => setPending(null) },
          )
        }
      />
    </div>
  )
}
