import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { startOfLocalDay } from '../../lib/time'
import type { Database } from '../../lib/database.types'

type Profile = Database['public']['Tables']['profiles']['Row']
type Streak = Database['public']['Tables']['streaks']['Row']

export const gamificationKeys = {
  profile: ['gamification', 'profile'] as const,
  streak: ['gamification', 'streak'] as const,
  todayXp: ['gamification', 'today-xp'] as const,
}

export function useProfile() {
  return useQuery({
    queryKey: gamificationKeys.profile,
    queryFn: async (): Promise<Profile | null> => {
      const { data, error } = await supabase.from('profiles').select('*').maybeSingle()
      if (error) throw error
      return data
    },
  })
}

/** No row until the first XP action of the account's life, so null is a normal answer. */
export function useStreak() {
  return useQuery({
    queryKey: gamificationKeys.streak,
    queryFn: async (): Promise<Streak | null> => {
      const { data, error } = await supabase.from('streaks').select('*').maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export function useTodayXp() {
  return useQuery({
    queryKey: gamificationKeys.todayXp,
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase
        .from('xp_events')
        .select('xp')
        .gte('created_at', startOfLocalDay().toISOString())
      if (error) throw error
      return data.reduce((sum, row) => sum + row.xp, 0)
    },
  })
}
