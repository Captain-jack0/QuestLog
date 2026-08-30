import { Card } from './Card'

interface EmptyStateProps {
  /**
   * The "there is nothing here" line. An emoji, where a screen wants one, is part of this
   * string — every existing one already sat at the end of the sentence, so a separate icon
   * prop would only re-join what the copy already spells out.
   */
  title: string
  /** Second line: what fills the space, or what to do about it. */
  description?: string
  /**
   * Makes the whole placeholder the call to action. The dashed edge is what marks it as a
   * slot waiting to be filled rather than a card with content in it.
   */
  onAction?: () => void
}

/**
 * The one place "nothing here yet" is drawn. It is a card, because on a screen an empty state
 * stands in for the content that is missing and needs the same footprint.
 *
 * Deliberately not used for the status lines inside bottom sheets (`PickerSheet`,
 * `FocusPickerSheet`): those sit on a surface that is already a sheet, where a `bg-surface`
 * card would be invisible, and each one has a `Loading…` twin styled identically. They belong
 * to that pair, not here.
 *
 * Nor for `ResumeCard`'s "No resume context yet…" line, for the same shape of reason one level
 * in: it is a branch inside a card that already has its own heading and Edit button, so this
 * would nest a card in a card. Its `mt-1` is not drift either — it is the gap from the `<h2>`
 * directly above, the same one the filled branch's first `<p>` uses in that exact slot. Aligning
 * it with the sheets' bare `text-muted` paragraphs would only close it up against the heading.
 *
 * Spans rather than paragraphs: with `onAction` the whole thing is wrapped in a `<button>`,
 * which may only contain phrasing content.
 */
export function EmptyState({ title, description, onAction }: EmptyStateProps) {
  const card = (
    <Card className={`text-center ${onAction ? 'border border-dashed border-line' : ''}`}>
      <span className="block font-medium">{title}</span>
      {description && <span className="mt-1 block text-sm text-muted">{description}</span>}
    </Card>
  )

  if (!onAction) return card

  return (
    <button type="button" onClick={onAction} className="block min-h-[44px] w-full">
      {card}
    </button>
  )
}
