import type { WeekBucket } from './aggregate'

/**
 * Eight bars, no axes, no library. Heights are relative to the best week so a quiet
 * stretch still reads as a shape.
 */
export function WeeklyXpChart({ weeks }: { weeks: WeekBucket[] }) {
  const peak = Math.max(...weeks.map((w) => w.xp), 1)

  return (
    <div className="flex h-32 items-end gap-1.5">
      {weeks.map((week) => (
        <div key={week.weekStart} className="flex flex-1 flex-col items-center gap-1">
          <span className="tabular text-3xs text-muted">{week.xp || ''}</span>
          <div
            role="img"
            aria-label={`Week of ${week.label}: ${week.xp} XP`}
            title={`${week.xp} XP`}
            className="w-full rounded-t bg-accent/80"
            style={{ height: `${Math.max((week.xp / peak) * 100, week.xp > 0 ? 4 : 2)}%` }}
          />
          <span className="text-3xs leading-none text-muted">{week.label.split(' ')[0]}</span>
        </div>
      ))}
    </div>
  )
}
