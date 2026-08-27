/**
 * The one place form control styling lives. `<input>`, `<textarea>` and `<select>` all share
 * the same shell, so this is a class string rather than a component: a component would have to
 * be polymorphic over three element types and forward a ref for every one of them, and it would
 * buy no shared behaviour or markup in return.
 *
 * Background rule: a field is always `bg-paper`, never `bg-surface`. Cards and bottom sheets are
 * `bg-surface`, so `bg-paper` reads as a well sunk into them; on the page itself (body is
 * `bg-paper`) `border-line` still draws the field. The reverse rule would make every field inside
 * a card invisible, which is exactly how Login used to look.
 *
 * Nothing here cancels the outline: the global `:focus-visible` ring in index.css is the focus
 * indicator and `focus-ring.test.ts` guards it. `focus:border-accent` is decoration on top.
 */
const shell = 'rounded-xl border border-line bg-paper focus:border-accent'

/** Stacked field: its own label above, full width, height from vertical padding. */
export const fieldClass = `w-full ${shell} px-4 py-3 text-base`

/** Field sharing a row with other controls: touch height instead of vertical padding. */
export const rowFieldClass = `min-h-[44px] ${shell} px-4 text-base`

/** Small select tucked beside other controls in a row. */
export const compactFieldClass = `min-h-[44px] ${shell} px-3 text-sm`
