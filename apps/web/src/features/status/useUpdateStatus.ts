import { useMutation, useQueryClient } from '@tanstack/react-query'
import confetti from 'canvas-confetti'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../components/ui/Toast'
import type { ItemStatus } from '../../lib/schemas'
import { statusFeedback, type StatusResult } from './feedback'

export type { StatusResult }

export interface StatusChange {
  itemType: 'task' | 'project'
  itemId: string
  status: ItemStatus
  leftOff: string
  nextStep: string
  /** The task the next step points at, if the user picked one. */
  nextStepTaskId?: string | null
  note?: string
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
        // undefined, not null: the parameter defaults to null server-side, and sending null
        // explicitly is the same thing with an extra key on the wire.
        p_next_step_task_id: change.nextStepTaskId ?? undefined,
        p_note: change.note?.trim() ? change.note.trim() : undefined,
      })
      if (error) throw error
      return data as unknown as StatusResult
    },
    onSuccess: (result) => {
      const feedback = statusFeedback(result)
      toast(feedback.xpToast, 'xp')
      if (feedback.confetti) {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.7 },
          disableForReducedMotion: true,
        })
        setTimeout(() => toast(feedback.levelToast!, 'xp'), 400)
      }
      for (const badgeToast of feedback.badgeToasts) {
        setTimeout(() => toast(badgeToast), 800)
      }
    },
    onError: (error: Error) => toast(error.message, 'error'),
    onSettled: () => {
      // The RPC touches items, logs, XP and streaks at once — refetch the lot. Threads and
      // focus derive from the item's status too, so they go stale on every call as well.
      for (const key of [['tasks'], ['projects'], ['gamification'], ['threads'], ['focus']]) {
        queryClient.invalidateQueries({ queryKey: key })
      }
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
