import { useMutation, useQueryClient } from '@tanstack/react-query'
import confetti from 'canvas-confetti'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../components/ui/Toast'
import type { ItemStatus } from '../../lib/schemas'

export interface StatusChange {
  itemType: 'task' | 'project'
  itemId: string
  status: ItemStatus
  leftOff: string
  nextStep: string
  note?: string
}

/** Shape of rpc_update_status' json return (BE-04). */
export interface StatusResult {
  xp_awarded: number
  total_xp: number
  level: number
  leveled_up: boolean
  streak_current: number
  streak_best: number
  freeze_tokens: number
  new_badges: string[]
}

/**
 * Every status change in the app goes through here: the RPC owns XP, streaks and badges,
 * so the client only reports what came back.
 */
export function useUpdateStatus(projectId?: string) {
  const queryClient = useQueryClient()
  const toast = useToast()

  return useMutation({
    mutationFn: async (change: StatusChange): Promise<StatusResult> => {
      const { data, error } = await supabase.rpc('rpc_update_status', {
        p_item_type: change.itemType,
        p_item_id: change.itemId,
        p_new_status: change.status,
        p_left_off: change.leftOff,
        p_next_step: change.nextStep,
        p_note: change.note?.trim() ? change.note.trim() : undefined,
      })
      if (error) throw error
      return data as unknown as StatusResult
    },
    onSuccess: (result) => {
      toast(`+${result.xp_awarded} ✨`, 'xp')
      if (result.leveled_up) {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.7 },
          disableForReducedMotion: true,
        })
        setTimeout(() => toast(`Level ${result.level}!`, 'xp'), 400)
      }
      for (const badge of result.new_badges ?? []) {
        setTimeout(() => toast(`Badge earned: ${badge.replace(/_/g, ' ')} 🏅`), 800)
      }
    },
    onError: (error: Error) => toast(error.message, 'error'),
    onSettled: () => {
      // The RPC touches items, logs, XP and streaks at once — refetch the lot.
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      queryClient.invalidateQueries({ queryKey: ['gamification'] })
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      }
    },
  })
}

/** Paused/blocked need the resume context; done prefills it but does not demand it. */
export function needsResumeContext(status: ItemStatus): boolean {
  return status === 'paused' || status === 'blocked'
}
