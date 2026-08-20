import type { ItemStatus } from '../../lib/schemas'

const styles: Record<ItemStatus, { label: string; className: string }> = {
  idea: { label: 'Idea', className: 'bg-gray-100 text-muted' },
  planned: { label: 'Planned', className: 'bg-blue-50 text-blue-700' },
  in_progress: { label: 'In progress', className: 'bg-accent/10 text-accent' },
  paused: { label: 'Paused', className: 'bg-flame/10 text-flame-ink' },
  blocked: { label: 'Blocked', className: 'bg-rose-50 text-rose-700' },
  done: { label: 'Done', className: 'bg-success/10 text-success-ink' },
  dropped: { label: 'Dropped', className: 'bg-gray-100 text-gray-400' },
}

export function StatusChip({ status }: { status: ItemStatus }) {
  const { label, className } = styles[status]
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${className}`}>
      {label}
    </span>
  )
}

export const statusLabel = (status: ItemStatus) => styles[status].label

/** The chip's colour pair, so pickers can reuse it without re-deriving the palette. */
export const statusTone = (status: ItemStatus) => styles[status].className
