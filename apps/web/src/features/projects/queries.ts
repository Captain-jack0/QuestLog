import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { optimisticId, replaceOptimistic } from '../../lib/optimistic'
import { OPEN_STATUSES, type ProgressLog, type Project, type ProjectInput } from '../../lib/schemas'
import { aggregateProjectStats, type ProjectStats } from './stats'

export type { ProjectStats }

export const projectKeys = {
  byArea: (areaId: string) => ['projects', areaId] as const,
  detail: (id: string) => ['project', id] as const,
  logs: (id: string) => ['project', id, 'logs'] as const,
  stats: (areaId: string) => ['projects', areaId, 'stats'] as const,
  openCounts: ['projects', 'open-counts'] as const,
}

export function useProject(id: string | undefined) {
  return useQuery({
    queryKey: projectKeys.detail(id ?? ''),
    enabled: Boolean(id),
    queryFn: async (): Promise<Project> => {
      const { data, error } = await supabase.from('projects').select('*').eq('id', id!).single()
      if (error) throw error
      return data
    },
  })
}

/** A log plus the title of the task its next step points at, if it points at one. */
export type ProgressLogWithNextTask = ProgressLog & {
  next_step_task: { title: string } | null
}

/** The append-only timeline, newest first. */
export function useProgressLogs(projectId: string | undefined) {
  return useQuery({
    queryKey: projectKeys.logs(projectId ?? ''),
    enabled: Boolean(projectId),
    queryFn: async (): Promise<ProgressLogWithNextTask[]> => {
      const { data, error } = await supabase
        .from('progress_logs')
        // Two foreign keys point at tasks now (the log's own item, and the task its next step
        // names), so the embed has to say which one by constraint name.
        .select('*, next_step_task:tasks!progress_logs_next_step_task_id_fkey(title)')
        .eq('project_id', projectId!)
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return data as unknown as ProgressLogWithNextTask[]
    },
  })
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
  const queryClient = useQueryClient()

  return useProjectMutation(
    areaId,
    async (input: ProjectInput) => {
      if (!userId) throw new Error('Not signed in')
      const { data, error } = await supabase
        .from('projects')
        .insert({ ...toRow(input), area_id: areaId, user_id: userId })
        .select()
        .single()
      if (error) throw error
      // The card links to /projects/:id — it must be the real one, not the placeholder.
      queryClient.setQueryData<Project[]>(projectKeys.byArea(areaId), (current) =>
        replaceOptimistic(current ?? [], data),
      )
    },
    (current, input) => [
      {
        ...toRow(input),
        id: optimisticId(current.length),
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

/**
 * Moves a project into another area. Both area lists go stale, so this invalidates the
 * whole projects branch rather than one key.
 */
export function useMoveProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, areaId }: { id: string; areaId: string }) => {
      const { error } = await supabase.from('projects').update({ area_id: areaId }).eq('id', id)
      if (error) throw error
    },
    onSettled: (_data, _error, vars) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(vars.id) })
      queryClient.invalidateQueries({ queryKey: ['gamification'] })
    },
  })
}

/** Every open project with its area, for the "move a task" picker. */
export function useProjectOptions() {
  return useQuery({
    queryKey: ['projects', 'options'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, title, area_id, life_areas(name, icon)')
        .in('status', OPEN_STATUSES)
        .order('updated_at', { ascending: false })
      if (error) throw error
      return data as unknown as {
        id: string
        title: string
        area_id: string | null
        life_areas: { name: string; icon: string | null } | null
      }[]
    },
  })
}
