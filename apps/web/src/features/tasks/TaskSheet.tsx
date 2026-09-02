import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { BottomSheet } from '../../components/ui/BottomSheet'
import { Button } from '../../components/ui/Button'
import { fieldClass } from '../../components/ui/field'
import { isOptimistic } from '../../lib/optimistic'
import {
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  PRIORITIES,
  PRIORITY_LABELS,
  taskSchema,
  type ItemStatus,
  type Task,
  type TaskInput,
} from '../../lib/schemas'

interface TaskSheetProps {
  open: boolean
  task?: Task | null
  onClose: () => void
  onSubmit: (values: TaskInput) => void
  /** Routed through the caller, like the row's: the status mutation stays where it lives. */
  onStatusChange: (status: ItemStatus) => void
  saving?: boolean
}

/**
 * The long form of a task edit. The card keeps its inline title/description/difficulty
 * editing — this sheet sits on top of it for the times you want every field at once.
 *
 * Status and "move to another project" deliberately stay outside: both already open a sheet
 * of their own (UpdateStatusSheet, PickerSheet), and two BottomSheets at once would stack two
 * document-level keydown listeners, so Escape would close both and the focus traps would fight.
 */
export function TaskSheet({
  open,
  task,
  onClose,
  onSubmit,
  onStatusChange,
  saving,
}: TaskSheetProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<TaskInput>({
    resolver: zodResolver(taskSchema),
    values: {
      title: task?.title ?? '',
      description: task?.description ?? '',
      difficulty: task?.difficulty ?? 'M',
      priority: task?.priority ?? 'med',
    },
  })

  // A row that has not come back from the database yet has no real id to update against.
  const unsaved = task ? isOptimistic(task.id) : false

  // One control, both directions. The row's checkbox only ever offers `done`, so a dropped task
  // has no way back to an open status anywhere else in the app. Neither target asks for resume
  // context (needsResumeContext covers paused/blocked only), so both go straight to the RPC.
  const subAction =
    task?.status === 'dropped'
      ? {
          label: 'Reopen',
          next: 'in_progress' as ItemStatus,
          hint: 'Moves back to your open tasks.',
        }
      : { label: 'Drop', next: 'dropped' as ItemStatus, hint: 'Stays in Closed, with its history.' }

  return (
    <BottomSheet open={open} onClose={onClose} title="Edit task">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <div>
          <label htmlFor="task-title" className="mb-1 block text-sm font-medium">
            Title
          </label>
          <input id="task-title" autoFocus {...register('title')} className={fieldClass} />
          {errors.title && <p className="mt-1 text-sm text-alert-ink">{errors.title.message}</p>}
        </div>

        <div>
          <label htmlFor="task-description" className="mb-1 block text-sm font-medium">
            Description
          </label>
          <textarea
            id="task-description"
            rows={3}
            {...register('description')}
            className={fieldClass}
          />
          {errors.description && (
            <p className="mt-1 text-sm text-alert-ink">{errors.description.message}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="task-difficulty" className="mb-1 block text-sm font-medium">
              Difficulty
            </label>
            {/* The sheet has the room the card lacks, so the label spells out what the letter buys. */}
            <select id="task-difficulty" {...register('difficulty')} className={fieldClass}>
              {DIFFICULTIES.map((difficulty) => (
                <option key={difficulty} value={difficulty}>
                  {DIFFICULTY_LABELS[difficulty]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="task-priority" className="mb-1 block text-sm font-medium">
              Priority
            </label>
            <select id="task-priority" {...register('priority')} className={fieldClass}>
              {PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {PRIORITY_LABELS[priority]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <Button type="submit" block disabled={saving || unsaved}>
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
        {unsaved && (
          <p className="text-sm text-muted">This task is still saving. Try again in a moment.</p>
        )}

        {/* Quiet and neutral, like the chip: `dropped` is grey in StatusChip, not an error tone,
            and the button is a choice rather than a verdict — no strike-through, that is the
            outcome label's language and would read as "disabled" on a control. Closing first
            keeps the resume sheet from ever stacking on top of this one. */}
        {task && (
          <div className="mt-4 border-t border-line pt-4">
            <button
              type="button"
              aria-label={`${subAction.label} task: ${task.title}`}
              disabled={saving || unsaved}
              onClick={() => {
                onClose()
                onStatusChange(subAction.next)
              }}
              className="btn-quiet min-h-[44px] w-full rounded-full border border-line px-2 text-xs font-semibold text-muted disabled:opacity-40"
            >
              {subAction.label}
            </button>
            <p className="mt-2 text-xs text-muted">{subAction.hint}</p>
          </div>
        )}
      </form>
    </BottomSheet>
  )
}
