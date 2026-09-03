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
import { ProjectSheet } from '../features/projects/ProjectSheet'
import { useCreateProject, useProjectStats, useProjects } from '../features/projects/queries'

export function AreaDetailScreen() {
  const { areaId = '' } = useParams()
  const { session } = useAuth()
  const toast = useToast()

  const area = useArea(areaId)
  const projects = useProjects(areaId)
  const stats = useProjectStats(areaId, projects.data?.map((p) => p.id) ?? [])

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
          return (
            <Card key={project.id} edgeColor={area.data?.color} className="aspect-square pl-5">
              <Link
                to={`/projects/${project.id}`}
                className="flex h-full w-full flex-col text-left"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold leading-tight line-clamp-2">{project.title}</span>
                  <StatusChip status={project.status} />
                </div>
                <div className="mt-auto">
                  {stat?.nextStep && (
                    <p className="mt-2 text-sm line-clamp-1">
                      <span className="text-muted">Next: </span>
                      {stat.nextStep}
                    </p>
                  )}
                  {stat && stat.tasksTotal > 0 && (
                    <div className="mt-3">
                      <ProgressBar done={stat.tasksDone} total={stat.tasksTotal} />
                      <p className="mt-1 text-xs text-muted">
                        {stat.tasksDone}/{stat.tasksTotal} tasks done
                      </p>
                    </div>
                  )}
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
