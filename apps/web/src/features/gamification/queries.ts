import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { startOfLocalDay } from '../../lib/time'
import { focusXpTotal } from '../../lib/xp'
import type { Database } from '../../lib/database.types'
import type { XpEvent } from './aggregate'

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
  progressLogCount: ['gamification', 'progress-log-count'] as const,
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
 * ponytail: PostgREST caps a response at max_rows (1000), so past 1000 xp_events this sum
 * silently undercounts (and the level with it). Fix: a server-side sum(xp) RPC.
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

export interface ProjectXpEvent {
  id: string
  created_at: string
  xp: number
  action_type: string
  user_id: string
  task_id: string | null
}

/**
 * This user's XP events on one project, newest first — the header sums them, History lists them
 * (same key, one request). xp_events is RLS-scoped to its owner, so on a shared project this is
 * the viewer's own share, not the project's total. Under ['gamification'], which every status
 * update and timer stop invalidates.
 *
 * ponytail: no limit, the sum needs every row; past PostgREST's max_rows (1000) on one project
 * both undercount. A server-side sum RPC is the upgrade.
 */
const projectXpQuery = (projectId: string | undefined) => ({
  queryKey: ['gamification', 'project-xp', projectId] as const,
  enabled: Boolean(projectId),
  queryFn: async (): Promise<ProjectXpEvent[]> => {
    const { data, error } = await supabase
      .from('xp_events')
      .select('id, created_at, xp, action_type, user_id, task_id')
      .eq('project_id', projectId!)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data
  },
})

export function useProjectXp(projectId: string | undefined) {
  return useQuery({ ...projectXpQuery(projectId), select: sumXp })
}

export function useProjectXpEvents(projectId: string | undefined) {
  return useQuery(projectXpQuery(projectId))
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

/**
 * Raw events for the last `weeks` weeks — the charts, the activity grid and badge counts share them.
 * Newest first: if PostgREST's max_rows (1000) ever cuts the window, it drops the oldest days, not
 * this week's. None of the aggregates depend on the order.
 */
export function useXpHistory(weeks = 12) {
  return useQuery({
    queryKey: [...gamificationKeys.history, weeks],
    queryFn: async (): Promise<XpEvent[]> => {
      const since = startOfLocalDay()
      since.setDate(since.getDate() - weeks * 7)
      const { data, error } = await supabase
        .from('xp_events')
        .select('created_at, xp, area_id')
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

/** Today's XP rows, fetched once and summed two ways by the hooks below (same key, one request). */
const todayXpQuery = {
  queryKey: gamificationKeys.todayXp,
  queryFn: async (): Promise<{ xp: number; action_type: string }[]> => {
    const { data, error } = await supabase
      .from('xp_events')
      .select('xp, action_type')
      .gte('created_at', startOfLocalDay().toISOString())
    if (error) throw error
    return data
  },
}

const sumXp = (rows: { xp: number }[]) => rows.reduce((sum, row) => sum + row.xp, 0)

/**
 * How many progress logs this user has written, for the threadkeeper badge. Filtered by user_id:
 * on a shared project RLS also lets other members' logs through. Lives under ['gamification'],
 * which every status update invalidates, so it moves with the log it just wrote.
 */
export function useProgressLogCount(userId: string | undefined) {
  return useQuery({
    queryKey: [...gamificationKeys.progressLogCount, userId],
    enabled: userId !== undefined,
    queryFn: async (): Promise<number> => {
      const { count, error } = await supabase
        .from('progress_logs')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId!)
      if (error) throw error
      return count ?? 0
    },
  })
}

export function useTodayXp() {
  return useQuery({ ...todayXpQuery, select: sumXp })
}

/** Today's focus_time XP alone — the part finish_time_entry caps (FOCUS_XP_DAILY_CAP). */
export function useTodayFocusXp() {
  return useQuery({
    ...todayXpQuery,
    select: focusXpTotal,
  })
}
