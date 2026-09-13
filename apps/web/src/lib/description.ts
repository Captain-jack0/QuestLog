/**
 * The one rule for every description the app writes: an empty one is `null`, never `''`.
 *
 * Three forms reach the column — the quick-add row, which sends nothing; a sheet with the box
 * left untouched, which sends `''`; and a box holding only whitespace. Storing them as three
 * different values makes the same empty task read differently depending on which door it came
 * through, and `''` is the one that lies: it is a description, of nothing.
 *
 * It lives here rather than beside any one caller because tasks and projects both write
 * descriptions, and a second copy of this rule is a copy that drifts.
 */
export function normalizeDescription(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

/**
 * The same rule for a partial update, where an absent `description` means "leave it alone" and
 * has to stay absent — normalising it to `null` would blank the column on every edit that only
 * meant to change the title.
 */
export function withNormalizedDescription<T extends { description?: string }>(
  fields: T,
): Omit<T, 'description'> & { description?: string | null } {
  if (fields.description === undefined) return fields
  return { ...fields, description: normalizeDescription(fields.description) }
}
