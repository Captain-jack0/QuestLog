import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Card } from '../components/ui/Card'
import { CardSkeleton } from '../components/ui/Skeleton'
import { Button } from '../components/ui/Button'
import { StatusChip } from '../components/ui/StatusChip'
import { StatusPicker } from '../components/ui/StatusPicker'
import { EditableText } from '../components/ui/EditableText'
import { PickerSheet } from '../components/ui/PickerSheet'
import { ProgressBar } from '../components/ui/ProgressBar'
import { useToast } from '../components/ui/Toast'
import { compactFieldClass, rowFieldClass } from '../components/ui/field'
import { useAuth } from '../auth/AuthProvider'
import { useArea, useAreas } from '../features/areas/queries'
import { ProjectSheet } from '../features/projects/ProjectSheet'
import {
  useMoveProject,
  useProgressLogs,
  useProject,
  useProjectOptions,
  useUpdateProject,
} from '../features/projects/queries'
import { useCreateTask, useMoveTask, useTasks, useUpdateTask } from '../features/tasks/queries'
import { UpdateStatusSheet, type PendingStatusChange } from '../features/status/UpdateStatusSheet'
import { ResumeCard } from '../features/status/ResumeCard'
import { needsResumeContext, useUpdateStatus } from '../features/status/useUpdateStatus'
import { relativeTime } from '../lib/time'
import { isOptimistic } from '../lib/optimistic'
import { TimerButton } from '../features/timer/TimerButton'
import { type Difficulty, type ItemStatus } from '../lib/schemas'

const DIFFICULTIES: Difficulty[] = ['S', 'M', 'L']

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

  const [editing, setEditing] = useState(false)
  const [pending, setPending] = useState<PendingStatusChange | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [newDifficulty, setNewDifficulty] = useState<Difficulty>('M')
  const [movingProject, setMovingProject] = useState(false)
  const [movingTask, setMovingTask] = useState<{ id: string; title: string } | null>(null)

  const latest = logs.data?.[0]
  const done = tasks.data?.filter((t) => t.status === 'done').length ?? 0

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
                className="h-2 w-2 rounded-full"
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

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {tasks.data?.map((task) => (
            <Card key={task.id} className="flex min-h-[190px] flex-col p-3">
              <div className="flex items-start justify-between gap-1">
                <EditableText
                  label={`Task title: ${task.title}`}
                  value={task.title}
                  disabled={isOptimistic(task.id)}
                  onSave={(title) => updateTask.mutate({ id: task.id, title })}
                  className={`font-semibold leading-tight ${
                    task.status === 'done' ? 'text-muted line-through' : ''
                  }`}
                />
                <select
                  aria-label={`Difficulty for ${task.title}`}
                  disabled={isOptimistic(task.id)}
                  value={task.difficulty}
                  onChange={(e) =>
                    updateTask.mutate({ id: task.id, difficulty: e.target.value as Difficulty })
                  }
                  className={`shrink-0 ${compactFieldClass} font-semibold text-muted`}
                >
                  {DIFFICULTIES.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <EditableText
                multiline
                allowEmpty
                label={`Description for ${task.title}`}
                placeholder="+ Add a description"
                value={task.description ?? ''}
                disabled={isOptimistic(task.id)}
                onSave={(description) => updateTask.mutate({ id: task.id, description })}
                className="mt-1 flex-1 text-sm text-muted"
              />

              <div className="mt-2">
                <StatusPicker
                  compact
                  label={`Status for ${task.title}`}
                  value={task.status}
                  // a row that has not come back from the database yet has no real id to send
                  disabled={isOptimistic(task.id)}
                  onChange={(status) => requestStatus('task', task.id, task.title, status)}
                />
              </div>

              <div className="mt-2 flex items-center justify-between gap-2">
                <button
                  type="button"
                  aria-label={`Move ${task.title} to another project`}
                  disabled={isOptimistic(task.id)}
                  onClick={() => setMovingTask({ id: task.id, title: task.title })}
                  className="btn-quiet min-h-[44px] rounded-full border border-line px-2 text-xs font-semibold text-muted disabled:opacity-40"
                >
                  ⇄ Move
                </button>
                <TimerButton
                  itemType="task"
                  itemId={task.id}
                  title={task.title}
                  withPomodoro
                  disabled={isOptimistic(task.id)}
                />
              </div>
            </Card>
          ))}
        </div>
      </section>

      <details className="mt-6">
        <summary className="cursor-pointer text-sm font-semibold uppercase tracking-wide text-muted">
          History ({logs.data?.length ?? 0})
        </summary>
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
