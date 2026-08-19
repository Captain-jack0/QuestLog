import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { AreaInput, LifeArea } from '../../lib/schemas'

export const areaKeys = {
  all: ['areas'] as const,
  detail: (id: string) => ['areas', id] as const,
}

export function useAreas() {
  return useQuery({
    queryKey: areaKeys.all,
    queryFn: async (): Promise<LifeArea[]> => {
      const { data, error } = await supabase
        .from('life_areas')
        .select('*')
        .eq('archived', false)
        .order('sort_order')
        .order('created_at')
      if (error) throw error
      return data
    },
  })
}

export function useArea(id: string | undefined) {
  return useQuery({
    queryKey: areaKeys.detail(id ?? ''),
    enabled: Boolean(id),
    queryFn: async (): Promise<LifeArea> => {
      const { data, error } = await supabase.from('life_areas').select('*').eq('id', id!).single()
      if (error) throw error
      return data
    },
  })
}

/** Wraps the optimistic snapshot/rollback dance every area mutation needs. */
function useAreaMutation<TVars>(
  mutationFn: (vars: TVars) => Promise<unknown>,
  optimistic: (current: LifeArea[], vars: TVars) => LifeArea[],
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onMutate: async (vars: TVars) => {
      await queryClient.cancelQueries({ queryKey: areaKeys.all })
      const previous = queryClient.getQueryData<LifeArea[]>(areaKeys.all)
      if (previous) queryClient.setQueryData(areaKeys.all, optimistic(previous, vars))
      return { previous }
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(areaKeys.all, context.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: areaKeys.all }),
  })
}

export function useCreateArea(userId: string | undefined) {
  return useAreaMutation(
    async (input: AreaInput) => {
      if (!userId) throw new Error('Not signed in')
      const { error } = await supabase.from('life_areas').insert({ ...input, user_id: userId })
      if (error) throw error
    },
    (current, input) => [
      ...current,
      {
        id: `optimistic-${current.length}`,
        user_id: userId ?? '',
        archived: false,
        created_at: new Date().toISOString(),
        ...input,
      } as LifeArea,
    ],
  )
}

export function useUpdateArea() {
  return useAreaMutation(
    async ({ id, ...input }: AreaInput & { id: string }) => {
      const { error } = await supabase.from('life_areas').update(input).eq('id', id)
      if (error) throw error
    },
    (current, vars) => current.map((a) => (a.id === vars.id ? { ...a, ...vars } : a)),
  )
}

export function useArchiveArea() {
  return useAreaMutation(
    async (id: string) => {
      const { error } = await supabase.from('life_areas').update({ archived: true }).eq('id', id)
      if (error) throw error
    },
    (current, id) => current.filter((a) => a.id !== id),
  )
}
