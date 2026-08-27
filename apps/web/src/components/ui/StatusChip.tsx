import type { ItemStatus } from '../../lib/schemas'

const styles: Record<ItemStatus, { label: string; className: string }> = {
  idea: { label: 'Idea', className: 'bg-line/50 text-muted' },
  planned: { label: 'Planned', className: 'bg-accent/15 text-accent' },
  in_progress: { label: 'In progress', className: 'bg-accent text-paper' },
  paused: { label: 'Paused', className: 'bg-flame/20 text-flame-ink' },
  blocked: { label: 'Blocked', className: 'bg-alert/20 text-alert-ink' },
  done: { label: 'Done', className: 'bg-success/20 text-success-ink' },
  dropped: { label: 'Dropped', className: 'bg-line/40 text-muted line-through' },
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
