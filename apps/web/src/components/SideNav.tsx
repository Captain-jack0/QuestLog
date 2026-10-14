import { Link, NavLink } from 'react-router-dom'
import { Logo } from './Logo'
import { NAV_ITEMS } from './navigation'
import { Icon } from './ui/Icon'
import { ProgressBar } from './ui/ProgressBar'
import { effectiveStreak } from '../features/gamification/aggregate'
import {
  useProfile,
  useStreak,
  useTodayFocusXp,
  useTodayXp,
} from '../features/gamification/queries'
import { groupThreads } from '../features/threads/groupThreads'
import { useHangingThreads } from '../features/threads/queries'
import { TimerBar } from '../features/timer/TimerBar'
import { FOCUS_XP_DAILY_CAP } from '../lib/xp'

/** How many in-progress threads the rail lists before it points at Threads for the rest. */
const RAIL_THREADS = 5

/**
 * Desktop rail, top to bottom: the mark, today's standing, the five places, what is in progress,
 * and the running clocks (the Focus deck) pinned to its foot. Only the five places are inside
 * the `Main` nav, so it holds exactly what the tab bar holds on a phone.
 */
export function SideNav() {
  return (
    <aside className="sticky top-0 flex h-dvh w-60 shrink-0 flex-col border-r border-line bg-surface lg:w-64">
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-3 py-5">
        <Logo className="px-2" />
        <Standing />

        <nav aria-label="Main">
          <ul className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-body-medium ${
                      isActive
                        ? 'bg-accent font-semibold text-paper shadow-glow-accent'
                        : 'link-quiet text-muted'
                    }`
                  }
                >
                  <Icon name={item.icon} className="icon-xl" />
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <InProgress />
      </div>

      <TimerBar docked />
    </aside>
  )
}

/**
 * Streak, shields and today's XP, with today's focus XP against its daily cap. Every number is
 * the database's; a part with nothing behind it yet (no streak row before the first XP) is left
 * out rather than shown as zero. The streak is the effective one and waits for the profile's
 * timezone, as on Progress.
 */
function Standing() {
  const profile = useProfile()
  const streak = useStreak()
  const todayXp = useTodayXp()
  const focusXp = useTodayFocusXp()

  if (!streak.data && todayXp.data === undefined) return null

  return (
    <div className="rounded-card border border-line bg-surface-raised p-3">
      {streak.data && !profile.isPending && (
        <p className="flex items-center justify-between gap-2 text-body-medium">
          <span className="flex items-center gap-1.5 font-semibold text-flame-ink tabular">
            <Icon name="local_fire_department" className="icon-lg" />
            {effectiveStreak(streak.data, profile.data?.timezone)}d streak
          </span>
          <span className="flex items-center gap-1 text-muted tabular">
            <Icon name="shield" className="icon-lg" />
            {streak.data.freeze_tokens}
            <span className="sr-only"> streak shields</span>
          </span>
        </p>
      )}
      {todayXp.data !== undefined && (
        <p className="mt-2 flex items-center justify-between gap-2">
          <span className="text-micro uppercase text-muted">Today</span>
          <span className="text-body-medium font-semibold text-success-ink tabular">
            +{todayXp.data} XP
          </span>
        </p>
      )}
      {focusXp.data !== undefined && (
        <div className="mt-2">
          <p className="mb-1 flex items-center justify-between gap-2 text-caption text-muted">
            <span>Focus XP</span>
            <span className="tabular">
              {focusXp.data}/{FOCUS_XP_DAILY_CAP}
            </span>
          </p>
          <ProgressBar
            done={Math.min(focusXp.data, FOCUS_XP_DAILY_CAP)}
            total={FOCUS_XP_DAILY_CAP}
            tone="success"
            label={`Focus XP today: ${focusXp.data} of ${FOCUS_XP_DAILY_CAP}`}
          />
        </div>
      )}
    </div>
  )
}

/** The Active half of the hanging threads (Today's own split), oldest first, a few at a time. */
function InProgress() {
  const threads = useHangingThreads()
  const { active } = groupThreads(threads.data ?? [])
  if (active.length === 0) return null

  const more = active.length - RAIL_THREADS

  return (
    <section aria-labelledby="rail-in-progress">
      <h2 id="rail-in-progress" className="mb-1 px-3 text-micro uppercase text-muted">
        In progress
      </h2>
      <ul className="flex flex-col">
        {active.slice(0, RAIL_THREADS).map((thread) => (
          <li key={`${thread.item_type}-${thread.item_id}`}>
            <Link
              to={`/projects/${thread.project_id}`}
              className="link-quiet flex min-h-[44px] items-start gap-2.5 rounded-xl px-3 py-1.5"
            >
              <span
                aria-hidden
                className="mt-1.5 h-2 w-2 shrink-0 rounded-full border border-ink/55"
                style={{ backgroundColor: thread.area_color ?? 'rgb(var(--muted))' }}
              />
              <span className="min-w-0">
                <span className="block truncate text-body-medium">{thread.title}</span>
                <span className="block truncate text-micro text-muted">{thread.project_title}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {more > 0 && (
        <Link
          to="/threads"
          className="link-quiet flex min-h-[44px] items-center rounded-xl px-3 text-caption text-muted"
        >
          +{more} more
        </Link>
      )}
    </section>
  )
}
