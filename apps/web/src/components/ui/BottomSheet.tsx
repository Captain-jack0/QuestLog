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

const LOCK_KEYS = ['position', 'top', 'width', 'overflow', 'paddingRight'] as const
type LockStyle = Record<(typeof LOCK_KEYS)[number], string>

/**
 * How the body is frozen while a sheet is open. iOS Safari keeps scrolling the page behind an
 * overlay when only `overflow: hidden` is set, so the body is pinned with `position: fixed`
 * instead and the scroll offset it loses is carried in `top` (restored on close).
 *
 * Pinning collapses the document, which takes the desktop scrollbar with it and shifts the
 * page sideways; `gutter` is that scrollbar's width and pads the gap back. Touch browsers
 * report 0 there and get no padding.
 */
export function bodyLockStyle(scrollY: number, gutter: number): LockStyle {
  return {
    position: 'fixed',
    top: `-${scrollY}px`,
    width: '100%',
    overflow: 'hidden',
    paddingRight: gutter > 0 ? `${gutter}px` : '',
  }
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
    // Only ever one sheet is open at a time (see TaskSheet), so this lock never nests: every
    // mount point sits under the same `z-30` overlay, which swallows the clicks that would
    // open a second one. Nesting would need a way to hand the page back to the right offset,
    // and there is nothing to hand it to yet.
    const body = document.body
    const scrollY = window.scrollY
    const gutter = window.innerWidth - document.documentElement.clientWidth
    const previous = {} as LockStyle
    for (const key of LOCK_KEYS) previous[key] = body.style[key]
    Object.assign(body.style, bodyLockStyle(scrollY, gutter))
    return () => {
      Object.assign(body.style, previous)
      // The body was pinned, so the browser forgot where the page was; put it back.
      window.scrollTo(0, scrollY)
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
