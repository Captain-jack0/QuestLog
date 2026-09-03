import { Card } from '../../components/ui/Card'
import { EditableText } from '../../components/ui/EditableText'
import { StatusChip } from '../../components/ui/StatusChip'
import { StatusPicker } from '../../components/ui/StatusPicker'
import { compactFieldClass } from '../../components/ui/field'
import { isOptimistic } from '../../lib/optimistic'
import { relativeTime } from '../../lib/time'
import {
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  PRIORITY_LABELS,
  type Difficulty,
  type ItemStatus,
  type Priority,
  type Task,
} from '../../lib/schemas'
import { TimerButton } from '../timer/TimerButton'
import type { TaskView } from './listPrefs'

/**
 * Priority is a shape, not a colour, and `med` draws nothing at all: most tasks in a healthy
 * list are `med`, so the list stays silent and only the exceptions speak. `alert`/`alert-ink`
 * is the error and `blocked` token — borrowing it here would read high priority as failure.
 */
const PRIORITY_MARKS: Partial<Record<Priority, { glyph: string; className: string }>> = {
  high: { glyph: '▲', className: 'text-accent' },
  low: { glyph: '▽', className: 'text-muted' },
}

function PriorityMark({ priority, className = '' }: { priority: Priority; className?: string }) {
  const mark = PRIORITY_MARKS[priority]
  if (!mark) return null
  return (
    <span className={`shrink-0 text-2xs leading-none ${mark.className} ${className}`}>
      <span aria-hidden>{mark.glyph}</span>
      <span className="sr-only">{PRIORITY_LABELS[priority]} priority</span>
    </span>
  )
}

/** The bare enum letter fits the width budget; the label it stands for goes to the reader. */
function DifficultyLetter({ difficulty }: { difficulty: Difficulty }) {
  return (
    <span className="shrink-0 text-2xs font-semibold text-muted">
      <span aria-hidden>{difficulty}</span>
      <span className="sr-only">Difficulty: {DIFFICULTY_LABELS[difficulty]}</span>
    </span>
  )
}

/**
 * Both views carry it: the pop-up holds priority, which nothing on either surface edits inline,
 * so a visible control has to point at it. A card body that silently opened the sheet was the
 * same affordance with nothing to see and no tab stop of its own.
 */
function OpenButton({ title, onOpen }: { title: string; onOpen: () => void }) {
  return (
    <button
      type="button"
      aria-label={`Open ${title}`}
      onClick={onOpen}
      className="min-h-[44px] min-w-[44px] shrink-0 rounded-full text-muted hover:bg-line/40"
    >
      <span aria-hidden>⋯</span>
    </button>
  )
}

interface TaskItemProps {
  task: Task
  view: TaskView
  /** Routed through the caller so the resume sheet stays where the status mutation lives. */
  onStatusChange: (status: ItemStatus) => void
  onUpdate: (fields: { title?: string; description?: string; difficulty?: Difficulty }) => void
  /** Card view only — the row sends moving to the pop-up. */
  onMove: () => void
  /** Opens the task pop-up: everything the row does not carry, and priority in both views. */
  onOpen: () => void
}

/**
 * One component, two containers. The card keeps every inline edit it has today; the row is
 * for scanning, so the rarely-used controls are *removed* to the pop-up rather than shrunk —
 * that is how every remaining target stays at 44px inside a 56px row.
 */
export function TaskItem({ task, view, onStatusChange, onUpdate, onMove, onOpen }: TaskItemProps) {
  // a row that has not come back from the database yet has no real id to send
  const pending = isOptimistic(task.id)
  const titleClass = task.status === 'done' ? 'text-muted line-through' : ''

  const title = (
    <EditableText
      label={`Task title: ${task.title}`}
      value={task.title}
      disabled={pending}
      onSave={(newTitle) => onUpdate({ title: newTitle })}
      className={`font-semibold leading-tight ${titleClass}`}
    />
  )

  if (view === 'row') {
    return (
      <div className="flex min-h-[56px] items-center gap-2 px-3 py-2">
        <PriorityMark priority={task.priority} />

        <div className="min-w-0 flex-1">{title}</div>

        {/* Leaves the layout at 390px, where the width is not there — but not the accessibility
            tree: `hidden` is display:none and takes the word with it, and since the checkbox
            went to the pop-up this chip is the row's only carrier of "done". `sr-only` is
            absolutely positioned, so it costs the row the same zero width `hidden` did. */}
        <span className="shrink-0 max-sm:sr-only">
          <StatusChip status={task.status} />
        </span>

        <DifficultyLetter difficulty={task.difficulty} />

        <span className="hidden shrink-0 text-2xs text-muted sm:inline">
          {relativeTime(task.updated_at)}
        </span>

        <OpenButton title={task.title} onOpen={onOpen} />
      </div>
    )
  }

  return (
    <Card className="flex min-h-[190px] flex-col">
      <div className="flex items-start justify-between gap-1">
        {/* pt-3 lines the glyph up with the first line of the 44px title button rather than
            centring it against a title that may wrap to two lines. */}
        <PriorityMark priority={task.priority} className="pt-3" />
        {title}
        <select
          aria-label={`Difficulty for ${task.title}: ${DIFFICULTY_LABELS[task.difficulty]}`}
          disabled={pending}
          value={task.difficulty}
          onChange={(e) => onUpdate({ difficulty: e.target.value as Difficulty })}
          className={`shrink-0 ${compactFieldClass} font-semibold text-muted`}
        >
          {DIFFICULTIES.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <OpenButton title={task.title} onOpen={onOpen} />
      </div>

      <EditableText
        multiline
        allowEmpty
        label={`Description for ${task.title}`}
        placeholder="+ Add a description"
        value={task.description ?? ''}
        disabled={pending}
        onSave={(description) => onUpdate({ description })}
        className="mt-1 flex-1 text-sm text-muted"
      />

      <div className="mt-2">
        <StatusPicker
          compact
          label={`Status for ${task.title}`}
          value={task.status}
          disabled={pending}
          onChange={onStatusChange}
        />
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label={`Move ${task.title} to another project`}
          disabled={pending}
          onClick={onMove}
          className="btn-quiet min-h-[44px] rounded-full border border-line px-2 text-xs font-semibold text-muted disabled:opacity-40"
        >
          ⇄ Move
        </button>
        <TimerButton
          itemType="task"
          itemId={task.id}
          title={task.title}
          withPomodoro
          disabled={pending}
        />
      </div>
    </Card>
  )
}
