import { Card } from '../../components/ui/Card'
import { EditableText } from '../../components/ui/EditableText'
import { Icon } from '../../components/ui/Icon'
import { StatusChip } from '../../components/ui/StatusChip'
import { StatusPicker } from '../../components/ui/StatusPicker'
import { compactFieldClass } from '../../components/ui/field'
import { isOptimistic } from '../../lib/optimistic'
import { relativeTime } from '../../lib/time'
import { PriorityBadge } from '../../components/ui/PriorityBadge'
import { XP } from '../../lib/xp'
import {
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  type Difficulty,
  type ItemStatus,
  type Task,
} from '../../lib/schemas'
import { TimerButton } from '../timer/TimerButton'
import { formatMinutes } from '../timer/pomodoro'
import type { TaskView } from './listPrefs'

/** "Touched 4d ago" — nothing at all for a row whose timestamp is not a date yet. */
function touched(updatedAt: string): string | null {
  const ago = relativeTime(updatedAt)
  return ago ? `Touched ${ago}` : null
}

/** The bare enum letter fits the width budget; the label it stands for goes to the reader. */
function DifficultyLetter({ difficulty }: { difficulty: Difficulty }) {
  return (
    <span className="shrink-0 text-micro font-semibold text-muted">
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
  /**
   * Card view only — every finished session on this task, stacked. Undefined while the query
   * is in flight and for a task nobody has timed; that draws nothing, so the footer does not
   * flicker an empty total in on load. A stored session is always ≥ 60s (rpc_stop_timer
   * discards shorter ones), so a present total never rounds to "0m".
   */
  focusSeconds?: number
}

/**
 * One component, two containers. The card keeps every inline edit it has today; the row is
 * for scanning, so the rarely-used controls are *removed* to the pop-up rather than shrunk —
 * that is how every remaining target stays at 44px inside a 56px row.
 */
export function TaskItem({
  task,
  view,
  onStatusChange,
  onUpdate,
  onMove,
  onOpen,
  focusSeconds,
}: TaskItemProps) {
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
        <PriorityBadge priority={task.priority} />

        <div className="min-w-0 flex-1">{title}</div>

        {/* Leaves the layout at 390px, where the width is not there — but not the accessibility
            tree: `hidden` is display:none and takes the word with it, and since the checkbox
            went to the pop-up this chip is the row's only carrier of "done". `sr-only` is
            absolutely positioned, so it costs the row the same zero width `hidden` did. */}
        <span className="shrink-0 max-sm:sr-only">
          <StatusChip status={task.status} />
        </span>

        <DifficultyLetter difficulty={task.difficulty} />

        <span className="hidden shrink-0 text-micro text-muted sm:inline">
          {touched(task.updated_at)}
        </span>

        <OpenButton title={task.title} onOpen={onOpen} />
      </div>
    )
  }

  return (
    <Card className="flex min-h-[190px] flex-col">
      <div className="flex items-start justify-between gap-1">
        {/* min-w-0, as in the row view: a flex item will not shrink below its longest word, so an
            unbroken title used to push the difficulty select and ⋯ out of the card (#54). */}
        <div className="min-w-0 flex-1">{title}</div>
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

      {/* The badges under the title, not beside it: the title row is already the width budget
          #54 was about. XP is what Done pays for this size (XP.taskDone, as rpc_update_status);
          the size letter itself is the select above, so it is not said twice. */}
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-micro text-muted">
        <PriorityBadge priority={task.priority} />
        <span>
          {XP.taskDone[task.difficulty]} XP<span className="sr-only"> when done</span>
        </span>
        <span>{touched(task.updated_at)}</span>
      </div>

      <EditableText
        multiline
        allowEmpty
        label={`Description for ${task.title}`}
        placeholder="+ Add a description"
        value={task.description ?? ''}
        disabled={pending}
        onSave={(description) => onUpdate({ description })}
        className="mt-1 flex-1 text-body text-muted"
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
          className="btn-quiet min-h-[44px] rounded-full border border-line px-2 text-caption font-semibold text-muted disabled:opacity-40"
        >
          <Icon name="swap_horiz" /> Move
        </button>
        {/* Beside the timer because it is the timer's own history: what the button has already
            banked on this task. Minutes, not mm:ss — this is a summary, and the live count is
            TimerBar's job. */}
        {focusSeconds ? (
          <span className="ml-auto shrink-0 text-micro text-muted">
            <span aria-hidden>
              <Icon name="timer" /> {formatMinutes(focusSeconds)}
            </span>
            <span className="sr-only">{formatMinutes(focusSeconds)} focused so far</span>
          </span>
        ) : null}
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
