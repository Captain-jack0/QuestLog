import { useState, type ReactNode } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { Card } from '../components/ui/Card'
import { CardSkeleton } from '../components/ui/Skeleton'
import { EmptyState } from '../components/ui/EmptyState'
import { Icon, type IconName } from '../components/ui/Icon'
import {
  useAreaStats,
  useBadges,
  useProfile,
  useProgressLogCount,
  useStreak,
  useTotalXp,
  useXpHistory,
  type AreaStat,
  type BadgeRow,
} from '../features/gamification/queries'
import {
  activeAreasLastWeek,
  calendarWeeks,
  dailyFocus,
  dailyXp,
  dailyXpTotals,
  effectiveStreak,
  intensity,
  INTENSITY_FLOORS,
  INTENSITY_SHADES,
  weeklyFocus,
  weeklyXp,
  type DayBucket,
  xpInLastDays,
  type XpEvent,
} from '../features/gamification/aggregate'
import { badgeProgress, type BadgeCounts } from '../features/gamification/badgeProgress'
import { BarChart, type ChartBar } from '../features/gamification/BarChart'
import { useDailyFocus } from '../features/timer/queries'
import { formatMinutes } from '../features/timer/pomodoro'
import { LOCALE } from '../lib/time'
import { levelForXp, XP, xpForLevel } from '../lib/xp'

const CALENDAR_WEEKS = 12
const CHART_WEEKS = 8
const CHART_DAYS = 7
/** streaks.freeze_tokens is checked `between 0 and 2` in the schema. */
const MAX_SHIELDS = 2

/**
 * The award table, generated from XP so the card can't drift from what the app pays.
 * XP.groomStale is left out on purpose: the web client never calls rpc_groom_stale, so nobody
 * here can earn it. List it again once a screen does.
 */
const XP_RULES: [string, string][] = [
  ['Bonus: a status update that is your first XP of the day', `+${XP.dailyCheckIn}`],
  ['Finish a task (S / M / L)', `+${XP.taskDone.S} / ${XP.taskDone.M} / ${XP.taskDone.L}`],
  ['Status update that doesn’t finish anything', `+${XP.progressUpdate}`],
  ['Finish a project', `+${XP.projectDone}`],
  ['Pick today’s focus (once a day)', `+${XP.pickFocus}`],
  [
    `Focus time: per completed ${XP.focus.minutes}-minute block in one session (max ${XP.focus.dailyCap}/day)`,
    `+${XP.focus.xp}`,
  ],
]

/** Legend text for INTENSITY_SHADES, same order. */
const SHADE_LABELS = [
  'No XP',
  `${INTENSITY_FLOORS[0]}–${INTENSITY_FLOORS[1] - 1}`,
  `${INTENSITY_FLOORS[1]}–${INTENSITY_FLOORS[2] - 1}`,
  `${INTENSITY_FLOORS[2]}+ XP`,
]

export function ProgressScreen() {
  const { session } = useAuth()
  const totalXp = useTotalXp()
  const streak = useStreak()
  const history = useXpHistory(CALENDAR_WEEKS)
  const progressLogs = useProgressLogCount(session?.user.id)
  const profile = useProfile()

  const total = totalXp.data ?? 0
  const events = history.data ?? []
  // The streak's "today" is the profile's timezone, so wait for the profile; if it fails, fall
  // back to the browser's timezone (timezone undefined) rather than hiding the streak.
  const profileReady = !profile.isPending
  const currentStreak = effectiveStreak(streak.data ?? null, profile.data?.timezone)
  /** A count whose query is loading or failed stays undefined, so its badge shows no counter. */
  const ready = (query: { isPending: boolean; isError: boolean }) =>
    !query.isPending && !query.isError
  const counts: BadgeCounts = {
    streak: ready(streak) && profileReady ? currentStreak : undefined,
    level: ready(totalXp) ? levelForXp(total) : undefined,
    progressLogs: ready(progressLogs) ? progressLogs.data : undefined,
    activeAreas: ready(history) ? activeAreasLastWeek(events) : undefined,
  }

  return (
    <div className="space-y-6 md:mx-auto md:max-w-4xl">
      <header>
        <h1 className="text-title-lg font-bold">Progress</h1>
      </header>

      {totalXp.isError || streak.isError ? (
        <p className="text-flame-ink">Could not load your level. Pull down to retry.</p>
      ) : totalXp.isPending || streak.isPending || !profileReady ? (
        <CardSkeleton rows={1} />
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          <LevelCard total={total} weekXp={history.data && xpInLastDays(history.data)} />
          <StreakCard
            current={currentStreak}
            best={streak.data?.best ?? 0}
            shields={streak.data?.freeze_tokens ?? 0}
          />
        </div>
      )}

      <section>
        <SectionHeading icon="calendar_today">Last {CALENDAR_WEEKS} weeks</SectionHeading>
        {history.isError ? (
          <p className="text-flame-ink">Could not load your activity. Pull down to retry.</p>
        ) : history.isPending ? (
          <CardSkeleton rows={1} />
        ) : (
          <ActivityGrid events={events} />
        )}
      </section>

      <Charts
        history={history}
        timeZone={profile.data?.timezone}
        timeZonePending={profile.isPending}
      />

      <AreaLevels />

      <Badges counts={counts} />

      <section>
        <SectionHeading icon="stars">How XP works</SectionHeading>
        <Card>
          <ul className="divide-y divide-line">
            {XP_RULES.map(([action, xp]) => (
              <li key={action} className="flex items-baseline justify-between gap-4 py-2">
                <span className="text-body">{action}</span>
                <span className="tabular shrink-0 text-body-medium text-success-ink">{xp} XP</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-caption text-muted">XP is never taken away; no leaderboards.</p>
        </Card>
      </section>
    </div>
  )
}

function SectionHeading({ icon, children }: { icon: IconName; children: ReactNode }) {
  return (
    <h2 className="mb-2 flex items-center gap-1.5 text-body font-semibold uppercase tracking-wide text-muted">
      <Icon name={icon} /> {children}
    </h2>
  )
}

/** A thin XP bar; `label` names it for screen readers. */
function Meter({ pct, label, className = '' }: { pct: number; label: string; className?: string }) {
  const clamped = Math.min(Math.max(Math.round(pct), 0), 100)
  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={`h-1.5 w-full overflow-hidden rounded-full bg-line/50 ${className}`}
    >
      <div
        className="h-full rounded-full bg-accent transition-all"
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}

/** Share of the way from the start of `level` to the next, as a percentage. */
function levelPct(xp: number, level: number): number {
  const floor = xpForLevel(level)
  const needed = xpForLevel(level + 1) - floor
  return needed > 0 ? ((xp - floor) / needed) * 100 : 0
}

function LevelCard({ total, weekXp }: { total: number; weekXp: number | undefined }) {
  const level = levelForXp(total)
  const ceiling = xpForLevel(level + 1)

  return (
    <Card className="md:col-span-2">
      <p className="text-micro uppercase text-muted">Level</p>
      <div className="flex items-end justify-between gap-4">
        <p className="tabular text-display-lg-mobile font-bold leading-none">{level}</p>
        <p className="tabular text-body text-muted">
          <span className="font-semibold text-ink">{total}</span> / {ceiling} XP
        </p>
      </div>
      <Meter
        className="mt-3"
        pct={levelPct(total, level)}
        label={`Progress to level ${level + 1}`}
      />
      <div className="mt-3 flex flex-wrap justify-between gap-2 text-body text-muted">
        <span className="tabular">
          {ceiling - total} XP to level {level + 1}
        </span>
        {weekXp !== undefined && (
          <span className="tabular font-semibold text-success-ink">+{weekXp} XP / 7d</span>
        )}
      </div>
      <p className="mt-2 text-micro text-muted">
        Reaching level n takes 100 × n<sup>1.5</sup> XP in total
      </p>
    </Card>
  )
}

function StreakCard({
  current,
  best,
  shields,
}: {
  current: number
  best: number
  shields: number
}) {
  return (
    <Card>
      <p className="text-micro uppercase text-muted">Streak</p>
      <p className="flex items-baseline gap-2">
        <Icon name="local_fire_department" className="icon-xl self-center text-flame-ink" />
        <span className="tabular text-display-lg-mobile font-bold leading-none">{current}</span>
        <span className="text-body text-muted">{current === 1 ? 'day' : 'days'}</span>
      </p>
      <p className="tabular mt-1 text-body text-muted">
        <Icon name="military_tech" /> Best: {best} {best === 1 ? 'day' : 'days'}
      </p>
      <div className="mt-3 border-t border-line pt-3">
        <p className="flex items-center gap-1">
          {Array.from({ length: MAX_SHIELDS }, (_, i) => (
            <Icon
              key={i}
              name="shield"
              className={`icon-xl ${i < shields ? 'text-accent-ink' : 'text-line'}`}
            />
          ))}
          <span className="tabular ml-1 text-body-medium">
            {shields} / {MAX_SHIELDS} shields
          </span>
        </p>
        <p className="mt-1 text-caption text-muted">
          You earn one every 7 streak days. Come back after a gap and a shield keeps the streak
          going.
        </p>
      </div>
    </Card>
  )
}

function ActivityGrid({ events }: { events: XpEvent[] }) {
  const daily = dailyXpTotals(events)
  const grid = calendarWeeks(CALENDAR_WEEKS)
  const days = grid.flat().filter((day): day is string => day !== null)
  const activeDays = days.filter((day) => daily.has(day)).length
  const gridXp = days.reduce((sum, day) => sum + (daily.get(day) ?? 0), 0)

  return (
    <Card>
      {/* One summary for the whole grid: 84 labelled cells would be a wall of noise to a screen
          reader. Each cell keeps a hover title. */}
      <div
        role="img"
        aria-label={`Last ${CALENDAR_WEEKS} weeks: XP on ${activeDays} of ${days.length} days, ${gridXp} XP in total`}
        className="flex gap-1 overflow-x-auto"
      >
        {grid.map((week, i) => (
          <div key={i} className="flex flex-col gap-1">
            {week.map((day, d) => (
              <span
                key={day ?? `${i}-${d}`}
                title={day ? `${day}: ${daily.get(day) ?? 0} XP` : undefined}
                className={`h-3 w-3 rounded-sm ${
                  day === null ? 'bg-transparent' : INTENSITY_SHADES[intensity(daily.get(day) ?? 0)]
                }`}
              />
            ))}
          </div>
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-muted">
        {INTENSITY_SHADES.map((shade, i) => (
          <li key={shade} className="flex items-center gap-1">
            <span aria-hidden className={`h-3 w-3 rounded-sm ${shade}`} />
            {SHADE_LABELS[i]}
          </li>
        ))}
      </ul>
    </Card>
  )
}

type ChartRange = 'weekly' | 'daily'

const RANGES: [ChartRange, string][] = [
  ['weekly', 'Weekly'],
  ['daily', 'Daily'],
]

/** "Today, Tue, Oct 13" for the last bucket, the bare date for the rest. */
const dayName = (day: DayBucket, i: number) =>
  i === CHART_DAYS - 1 ? `Today, ${day.date}` : day.date

/** XP and focus side by side, both by week or both by day. The choice is state, not stored. */
function Charts({
  history,
  timeZone,
  timeZonePending,
}: {
  history: ReturnType<typeof useXpHistory>
  /** The profile's timezone; undefined when the profile failed, and the daily buckets then fall
   * back to the browser's timezone. */
  timeZone: string | undefined
  timeZonePending: boolean
}) {
  const [range, setRange] = useState<ChartRange>('weekly')
  const focus = useDailyFocus(CALENDAR_WEEKS * 7)
  const daily = range === 'daily'
  // Daily buckets cut at midnight in the profile's timezone: wait for it, or the bars would
  // shift once it lands. Weekly buckets don't use it.
  const tzWait = daily && timeZonePending
  const period = daily ? `${CHART_DAYS} days` : `${CHART_WEEKS} weeks`

  const xpBars: ChartBar[] = daily
    ? dailyXp(history.data ?? [], timeZone, CHART_DAYS).map((day, i) => ({
        key: day.key,
        label: day.label,
        value: day.xp,
        valueText: day.xp ? String(day.xp) : '',
        ariaLabel: `${dayName(day, i)}: ${day.xp} XP`,
      }))
    : weeklyXp(history.data ?? [], CHART_WEEKS).map((week) => ({
        key: week.weekStart,
        label: week.label.split(' ')[0],
        value: week.xp,
        valueText: week.xp ? String(week.xp) : '',
        ariaLabel: `Week of ${week.label}: ${week.xp} XP`,
      }))
  const focusBars: ChartBar[] = daily
    ? dailyFocus(focus.data ?? [], timeZone, CHART_DAYS).map((day, i) => ({
        key: day.key,
        label: day.label,
        value: day.seconds,
        valueText: day.seconds > 0 ? formatMinutes(day.seconds) : '',
        ariaLabel: `${dayName(day, i)}: ${formatMinutes(day.seconds)} focused`,
      }))
    : weeklyFocus(focus.data ?? [], CHART_WEEKS).map((week) => ({
        key: week.weekStart,
        label: week.label.split(' ')[0],
        value: week.seconds,
        valueText: week.seconds > 0 ? formatMinutes(week.seconds) : '',
        ariaLabel: `Week of ${week.label}: ${formatMinutes(week.seconds)} focused`,
      }))
  const totalXp = xpBars.reduce((sum, bar) => sum + bar.value, 0)
  const totalFocus = focusBars.reduce((sum, bar) => sum + bar.value, 0)

  return (
    <div className="space-y-3">
      <div
        role="radiogroup"
        aria-label="Chart range"
        className="flex w-fit rounded-full bg-surface"
      >
        {RANGES.map(([value, label]) => {
          const active = range === value
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setRange(value)}
              className={`min-h-[44px] rounded-full px-4 text-caption font-semibold transition ${
                active ? 'bg-accent/10 text-accent-ink' : 'text-muted hover:bg-line/40'
              }`}
            >
              {label}
            </button>
          )
        })}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <section>
          <SectionHeading icon="bar_chart">XP per {daily ? 'day' : 'week'}</SectionHeading>
          {history.isError ? (
            <p className="text-flame-ink">Could not load your XP history. Pull down to retry.</p>
          ) : history.isPending || tzWait ? (
            <CardSkeleton rows={1} />
          ) : (
            <Card>
              <BarChart tone="accent" bars={xpBars} />
              <p className="mt-2 text-caption text-muted">
                {totalXp} XP in the last {period}
              </p>
            </Card>
          )}
        </section>

        <section>
          <SectionHeading icon="timer">Focus time per {daily ? 'day' : 'week'}</SectionHeading>
          {focus.isError ? (
            <p className="text-flame-ink">Could not load your focus time. Pull down to retry.</p>
          ) : focus.isPending || tzWait ? (
            <CardSkeleton rows={1} />
          ) : (
            <Card>
              <BarChart tone="success" bars={focusBars} />
              <p className="mt-2 text-caption text-muted">
                {totalFocus > 0
                  ? `${formatMinutes(totalFocus)} tracked in the last ${period}`
                  : 'Start a timer on a task to see your focus here.'}
              </p>
            </Card>
          )}
        </section>
      </div>
    </div>
  )
}

function AreaLevels() {
  const areas = useAreaStats()

  return (
    <section>
      <SectionHeading icon="grid_view">Areas</SectionHeading>
      {areas.isPending && <CardSkeleton rows={1} />}
      {areas.isError && (
        <p className="text-flame-ink">Could not load area levels. Pull down to retry.</p>
      )}
      {areas.data?.length === 0 && (
        <EmptyState title="Areas get their own levels once they earn XP." />
      )}
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
        {areas.data?.map((area) => (
          <AreaLevelCard key={area.area_id} area={area} />
        ))}
      </div>
    </section>
  )
}

function AreaLevelCard({ area }: { area: AreaStat }) {
  return (
    <Card edgeColor={area.color} className="pl-5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="truncate font-semibold">
          {area.icon} {area.name}
        </p>
        <span className="tabular shrink-0 text-body-medium text-accent-ink">
          Level {area.level}
        </span>
      </div>
      <Meter
        className="mt-2"
        pct={levelPct(area.total_xp, area.level)}
        label={`${area.name}: progress to level ${area.level + 1}`}
      />
      <p className="tabular mt-1 text-caption text-muted">
        {area.total_xp} / {xpForLevel(area.level + 1)} XP
      </p>
    </Card>
  )
}

function Badges({ counts }: { counts: BadgeCounts }) {
  const badges = useBadges()
  const earned = badges.data?.filter((badge) => badge.earned_at !== null) ?? []
  const locked = badges.data?.filter((badge) => badge.earned_at === null) ?? []

  return (
    <section>
      <div className="flex items-baseline justify-between gap-2">
        <SectionHeading icon="workspace_premium">Badges</SectionHeading>
        {badges.data && (
          <span className="tabular text-caption text-muted">
            {earned.length} of {badges.data.length} earned
          </span>
        )}
      </div>
      {badges.isPending && <CardSkeleton rows={1} />}
      {badges.isError && (
        <p className="text-flame-ink">Could not load badges. Pull down to retry.</p>
      )}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {earned.map((badge) => (
          <BadgeCard key={badge.id} badge={badge}>
            <p className="mt-2 flex items-center gap-1 text-caption font-semibold text-success-ink">
              <Icon name="check_circle" /> Earned{' '}
              {new Date(badge.earned_at!).toLocaleDateString(LOCALE)}
            </p>
          </BadgeCard>
        ))}
        {locked.map((badge) => {
          const progress = badgeProgress(badge.code, counts)
          return (
            <BadgeCard key={badge.id} badge={badge} locked>
              {progress && (
                <div className="mt-2">
                  <Meter
                    pct={(progress.current / progress.target) * 100}
                    label={`${badge.name}: ${progress.current} of ${progress.target}`}
                  />
                  <p className="tabular mt-1 text-caption text-muted">
                    {progress.current} / {progress.target}
                  </p>
                  {/* Badges are granted inside rpc_update_status, so a target met since the last
                      update (a level reached by focus time, say) waits for the next one. */}
                  {progress.current >= progress.target && (
                    <p className="mt-1 text-caption text-muted">Unlocks on your next update</p>
                  )}
                </div>
              )}
            </BadgeCard>
          )
        })}
      </div>
    </section>
  )
}

/** Name and description come from the badges table, never from design copy. */
function BadgeCard({
  badge,
  locked = false,
  children,
}: {
  badge: BadgeRow
  locked?: boolean
  children: ReactNode
}) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <span aria-hidden className={`text-title-lg ${locked ? 'opacity-50 grayscale' : ''}`}>
          {badge.icon}
        </span>
        {locked && (
          <span className="flex items-center gap-1 text-caption text-muted">
            <Icon name="lock" /> Locked
          </span>
        )}
      </div>
      <p className="mt-1 font-semibold leading-tight">{badge.name}</p>
      <p className="mt-1 text-caption text-muted">{badge.description}</p>
      {children}
    </Card>
  )
}
