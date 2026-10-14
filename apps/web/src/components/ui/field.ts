/**
 * The one place form control styling lives. `<input>`, `<textarea>` and `<select>` all share
 * the same shell, so this is a class string rather than a component: a component would have to
 * be polymorphic over three element types and forward a ref for every one of them, and it would
 * buy no shared behaviour or markup in return.
 *
 * Background rule: a field is always `bg-surface-sunken`, never `bg-surface`. Cards and bottom
 * sheets are `bg-surface` (or raised), so the sunken plane reads as a well cut into them; on the
 * page itself it sits a step below the paper, and `border-line` still draws it. In calm, sunken
 * *is* paper (index.css), so daylight fields look exactly as they did. The reverse rule would make
 * every field inside a card invisible, which is exactly how Login used to look.
 *
 * Nothing here cancels the outline: the global `:focus-visible` ring in index.css is the focus
 * indicator and `focus-ring.test.ts` guards it. `focus:border-accent` is decoration on top.
 */
const shell = 'rounded-xl border border-line bg-surface-sunken focus:border-accent'

/** Stacked field: its own label above, full width, height from vertical padding. */
export const fieldClass = `w-full ${shell} px-4 py-3 text-lead-mobile`

/** Field sharing a row with other controls: touch height instead of vertical padding. */
export const rowFieldClass = `min-h-[44px] ${shell} px-4 text-lead-mobile`

/** Small select tucked beside other controls in a row. */
export const compactFieldClass = `min-h-[44px] ${shell} px-3 text-body`
