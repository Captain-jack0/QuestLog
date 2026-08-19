import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { ItemStatus } from '../../lib/schemas'

export interface HangingThread {
  item_type: 'task' | 'project'
  item_id: string
  title: string
  status: ItemStatus
  project_id: string
  project_title: string
  area_name: string | null
  area_color: string | null
  left_off: string | null
  next_step: string | null
  last_activity_at: string
}

export const threadKeys = {
  all: ['threads'] as const,
}

/** v_hanging_threads already excludes snoozed items and sorts by oldest activity. */
export function useHangingThreads() {
  return useQuery({
    queryKey: threadKeys.all,
    queryFn: async (): Promise<HangingThread[]> => {
      const { data, error } = await supabase
        .from('v_hanging_threads')
        .select(
          'item_type, item_id, title, status, project_id, project_title, area_name, area_color, left_off, next_step, last_activity_at',
        )
        .order('last_activity_at', { ascending: true })
        .limit(20)
      if (error) throw error
      return data as unknown as HangingThread[]
    },
  })
}

export const SNOOZE_OPTIONS = [
  { label: '3 days', days: 3 },
  { label: '1 week', days: 7 },
  { label: '1 month', days: 30 },
] as const

export function useSnooze() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      itemType,
      itemId,
      days,
    }: {
      itemType: 'task' | 'project'
      itemId: string
      days: number
    }) => {
      const until = new Date()
      until.setDate(until.getDate() + days)
      const { error } = await supabase.rpc('rpc_snooze', {
        p_item_type: itemType,
        p_item_id: itemId,
        p_until: until.toISOString().slice(0, 10),
      })
      if (error) throw error
    },
    onMutate: async ({ itemId }) => {
      await queryClient.cancelQueries({ queryKey: threadKeys.all })
      const previous = queryClient.getQueryData<HangingThread[]>(threadKeys.all)
      if (previous) {
        queryClient.setQueryData(
          threadKeys.all,
          previous.filter((t) => t.item_id !== itemId),
        )
      }
      return { previous }
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(threadKeys.all, context.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: threadKeys.all }),
  })
}
