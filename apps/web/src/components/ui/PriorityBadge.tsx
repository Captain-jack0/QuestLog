import { PRIORITY_LABELS, type Priority } from '../../lib/schemas'

/**
 * high/med/low read as P1/P2/P3. Only P1 is tinted, with the same accent pair as the Planned chip
 * (StatusChip.tsx) so its contrast is already tested; P2 and P3 take Idea's quiet pair. Never
 * `alert`: that token is errors and Blocked, and high priority is not a failure.
 */
const BADGES: Record<Priority, { label: string; className: string }> = {
  high: { label: 'P1', className: 'bg-accent/15 text-accent-ink' },
  med: { label: 'P2', className: 'bg-line/30 text-muted' },
  low: { label: 'P3', className: 'bg-line/30 text-muted' },
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const { label, className } = BADGES[priority]
  return (
    <span className={`shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-micro ${className}`}>
      <span aria-hidden>{label}</span>
      <span className="sr-only">{PRIORITY_LABELS[priority]} priority</span>
    </span>
  )
}
