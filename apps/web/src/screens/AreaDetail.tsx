import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Card } from '../components/ui/Card'
import { CardSkeleton } from '../components/ui/Skeleton'
import { Button } from '../components/ui/Button'
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
        <Card className="text-center">
          <p className="font-medium">Nothing here yet</p>
          <p className="mt-1 text-sm text-muted">
            A project is anything with more than one step. Add the first one.
          </p>
        </Card>
      )}

      <div className="space-y-3">
        {projects.data?.map((project) => {
          const stat = stats.data?.[project.id]
          return (
            <Card key={project.id} edgeColor={area.data?.color} className="pl-5">
              <Link to={`/projects/${project.id}`} className="block w-full text-left">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold leading-tight">{project.title}</span>
                  <StatusChip status={project.status} />
                </div>
                {stat?.nextStep && (
                  <p className="mt-2 text-sm">
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
