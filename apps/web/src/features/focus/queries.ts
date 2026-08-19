import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { OPEN_STATUSES, type ItemStatus } from '../../lib/schemas'

export interface FocusRow {
  id: string
  completed: boolean
  task_id: string | null
  project_id: string | null
  tasks: { title: string; status: ItemStatus } | null
  projects: { title: string; status: ItemStatus } | null
}

/** A task or project that can be picked as today's focus. */
export interface PickableItem {
  itemType: 'task' | 'project'
  id: string
  title: string
  status: ItemStatus
}

export const focusKeys = {
  forDate: (date: string) => ['focus', date] as const,
  pickable: ['focus', 'pickable'] as const,
}

export function useFocusItems(date: string) {
  return useQuery({
    queryKey: focusKeys.forDate(date),
    queryFn: async (): Promise<FocusRow[]> => {
      const { data, error } = await supabase
        .from('focus_items')
        .select('id, completed, task_id, project_id, tasks(title, status), projects(title, status)')
        .eq('date', date)
        .order('created_at')
      if (error) throw error
      return data as unknown as FocusRow[]
    },
  })
}

/** Everything still open, for the picker sheet. */
export function usePickableItems(enabled: boolean) {
  return useQuery({
    queryKey: focusKeys.pickable,
    enabled,
    queryFn: async (): Promise<PickableItem[]> => {
      const [tasks, projects] = await Promise.all([
        supabase.from('tasks').select('id, title, status').in('status', OPEN_STATUSES),
        supabase.from('projects').select('id, title, status').in('status', OPEN_STATUSES),
      ])
      if (tasks.error) throw tasks.error
      if (projects.error) throw projects.error
      return [
        ...projects.data.map((p) => ({
          itemType: 'project' as const,
          id: p.id,
          title: p.title,
          status: p.status,
        })),
        ...tasks.data.map((t) => ({
          itemType: 'task' as const,
          id: t.id,
          title: t.title,
          status: t.status,
        })),
      ]
    },
  })
}

interface PickFocusResult {
  items: number
  xp_awarded: number
}

export function usePickFocus(date: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (items: PickableItem[]): Promise<PickFocusResult> => {
      const payload = items.map((item) =>
        item.itemType === 'task' ? { task_id: item.id } : { project_id: item.id },
      )
      const { data, error } = await supabase.rpc('rpc_pick_focus', {
        p_date: date,
        p_items: payload,
      })
      if (error) throw error
      return data as unknown as PickFocusResult
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: focusKeys.forDate(date) })
      queryClient.invalidateQueries({ queryKey: ['gamification'] })
    },
  })
}

export function useToggleFocusItem(date: string) {
  const queryClient = useQueryClient()
  const key = focusKeys.forDate(date)

  return useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      const { error } = await supabase.from('focus_items').update({ completed }).eq('id', id)
      if (error) throw error
    },
    onMutate: async ({ id, completed }) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<FocusRow[]>(key)
      if (previous) {
        queryClient.setQueryData(
          key,
          previous.map((row) => (row.id === id ? { ...row, completed } : row)),
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
