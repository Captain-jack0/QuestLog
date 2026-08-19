import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { Difficulty, Task } from '../../lib/schemas'

export const taskKeys = {
  byProject: (projectId: string) => ['tasks', projectId] as const,
}

export function useTasks(projectId: string | undefined) {
  return useQuery({
    queryKey: taskKeys.byProject(projectId ?? ''),
    enabled: Boolean(projectId),
    queryFn: async (): Promise<Task[]> => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('project_id', projectId!)
        .order('sort_order')
        .order('created_at')
      if (error) throw error
      return data
    },
  })
}

export function useCreateTask(projectId: string, userId: string | undefined) {
  const queryClient = useQueryClient()
  const key = taskKeys.byProject(projectId)

  return useMutation({
    mutationFn: async ({ title, difficulty }: { title: string; difficulty: Difficulty }) => {
      if (!userId) throw new Error('Not signed in')
      const sortOrder = queryClient.getQueryData<Task[]>(key)?.length ?? 0
      const { error } = await supabase.from('tasks').insert({
        project_id: projectId,
        user_id: userId,
        title,
        difficulty,
        sort_order: sortOrder,
      })
      if (error) throw error
    },
    onMutate: async ({ title, difficulty }) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Task[]>(key)
      if (previous) {
        queryClient.setQueryData(key, [
          ...previous,
          {
            id: `optimistic-${previous.length}`,
            project_id: projectId,
            user_id: userId ?? '',
            title,
            difficulty,
            status: 'idea',
            sort_order: previous.length,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            completed_at: null,
            snoozed_until: null,
          } as Task,
        ])
      }
      return { previous }
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  })
}

/** Title / difficulty edits. Status changes go through rpc_update_status instead. */
export function useUpdateTask(projectId: string) {
  const queryClient = useQueryClient()
  const key = taskKeys.byProject(projectId)

  return useMutation({
    mutationFn: async ({
      id,
      ...fields
    }: {
      id: string
      title?: string
      difficulty?: Difficulty
    }) => {
      const { error } = await supabase.from('tasks').update(fields).eq('id', id)
      if (error) throw error
    },
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Task[]>(key)
      if (previous) {
        queryClient.setQueryData(
          key,
          previous.map((t) => (t.id === vars.id ? { ...t, ...vars } : t)),
        )
      }
      return { previous }
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  })
}
