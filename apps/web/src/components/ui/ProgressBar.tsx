export function ProgressBar({
  done,
  total,
  tone = 'accent',
  full = false,
  label = `${done} of ${total} tasks done`,
}: {
  done: number
  total: number
  /** What the bar measures, for screen readers. Tasks unless told otherwise. */
  label?: string
  /** Fill colour. 'success' marks a finished project (StatusChip.tsx uses the same token). */
  tone?: 'accent' | 'success'
  /** Draw the fill at 100% regardless of done/total — a done project whose tasks weren't all
   *  individually marked done (some dropped, etc) still reads as finished. aria-valuenow and
   *  the label keep the real counts: this only changes the pixels. */
  full?: boolean
}) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className="h-1 w-full overflow-hidden rounded-full bg-line/50"
    >
      <div
        className={`h-full rounded-full transition-all ${tone === 'success' ? 'bg-success' : 'bg-accent'}`}
        style={{ width: `${full ? 100 : pct}%` }}
      />
    </div>
  )
}
