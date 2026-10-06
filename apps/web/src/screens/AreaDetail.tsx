import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Card } from '../components/ui/Card'
import { CardSkeleton } from '../components/ui/Skeleton'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { StatusChip } from '../components/ui/StatusChip'
import { ProgressBar } from '../components/ui/ProgressBar'
import { useToast } from '../components/ui/Toast'
import { useAuth } from '../auth/AuthProvider'
import { AreaSheet } from '../features/areas/AreaSheet'
import { useArchiveArea, useArea, useUpdateArea } from '../features/areas/queries'
import { projectCardView } from '../features/projects/cardView'
import { ProjectSheet } from '../features/projects/ProjectSheet'
import { useCreateProject, useProjectStats, useProjects } from '../features/projects/queries'
import { formatMinutes } from '../features/timer/pomodoro'
import { useProjectTotals } from '../features/timer/queries'
import { isOptimistic } from '../lib/optimistic'

export function AreaDetailScreen() {
  const { areaId = '' } = useParams()
  const { session } = useAuth()
  const toast = useToast()

  const area = useArea(areaId)
  const projects = useProjects(areaId)
  const stats = useProjectStats(areaId, projects.data?.map((p) => p.id) ?? [])
  // The optimistic card is left out: its placeholder id is not a uuid, and Postgres would
  // reject the whole query over it (lib/optimistic.ts) — every badge blank until the insert lands.
  const focusTotals = useProjectTotals(
    (projects.data ?? []).map((p) => p.id).filter((id) => !isOptimistic(id)),
  )

  const updateArea = useUpdateArea()
  const archiveArea = useArchiveArea()
  const createProject = useCreateProject(areaId, session?.user.id)

  const [areaSheet, setAreaSheet] = useState(false)
  const [creating, setCreating] = useState(false)

  return (
    <div>
      <Link to="/areas" className="text-sm font-medium text-muted">
        ← Areas
      </Link>

      <header className="mb-4 mt-2 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">
            {area.data?.icon} {area.data?.name ?? 'Area'}
          </h1>
          <p className="text-sm text-muted">
            {projects.data?.length ?? 0} project{projects.data?.length === 1 ? '' : 's'}
          </p>
        </div>
        <Button variant="ghost" className="px-3 py-2" onClick={() => setAreaSheet(true)}>
          Edit
        </Button>
      </header>

      <Button block onClick={() => setCreating(true)} className="mb-4">
        + New project
      </Button>

      {projects.isPending && <CardSkeleton rows={2} />}
      {projects.data?.length === 0 && (
        <EmptyState
          title="Nothing here yet"
          description="A project is anything with more than one step. Add the first one."
        />
      )}

      {/* Same rule as the task grid (ProjectDetail.tsx:172), and the same trap: a column step
          has to wait for the container, and the shell's content is frozen at 416px from 448px
          to 767px (App.tsx:56). `sm:grid-cols-3` stepped up inside that frozen width — 131px
          tiles, 95px inside the padding, and next to a `shrink-0` status chip that is 76px on
          its own the title was left 11px, about one character. At 390px the same tile gives it
          53px. `md` would not fix it either (32px), because the 224px side rail arrives with
          that breakpoint (SideNav.tsx:10). From `lg` the container can pay: three columns give
          the title 107px at 1024px, four give it 111px at 1280px. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
        {projects.data?.map((project) => {
          const stat = stats.data?.[project.id]
          const focusSeconds = focusTotals.data?.[project.id]
          const isDone = project.status === 'done'
          const view = projectCardView(project.status, stat)
          return (
            <Card
              key={project.id}
              edgeColor={isDone ? 'rgb(var(--success))' : area.data?.color}
              className="aspect-square pl-5"
            >
              {/* Done cards fade via a local opacity on the title and the progress bar only —
                  never on the Card itself. A card-wide opacity composites every pixel in it
                  (chip included) against --paper, and the Done chip (success-ink on
                  success/20, see StatusChip.tsx) is already only 4.27:1 in the calm theme at
                  full strength: any further blend pushes it under the 4.5:1 floor with no
                  opacity value that recovers it (that 4.27:1 is pre-existing — the same chip
                  renders at full strength everywhere else in the app, e.g. ProjectDetail.tsx).
                  So the chip is left untouched here, and opacity-75 is applied only to the title
                  (ink on the card's own surface: 6.53:1 calm, 8.29:1 quest) and the progress
                  bar. The "Completed" label stays plain text-muted (4.83:1) — muted plus
                  opacity would drop under 4.5:1 in calm.
                  `group`/`group-hover` brings both back to full strength on hover/focus. */}
              <Link
                to={`/projects/${project.id}`}
                className="group flex h-full w-full flex-col text-left"
              >
                <div className="flex items-start justify-between gap-2">
                  <span
                    className={`font-semibold leading-tight line-clamp-2 ${
                      isDone
                        ? 'text-ink opacity-75 line-through transition group-hover:opacity-100 group-focus-within:opacity-100'
                        : ''
                    }`}
                  >
                    {project.title}
                  </span>
                  <StatusChip status={project.status} />
                </div>
                <div className="mt-auto">
                  {view.showNext && stat?.nextStep && (
                    <p className="mt-2 text-sm line-clamp-1">
                      <span className="text-muted">Next: </span>
                      {stat.nextStep}
                    </p>
                  )}
                  {view.showStats && (
                    <div className="mt-3">
                      {view.showProgress && (
                        <div
                          className={
                            isDone
                              ? 'opacity-75 transition group-hover:opacity-100 group-focus-within:opacity-100'
                              : ''
                          }
                        >
                          <ProgressBar
                            done={view.barDone}
                            total={view.barTotal}
                            tone={view.tone}
                            full={view.barFull}
                          />
                        </div>
                      )}
                      {view.label && <p className="mt-1 text-xs text-muted">{view.label}</p>}
                    </div>
                  )}
                  {/* Outside `showStats`: a project with no tasks can still have time clocked on
                      it. Plain `text-muted` with no fade on a Done card, for the reason given
                      for "Completed" above. */}
                  {focusSeconds ? (
                    <p className="mt-1 text-xs text-muted">
                      <span aria-hidden>⏱ {formatMinutes(focusSeconds)}</span>
                      <span className="sr-only">{formatMinutes(focusSeconds)} focused</span>
                    </p>
                  ) : null}
                </div>
              </Link>
            </Card>
          )
        })}
      </div>

      <AreaSheet
        open={areaSheet}
        area={area.data}
        onClose={() => setAreaSheet(false)}
        saving={updateArea.isPending}
        onSubmit={(values) =>
          updateArea.mutate(
            { ...values, id: areaId },
            {
              onSuccess: () => {
                setAreaSheet(false)
                toast('Area updated')
              },
              onError: (error) => toast(error.message, 'error'),
            },
          )
        }
        onArchive={() =>
          archiveArea.mutate(areaId, {
            onSuccess: () => {
              setAreaSheet(false)
              toast('Area archived')
            },
            onError: (error) => toast(error.message, 'error'),
          })
        }
      />

      <ProjectSheet
        open={creating}
        onClose={() => setCreating(false)}
        saving={createProject.isPending}
        onSubmit={(values) =>
          createProject.mutate(values, {
            onSuccess: () => {
              setCreating(false)
              toast('Project created')
            },
            onError: (error) => toast(error.message, 'error'),
          })
        }
      />
    </div>
  )
}
