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

interface TaskSheetBase {
  open: boolean
  onClose: () => void
  onSubmit: (values: TaskInput) => void
  saving?: boolean
}

/**
 * A union rather than two optional props: a task that has not been inserted yet has no status to
 * change, and an edit sheet without `onStatusChange` would render the picker and silently do
 * nothing when you use it. Each mode can only be given the props it can act on.
 */
type TaskSheetProps = TaskSheetBase &
  (
    | {
        mode: 'create'
        /** Seeds the fields, so the quick-add row's half-typed entry carries into the sheet. */
        initial?: Partial<TaskInput>
        task?: never
        onStatusChange?: never
      }
    | {
        mode?: 'edit'
        initial?: never
        task: Task | null
        /** Routed through the caller, like the row's: the status mutation stays where it lives. */
        onStatusChange: (status: ItemStatus) => void
      }
  )

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
  initial,
  mode = 'edit',
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
    // Still `values`, not `defaultValues`: the edit sheet stays mounted across tasks, so the
    // form has to re-sync when `task` changes. `initial` only fills the create side, and the
    // sheet is modal — the quick-add field it reads cannot move while the sheet is open, so
    // the object stays deep-equal and never resets what you are typing in here.
    values: {
      title: task?.title ?? initial?.title ?? '',
      description: task?.description ?? initial?.description ?? '',
      difficulty: task?.difficulty ?? initial?.difficulty ?? 'M',
      priority: task?.priority ?? initial?.priority ?? 'med',
    },
  })

  // A row that has not come back from the database yet has no real id to update against.
  const unsaved = task ? isOptimistic(task.id) : false

  return (
    // "Add task", not "New task": the quick-add input already answers to that name, and two
    // things with one accessible name is a selector waiting to hit the wrong one.
    <BottomSheet open={open} onClose={onClose} title={mode === 'create' ? 'Add task' : 'Edit task'}>
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
          {saving ? 'Saving…' : mode === 'create' ? 'Add task' : 'Save changes'}
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
                onStatusChange?.(status)
              }}
            />
          </div>
        )}
      </form>
    </BottomSheet>
  )
}
