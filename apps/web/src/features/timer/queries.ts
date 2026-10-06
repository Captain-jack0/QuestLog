import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../components/ui/Toast'
import {
  sumSecondsByProject,
  sumSecondsByTask,
  type ProjectTimeEntryRow,
  type TimeEntryRow,
} from './totals'

export interface RunningTimer {
  id: string
  started_at: string
  mode: 'timer' | 'pomodoro'
  project_id: string
  task_id: string | null
  project_title: string
  task_title: string | null
  area_color: string | null
  /** Finished seconds of the running entry's project, in the user's local day / ever. The
   *  running entry is in neither — timerBarSeconds adds the live session. */
  project_seconds_today: number
  project_seconds_total: number
}

export interface StopResult {
  stopped: boolean
  seconds: number
  xp_awarded: number
  discarded?: boolean
  daily_cap_reached?: boolean
}

export const timerKeys = {
  running: ['timer', 'running'] as const,
  daily: ['timer', 'daily'] as const,
  taskTotals: ['timer', 'task-totals'] as const,
  projectTotals: ['timer', 'project-totals'] as const,
}

export function useRunningTimer() {
  return useQuery({
    queryKey: timerKeys.running,
    queryFn: async (): Promise<RunningTimer | null> => {
      const { data, error } = await supabase.from('v_running_timer').select('*').maybeSingle()
      if (error) throw error
      return (data as RunningTimer | null) ?? null
    },
    // a timer left running in another tab should surface here before long
    refetchInterval: 60_000,
  })
}

export function useStartTimer() {
  const queryClient = useQueryClient()
  const toast = useToast()

  return useMutation({
    mutationFn: async (vars: {
      itemType: 'task' | 'project'
      itemId: string
      mode?: 'timer' | 'pomodoro'
    }) => {
      const { error } = await supabase.rpc('rpc_start_timer', {
        p_item_type: vars.itemType,
        p_item_id: vars.itemId,
        p_mode: vars.mode ?? 'timer',
      })
      if (error) throw error
    },
    onError: (error: Error) => toast(error.message, 'error'),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['timer'] }),
  })
}

export function useStopTimer() {
  const queryClient = useQueryClient()
  const toast = useToast()

  return useMutation({
    mutationFn: async (): Promise<StopResult> => {
      const { data, error } = await supabase.rpc('rpc_stop_timer')
      if (error) throw error
      return data as unknown as StopResult
    },
    onSuccess: (result) => {
      if (result.discarded) {
        toast('Too short to count — nothing logged')
      } else if (result.xp_awarded > 0) {
        toast(`+${result.xp_awarded} ✨ for ${Math.round(result.seconds / 60)} min focus`, 'xp')
      } else if (result.stopped) {
        toast(
          result.daily_cap_reached
            ? `Logged ${Math.round(result.seconds / 60)} min — daily focus XP is capped`
            : `Logged ${Math.round(result.seconds / 60)} min`,
        )
      }
    },
    onError: (error: Error) => toast(error.message, 'error'),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['timer'] })
      queryClient.invalidateQueries({ queryKey: ['gamification'] })
    },
  })
}

/**
 * Stacked focus seconds per task, for the task cards. One query for the whole screen rather
 * than one per card, like useProjectStats. Sits under the `timer` key so both mutations above
 * already invalidate it — stopping a timer folds that session into the total.
 *
 * Keyed on the task ids, not on the project: `time_entries.project_id` is snapshotted when the
 * timer starts (time_tracking.sql:52-53,67-68) and no trigger re-points it, so a task moved to
 * another project keeps entries filed under the old one. Asking by project would drop that
 * task's whole history the moment ⇄ Move is pressed.
 *
 * ponytail: no aggregate and no limit — with config.toml's max_rows = 1000 a screen whose
 * tasks hold more than 1000 sessions between them would silently undercount. Roughly three
 * years of daily focus on one project; a `sum() group by task_id` RPC is the upgrade.
 */
export function useTaskTotals(taskIds: string[]) {
  return useQuery({
    queryKey: [...timerKeys.taskTotals, taskIds.join(',')],
    enabled: taskIds.length > 0,
    queryFn: async (): Promise<Record<string, number>> => {
      const { data, error } = await supabase
        .from('time_entries')
        .select('task_id, seconds')
        .in('task_id', taskIds)
      if (error) throw error
      return sumSecondsByTask((data ?? []) as TimeEntryRow[])
    },
  })
}

/**
 * Banked focus seconds per project, for the project cards and the project header. Same shape
 * as useTaskTotals and under the same `timer` key, so stopping a timer refreshes it.
 *
 * Keyed on `project_id`, unlike the task totals: this is the number v_running_timer reports as
 * `project_seconds_total`, and an entry whose task was deleted keeps its `project_id`, so its
 * seconds stay. The flip side is the snapshot described above — a task moved to another project
 * leaves the seconds it had already clocked with the project it was in at the time.
 *
 * ponytail: no aggregate and no limit, the same max_rows = 1000 ceiling as useTaskTotals and
 * reached sooner — an area screen asks for every session of every project in the area at once.
 * Past that the totals silently undercount; a `sum() group by project_id` RPC is the upgrade.
 */
export function useProjectTotals(projectIds: string[]) {
  return useQuery({
    queryKey: [...timerKeys.projectTotals, projectIds.join(',')],
    enabled: projectIds.length > 0,
    queryFn: async (): Promise<Record<string, number>> => {
      const { data, error } = await supabase
        .from('time_entries')
        .select('project_id, seconds')
        .in('project_id', projectIds)
      if (error) throw error
      return sumSecondsByProject((data ?? []) as ProjectTimeEntryRow[])
    },
  })
}

/** Seconds per local day, for the Progress chart. */
export function useDailyFocus(days = 56) {
  return useQuery({
    queryKey: [...timerKeys.daily, days],
    queryFn: async (): Promise<{ day: string; seconds: number }[]> => {
      const { data, error } = await supabase.rpc('daily_focus_seconds', { p_days: days })
      if (error) throw error
      return (data ?? []) as { day: string; seconds: number }[]
    },
  })
}
