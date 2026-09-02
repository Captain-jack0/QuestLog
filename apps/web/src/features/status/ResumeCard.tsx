import { useEffect, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { fieldClass } from '../../components/ui/field'
import { relativeTime } from '../../lib/time'

interface ResumeCardProps {
  leftOff: string | null
  nextStep: string | null
  loggedAt: string | null
  fromAi?: boolean
  saving?: boolean
  onSave: (values: { leftOff: string; nextStep: string }) => void
}

/** The band's own top edge, so the project header reads as one card split by hairlines. */
const BAND_CLASS = 'mt-4 border-t border-line pt-4'

/**
 * The resume context, editable in place. Saving appends a new progress log rather than
 * rewriting the old one — the timeline stays append-only, which is the whole point.
 *
 * No longer a `Card` of its own despite the name: it is a band inside the project header
 * card, divided by a hairline. A card here would have been a card inside a card, where both
 * surfaces are `bg-surface` and the inner boundary disappears.
 */
export function ResumeCard({
  leftOff,
  nextStep,
  loggedAt,
  fromAi,
  saving,
  onSave,
}: ResumeCardProps) {
  const [editing, setEditing] = useState(false)
  const [draftLeftOff, setDraftLeftOff] = useState('')
  const [draftNextStep, setDraftNextStep] = useState('')

  useEffect(() => {
    if (!editing) {
      setDraftLeftOff(leftOff ?? '')
      setDraftNextStep(nextStep ?? '')
    }
  }, [editing, leftOff, nextStep])

  if (editing) {
    return (
      <div className={BAND_CLASS}>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            onSave({ leftOff: draftLeftOff.trim(), nextStep: draftNextStep.trim() })
            setEditing(false)
          }}
        >
          <label htmlFor="resume-left-off" className="text-sm font-semibold text-muted">
            Where you left off
          </label>
          <textarea
            id="resume-left-off"
            rows={2}
            autoFocus
            value={draftLeftOff}
            onChange={(e) => setDraftLeftOff(e.target.value)}
            className={`mt-1 ${fieldClass}`}
          />

          <label htmlFor="resume-next-step" className="mt-3 block text-sm font-semibold text-muted">
            Next step
          </label>
          <textarea
            id="resume-next-step"
            rows={2}
            value={draftNextStep}
            onChange={(e) => setDraftNextStep(e.target.value)}
            className={`mt-1 ${fieldClass}`}
          />

          <div className="mt-3 flex gap-2">
            <Button type="submit" className="flex-1" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted">Saving keeps the old note in History.</p>
        </form>
      </div>
    )
  }

  return (
    <div className={BAND_CLASS}>
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Where you left off
        </h2>
        <button
          type="button"
          aria-label="Edit resume context"
          onClick={() => setEditing(true)}
          className="-mt-1 min-h-[44px] rounded-lg px-2 text-sm font-semibold text-accent"
        >
          ✎ Edit
        </button>
      </div>

      {loggedAt ? (
        <>
          <p className="mt-1 text-lg leading-snug">{leftOff || '—'}</p>
          <h2 className="mt-4 text-sm font-semibold uppercase tracking-wide text-muted">
            Next step
          </h2>
          <p className="mt-1 text-lg font-medium leading-snug">{nextStep || '—'}</p>
          <p className="mt-3 text-xs text-muted">
            {relativeTime(loggedAt)}
            {fromAi && ' · via AI'}
          </p>
        </>
      ) : (
        <p className="mt-1 text-muted">
          No resume context yet — write the first note, or pause the project to be asked for one.
        </p>
      )}
    </div>
  )
}
