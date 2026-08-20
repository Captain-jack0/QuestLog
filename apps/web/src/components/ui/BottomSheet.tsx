import { useEffect, type ReactNode } from 'react'

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
}

export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-30" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-ink/30" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-2xl bg-surface p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
        {title && <h2 className="mb-3 text-lg font-bold">{title}</h2>}
        {children}
      </div>
    </div>
  )
}
