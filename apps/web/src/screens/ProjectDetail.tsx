import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Card } from '../components/ui/Card'
import { CardSkeleton } from '../components/ui/Skeleton'
import { Button } from '../components/ui/Button'
import { StatusChip } from '../components/ui/StatusChip'
import { StatusPicker } from '../components/ui/StatusPicker'
import { EditableText } from '../components/ui/EditableText'
import { ProgressBar } from '../components/ui/ProgressBar'
import { useToast } from '../components/ui/Toast'
import { useAuth } from '../auth/AuthProvider'
import { useArea } from '../features/areas/queries'
import { ProjectSheet } from '../features/projects/ProjectSheet'
import { useProgressLogs, useProject, useUpdateProject } from '../features/projects/queries'
import { useCreateTask, useTasks, useUpdateTask } from '../features/tasks/queries'
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

  const [editing, setEditing] = useState(false)
  const [pending, setPending] = useState<PendingStatusChange | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [newDifficulty, setNewDifficulty] = useState<Difficulty>('M')

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
  if (project.isError || !project.data) return <p className="text-flame-ink">Project not found.</p>

  return (
    <div>
      <Link to={`/areas/${project.data.area_id ?? ''}`} className="text-sm font-medium text-muted">
        ← {area.data?.name ?? 'Area'}
      </Link>

      <header className="mb-4 mt-2">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-bold leading-tight">{project.data.title}</h1>
          <Button variant="ghost" className="shrink-0 px-3 py-2" onClick={() => setEditing(true)}>
            Edit
          </Button>
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
            className="min-h-[44px] flex-1 rounded-xl border border-line bg-surface px-4 text-base outline-none focus:border-accent"
          />
          <select
            aria-label="New task difficulty"
            value={newDifficulty}
            onChange={(e) => setNewDifficulty(e.target.value as Difficulty)}
            className="min-h-[44px] rounded-xl border border-line bg-surface px-2 text-sm"
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

        <div className="space-y-2">
          {tasks.data?.map((task) => (
            <Card key={task.id} className="p-3">
              <div className="flex items-start justify-between gap-2">
                <EditableText
                  label={`Task title: ${task.title}`}
                  value={task.title}
                  disabled={isOptimistic(task.id)}
                  onSave={(title) => updateTask.mutate({ id: task.id, title })}
                  className={`font-medium leading-tight ${
                    task.status === 'done' ? 'text-muted line-through' : ''
                  }`}
                />
                <TimerButton
                  itemType="task"
                  itemId={task.id}
                  title={task.title}
                  withPomodoro
                  disabled={isOptimistic(task.id)}
                />
                <select
                  aria-label={`Difficulty for ${task.title}`}
                  disabled={isOptimistic(task.id)}
                  value={task.difficulty}
                  onChange={(e) =>
                    updateTask.mutate({ id: task.id, difficulty: e.target.value as Difficulty })
                  }
                  className="shrink-0 rounded-lg bg-paper px-2 py-1 text-xs font-semibold text-muted"
                >
                  {DIFFICULTIES.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
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
