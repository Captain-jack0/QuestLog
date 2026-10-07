import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { optimisticId, replaceOptimistic } from '../../lib/optimistic'
import type { Difficulty, Priority, Task } from '../../lib/schemas'
import { withNormalizedDescription } from '../../lib/description'
import { areaKeys } from '../areas/queries'
import { newTaskRow } from './newTask'

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
        // The list re-sorts on the client (taskOrder.ts); this only makes the raw order match
        // its default instead of a manual order nothing can set any more.
        .order('updated_at')
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
    // Both halves below build their row through `newTaskRow` (newTask.ts): the optimistic
    // placeholder has to store exactly what the insert will, or the list flickers on refetch —
    // and that is testable there, where importing the module does not stand up a client.
    mutationFn: async (input: {
      title: string
      description?: string
      difficulty: Difficulty
      priority?: Priority
    }) => {
      if (!userId) throw new Error('Not signed in')
      const sortOrder = queryClient.getQueryData<Task[]>(key)?.length ?? 0
      const { data, error } = await supabase
        .from('tasks')
        .insert(newTaskRow({ ...input, projectId, userId, sortOrder }))
        .select()
        .single()
      if (error) throw error
      return data
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Task[]>(key)
      if (previous) {
        // No `as Task`: the cast was the only thing that would have hidden a new column from
        // this row, and a placeholder missing a field the list reads is exactly the bug worth
        // catching at compile time. Every field the row does not carry is spelled out below.
        const optimistic: Task = {
          ...newTaskRow({
            ...input,
            projectId,
            userId: userId ?? '',
            sortOrder: previous.length,
          }),
          id: optimisticId(previous.length),
          status: 'idea',
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
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key })
      // A task write touches its project and that project's area
      // (20261005120000_untouched_first_ordering.sql), and both lists order by that touch.
      // Left to the 30s staleTime, going back up right after this would show the old order.
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      queryClient.invalidateQueries({ queryKey: areaKeys.all })
    },
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
      const { error } = await supabase
        .from('tasks')
        .update(withNormalizedDescription(fields))
        .eq('id', id)
      if (error) throw error
    },
    onMutate: async ({ id, ...fields }) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Task[]>(key)
      if (previous) {
        // The same normalisation the write gets: a row that shows '' until the refetch lands
        // and null afterwards is the flicker the optimistic row exists to prevent.
        const patch = withNormalizedDescription(fields)
        queryClient.setQueryData(
          key,
          previous.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        )
      }
      return { previous }
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key })
      // Same as useCreateTask: the edit moved the project and the area in their lists too.
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      queryClient.invalidateQueries({ queryKey: areaKeys.all })
    },
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
      queryClient.invalidateQueries({ queryKey: areaKeys.all })
    },
  })
}
