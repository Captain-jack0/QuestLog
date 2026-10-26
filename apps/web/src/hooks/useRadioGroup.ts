import { useEffect, useState, type RefObject } from 'react'

/** Where an arrow key lands from `current`, wrapping at both ends; null for any other key. */
export function arrowTarget(current: number, key: string, length: number): number | null {
  const step =
    key === 'ArrowRight' || key === 'ArrowDown'
      ? 1
      : key === 'ArrowLeft' || key === 'ArrowUp'
        ? -1
        : 0
  if (step === 0 || current === -1 || length === 0) return null
  return (current + step + length) % length
}

/**
 * WAI-ARIA radio group pattern: roving tabindex + arrow key navigation.
 * The group is a single Tab stop; arrows move between options.
 *
 * `followFocus` picks between the pattern's two modes. On (the default), the arrow also
 * selects: right for a sort order or a theme, where a pick is free to undo. Off, the arrow
 * only moves focus and Space/Enter (the button's own click) selects: a status change is a
 * write that can award XP or open the resume sheet, so walking past "Done" must not make it.
 *
 * @param containerRef - Ref to the group container element
 * @param value - Currently selected option value
 * @param options - All option values in DOM order
 * @param onChange - Called when an arrow key selects a new option (followFocus only)
 * @param disabled - When true, all options are unreachable via Tab
 * @param followFocus - Whether arrow keys select as well as move focus
 * @returns tabIndex (-1 for unselected, 0 for selected) for each option
 */
export function useRadioGroup<T extends string>(
  containerRef: RefObject<HTMLElement>,
  value: T,
  options: readonly T[],
  onChange: (value: T) => void,
  disabled = false,
  followFocus = true,
): (option: T) => number {
  // With followFocus off, focus can sit away from the checked option. The Tab stop has to
  // travel with it, or Tab from there lands on the checked option instead of leaving the group.
  const [roving, setRoving] = useState<T | null>(null)
  useEffect(() => setRoving(null), [value])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const onKey = (e: KeyboardEvent) => {
      const radios = Array.from(container.querySelectorAll<HTMLElement>('[role="radio"]'))
      // keydown only reaches the container from a focused radio, so this is never -1 in practice.
      const next = arrowTarget(
        radios.indexOf(document.activeElement as HTMLElement),
        e.key,
        options.length,
      )
      if (next === null) return
      e.preventDefault()
      if (followFocus) onChange(options[next])
      radios[next]?.focus()
    }
    // The Tab stop follows whichever radio has focus (also after the window loses and regains
    // it), and leaving the group hands it back to the checked option, so coming back lands there.
    const onFocusIn = (e: FocusEvent) => {
      const radios = Array.from(container.querySelectorAll<HTMLElement>('[role="radio"]'))
      const index = radios.indexOf(e.target as HTMLElement)
      if (index !== -1) setRoving(options[index])
    }
    const onFocusOut = (e: FocusEvent) => {
      if (!container.contains(e.relatedTarget as Node | null)) setRoving(null)
    }

    container.addEventListener('keydown', onKey)
    container.addEventListener('focusin', onFocusIn)
    container.addEventListener('focusout', onFocusOut)
    return () => {
      container.removeEventListener('keydown', onKey)
      container.removeEventListener('focusin', onFocusIn)
      container.removeEventListener('focusout', onFocusOut)
    }
  }, [containerRef, options, onChange, followFocus])

  return (option: T) => {
    if (disabled) return -1
    return option === (roving ?? value) ? 0 : -1
  }
}
