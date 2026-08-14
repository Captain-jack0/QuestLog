import { levelForXp, xpForLevel } from '../lib/xp'

export function ProgressScreen() {
  const totalXp = 0
  const level = levelForXp(totalXp)
  const next = xpForLevel(level + 1)

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Progress</h1>
      <div className="rounded-card bg-surface p-5 text-center shadow-sm">
        <div className="text-sm text-muted">Level</div>
        <div className="text-5xl font-bold text-accent">{level}</div>
        <div className="mx-auto mt-3 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-gray-100">
          <div className="h-full bg-accent" style={{ width: `${(totalXp / next) * 100}%` }} />
        </div>
        <div className="mt-1 text-xs text-muted">
          {totalXp} / {next} XP to level {level + 1}
        </div>
      </div>
      <p className="mt-4 text-center text-xs text-muted">
        Charts, badges & streak calendar arrive in task FE-06
      </p>
    </div>
  )
}
