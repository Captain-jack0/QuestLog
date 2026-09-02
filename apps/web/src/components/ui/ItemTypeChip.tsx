type ItemType = 'task' | 'project'

const labels: Record<ItemType, string> = {
  task: 'Task',
  project: 'Project',
}

/**
 * What a row *is* — a whole project, or one task inside one. A different axis from StatusChip,
 * which says what state it is in, so the two are deliberately not the same shape: status is a
 * filled `rounded-full` pill carrying meaning in its colour, this is a neutral `rounded-lg`
 * outline that stays quiet beside it. Colour in this app is spoken for (status, life areas),
 * and inventing a third palette here would make "project" look like a state.
 *
 * `border-line` rather than the `bg-paper` fill alone: on the calm theme paper (250 250 247)
 * sits on surface (255 255 255) and the box would be invisible; the hairline flips with the
 * theme and reads on both.
 */
export function ItemTypeChip({ itemType }: { itemType: ItemType }) {
  return (
    <span className="shrink-0 whitespace-nowrap rounded-lg border border-line bg-paper px-1.5 py-0.5 text-2xs font-semibold text-muted">
      {labels[itemType]}
    </span>
  )
}

/** The chip's word, for places that need it in a string (aria-label, headings). */
export const itemTypeLabel = (itemType: ItemType) => labels[itemType]
