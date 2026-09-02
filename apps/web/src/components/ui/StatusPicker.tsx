import { ITEM_STATUSES, type ItemStatus } from '../../lib/schemas'
import { statusLabel, statusTone } from './StatusChip'

interface StatusPickerProps {
  value: ItemStatus
  onChange: (status: ItemStatus) => void
  label: string
  /** Compact rows (task lists) drop to the statuses a task actually moves between. */
  compact?: boolean
  disabled?: boolean
}

/**
 * `dropped` is here despite costing a second line: it is how you leave a task behind, and
 * without it the card offers no way to — the edit sheet was the only route.
 *
 * A fifth chip cannot fit, whatever it is called. At 390px the card's inner width is 326px
 * and the first four chips measure 299px, so the 27px left over is less than the 44px a
 * touch target needs. The picker therefore grows 44px → 94px, and the card 228px → 278px.
 *
 * That cost is not new, only spread: at 320px all four chips already wrap, and `idea`,
 * `planned` and `dropped` cards have shown five chips ever since `value` was prepended below.
 */
const QUICK: ItemStatus[] = ['in_progress', 'paused', 'blocked', 'done', 'dropped']

/**
 * One tap per status instead of open-scroll-pick. Rendered as a radio group so keyboard
 * and screen readers get the same single choice the eye sees.
 */
export function StatusPicker({
  value,
  onChange,
  label,
  compact = false,
  disabled = false,
}: StatusPickerProps) {
  const options = compact ? Array.from(new Set([value, ...QUICK])) : ITEM_STATUSES

  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((status) => {
        const active = status === value
        return (
          <button
            key={status}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={`${label}: ${statusLabel(status)}`}
            disabled={disabled}
            onClick={() => !active && onChange(status)}
            className={`min-h-[44px] rounded-full px-3 text-xs font-semibold transition disabled:opacity-40 ${
              active
                ? `${statusTone(status)} ring-2 ring-accent ring-offset-1`
                : 'bg-paper text-muted hover:bg-line/40'
            }`}
          >
            {statusLabel(status)}
          </button>
        )
      })}
    </div>
  )
}
