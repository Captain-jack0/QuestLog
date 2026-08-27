import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '../components/ui/Card'
import { CardSkeleton } from '../components/ui/Skeleton'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { useToast } from '../components/ui/Toast'
import { useAuth } from '../auth/AuthProvider'
import { AreaSheet } from '../features/areas/AreaSheet'
import { useAreas, useCreateArea } from '../features/areas/queries'
import { useOpenProjectCounts } from '../features/projects/queries'

export function AreasScreen() {
  const { session } = useAuth()
  const toast = useToast()
  const [sheetOpen, setSheetOpen] = useState(false)
  const areas = useAreas()
  const counts = useOpenProjectCounts()
  const createArea = useCreateArea(session?.user.id)

  return (
    <div>
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Areas</h1>
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

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {areas.data?.map((area) => (
          <Link key={area.id} to={`/areas/${area.id}`} className="block">
            <Card edgeColor={area.color} className="h-full pl-5">
              <div className="text-2xl">{area.icon}</div>
              <div className="mt-1 font-semibold leading-tight">{area.name}</div>
              <div className="mt-1 text-sm text-muted">
                {counts.data?.[area.id] ?? 0} open project
                {(counts.data?.[area.id] ?? 0) === 1 ? '' : 's'}
              </div>
            </Card>
          </Link>
        ))}
      </div>

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
