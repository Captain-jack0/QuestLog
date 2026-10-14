import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CardSkeleton } from '../components/ui/Skeleton'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { useToast } from '../components/ui/Toast'
import { useAuth } from '../auth/AuthProvider'
import { AreaSheet } from '../features/areas/AreaSheet'
import { AreaCard, WeeklySplit } from '../features/areas/AreaCard'
import { threadsByArea } from '../features/areas/areaSummary'
import { useAreas, useCreateArea } from '../features/areas/queries'
import { useAreaStats } from '../features/gamification/queries'
import { useOpenProjectCounts } from '../features/projects/queries'
import { useAllThreads } from '../features/threads/queries'
import { useAreaFocus } from '../features/timer/queries'

export function AreasScreen() {
  const { session } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [sheetOpen, setSheetOpen] = useState(false)
  const areas = useAreas()
  const counts = useOpenProjectCounts()
  const stats = useAreaStats()
  const threads = useAllThreads()
  const focus = useAreaFocus()
  const createArea = useCreateArea(session?.user.id)

  const xpByArea = useMemo(
    () => new Map((stats.data ?? []).map((s) => [s.area_id, s.total_xp])),
    [stats.data],
  )
  const waiting = useMemo(() => threadsByArea(threads.data ?? []), [threads.data])
  const userId = session?.user.id

  return (
    <div>
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-title-lg font-bold">Areas</h1>
        <Button onClick={() => setSheetOpen(true)} className="px-3 py-2">
          + New
        </Button>
      </header>

      {areas.isPending && <CardSkeleton rows={2} />}
      {areas.isError && <p className="text-alert-ink">Could not load areas. Pull down to retry.</p>}

      {areas.data?.length === 0 && (
        <EmptyState
          title="No areas yet 🧭"
          description="Areas are your big buckets — Work, Home, Learning. Start with one."
        />
      )}

      {/* One column until the side rail has arrived and left room for two (SideNav.tsx) — the
          same container trap AreaDetail.tsx spells out for its grid. The order is the server's
          least-recently-touched-first, untouched. */}
      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {areas.data?.map((area) => (
          <AreaCard
            key={area.id}
            area={area}
            openProjects={counts.data?.[area.id] ?? 0}
            totalXp={xpByArea.get(area.id)}
            // v_hanging_threads only returns the owner's projects: for a shared area an empty
            // answer says nothing, so no thread row at all. Nor while loading or after an error.
            threadsKnown={threads.isSuccess && area.user_id === userId}
            waiting={waiting.get(area.id)}
            focusSeconds={focus.data?.total[area.id]}
            onResume={(projectId) => navigate(`/projects/${projectId}`)}
          />
        ))}
      </div>

      {Boolean(areas.data?.length) && (
        <WeeklySplit areas={areas.data ?? []} week={focus.data?.week} />
      )}

      <AreaSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        saving={createArea.isPending}
        onSubmit={(values) =>
          createArea.mutate(values, {
            onSuccess: () => {
              setSheetOpen(false)
              toast('Area created')
            },
            onError: (error) => toast(error.message, 'error'),
          })
        }
      />
    </div>
  )
}
