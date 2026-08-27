import { useEffect, useState } from 'react'
import { BottomSheet } from '../../components/ui/BottomSheet'
import { Button } from '../../components/ui/Button'
import { statusLabel } from '../../components/ui/StatusChip'
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
}

interface UpdateStatusSheetProps {
  pending: PendingStatusChange | null
  saving?: boolean
  onClose: () => void
  onSubmit: (values: { leftOff: string; nextStep: string; note: string }) => void
}

const field =
  'w-full rounded-xl border border-line bg-paper px-4 py-3 text-base focus:border-accent'

export function UpdateStatusSheet({ pending, saving, onClose, onSubmit }: UpdateStatusSheetProps) {
  const [leftOff, setLeftOff] = useState('')
  const [nextStep, setNextStep] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLeftOff(pending?.leftOff ?? '')
    setNextStep(pending?.nextStep ?? '')
    setNote('')
    setError(null)
  }, [pending])

  if (!pending) return null

  const required = needsResumeContext(pending.status)

  return (
    <BottomSheet open onClose={onClose} title={`${pending.title} → ${statusLabel(pending.status)}`}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (required && (!leftOff.trim() || !nextStep.trim())) {
            setError('Both fields keep the thread alive — fill them in before pausing.')
            return
          }
          onSubmit({ leftOff: leftOff.trim(), nextStep: nextStep.trim(), note })
        }}
      >
        <div>
          <label htmlFor="left-off" className="mb-1 block text-sm font-medium">
            Where did you leave off?{required && <span className="text-flame-ink"> *</span>}
          </label>
          <textarea
            id="left-off"
            rows={2}
            autoFocus
            value={leftOff}
            onChange={(e) => setLeftOff(e.target.value)}
            className={field}
          />
        </div>

        <div>
          <label htmlFor="next-step" className="mb-1 block text-sm font-medium">
            What&apos;s the next step?{required && <span className="text-flame-ink"> *</span>}
          </label>
          <textarea
            id="next-step"
            rows={2}
            value={nextStep}
            onChange={(e) => setNextStep(e.target.value)}
            className={field}
          />
        </div>

        <div>
          <label htmlFor="status-note" className="mb-1 block text-sm font-medium">
            Note <span className="text-muted">(optional)</span>
          </label>
          <input
            id="status-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className={field}
          />
        </div>

        {error && (
          <p role="alert" className="text-sm text-flame-ink">
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
