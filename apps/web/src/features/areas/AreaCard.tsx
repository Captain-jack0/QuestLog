import { Link } from 'react-router-dom'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'
import type { AreaThread } from '../threads/queries'
import { formatMinutes } from '../timer/pomodoro'
import type { LifeArea } from '../../lib/schemas'
import { relativeTime } from '../../lib/time'
import { LevelRing } from './LevelRing'
import { levelProgress, sharePercents } from './areaSummary'

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
          <p className="mt-1 text-lead line-clamp-2">{oldest.next_step || oldest.title}</p>
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
