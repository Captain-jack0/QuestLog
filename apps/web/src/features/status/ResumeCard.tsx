import { useEffect, useState, type ReactNode } from 'react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { fieldClass, rowFieldClass } from '../../components/ui/field'
import { Icon } from '../../components/ui/Icon'
import { relativeTime } from '../../lib/time'

interface ResumeCardProps {
  leftOff: string | null
  nextStep: string | null
  loggedAt: string | null
  fromAi?: boolean
  saving?: boolean
  /** The life area's colour: the same edge the area's own cards carry. */
  edgeColor?: string | null
  /** The box's one filled action — the caller's 25-minute focus start. */
  focusAction?: ReactNode
  onSave: (values: { leftOff: string; nextStep: string }) => void
  /**
   * Appends a log carrying this note and the current context unchanged. `done` runs once the
   * write lands, so a failed save keeps the typed note on screen instead of eating it.
   */
  onAddNote?: (note: string, done: () => void) => void
}

const LABEL_CLASS = 'text-micro uppercase text-muted'

/**
 * The resume context, editable in place. Saving appends a new progress log rather than
 * rewriting the old one — the timeline stays append-only, which is the whole point.
 *
 * A card of its own again, after the header: the resume box is the first thing a returning
 * captain needs, so it gets its own boundary and the area's colour edge. The next step is the
 * largest text in the box — it is what you act on — and "where I left off" is the quoted well
 * beneath its label, read once and set down.
 */
export function ResumeCard({
  leftOff,
  nextStep,
  loggedAt,
  fromAi,
  saving,
  edgeColor,
  focusAction,
  onSave,
  onAddNote,
}: ResumeCardProps) {
  const [editing, setEditing] = useState(false)
  const [draftLeftOff, setDraftLeftOff] = useState('')
  const [draftNextStep, setDraftNextStep] = useState('')
  const [noting, setNoting] = useState(false)
  const [note, setNote] = useState('')

  useEffect(() => {
    if (!editing) {
      setDraftLeftOff(leftOff ?? '')
      setDraftNextStep(nextStep ?? '')
    }
  }, [editing, leftOff, nextStep])

  if (editing) {
    return (
      <Card edgeColor={edgeColor}>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            onSave({ leftOff: draftLeftOff.trim(), nextStep: draftNextStep.trim() })
            setEditing(false)
          }}
        >
          <label htmlFor="resume-left-off" className="text-body font-semibold text-muted">
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

          <label
            htmlFor="resume-next-step"
            className="mt-3 block text-body font-semibold text-muted"
          >
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
          <p className="mt-2 text-caption text-muted">Saving keeps the old note in History.</p>
        </form>
      </Card>
    )
  }

  return (
    <Card edgeColor={edgeColor}>
      <div className="flex items-start justify-between gap-2">
        <h2 className={`pt-3 ${LABEL_CLASS}`}>Where I left off</h2>
        <button
          type="button"
          aria-label="Edit resume context"
          onClick={() => {
            setNoting(false)
            setEditing(true)
          }}
          className="btn-quiet min-h-[44px] shrink-0 rounded-lg px-2 text-body font-semibold text-accent-ink"
        >
          <Icon name="edit" /> Edit
        </button>
      </div>

      {loggedAt ? (
        <>
          <blockquote className="mt-1 break-words rounded-xl border border-line bg-surface-sunken px-3 py-2 text-body italic">
            {leftOff || '—'}
          </blockquote>
          <h2 className={`mt-4 ${LABEL_CLASS}`}>Next step</h2>
          <p className="mt-1 break-words text-title-md">{nextStep || '—'}</p>
          <p className="mt-2 text-caption text-muted">
            {relativeTime(loggedAt)}
            {fromAi && ' · via AI'}
          </p>
        </>
      ) : (
        <p className="mt-1 text-muted">
          No resume context yet — write the first note, or pause the project to be asked for one.
        </p>
      )}

      {noting && onAddNote ? (
        <form
          className="mt-4"
          onSubmit={(e) => {
            e.preventDefault()
            const text = note.trim()
            if (!text) return
            onAddNote(text, () => {
              setNote('')
              setNoting(false)
            })
          }}
        >
          <label htmlFor="resume-micro-note" className="text-body font-semibold text-muted">
            Micro-note
          </label>
          {/* Wraps like the quick-add row: the field keeps the full width at 320px and the two
              buttons drop below it rather than squeezing it. */}
          <div className="mt-1 flex flex-wrap gap-2">
            <input
              id="resume-micro-note"
              autoFocus
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="A line for the log…"
              className={`w-full ${rowFieldClass}`}
            />
            <Button type="submit" disabled={saving || !note.trim()}>
              {saving ? 'Saving…' : 'Save note'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setNoting(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        (focusAction || onAddNote) && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {focusAction}
            {onAddNote && (
              <Button type="button" variant="ghost" onClick={() => setNoting(true)}>
                <Icon name="add" /> Micro-note
              </Button>
            )}
          </div>
        )
      )}
    </Card>
  )
}
