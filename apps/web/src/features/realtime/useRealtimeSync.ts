import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../components/ui/Toast'
import { STALE_KEYS, staleKeys } from './staleKeys'

/** Events closer together than this are refetched as one batch. */
const BATCH_MS = 250

/**
 * One Realtime channel per signed-in session (#78): a change another member makes lands here and
 * refetches whatever it touched. Mounted in the signed-in shell, so signing out unmounts it and the
 * channel goes with it.
 *
 * INSERT/UPDATE arrive only for rows RLS lets this user read. DELETE is not filtered by RLS —
 * every subscriber gets every delete, primary key only (see 20261012120000_sharing_realtime.sql).
 * ponytail: so anyone's delete anywhere marks this table's prefixes stale here, and whatever of
 * them is on screen refetches once per batch. Filter by cached ids, or move to broadcast_changes,
 * if that load ever shows up.
 */
export function useRealtimeSync(userId: string) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const navigate = useNavigate()
  // Read at event time, so moving between screens does not tear the channel down.
  const latest = useRef({ navigate, toast })
  latest.current = { navigate, toast }

  useEffect(() => {
    const pending = new Set<string>()
    let timer: ReturnType<typeof setTimeout> | undefined
    const flush = () => {
      timer = undefined
      for (const queryKey of staleKeys(pending)) queryClient.invalidateQueries({ queryKey })
      pending.clear()
    }

    // Unique per mount: a channel still leaving from the last mount cannot be handed back.
    const channel = supabase.channel(`sync:${userId}:${crypto.randomUUID()}`)
    for (const table of Object.keys(STALE_KEYS)) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => {
        // Taken off this project: leave its screen before the refetch turns it into "not found".
        if (
          table === 'project_members' &&
          payload.eventType === 'DELETE' &&
          payload.old.user_id === userId &&
          window.location.pathname === `/projects/${payload.old.project_id}`
        ) {
          latest.current.navigate('/areas', { replace: true })
          latest.current.toast('You no longer have access to that project.')
        }
        pending.add(table)
        timer ??= setTimeout(flush, BATCH_MS)
      })
    }
    channel.subscribe()
    return () => {
      clearTimeout(timer)
      supabase.removeChannel(channel)
    }
  }, [userId, queryClient])
}
