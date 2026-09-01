import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { optimisticId, replaceOptimistic } from '../../lib/optimistic'
import type { Difficulty, Priority, Task } from '../../lib/schemas'

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
    // priority defaults to 'med' here, not just in the column default: the optimistic row has to
    // show the same value the insert will store, or the list flickers on refetch.
    mutationFn: async ({
      title,
      difficulty,
      priority = 'med',
    }: {
      title: string
      difficulty: Difficulty
      priority?: Priority
    }) => {
      if (!userId) throw new Error('Not signed in')
      const sortOrder = queryClient.getQueryData<Task[]>(key)?.length ?? 0
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          project_id: projectId,
          user_id: userId,
          title,
          difficulty,
          priority,
          sort_order: sortOrder,
        })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onMutate: async ({ title, difficulty, priority = 'med' }) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Task[]>(key)
      if (previous) {
        // No `as Task`: the cast was the only thing that would have hidden a new column from
        // this row, and a placeholder missing a field the list reads is exactly the bug worth
        // catching at compile time. Every field below is spelled out on purpose.
        const optimistic: Task = {
          id: optimisticId(previous.length),
          project_id: projectId,
          user_id: userId ?? '',
          title,
          description: null,
          difficulty,
          priority,
          status: 'idea',
          sort_order: previous.length,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          completed_at: null,
          snoozed_until: null,
        }
        queryClient.setQueryData(key, [...previous, optimistic])
      }
      return { previous }
    },
    // Swap the placeholder for the saved row at once: its real id is what every later
    // action (status change, difficulty edit) has to send.
    onSuccess: (row) => {
      queryClient.setQueryData<Task[]>(key, (current) => replaceOptimistic(current ?? [], row))
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  })
}

/** Title / difficulty / priority edits. Status changes go through rpc_update_status instead. */
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
      description?: string
      difficulty?: Difficulty
      priority?: Priority
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

/** Moves a task into another project; both task lists are refetched. */
export function useMoveTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, projectId }: { id: string; projectId: string }) => {
      const { error } = await supabase.from('tasks').update({ project_id: projectId }).eq('id', id)
      if (error) throw error
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}
