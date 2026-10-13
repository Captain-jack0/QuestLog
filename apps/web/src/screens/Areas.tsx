import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Card } from '../components/ui/Card'
import { CardSkeleton } from '../components/ui/Skeleton'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { Icon } from '../components/ui/Icon'
import { useToast } from '../components/ui/Toast'
import { useAuth } from '../auth/AuthProvider'
import { AreaSheet } from '../features/areas/AreaSheet'
import { LevelRing } from '../features/areas/LevelRing'
import { levelProgress, sharePercents, threadsByArea } from '../features/areas/areaSummary'
import { useAreas, useCreateArea } from '../features/areas/queries'
import { useAreaStats } from '../features/gamification/queries'
import { useOpenProjectCounts } from '../features/projects/queries'
import { useAreaThreads, type AreaThread } from '../features/threads/queries'
import { formatMinutes } from '../features/timer/pomodoro'
import { useAreaFocus } from '../features/timer/queries'
import type { LifeArea } from '../lib/schemas'
import { relativeTime } from '../lib/time'

export function AreasScreen() {
  const { session } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [sheetOpen, setSheetOpen] = useState(false)
  const areas = useAreas()
  const counts = useOpenProjectCounts()
  const stats = useAreaStats()
  const threads = useAreaThreads()
  const focus = useAreaFocus()
  const createArea = useCreateArea(session?.user.id)

  const xpByArea = useMemo(
    () => new Map((stats.data ?? []).map((s) => [s.area_id, s.total_xp])),
    [stats.data],
  )
  const waiting = useMemo(() => threadsByArea(threads.data ?? []), [threads.data])
  const userId = session?.user.id

  return (
    <div>
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-title-lg font-bold">Areas</h1>
        <Button onClick={() => setSheetOpen(true)} className="px-3 py-2">
          + New
        </Button>
      </header>

      {areas.isPending && <CardSkeleton rows={2} />}
      {areas.isError && <p className="text-alert-ink">Could not load areas. Pull down to retry.</p>}

      {areas.data?.length === 0 && (
        <EmptyState
          title="No areas yet 🧭"
          description="Areas are your big buckets — Work, Home, Learning. Start with one."
        />
      )}

      {/* One column until the side rail has arrived and left room for two (SideNav.tsx) — the
          same container trap AreaDetail.tsx spells out for its grid. The order is the server's
          least-recently-touched-first, untouched. */}
      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {areas.data?.map((area) => (
          <AreaCard
            key={area.id}
            area={area}
            openProjects={counts.data?.[area.id] ?? 0}
            totalXp={xpByArea.get(area.id)}
            // v_hanging_threads only returns the owner's projects: for a shared area an empty
            // answer says nothing, so no thread row at all. Nor while loading or after an error.
            threadsKnown={threads.isSuccess && area.user_id === userId}
            waiting={waiting.get(area.id)}
            focusSeconds={focus.data?.total[area.id]}
            onResume={(projectId) => navigate(`/projects/${projectId}`)}
          />
        ))}
      </div>

      {Boolean(areas.data?.length) && (
        <WeeklySplit areas={areas.data ?? []} week={focus.data?.week} />
      )}

      <AreaSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        saving={createArea.isPending}
        onSubmit={(values) =>
          createArea.mutate(values, {
            onSuccess: () => {
              setSheetOpen(false)
              toast('Area created')
            },
            onError: (error) => toast(error.message, 'error'),
          })
        }
      />
    </div>
  )
}

/**
 * One link per card, on the name, stretched over the card by its ::after — the smoke test counts
 * `a[href^="/areas/"]` and finds the card by `link /Work/`. Resume is a button raised above that
 * overlay (z-10) that navigates itself: a second `<a>` would break both, and a button inside the
 * link would be invalid nesting.
 */
export function AreaCard({
  area,
  openProjects,
  totalXp,
  threadsKnown,
  waiting,
  focusSeconds,
  onResume,
}: {
  area: LifeArea
  openProjects: number
  totalXp: number | undefined
  threadsKnown: boolean
  waiting: { count: number; oldest: AreaThread } | undefined
  focusSeconds: number | undefined
  onResume: (projectId: string) => void
}) {
  const oldest = waiting?.oldest
  return (
    <Card edgeColor={area.color} className="flex h-full flex-col gap-3 pl-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-micro uppercase text-muted">
            {area.icon && <span aria-hidden>{area.icon} </span>}
            {openProjects} open project{openProjects === 1 ? '' : 's'}
          </p>
          <h2 className="mt-1 text-title-md">
            {/* The ring sits on the overlay, not the link's own box: Card clips (overflow-hidden)
                the global outline, and the card is what the link stands for. */}
            <Link
              to={`/areas/${area.id}`}
              className="after:absolute after:inset-0 after:rounded-card focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-accent"
            >
              {area.name}
            </Link>
          </h2>
        </div>
        {totalXp !== undefined && (
          <div className="flex shrink-0 flex-col items-center gap-0.5">
            <LevelRing totalXp={totalXp} />
            {/* The ring's label already says this to a screen reader. */}
            <p aria-hidden className="text-micro text-muted">
              {totalXp} / {levelProgress(totalXp).ceiling} XP
            </p>
          </div>
        )}
      </div>

      {threadsKnown && (
        <p className="flex items-center gap-1.5 text-caption text-muted">
          <Icon name="history" />
          {waiting
            ? `${waiting.count} waiting thread${waiting.count === 1 ? '' : 's'} · oldest ${relativeTime(
                waiting.oldest.last_activity_at,
              )}`
            : 'No waiting threads'}
        </p>
      )}

      {threadsKnown && oldest && (
        <div className="rounded-xl bg-surface-sunken p-3">
          <p className="text-micro uppercase text-muted">From {oldest.project_title}</p>
          {/* Resume-first: the next step is what the card is for. Without one, the waiting task
              itself is the next thing to pick up. */}
          <p className="mt-1 text-lead line-clamp-2">{oldest.next_step ?? oldest.title}</p>
          {oldest.left_off && (
            <p className="mt-1 text-caption text-muted line-clamp-2">Left off: {oldest.left_off}</p>
          )}
        </div>
      )}

      <div className="mt-auto flex items-center justify-between gap-3">
        {focusSeconds ? (
          <p className="text-caption text-muted">
            <span aria-hidden>
              <Icon name="timer" /> {formatMinutes(focusSeconds)}
            </span>
            <span className="sr-only">{formatMinutes(focusSeconds)} focused</span>
          </p>
        ) : (
          <span />
        )}
        {threadsKnown && oldest && (
          <Button
            variant="ghost"
            className="relative z-10 px-3 py-2"
            aria-label={`Resume ${oldest.project_title}`}
            onClick={() => onResume(oldest.project_id)}
          >
            <Icon name="play_arrow" /> Resume
          </Button>
        )}
      </div>
    </Card>
  )
}

/** This week's focus split across areas: one stacked bar, the legend carrying the numbers. */
export function WeeklySplit({
  areas,
  week,
}: {
  areas: LifeArea[]
  /** Undefined until the focus query has answered — loading and error say nothing about the week. */
  week: Record<string, number> | undefined
}) {
  const logged = areas
    .map((area) => ({ area, seconds: week?.[area.id] ?? 0 }))
    .filter((row) => row.seconds > 0)
    .sort((a, b) => b.seconds - a.seconds)
  const percents = sharePercents(logged.map((row) => row.seconds))
  const total = logged.reduce((sum, row) => sum + row.seconds, 0)

  return (
    <Card className="mt-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-title-md">This week by area</h2>
        {total > 0 && <p className="text-caption text-muted">{formatMinutes(total)} focused</p>}
      </div>
      {!week ? null : total === 0 ? (
        <p className="mt-2 text-body text-muted">
          No focus time logged this week yet. Start a timer on any task and it shows up here.
        </p>
      ) : (
        <>
          <div aria-hidden className="mt-3 flex h-2 overflow-hidden rounded-full bg-line/50">
            {logged.map((row, i) => (
              <div
                key={row.area.id}
                style={{ width: `${percents[i]}%`, backgroundColor: row.area.color }}
              />
            ))}
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-caption">
            {logged.map((row, i) => (
              <li key={row.area.id} className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 rounded-full border border-ink/55"
                  style={{ backgroundColor: row.area.color }}
                />
                {row.area.name} {percents[i] === 0 ? '<1' : percents[i]}%
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  )
}
