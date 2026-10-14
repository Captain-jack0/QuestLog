import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { BottomSheet } from '../../components/ui/BottomSheet'
import { Button } from '../../components/ui/Button'
import { fieldClass } from '../../components/ui/field'
import { useToast } from '../../components/ui/Toast'
import { useAuth } from '../../auth/AuthProvider'
import type { Project } from '../../lib/schemas'
import { deleteProject, leaveProject, restoreProject } from './queries'

/** The confirm button wakes only once the project's name is typed out in full. */
export function deleteConfirmed(typed: string, title: string): boolean {
  return typed.trim() === title.trim()
}

/** Only the owner deletes a project; anyone else on a shared one can only leave it (#60). */
export function removalKind(
  ownerId: string | undefined,
  userId: string | undefined,
): 'delete' | 'leave' {
  return ownerId !== undefined && ownerId === userId ? 'delete' : 'leave'
}

type RemovalKind = ReturnType<typeof removalKind>

/**
 * Where the project's own screen goes once it is gone. The owner lands on the area it lived in; a
 * member who left goes to the area list — the area is the owner's, and a member of the project
 * alone cannot open it.
 */
export function removedRedirect(kind: RemovalKind, areaId: string | null | undefined): string {
  return kind === 'delete' && areaId ? `/areas/${areaId}` : '/areas'
}

type RemovableProject = Pick<Project, 'id' | 'title' | 'user_id'>

/**
 * "Delete" for the owner — confirmed by typing the name, undone from the toast — or "Leave" for a
 * member. The area grid's card button and the project's edit sheet both go through this, so the
 * two doors behave as one. `start` opens the flow; `sheet` is the confirm dialog to mount.
 * `onRemoved` runs once the project is gone for this user, before the caches refetch: leave its
 * screen there. `project` may still be loading, so it is optional.
 */
export function useProjectRemoval(
  project: RemovableProject | undefined,
  onRemoved?: (kind: RemovalKind) => void,
) {
  const { session } = useAuth()
  const userId = session?.user.id
  const toast = useToast()
  const queryClient = useQueryClient()
  const [confirming, setConfirming] = useState(false)
  const [typed, setTyped] = useState('')
  const kind = removalKind(project?.user_id, userId)
  const id = project?.id ?? ''
  const title = project?.title ?? ''

  // A project's disappearance reaches every screen (lists, Today, timers, threads, stats), so
  // everything is marked stale rather than a hand-kept list of keys that would drift.
  const refresh = () => queryClient.invalidateQueries()

  // Hook-level callbacks, not mutate()'s: these still run after onRemoved navigates away.
  const remove = useMutation({
    mutationFn: () => (kind === 'delete' ? deleteProject(id) : leaveProject(id, userId ?? '')),
    onSuccess: () => {
      setConfirming(false)
      onRemoved?.(kind)
      refresh()
      if (kind === 'leave') {
        toast(`You left "${title}"`)
        return
      }
      toast('Project deleted', 'info', {
        label: 'Undo',
        onClick: () =>
          restoreProject(id).then(
            () => {
              refresh()
              toast('Project restored')
            },
            (error: Error) => toast(error.message, 'error'),
          ),
      })
    },
    onError: (error) => toast(error.message, 'error'),
  })

  const start = () => {
    if (kind === 'delete') {
      setTyped('')
      setConfirming(true)
    } else if (window.confirm(`Leave "${title}"? You will need a new invite to rejoin.`)) {
      remove.mutate()
    }
  }

  const sheet = (
    <BottomSheet open={confirming} onClose={() => setConfirming(false)} title="Delete project?">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (deleteConfirmed(typed, title)) remove.mutate()
        }}
      >
        <p className="text-sm text-muted">
          It disappears from every list, for everyone it is shared with. Its history, your XP and
          your badges stay, and you can undo right after.
        </p>
        <div>
          <label htmlFor={`delete-confirm-${id}`} className="mb-1 block text-sm font-medium">
            Type <strong>{title}</strong> to confirm
          </label>
          <input
            id={`delete-confirm-${id}`}
            autoComplete="off"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            className={fieldClass}
          />
        </div>
        <Button
          type="submit"
          variant="danger"
          block
          disabled={!deleteConfirmed(typed, title) || remove.isPending}
        >
          {remove.isPending ? 'Deleting…' : 'Delete project'}
        </Button>
      </form>
    </BottomSheet>
  )

  return { label: kind === 'delete' ? 'Delete project' : 'Leave project', kind, start, sheet }
}

/** The area grid's card button: a 44px icon beside the card's link, never inside it. */
export function ProjectRemoval({
  project,
  className = '',
}: {
  project: RemovableProject
  className?: string
}) {
  const removal = useProjectRemoval(project)
  return (
    <>
      <button
        type="button"
        aria-label={`${removal.label} ${project.title}`}
        onClick={removal.start}
        className={`flex h-11 w-11 items-center justify-center rounded-xl text-muted transition hover:text-alert-ink ${className}`}
      >
        <i className={`pi ${removal.kind === 'delete' ? 'pi-trash' : 'pi-sign-out'}`} aria-hidden />
      </button>
      {removal.sheet}
    </>
  )
}
