import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { gamificationKeys } from '../gamification/queries'
import type { ProfileInput } from '../../lib/schemas'

export function useUpdateProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: ProfileInput) => {
      const { data: session } = await supabase.auth.getSession()
      const id = session.session?.user.id
      if (!id) throw new Error('Not signed in')
      const { error } = await supabase.from('profiles').update(input).eq('id', id)
      if (error) throw error
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: gamificationKeys.profile }),
  })
}

export interface ExportBundle {
  exported_at: string
  life_areas: unknown[]
  projects: unknown[]
  tasks: unknown[]
  progress_logs: unknown[]
  focus_items: unknown[]
  xp_events: unknown[]
  user_badges: unknown[]
}

/**
 * Everything this account owns, read with the user's own RLS-scoped client — no server
 * involved, so nothing to trust but the session already in the browser.
 */
export async function fetchExportBundle(): Promise<ExportBundle> {
  const tables = [
    'life_areas',
    'projects',
    'tasks',
    'progress_logs',
    'focus_items',
    'xp_events',
    'user_badges',
  ] as const

  const results = await Promise.all(tables.map((table) => supabase.from(table).select('*')))
  const bundle: Record<string, unknown[]> = {}
  results.forEach((result, i) => {
    if (result.error) throw result.error
    bundle[tables[i]] = result.data
  })

  return { exported_at: new Date().toISOString(), ...bundle } as ExportBundle
}

export function downloadJson(data: unknown, filename: string): void {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
  )
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
