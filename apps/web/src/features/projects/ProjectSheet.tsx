import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { BottomSheet } from '../../components/ui/BottomSheet'
import { Button } from '../../components/ui/Button'
import { statusLabel } from '../../components/ui/StatusChip'
import { fieldClass } from '../../components/ui/field'
import { ITEM_STATUSES, projectSchema, type Project, type ProjectInput } from '../../lib/schemas'

interface ProjectSheetProps {
  open: boolean
  project?: Project | null
  onClose: () => void
  onSubmit: (values: ProjectInput) => void
  saving?: boolean
}

export function ProjectSheet({ open, project, onClose, onSubmit, saving }: ProjectSheetProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProjectInput>({
    resolver: zodResolver(projectSchema),
    values: {
      title: project?.title ?? '',
      description: project?.description ?? '',
      priority: project?.priority ?? 'med',
      status: project?.status ?? 'idea',
      target_date: project?.target_date ?? '',
    },
  })

  return (
    <BottomSheet open={open} onClose={onClose} title={project ? 'Edit project' : 'New project'}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <div>
          <label htmlFor="project-title" className="mb-1 block text-sm font-medium">
            Title
          </label>
          <input id="project-title" autoFocus {...register('title')} className={fieldClass} />
          {errors.title && <p className="mt-1 text-sm text-alert-ink">{errors.title.message}</p>}
        </div>

        <div>
          <label htmlFor="project-description" className="mb-1 block text-sm font-medium">
            Description
          </label>
          <textarea
            id="project-description"
            rows={3}
            {...register('description')}
            className={fieldClass}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="project-status" className="mb-1 block text-sm font-medium">
              Status
            </label>
            <select id="project-status" {...register('status')} className={fieldClass}>
              {ITEM_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {statusLabel(status)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="project-priority" className="mb-1 block text-sm font-medium">
              Priority
            </label>
            <select id="project-priority" {...register('priority')} className={fieldClass}>
              <option value="low">Low</option>
              <option value="med">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="project-target" className="mb-1 block text-sm font-medium">
            Target date
          </label>
          <input
            id="project-target"
            type="date"
            {...register('target_date')}
            className={fieldClass}
          />
        </div>

        <Button type="submit" block disabled={saving}>
          {saving ? 'Saving…' : project ? 'Save changes' : 'Create project'}
        </Button>
      </form>
    </BottomSheet>
  )
}
