import { useEffect, useRef, useState } from 'react'
import { BottomSheet } from '../../components/ui/BottomSheet'
import { Button } from '../../components/ui/Button'
import { PickerList } from '../../components/ui/PickerSheet'
import { statusLabel } from '../../components/ui/StatusChip'
import { fieldClass } from '../../components/ui/field'
import { usePickableItems } from '../focus/queries'
import type { ItemStatus } from '../../lib/schemas'
import { needsResumeContext } from './useUpdateStatus'

export interface PendingStatusChange {
  itemType: 'task' | 'project'
  itemId: string
  title: string
  status: ItemStatus
  /** Carried over from the last log so "done" only needs a confirm. */
  leftOff?: string | null
  nextStep?: string | null
  /** Also carried over: without it, confirming a prefilled sheet would drop the task the
   *  previous log pointed at. */
  nextStepTaskId?: string | null
  nextStepTaskTitle?: string | null
}

interface UpdateStatusSheetProps {
  pending: PendingStatusChange | null
  saving?: boolean
  onClose: () => void
  onSubmit: (values: {
    leftOff: string
    nextStep: string
    note: string
    nextStepTaskId: string | null
  }) => void
}

/**
 * One sheet, two modes. The task picker is *not* a second `BottomSheet`: the sheet binds its
 * Escape/Tab handler to `document`, so two open at once would close together on Escape and
 * fight over the focus trap. Swapping the children of the sheet already open costs nothing and
 * keeps the half-typed form alive, because the form's state lives out here rather than in it.
 */
export function UpdateStatusSheet({ pending, saving, onClose, onSubmit }: UpdateStatusSheetProps) {
  const [mode, setMode] = useState<'form' | 'pick'>('form')
  const [leftOff, setLeftOff] = useState('')
  const [nextStep, setNextStep] = useState('')
  const [note, setNote] = useState('')
  const [taskId, setTaskId] = useState<string | null>(null)
  const [taskTitle, setTaskTitle] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const pickRef = useRef<HTMLDivElement>(null)

  // Every open item in the account, not just this project's — the next step is often somewhere
  // else entirely. Fetched only once the picker is asked for; the key is shared with the focus
  // picker, so the second open is already warm.
  const pickable = usePickableItems(mode === 'pick')

  useEffect(() => {
    setMode('form')
    setLeftOff(pending?.leftOff ?? '')
    setNextStep(pending?.nextStep ?? '')
    setNote('')
    setTaskId(pending?.nextStepTaskId ?? null)
    setTaskTitle(pending?.nextStepTaskTitle ?? null)
    setError(null)
  }, [pending])

  // The sheet is already open, so its own focus trap does not re-run on a mode change: without
  // this the keyboard would be left on the button that just unmounted. Re-runs when the list
  // arrives too, since until then there is nothing in there to focus.
  useEffect(() => {
    if (mode === 'pick') pickRef.current?.querySelector<HTMLElement>('input, button')?.focus()
  }, [mode, pickable.data])

  if (!pending) return null

  const required = needsResumeContext(pending.status)

  function clearTask() {
    setTaskId(null)
    setTaskTitle(null)
  }

  if (mode === 'pick') {
    const options = (pickable.data ?? [])
      .filter(
        (item) =>
          item.itemType === 'task' &&
          // A task cannot be its own next step; the DB rejects it, so never offer it.
          !(pending.itemType === 'task' && item.id === pending.itemId),
      )
      .map((item) => ({
        id: item.id,
        label: item.title,
        hint: [item.projectTitle, statusLabel(item.status)].filter(Boolean).join(' · '),
      }))

    // Escape and the backdrop go back to the form rather than discarding it: the same sheet is
    // still open, and half a typed update is not something to throw away on a stray keypress.
    return (
      <BottomSheet open onClose={() => setMode('form')} title="Which task comes next?">
        <div ref={pickRef}>
          <PickerList
            options={options}
            loading={pickable.isPending}
            emptyText="No other open task to point at yet."
            onPick={(id) => {
              setTaskId(id)
              setTaskTitle(options.find((option) => option.id === id)?.label ?? null)
              setError(null)
              setMode('form')
            }}
          />
          <Button variant="ghost" block className="mt-3" onClick={() => setMode('form')}>
            Back
          </Button>
        </div>
      </BottomSheet>
    )
  }

  return (
    <BottomSheet open onClose={onClose} title={`${pending.title} → ${statusLabel(pending.status)}`}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          // A picked task is a next step in its own right, so either half satisfies the rule.
          if (required && (!leftOff.trim() || (!nextStep.trim() && !taskId))) {
            setError(
              'Both halves keep the thread alive — where you left off, and a next step: write one or point at a task.',
            )
            return
          }
          onSubmit({
            leftOff: leftOff.trim(),
            nextStep: nextStep.trim(),
            note,
            nextStepTaskId: taskId,
          })
        }}
      >
        <div>
          <label htmlFor="left-off" className="mb-1 block text-sm font-medium">
            Where did you leave off?{required && <span className="text-alert-ink"> *</span>}
          </label>
          <textarea
            id="left-off"
            rows={2}
            autoFocus
            value={leftOff}
            onChange={(e) => setLeftOff(e.target.value)}
            className={fieldClass}
          />
        </div>

        <div>
          <label htmlFor="next-step" className="mb-1 block text-sm font-medium">
            What&apos;s the next step?{required && <span className="text-alert-ink"> *</span>}
          </label>
          <textarea
            id="next-step"
            rows={2}
            value={nextStep}
            onChange={(e) => setNextStep(e.target.value)}
            className={fieldClass}
          />

          {taskId ? (
            <div className="mt-2 flex items-center gap-1 rounded-xl border border-line bg-paper px-3">
              <span className="min-w-0 flex-1 truncate py-2 text-sm">
                <span className="text-muted">Task: </span>
                {taskTitle}
              </span>
              <button
                type="button"
                onClick={() => setMode('pick')}
                className="min-h-[44px] shrink-0 px-2 text-sm font-semibold text-accent"
              >
                Change
              </button>
              <button
                type="button"
                onClick={clearTask}
                className="min-h-[44px] shrink-0 px-2 text-sm font-semibold text-muted"
              >
                Clear
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setMode('pick')}
              className="mt-1 min-h-[44px] text-sm font-semibold text-accent"
            >
              …or point at a task →
            </button>
          )}
        </div>

        <div>
          <label htmlFor="status-note" className="mb-1 block text-sm font-medium">
            Note <span className="text-muted">(optional)</span>
          </label>
          <input
            id="status-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className={fieldClass}
          />
        </div>

        {error && (
          <p role="alert" className="text-sm text-alert-ink">
            {error}
          </p>
        )}

        <Button type="submit" block disabled={saving}>
          {saving ? 'Saving…' : `Mark as ${statusLabel(pending.status).toLowerCase()}`}
        </Button>
      </form>
    </BottomSheet>
  )
}
