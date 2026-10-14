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
  area_id: string | null
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

const THREAD_COLUMNS =
  'item_type, item_id, title, status, display_status, project_id, project_title, area_id, area_name, area_color, left_off, next_step, next_step_task_id, next_step_task_title, next_step_task_status, next_step_task_project_id, last_activity_at'

/** v_hanging_threads holds tasks only (#44), already excludes snoozed items and sorts by oldest
 *  activity. */
async function fetchThreads(limit: number): Promise<HangingThread[]> {
  const { data, error } = await supabase
    .from('v_hanging_threads')
    .select(THREAD_COLUMNS)
    .order('last_activity_at', { ascending: true })
    .limit(limit)
  if (error) throw error
  return data as unknown as HangingThread[]
}

/** Today's list and the rail: the oldest few. */
export function useHangingThreads() {
  return useQuery({
    queryKey: threadKeys.all,
    queryFn: () => fetchThreads(HANGING_THREADS_LIMIT),
  })
}

/** Rows useAllThreads reads at most. */
export const ALL_THREADS_LIMIT = 1000

/**
 * The same view without Today's 20-row cut, for the Threads screen and the Areas cards: a cut
 * taken oldest-first would hide newer threads and leave a busy user's newer areas at zero.
 * Under the `threads` prefix, so everything that refreshes Today's list refreshes this too.
 * ponytail: 1000 is config.toml's max_rows; a count-per-area RPC and paging are the upgrade.
 */
export function useAllThreads() {
  return useQuery({
    queryKey: [...threadKeys.all, 'every'],
    queryFn: () => fetchThreads(ALL_THREADS_LIMIT),
  })
}

/**
 * How many of your own tasks are done or dropped — the threads that settled. Filtered by
 * user_id: on a shared project RLS also lets other members' tasks through. Under the `threads`
 * prefix, which every status change and realtime task event invalidates.
 */
export function useSettledCount(userId: string | undefined) {
  return useQuery({
    queryKey: [...threadKeys.all, 'settled', userId],
    enabled: userId !== undefined,
    queryFn: async (): Promise<number> => {
      const { count, error } = await supabase
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId!)
        .in('status', ['done', 'dropped'])
      if (error) throw error
      return count ?? 0
    },
  })
}

export const SNOOZE_OPTIONS = [
  { label: '3 days', days: 3 },
  { label: '1 week', days: 7 },
  { label: '1 month', days: 30 },
] as const

/** The two row lists a snooze takes a thread out of: Today's and the Threads screen's. */
const SNOOZABLE_KEYS = [threadKeys.all, [...threadKeys.all, 'every']] as const

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
      // Both lists, by exact key: a prefix match would also catch ['threads', 'settled', uid],
      // which holds a number, not rows.
      const previous = SNOOZABLE_KEYS.map(
        (key) => [key, queryClient.getQueryData<HangingThread[]>(key)] as const,
      )
      for (const [key, rows] of previous) {
        if (rows) {
          queryClient.setQueryData(
            key,
            rows.filter((t) => t.item_id !== itemId),
          )
        }
      }
      return { previous }
    },
    onError: (_error, _vars, context) => {
      for (const [key, rows] of context?.previous ?? []) {
        if (rows) queryClient.setQueryData(key, rows)
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: threadKeys.all }),
  })
}
