import { useEffect, useRef, type ReactNode } from 'react'

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
}

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

/**
 * Where Tab should land inside a focus trap, given how many focusable elements the sheet
 * holds *right now*. `current` is -1 when focus has escaped the sheet, in which case Tab
 * pulls it back to the near end.
 */
export function nextTrapIndex(count: number, current: number, backwards: boolean): number {
  if (count === 0) return -1
  if (current === -1) return backwards ? count - 1 : 0
  return (current + (backwards ? -1 : 1) + count) % count
}

export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)

  // Most callers pass an inline arrow, so keeping `onClose` out of the effect deps below is
  // what stops a parent re-render from re-running the trap and yanking focus mid-typing.
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    if (!open) return
    const panel = panelRef.current
    const openedBy = document.activeElement as HTMLElement | null

    // Read live on every Tab: sheet content moves under us (PickerSheet grows a search box
    // past 6 options, lists filter as you type), so a list captured on open would go stale.
    const focusable = () => Array.from(panel?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])

    focusable()[0]?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab') return
      const items = focusable()
      const index = nextTrapIndex(
        items.length,
        items.indexOf(document.activeElement as HTMLElement),
        e.shiftKey,
      )
      if (index === -1) return
      e.preventDefault()
      items[index].focus()
    }

    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      // The opener can be gone by now (a thread card that got snoozed away).
      if (openedBy && document.contains(openedBy)) openedBy.focus()
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-30" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-ink/30" onClick={onClose} />
      <div
        ref={panelRef}
        className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-2xl bg-surface p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
        {title && <h2 className="mb-3 text-lg font-bold">{title}</h2>}
        {children}
      </div>
    </div>
  )
}
