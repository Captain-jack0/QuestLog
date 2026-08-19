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
  total: ['gamification', 'total-xp'] as const,
  history: ['gamification', 'xp-history'] as const,
  areaStats: ['gamification', 'area-stats'] as const,
  badges: ['gamification', 'badges'] as const,
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

/**
 * Lifetime XP, summed client-side.
 * ponytail: fine while a personal log stays in the thousands of rows; move to an RPC
 * (sum(xp) in SQL) if the payload ever gets noticeable.
 */
export function useTotalXp() {
  return useQuery({
    queryKey: gamificationKeys.total,
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase.from('xp_events').select('xp')
      if (error) throw error
      return data.reduce((sum, row) => sum + row.xp, 0)
    },
  })
}

export interface AreaStat {
  area_id: string
  name: string
  color: string
  icon: string | null
  total_xp: number
  level: number
  open_projects: number
  open_tasks: number
}

export function useAreaStats() {
  return useQuery({
    queryKey: gamificationKeys.areaStats,
    queryFn: async (): Promise<AreaStat[]> => {
      const { data, error } = await supabase
        .from('v_area_stats')
        .select('area_id, name, color, icon, total_xp, level, open_projects, open_tasks')
        .order('total_xp', { ascending: false })
      if (error) throw error
      return data as unknown as AreaStat[]
    },
  })
}

export interface BadgeRow {
  id: string
  code: string
  name: string
  description: string
  icon: string
  earned_at: string | null
}

/** The whole catalogue, with earned_at filled in for the ones this user holds. */
export function useBadges() {
  return useQuery({
    queryKey: gamificationKeys.badges,
    queryFn: async (): Promise<BadgeRow[]> => {
      const [badges, earned] = await Promise.all([
        supabase.from('badges').select('id, code, name, description, icon').order('code'),
        supabase.from('user_badges').select('badge_id, earned_at'),
      ])
      if (badges.error) throw badges.error
      if (earned.error) throw earned.error

      const earnedAt = new Map(earned.data.map((row) => [row.badge_id, row.earned_at]))
      return badges.data.map((badge) => ({ ...badge, earned_at: earnedAt.get(badge.id) ?? null }))
    },
  })
}

/** Raw events for the last `weeks` weeks — the chart and the streak dots share them. */
export function useXpHistory(weeks = 12) {
  return useQuery({
    queryKey: [...gamificationKeys.history, weeks],
    queryFn: async (): Promise<{ created_at: string; xp: number }[]> => {
      const since = startOfLocalDay()
      since.setDate(since.getDate() - weeks * 7)
      const { data, error } = await supabase
        .from('xp_events')
        .select('created_at, xp')
        .gte('created_at', since.toISOString())
        .order('created_at')
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
