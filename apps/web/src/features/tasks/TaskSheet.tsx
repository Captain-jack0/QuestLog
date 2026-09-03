import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { BottomSheet } from '../../components/ui/BottomSheet'
import { Button } from '../../components/ui/Button'
import { StatusPicker } from '../../components/ui/StatusPicker'
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
 * "Move to another project" deliberately stays outside: it opens a PickerSheet of its own, and
 * two BottomSheets at once would stack two document-level keydown listeners, so Escape would
 * close both and the focus traps would fight. Status is in, under the same rule: the picker
 * closes this sheet before it asks, so the resume sheet never lands on top of one.
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

        {/* The whole set, not a single toggle. The Drop/Reopen pair this replaces could reach
            `dropped` and `in_progress` only, so the sheet could neither finish a task nor reopen
            a finished one — and with the row's checkbox gone (TaskItem.tsx:101) that is the row
            view's only way to either. One control, not two: a Drop button beside a `Dropped`
            chip would be the same mutation offered twice, one of them phrased differently.

            Same component and same `compact` set as the card (TaskItem.tsx:174), so a status
            reads the same wherever you meet it — and the sheet's 358px inner width at 390px is
            wider than the 326px the card fits it in, so it costs the same two rows.

            Closing first keeps the resume sheet (paused/blocked/done) off the top of this one;
            both state updates land in one commit, so nothing flickers in between. */}
        {task && (
          <div className="mt-4 border-t border-line pt-4">
            <p className="mb-2 text-sm font-medium">Status</p>
            <StatusPicker
              compact
              label="Status"
              value={task.status}
              disabled={saving || unsaved}
              onChange={(status) => {
                onClose()
                onStatusChange(status)
              }}
            />
          </div>
        )}
      </form>
    </BottomSheet>
  )
}
