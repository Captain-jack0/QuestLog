import { barHeights } from './aggregate'

export interface ChartBar {
  key: string
  /** Axis label under the bar. */
  label: string
  value: number
  /** Printed above the bar; empty hides it. */
  valueText: string
  ariaLabel: string
}

/** Bar fills, each at least 3:1 against the card in both themes (contrast.test.ts). */
export const TONE = { accent: 'bg-accent/80', success: 'bg-success' } as const

/**
 * One bar per bucket (a week or a day), no axes, no library. Heights are relative to the best
 * bucket (barHeights) so a quiet stretch still reads as a shape. Each column is full height and the
 * bar sits in a `flex-1 min-h-0` slot of definite height: a percentage height inside an
 * auto-height column resolves to 0, which is how the bars once vanished.
 */
export function BarChart({ bars, tone }: { bars: ChartBar[]; tone: keyof typeof TONE }) {
  const heights = barHeights(bars.map((bar) => bar.value))

  return (
    <div className="flex h-32 gap-1.5">
      {bars.map((bar, i) => (
        <div key={bar.key} className="flex flex-1 flex-col items-center gap-1">
          <span className="tabular h-3.5 text-micro font-normal tracking-normal text-muted">
            {bar.valueText}
          </span>
          <div className="flex min-h-0 w-full flex-1 items-end">
            <div
              role="img"
              aria-label={bar.ariaLabel}
              title={bar.ariaLabel}
              className={`w-full rounded-t ${TONE[tone]}`}
              style={{ height: `${heights[i]}%` }}
            />
          </div>
          <span className="text-micro leading-none text-muted">{bar.label}</span>
        </div>
      ))}
    </div>
  )
}
