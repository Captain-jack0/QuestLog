import { useEffect, useState, type RefObject } from 'react'

/**
 * WAI-ARIA radio group pattern: roving tabindex + arrow key navigation.
 * The group is a single Tab stop; arrows move between options.
 *
 * @param containerRef - Ref to the group container element
 * @param value - Currently selected option value
 * @param options - All option values in DOM order
 * @param onChange - Called when arrow keys pick a new option
 * @param disabled - When true, all options are unreachable via Tab
 * @returns tabIndex (-1 for unselected, 0 for selected) for each option
 */
export function useRadioGroup<T extends string>(
  containerRef: RefObject<HTMLElement>,
  value: T,
  options: readonly T[],
  onChange: (value: T) => void,
  disabled = false,
): (option: T) => number {
  const [focused, setFocused] = useState<T | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const onKey = (e: KeyboardEvent) => {
      const current = options.indexOf(value)
      if (current === -1) return

      let next = -1
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        next = (current + 1) % options.length
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        next = (current - 1 + options.length) % options.length
      }

      if (next === -1) return
      e.preventDefault()
      const newValue = options[next]
      onChange(newValue)
      setFocused(newValue)
    }

    container.addEventListener('keydown', onKey)
    return () => container.removeEventListener('keydown', onKey)
  }, [containerRef, value, options, onChange])

  // Focus the newly selected option after arrow key press
  useEffect(() => {
    if (!focused) return
    const container = containerRef.current
    if (!container) return

    const button = container.querySelector<HTMLElement>(
      `button[role="radio"][aria-checked="true"]`,
    )
    button?.focus()
    setFocused(null)
  }, [focused, containerRef])

  return (option: T) => {
    if (disabled) return -1
    return option === value ? 0 : -1
  }
}
