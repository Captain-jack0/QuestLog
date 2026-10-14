import { Link, useLocation, useMatch } from 'react-router-dom'
import { LogoMark } from './Logo'
import { NAV_ITEMS } from './navigation'
import { Icon } from './ui/Icon'
import { useArea } from '../features/areas/queries'
import { effectiveStreak } from '../features/gamification/aggregate'
import { useProfile, useStreak, useTodayXp } from '../features/gamification/queries'
import { useProject } from '../features/projects/queries'

const IS_MAC = /Mac|iPhone|iPad/.test(navigator.userAgent)

/**
 * The bar over every signed-in screen. Left: where you are — on a desktop the screen name, or a
 * breadcrumb on the detail screens; on a phone the mark, since the tab bar already says where.
 * Right: streak, today's XP, Quick add, and the way to your profile.
 *
 * Names here are chosen against the e2e selectors, which match link names as substrings: the
 * avatar is "Profile" (not "Settings"), the breadcrumb's "Areas" is plain text (not a second
 * "Areas" link), and Quick add never says "+ New".
 */
export function TopBar({ desktop, onQuickAdd }: { desktop: boolean; onQuickAdd: () => void }) {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-paper/85 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-md items-center gap-2 px-4 md:max-w-5xl md:gap-3 md:px-8 lg:max-w-6xl">
        <div className="min-w-0 flex-1">
          {desktop ? <Whereabouts /> : <LogoMark className="h-8 w-8" />}
        </div>
        <Chips />
        <button
          type="button"
          aria-label="Quick add"
          aria-keyshortcuts={IS_MAC ? 'Meta+K' : 'Control+K'}
          onClick={onQuickAdd}
          className="btn-primary flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center gap-1.5 rounded-xl border border-accent px-2.5 text-body font-semibold transition md:px-3"
        >
          <Icon name="add" className="icon-xl" />
          <span className="hidden md:inline">Quick add</span>
          <kbd className="hidden rounded-md border border-paper/40 px-1.5 font-sans text-micro lg:inline">
            {IS_MAC ? '⌘K' : 'Ctrl K'}
          </kbd>
        </button>
        <Link
          to="/settings"
          aria-label="Profile"
          className="link-quiet flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-surface-raised text-muted"
        >
          <Icon name="person" className="icon-xl" />
        </Link>
      </div>
    </header>
  )
}

/**
 * Streak and today's XP, each shown only once its number is real. The streak is the effective
 * one (Progress, Today and the rail say the same): it waits for the profile, whose timezone
 * decides what "yesterday" is.
 */
function Chips() {
  const profile = useProfile()
  const streak = useStreak()
  const todayXp = useTodayXp()

  return (
    <>
      {streak.data && !profile.isPending && (
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-flame/10 px-2.5 py-1 text-caption font-semibold text-flame-ink tabular">
          <Icon name="local_fire_department" className="icon-lg" />
          <span className="sr-only">Streak: </span>
          {effectiveStreak(streak.data, profile.data?.timezone)}
          <span className="sr-only"> days</span>
        </span>
      )}
      {todayXp.data !== undefined && (
        <span className="flex shrink-0 items-center rounded-full bg-success/10 px-2.5 py-1 text-caption font-semibold text-success-ink tabular">
          +{todayXp.data} XP<span className="sr-only"> today</span>
        </span>
      )}
    </>
  )
}

/** Desktop left side: a breadcrumb on area and project pages, the screen's name elsewhere. */
function Whereabouts() {
  const { pathname } = useLocation()
  const projectId = useMatch('/projects/:projectId')?.params.projectId
  const areaRouteId = useMatch('/areas/:areaId')?.params.areaId

  // The same queries the detail screens run, so these resolve from the cache, not the network.
  const project = useProject(projectId)
  const areaId = projectId ? project.data?.area_id : areaRouteId
  const area = useArea(areaId ?? undefined)

  if (projectId || areaRouteId) {
    return (
      <nav aria-label="Breadcrumb">
        <ol className="flex min-w-0 items-center gap-1.5 text-body text-muted">
          <li className="shrink-0">Areas</li>
          {area.data && (
            <>
              <Separator />
              {projectId ? (
                <li className="min-w-0 truncate">
                  <Link
                    to={`/areas/${area.data.id}`}
                    className="link-quiet inline-flex min-h-[44px] items-center rounded-lg px-1.5"
                  >
                    {area.data.name}
                  </Link>
                </li>
              ) : (
                <li aria-current="page" className="min-w-0 truncate font-semibold text-ink">
                  {area.data.name}
                </li>
              )}
            </>
          )}
          {projectId && project.data && (
            <>
              <Separator />
              <li aria-current="page" className="min-w-0 truncate font-semibold text-ink">
                {project.data.title}
              </li>
            </>
          )}
        </ol>
      </nav>
    )
  }

  const screen = NAV_ITEMS.find((item) => item.to === pathname)
  return screen ? <p className="text-lead font-semibold">{screen.label}</p> : null
}

function Separator() {
  return (
    <li aria-hidden className="shrink-0">
      <Icon name="chevron_right" className="icon-lg" />
    </li>
  )
}
