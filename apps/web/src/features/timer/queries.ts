import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../components/ui/Toast'

export interface RunningTimer {
  id: string
  started_at: string
  mode: 'timer' | 'pomodoro'
  project_id: string
  task_id: string | null
  project_title: string
  task_title: string | null
  area_color: string | null
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
