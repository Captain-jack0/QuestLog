import { Card } from '../components/ui/Card'
import {
  useAreaStats,
  useBadges,
  useStreak,
  useTotalXp,
  useXpHistory,
} from '../features/gamification/queries'
import { activeDayKeys, calendarWeeks, weeklyXp } from '../features/gamification/aggregate'
import { WeeklyXpChart } from '../features/gamification/WeeklyXpChart'
import { levelForXp, xpForLevel } from '../lib/xp'

const CALENDAR_WEEKS = 12

export function ProgressScreen() {
  const totalXp = useTotalXp()
  const streak = useStreak()
  const areas = useAreaStats()
  const badges = useBadges()
  const history = useXpHistory(CALENDAR_WEEKS)

  const total = totalXp.data ?? 0
  const level = levelForXp(total)
  const floor = xpForLevel(level)
  const ceiling = xpForLevel(level + 1)
  const intoLevel = total - floor
  const needed = ceiling - floor
  const pct = needed > 0 ? Math.min(Math.round((intoLevel / needed) * 100), 100) : 0

  const active = activeDayKeys(history.data ?? [])
  const grid = calendarWeeks(CALENDAR_WEEKS)

  return (
    <div className="space-y-6 md:mx-auto md:max-w-4xl">
      <header>
        <h1 className="text-2xl font-bold">Progress</h1>
      </header>

      <Card>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-sm text-muted">Level</p>
            <p className="tabular text-4xl font-bold leading-none">{level}</p>
          </div>
          <p className="tabular text-sm text-muted">
            {intoLevel} / {needed} XP to level {level + 1}
          </p>
        </div>
        <div
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Progress to level ${level + 1}`}
          className="mt-3 h-1 w-full overflow-hidden rounded-full bg-line/50"
        >
          <div
            className="h-full rounded-full bg-accent transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-3 flex gap-4 text-sm text-muted">
          <span className="tabular">✨ {total} XP total</span>
          <span className="tabular">🔥 {streak.data?.current ?? 0} current</span>
          <span className="tabular">🏔 {streak.data?.best ?? 0} best</span>
        </div>
      </Card>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Areas</h2>
        {areas.data?.length === 0 && (
          <p className="text-sm text-muted">Areas get their own levels once they earn XP.</p>
        )}
        <div className="flex flex-wrap gap-2">
          {areas.data?.map((area) => (
            <span
              key={area.area_id}
              className="flex items-center gap-2 rounded-full bg-surface px-3 py-1.5 text-sm shadow-sm"
            >
              <span
                aria-hidden
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: area.color }}
              />
              {area.icon} {area.name}
              <span className="tabular font-semibold text-accent">lvl {area.level}</span>
              <span className="tabular text-xs text-muted">{area.total_xp} XP</span>
            </span>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
          XP per week
        </h2>
        <Card>
          <WeeklyXpChart weeks={weeklyXp(history.data ?? [], 8)} />
        </Card>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
          Last {CALENDAR_WEEKS} weeks
        </h2>
        <Card>
          <div className="flex gap-1 overflow-x-auto">
            {grid.map((week, i) => (
              <div key={i} className="flex flex-col gap-1">
                {week.map((day, d) => (
                  <span
                    key={day ?? `${i}-${d}`}
                    title={day ?? undefined}
                    aria-label={day ? `${day}: ${active.has(day) ? 'active' : 'quiet'}` : undefined}
                    className={`h-3 w-3 rounded-sm ${
                      day === null ? 'bg-transparent' : active.has(day) ? 'bg-accent' : 'bg-line/50'
                    }`}
                  />
                ))}
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">One dot per day — filled means you showed up.</p>
        </Card>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Badges</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {badges.data?.map((badge) => {
            const earned = badge.earned_at !== null
            return (
              <Card key={badge.id} className={earned ? '' : 'opacity-60'}>
                <div className={`text-2xl ${earned ? '' : 'grayscale'}`}>{badge.icon}</div>
                <p className="mt-1 font-semibold leading-tight">{badge.name}</p>
                <p className="mt-1 text-xs text-muted">{badge.description}</p>
                {earned && (
                  <p className="mt-2 text-xs font-semibold text-success-ink">
                    Earned {new Date(badge.earned_at!).toLocaleDateString()}
                  </p>
                )}
              </Card>
            )
          })}
        </div>
      </section>
    </div>
  )
}
