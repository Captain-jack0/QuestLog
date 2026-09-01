import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Card } from '../components/ui/Card'
import { CardSkeleton } from '../components/ui/Skeleton'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { StatusChip } from '../components/ui/StatusChip'
import { StatusPicker } from '../components/ui/StatusPicker'
import { PickerSheet } from '../components/ui/PickerSheet'
import { ProgressBar } from '../components/ui/ProgressBar'
import { useToast } from '../components/ui/Toast'
import { compactFieldClass, rowFieldClass } from '../components/ui/field'
import { useAuth } from '../auth/AuthProvider'
import { useArea, useAreas } from '../features/areas/queries'
import { useProfile } from '../features/gamification/queries'
import { ProjectSheet } from '../features/projects/ProjectSheet'
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
import { savePrefs, storedPrefs, type TaskListPrefs } from '../features/tasks/listPrefs'
import { partitionTasks } from '../features/tasks/taskOrder'
import { UpdateStatusSheet, type PendingStatusChange } from '../features/status/UpdateStatusSheet'
import { ResumeCard } from '../features/status/ResumeCard'
import { needsResumeContext, useUpdateStatus } from '../features/status/useUpdateStatus'
import { relativeTime } from '../lib/time'
import { TimerButton } from '../features/timer/TimerButton'
import { DIFFICULTIES, type Difficulty, type ItemStatus, type Task } from '../lib/schemas'

/** Same summary as the History section below, so the two collapsibles read as one pattern. */
const SUMMARY_CLASS = 'cursor-pointer text-sm font-semibold uppercase tracking-wide text-muted'

export function ProjectDetailScreen() {
  const { projectId = '' } = useParams()
  const { session } = useAuth()
  const toast = useToast()

  const project = useProject(projectId)
  const area = useArea(project.data?.area_id ?? undefined)
  const tasks = useTasks(projectId)
  const logs = useProgressLogs(projectId)

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
  const [movingProject, setMovingProject] = useState(false)
  const [movingTask, setMovingTask] = useState<{ id: string; title: string } | null>(null)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  // Hydrated once, on mount: the list should already be in the shape you left it in when it
  // first paints, not reflow into it after an effect.
  const [prefs, setPrefs] = useState<TaskListPrefs>(storedPrefs)

  const latest = logs.data?.[0]
  // Deliberately the unfiltered query data: the bar reports the project, not the current view,
  // so hiding a done task behind a filter must not move it.
  const done = tasks.data?.filter((t) => t.status === 'done').length ?? 0
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
    })

    if (prefs.view === 'row') {
      return (
        <Card className="divide-y divide-line p-0">
          {items.map((task) => (
            <TaskItem key={task.id} view="row" {...handlers(task)} />
          ))}
        </Card>
      )
    }

    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((task) => (
          <TaskItem key={task.id} view="card" {...handlers(task)} />
        ))}
      </div>
    )
  }

  if (project.isPending) return <CardSkeleton rows={3} />
  if (project.isError || !project.data) return <p className="text-alert-ink">Project not found.</p>

  return (
    <div>
      {/* inline-flex, not a bare min-height: min-height does not apply to an inline box, so on
          an <a> the utility alone would have measured the same 17px it was meant to fix. Centred,
          unlike the thread title in Today, because this link stands alone with nothing beside it
          to keep level. */}
      <Link
        to={`/areas/${project.data.area_id ?? ''}`}
        className="inline-flex min-h-[44px] items-center text-sm font-medium text-muted"
      >
        ← {area.data?.name ?? 'Area'}
      </Link>

      <header className="mb-4 mt-2">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-bold leading-tight">{project.data.title}</h1>
          <span className="flex shrink-0 gap-2">
            <Button variant="ghost" className="px-3 py-2" onClick={() => setMovingProject(true)}>
              Move
            </Button>
            <Button variant="ghost" className="px-3 py-2" onClick={() => setEditing(true)}>
              Edit
            </Button>
          </span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          {area.data && (
            <span className="flex items-center gap-1 text-muted">
              <span
                aria-hidden
                className="h-2 w-2 rounded-full border border-ink/55"
                style={{ backgroundColor: area.data.color }}
              />
              {area.data.icon} {area.data.name}
            </span>
          )}
          <StatusChip status={project.data.status} />
          <span className="text-muted">{project.data.priority} priority</span>
          <TimerButton
            itemType="project"
            itemId={projectId}
            title={project.data.title}
            withPomodoro
          />
        </div>
        {project.data.description && (
          <p className="mt-2 text-sm text-muted">{project.data.description}</p>
        )}
      </header>

      <ResumeCard
        leftOff={latest?.left_off ?? null}
        nextStep={latest?.next_step ?? null}
        loggedAt={latest?.created_at ?? null}
        fromAi={latest?.source === 'ai'}
        saving={updateStatus.isPending}
        onSave={({ leftOff, nextStep }) =>
          updateStatus.mutate({
            itemType: 'project',
            itemId: projectId,
            // an edit is a progress update, not a status change
            status: project.data!.status,
            leftOff,
            nextStep,
          })
        }
      />

      <div className="mb-6">
        <p className="mb-2 text-sm font-medium">Project status</p>
        <StatusPicker
          label="Project status"
          value={project.data.status}
          onChange={(status) => requestStatus('project', projectId, project.data!.title, status)}
        />
      </div>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Tasks</h2>
          <span className="text-xs text-muted">
            {done}/{tasks.data?.length ?? 0} done
          </span>
        </div>
        {(tasks.data?.length ?? 0) > 0 && (
          <div className="mb-3">
            <ProgressBar done={done} total={tasks.data?.length ?? 0} />
          </div>
        )}

        <form
          className="mb-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            const title = newTitle.trim()
            if (!title) return
            createTask.mutate(
              { title, difficulty: newDifficulty },
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
            className={`flex-1 ${rowFieldClass}`}
          />
          <select
            aria-label="New task difficulty"
            value={newDifficulty}
            onChange={(e) => setNewDifficulty(e.target.value as Difficulty)}
            className={compactFieldClass}
          >
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <Button type="submit" className="px-4">
            Add
          </Button>
        </form>

        {(tasks.data?.length ?? 0) > 0 && (
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

        {openTasks.length > 0 && taskList(openTasks)}

        {/* Two ways to lose sight of an open task, two different ways out. */}
        {(tasks.data?.length ?? 0) > 0 &&
          openTasks.length === 0 &&
          (hiddenByFilter > 0 ? (
            <EmptyState
              title="No open task matches these filters."
              description={`${hiddenByFilter} hidden. Show all.`}
              onAction={() => changePrefs({ ...prefs, status: [], staleOnly: false })}
            />
          ) : (
            <EmptyState
              title="Nothing open here."
              description="They're waiting in Completed below."
            />
          ))}

        {closedTasks.length > 0 && (
          <details
            className="mt-4"
            open={prefs.showCompleted}
            onToggle={(e) => changePrefs({ ...prefs, showCompleted: e.currentTarget.open })}
          >
            <summary className={SUMMARY_CLASS}>Completed ({closedTasks.length})</summary>
            {/* No dimming: these rows keep their status controls, and a finished task you
                meant to keep open is exactly the one you need to be able to read. */}
            <div className="mt-3">{taskList(closedTasks)}</div>
          </details>
        )}
      </section>

      <details className="mt-6">
        <summary className={SUMMARY_CLASS}>History ({logs.data?.length ?? 0})</summary>
        <ol className="mt-3 space-y-3 border-l border-line pl-4">
          {logs.data?.map((log) => (
            <li key={log.id}>
              <p className="text-xs text-muted">
                {relativeTime(log.created_at)}
                {log.source === 'ai' && (
                  <span className="ml-2 rounded-full bg-accent/10 px-2 py-0.5 font-semibold text-accent">
                    via AI
                  </span>
                )}
              </p>
              {log.left_off && <p className="text-sm">{log.left_off}</p>}
              {log.next_step && (
                <p className="text-sm">
                  <span className="text-muted">Next: </span>
                  {log.next_step}
                </p>
              )}
              {log.note && <p className="text-sm italic text-muted">{log.note}</p>}
            </li>
          ))}
        </ol>
      </details>

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

      <TaskSheet
        open={editingTask !== null}
        task={editingTask}
        onClose={() => setEditingTask(null)}
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
        onSubmit={({ leftOff, nextStep, note }) =>
          pending &&
          updateStatus.mutate(
            {
              itemType: pending.itemType,
              itemId: pending.itemId,
              status: pending.status,
              leftOff,
              nextStep,
              note,
            },
            { onSuccess: () => setPending(null) },
          )
        }
      />
    </div>
  )
}
