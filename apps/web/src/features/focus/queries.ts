import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { OPEN_STATUSES, type ItemStatus } from '../../lib/schemas'

/** The area embed. Null when the row is out of reach under RLS (a project shared with you that
 *  lives in someone else's area) as well as when there is no area. */
type AreaEmbed = { name: string; color: string } | null

export interface FocusRow {
  id: string
  completed: boolean
  task_id: string | null
  project_id: string | null
  tasks: {
    title: string
    status: ItemStatus
    projects: { title: string; life_areas: AreaEmbed } | null
  } | null
  projects: { title: string; status: ItemStatus; life_areas: AreaEmbed } | null
}

/** A task or project that can be picked as today's focus, or as a next step. */
export interface PickableItem {
  itemType: 'task' | 'project'
  id: string
  title: string
  status: ItemStatus
  /** Where a task lives, so a picker spanning every project can say which one. Null on a
   *  project, which is one. */
  projectId: string | null
  projectTitle: string | null
}

export const focusKeys = {
  forDate: (date: string) => ['focus', date] as const,
  pickable: ['focus', 'pickable'] as const,
  nextSteps: ['focus', 'next-steps'] as const,
}

export function useFocusItems(date: string) {
  return useQuery({
    queryKey: focusKeys.forDate(date),
    queryFn: async (): Promise<FocusRow[]> => {
      const { data, error } = await supabase
        .from('focus_items')
        .select(
          'id, completed, task_id, project_id, tasks(title, status, projects(title, life_areas(name, color))), projects(title, status, life_areas(name, color))',
        )
        .eq('date', date)
        .order('created_at')
      if (error) throw error
      return data as unknown as FocusRow[]
    },
  })
}

/**
 * The next step each focus card leads with, keyed by focus row id: the newest progress log of a
 * task, or the newest log filed under a project (any of its tasks' too — the Areas cards' rule,
 * projects/stats.ts). One `limit(1)` read per picked item, so at most three, each through the
 * same RLS as the project timeline. Under the `focus` key: rpc_update_status and the realtime
 * progress_logs stream both refresh it.
 */
export function useFocusNextSteps(items: FocusRow[]) {
  return useQuery({
    queryKey: [...focusKeys.nextSteps, items.map((item) => item.id).join(',')],
    enabled: items.length > 0,
    queryFn: async (): Promise<Record<string, string | null>> => {
      const latest = await Promise.all(
        items.map((item) => {
          // Newest log that actually has a next step: a micro-note files a log without one.
          const logs = supabase
            .from('progress_logs')
            .select('next_step')
            .not('next_step', 'is', null)
            .neq('next_step', '')
          // A focus row holds exactly one of the two ids (rpc_pick_focus).
          const own = item.task_id
            ? logs.eq('task_id', item.task_id)
            : logs.eq('project_id', item.project_id ?? '')
          return own.order('created_at', { ascending: false }).limit(1).maybeSingle()
        }),
      )
      const steps: Record<string, string | null> = {}
      latest.forEach(({ data, error }, i) => {
        if (error) throw error
        steps[items[i].id] = data?.next_step ?? null
      })
      return steps
    },
  })
}

/** Everything still open, for the picker sheet. */
export function usePickableItems(enabled: boolean) {
  return useQuery({
    queryKey: focusKeys.pickable,
    enabled,
    queryFn: async (): Promise<PickableItem[]> => {
      const [tasks, projects] = await Promise.all([
        supabase
          .from('tasks')
          .select('id, title, status, project_id, projects(title)')
          .in('status', OPEN_STATUSES),
        supabase.from('projects').select('id, title, status').in('status', OPEN_STATUSES),
      ])
      if (tasks.error) throw tasks.error
      if (projects.error) throw projects.error
      return [
        ...projects.data.map((p) => ({
          itemType: 'project' as const,
          id: p.id,
          title: p.title,
          status: p.status,
          projectId: null,
          projectTitle: null,
        })),
        ...tasks.data.map((t) => ({
          itemType: 'task' as const,
          id: t.id,
          title: t.title,
          status: t.status,
          projectId: t.project_id,
          projectTitle: t.projects?.title ?? null,
        })),
      ]
    },
  })
}

interface PickFocusResult {
  items: number
  xp_awarded: number
}

export function usePickFocus(date: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (items: PickableItem[]): Promise<PickFocusResult> => {
      const payload = items.map((item) =>
        item.itemType === 'task' ? { task_id: item.id } : { project_id: item.id },
      )
      const { data, error } = await supabase.rpc('rpc_pick_focus', {
        p_date: date,
        p_items: payload,
      })
      if (error) throw error
      return data as unknown as PickFocusResult
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: focusKeys.forDate(date) })
      queryClient.invalidateQueries({ queryKey: ['gamification'] })
    },
  })
}

export function useToggleFocusItem(date: string) {
  const queryClient = useQueryClient()
  const key = focusKeys.forDate(date)

  return useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      const { error } = await supabase.from('focus_items').update({ completed }).eq('id', id)
      if (error) throw error
    },
    onMutate: async ({ id, completed }) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<FocusRow[]>(key)
      if (previous) {
        queryClient.setQueryData(
          key,
          previous.map((row) => (row.id === id ? { ...row, completed } : row)),
        )
      }
      return { previous }
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  })
}
