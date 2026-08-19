import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { OPEN_STATUSES, type Project, type ProjectInput } from '../../lib/schemas'

export const projectKeys = {
  byArea: (areaId: string) => ['projects', areaId] as const,
  stats: (areaId: string) => ['projects', areaId, 'stats'] as const,
  openCounts: ['projects', 'open-counts'] as const,
}

/** Empty strings from the form are stored as null, not as ''. */
function toRow(input: ProjectInput) {
  return {
    title: input.title,
    description: input.description?.trim() ? input.description.trim() : null,
    priority: input.priority,
    status: input.status,
    target_date: input.target_date ? input.target_date : null,
  }
}

export function useProjects(areaId: string | undefined) {
  return useQuery({
    queryKey: projectKeys.byArea(areaId ?? ''),
    enabled: Boolean(areaId),
    queryFn: async (): Promise<Project[]> => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('area_id', areaId!)
        .order('updated_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export interface ProjectStats {
  tasksDone: number
  tasksTotal: number
  nextStep: string | null
}

/** Pure part of useProjectStats: logs must arrive newest first. */
export function aggregateProjectStats(
  projectIds: string[],
  tasks: { project_id: string; status: string }[],
  logs: { project_id: string; next_step: string | null }[],
): Record<string, ProjectStats> {
  const stats: Record<string, ProjectStats> = {}
  for (const id of projectIds) stats[id] = { tasksDone: 0, tasksTotal: 0, nextStep: null }

  for (const task of tasks) {
    const entry = stats[task.project_id]
    if (!entry) continue
    entry.tasksTotal += 1
    if (task.status === 'done') entry.tasksDone += 1
  }
  for (const log of logs) {
    const entry = stats[log.project_id]
    if (entry && entry.nextStep === null) entry.nextStep = log.next_step
  }
  return stats
}

/**
 * Task counts and the newest next_step for every project in one area — two flat queries
 * instead of one per card.
 */
export function useProjectStats(areaId: string | undefined, projectIds: string[]) {
  return useQuery({
    queryKey: [...projectKeys.stats(areaId ?? ''), projectIds.join(',')],
    enabled: projectIds.length > 0,
    queryFn: async (): Promise<Record<string, ProjectStats>> => {
      const [tasks, logs] = await Promise.all([
        supabase.from('tasks').select('project_id, status').in('project_id', projectIds),
        supabase
          .from('progress_logs')
          .select('project_id, next_step, created_at')
          .in('project_id', projectIds)
          .order('created_at', { ascending: false }),
      ])
      if (tasks.error) throw tasks.error
      if (logs.error) throw logs.error
      return aggregateProjectStats(projectIds, tasks.data, logs.data)
    },
  })
}

/** Open project count per area, for the Areas grid. */
export function useOpenProjectCounts() {
  return useQuery({
    queryKey: projectKeys.openCounts,
    queryFn: async (): Promise<Record<string, number>> => {
      const { data, error } = await supabase
        .from('projects')
        .select('area_id')
        .in('status', OPEN_STATUSES)
      if (error) throw error
      const counts: Record<string, number> = {}
      for (const row of data) {
        if (row.area_id) counts[row.area_id] = (counts[row.area_id] ?? 0) + 1
      }
      return counts
    },
  })
}

function useProjectMutation<TVars>(
  areaId: string,
  mutationFn: (vars: TVars) => Promise<unknown>,
  optimistic: (current: Project[], vars: TVars) => Project[],
) {
  const queryClient = useQueryClient()
  const key = projectKeys.byArea(areaId)
  return useMutation({
    mutationFn,
    onMutate: async (vars: TVars) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Project[]>(key)
      if (previous) queryClient.setQueryData(key, optimistic(previous, vars))
      return { previous }
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key })
      queryClient.invalidateQueries({ queryKey: projectKeys.openCounts })
    },
  })
}

export function useCreateProject(areaId: string, userId: string | undefined) {
  return useProjectMutation(
    areaId,
    async (input: ProjectInput) => {
      if (!userId) throw new Error('Not signed in')
      const { error } = await supabase
        .from('projects')
        .insert({ ...toRow(input), area_id: areaId, user_id: userId })
      if (error) throw error
    },
    (current, input) => [
      {
        ...toRow(input),
        id: `optimistic-${current.length}`,
        area_id: areaId,
        user_id: userId ?? '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        completed_at: null,
        snoozed_until: null,
      } as Project,
      ...current,
    ],
  )
}

export function useUpdateProject(areaId: string) {
  return useProjectMutation(
    areaId,
    async ({ id, ...input }: ProjectInput & { id: string }) => {
      const { error } = await supabase.from('projects').update(toRow(input)).eq('id', id)
      if (error) throw error
    },
    (current, vars) =>
      current.map((p) => (p.id === vars.id ? { ...p, ...toRow(vars), id: vars.id } : p)),
  )
}
