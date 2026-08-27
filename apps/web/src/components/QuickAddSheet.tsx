import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BottomSheet } from './ui/BottomSheet'
import { Button } from './ui/Button'
import { useToast } from './ui/Toast'
import { useAuth } from '../auth/AuthProvider'
import { useAreas } from '../features/areas/queries'
import { supabase } from '../lib/supabase'
import { OPEN_STATUSES } from '../lib/schemas'

const LAST_AREA = 'questlog:last-area'
const LAST_PROJECT = 'questlog:last-project'

interface QuickAddSheetProps {
  open: boolean
  onClose: () => void
}

/** Projects of one area, for the picker. */
function useAreaProjects(areaId: string) {
  return useQuery({
    queryKey: ['quick-add', 'projects', areaId],
    enabled: Boolean(areaId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, title')
        .eq('area_id', areaId)
        .in('status', OPEN_STATUSES)
        .order('updated_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function QuickAddSheet({ open, onClose }: QuickAddSheetProps) {
  const { session } = useAuth()
  const toast = useToast()
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)

  const areas = useAreas()
  const [areaId, setAreaId] = useState(() => localStorage.getItem(LAST_AREA) ?? '')
  const [projectId, setProjectId] = useState(() => localStorage.getItem(LAST_PROJECT) ?? '')
  const [asProject, setAsProject] = useState(false)
  const projects = useAreaProjects(areaId)

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  // A remembered project that no longer belongs to the chosen area would save into the wrong place.
  useEffect(() => {
    if (projects.data && projectId && !projects.data.some((p) => p.id === projectId)) {
      setProjectId('')
    }
  }, [projects.data, projectId])

  const add = useMutation({
    mutationFn: async (title: string) => {
      const userId = session?.user.id
      if (!userId) throw new Error('Not signed in')

      // A task needs a project; without one we can only create a project.
      if (asProject || !projectId) {
        if (!areaId) throw new Error('Pick an area first')
        const { error } = await supabase
          .from('projects')
          .insert({ user_id: userId, area_id: areaId, title, status: 'idea' })
        if (error) throw error
        return 'project' as const
      }

      const { error } = await supabase
        .from('tasks')
        .insert({ user_id: userId, project_id: projectId, title, status: 'idea' })
      if (error) throw error
      return 'task' as const
    },
    onSuccess: (kind) => {
      localStorage.setItem(LAST_AREA, areaId)
      localStorage.setItem(LAST_PROJECT, projectId)
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['quick-add'] })
      queryClient.invalidateQueries({ queryKey: ['focus'] })
      toast(kind === 'project' ? 'Project added' : 'Task added')
      // stays open for the next thought
      if (inputRef.current) {
        inputRef.current.value = ''
        inputRef.current.focus()
      }
    },
    onError: (error: Error) => toast(error.message, 'error'),
  })

  const canAddTask = Boolean(projectId)

  return (
    <BottomSheet open={open} onClose={onClose} title="Quick add">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          const title = inputRef.current?.value.trim()
          if (title) add.mutate(title)
        }}
      >
        <input
          ref={inputRef}
          aria-label="What's on your mind?"
          placeholder="What's on your mind, Captain?"
          className="w-full rounded-xl border border-line bg-paper px-4 py-3 text-base focus:border-accent"
        />

        <div className="grid grid-cols-2 gap-2">
          <select
            aria-label="Area"
            value={areaId}
            onChange={(e) => {
              setAreaId(e.target.value)
              setProjectId('')
            }}
            className="min-h-[44px] rounded-xl border border-line bg-paper px-3 text-sm"
          >
            <option value="">Area…</option>
            {areas.data?.map((area) => (
              <option key={area.id} value={area.id}>
                {area.icon} {area.name}
              </option>
            ))}
          </select>

          <select
            aria-label="Project"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            disabled={!areaId}
            className="min-h-[44px] rounded-xl border border-line bg-paper px-3 text-sm disabled:opacity-50"
          >
            <option value="">Project…</option>
            {projects.data?.map((project) => (
              <option key={project.id} value={project.id}>
                {project.title}
              </option>
            ))}
          </select>
        </div>

        {!canAddTask && (
          <label className="flex min-h-[44px] items-center justify-between gap-3 text-sm">
            <span>
              Add as project
              <span className="block text-xs text-muted">
                No project picked, so this lands in the area as one.
              </span>
            </span>
            <input
              type="checkbox"
              checked
              disabled
              aria-label="Add as project"
              className="h-6 w-6 accent-accent"
            />
          </label>
        )}

        {canAddTask && (
          <label className="flex min-h-[44px] items-center justify-between gap-3 text-sm">
            <span>Add as project instead</span>
            <input
              type="checkbox"
              checked={asProject}
              onChange={(e) => setAsProject(e.target.checked)}
              aria-label="Add as project instead"
              className="h-6 w-6 accent-accent"
            />
          </label>
        )}

        <Button type="submit" block disabled={add.isPending}>
          {add.isPending ? 'Saving…' : 'Add'}
        </Button>
        <p className="text-center text-xs text-muted">
          Enter saves and keeps the sheet open. Tap outside to close.
        </p>
      </form>
    </BottomSheet>
  )
}
