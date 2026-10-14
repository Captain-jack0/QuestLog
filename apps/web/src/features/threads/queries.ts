import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { ItemStatus } from '../../lib/schemas'

export interface HangingThread {
  item_type: 'task' | 'project'
  item_id: string
  title: string
  /** The task's real status — what any write starts from. */
  status: ItemStatus
  /** What Today groups and labels by: the project's paused/blocked when the task is in_progress
   *  under it, else status (#44). */
  display_status: ItemStatus
  project_id: string
  project_title: string
  area_name: string | null
  area_color: string | null
  left_off: string | null
  next_step: string | null
  /** The task the next step points at, read live: the card shows what that task is doing now,
   *  not what it was doing when the log was written. Null once the task is deleted — the
   *  snapshot in next_step is what survives. */
  next_step_task_id: string | null
  next_step_task_title: string | null
  next_step_task_status: ItemStatus | null
  next_step_task_project_id: string | null
  last_activity_at: string
}

export const threadKeys = {
  all: ['threads'] as const,
}

/** Rows useHangingThreads reads; a list this long may have more behind it. */
export const HANGING_THREADS_LIMIT = 20

/** v_hanging_threads holds tasks only (#44), already excludes snoozed items and sorts by oldest
 *  activity. */
export function useHangingThreads() {
  return useQuery({
    queryKey: threadKeys.all,
    queryFn: async (): Promise<HangingThread[]> => {
      const { data, error } = await supabase
        .from('v_hanging_threads')
        .select(
          'item_type, item_id, title, status, display_status, project_id, project_title, area_name, area_color, left_off, next_step, next_step_task_id, next_step_task_title, next_step_task_status, next_step_task_project_id, last_activity_at',
        )
        .order('last_activity_at', { ascending: true })
        .limit(HANGING_THREADS_LIMIT)
      if (error) throw error
      return data as unknown as HangingThread[]
    },
  })
}

export interface AreaThread {
  area_id: string | null
  project_id: string
  project_title: string
  title: string
  left_off: string | null
  next_step: string | null
  last_activity_at: string
}

/**
 * The same view, slimmer and without Today's 20-row cut: the Areas cards count every waiting
 * thread per area, and a cut taken oldest-first would leave a busy user's newer areas at zero.
 * Under the `threads` prefix, so everything that refreshes Today's list refreshes this too.
 * ponytail: 1000 is config.toml's max_rows; a count-per-area RPC is the upgrade past that.
 */
export function useAreaThreads() {
  return useQuery({
    queryKey: [...threadKeys.all, 'by-area'],
    queryFn: async (): Promise<AreaThread[]> => {
      const { data, error } = await supabase
        .from('v_hanging_threads')
        .select('area_id, project_id, project_title, title, left_off, next_step, last_activity_at')
        .order('last_activity_at', { ascending: true })
        .limit(1000)
      if (error) throw error
      return data as unknown as AreaThread[]
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
