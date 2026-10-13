import { useState } from 'react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { Icon } from '../components/ui/Icon'
import { ItemTypeChip, itemTypeLabel } from '../components/ui/ItemTypeChip'
import { useToast } from '../components/ui/Toast'
import { FocusPickerSheet } from '../features/focus/FocusPickerSheet'
import { useFocusItems, usePickFocus, useToggleFocusItem } from '../features/focus/queries'
import { useProfile, useStreak, useTodayXp } from '../features/gamification/queries'
import { effectiveStreak } from '../features/gamification/aggregate'
import { ThreadList } from '../features/threads/ThreadList'
import { localDateKey } from '../lib/time'

export function TodayScreen() {
  const today = localDateKey()
  const toast = useToast()

  const profile = useProfile()
  const streak = useStreak()
  const todayXp = useTodayXp()
  const focus = useFocusItems(today)

  const pickFocus = usePickFocus(today)
  const toggleFocus = useToggleFocusItem(today)

  const [pickerOpen, setPickerOpen] = useState(false)

  const name = profile.data?.display_name ?? 'Captain'
  const weekday = new Date().toLocaleDateString(undefined, { weekday: 'long' })

  return (
    <div>
      <header className="mb-6">
        <p className="text-body text-muted">{weekday}</p>
        <h1 className="text-title-lg font-bold">Welcome back, {name}</h1>
        <div className="mt-2 flex items-center gap-3 text-body">
          <span className="rounded-full bg-flame/10 px-3 py-1 font-semibold text-flame-ink tabular">
            <Icon name="local_fire_department" />{' '}
            {effectiveStreak(streak.data ?? null, profile.data?.timezone)}-day streak
          </span>
          <span className="rounded-full bg-accent/10 px-3 py-1 font-semibold text-accent tabular">
            <Icon name="stars" /> {todayXp.data ?? 0} XP today
          </span>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:items-start">
        <section className="mb-6 lg:mb-0">
          <h2 className="mb-2 text-body font-semibold uppercase tracking-wide text-muted">
            Today&apos;s focus
          </h2>

          {focus.data?.length === 0 ? (
            <EmptyState
              title="Pick up to 3 things to focus on today"
              description="+5 ✨ for choosing"
              onAction={() => setPickerOpen(true)}
            />
          ) : (
            <div className="space-y-2">
              {focus.data?.map((item) => {
                const title = item.tasks?.title ?? item.projects?.title ?? 'Untitled'
                // focus_items holds exactly one of the two ids (rpc_pick_focus rejects
                // anything else, focus_snooze_views.sql:34), so project_id alone decides.
                const itemType = item.project_id ? 'project' : 'task'
                const titleClass = item.completed ? 'text-muted line-through' : 'font-medium'
                return (
                  <Card key={item.id}>
                    <label className="flex min-h-[44px] items-center gap-3">
                      {/* The chip at the end of the row is real text, but an explicit
                          aria-label outranks the wrapping <label>, so the kind has to be
                          repeated in the name — otherwise someone tabbing the list hears
                          "Redesign" without ever learning which Redesign they are ticking. */}
                      <input
                        type="checkbox"
                        aria-label={`Done: ${title} — ${itemTypeLabel(itemType)}`}
                        checked={item.completed}
                        onChange={(e) =>
                          toggleFocus.mutate({ id: item.id, completed: e.target.checked })
                        }
                        className="h-6 w-6 shrink-0 accent-accent"
                      />
                      <span className={`min-w-0 flex-1 ${titleClass}`}>{title}</span>
                      <ItemTypeChip itemType={itemType} />
                    </label>
                  </Card>
                )
              })}
              <Button variant="ghost" block onClick={() => setPickerOpen(true)}>
                Change focus
              </Button>
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-2 text-body font-semibold uppercase tracking-wide text-muted">
            Hanging threads
          </h2>
          <ThreadList />
        </section>
      </div>

      <FocusPickerSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        saving={pickFocus.isPending}
        onSubmit={(items) =>
          pickFocus.mutate(items, {
            onSuccess: (result) => {
              setPickerOpen(false)
              toast(result.xp_awarded > 0 ? `+${result.xp_awarded} ✨` : 'Focus updated', 'xp')
            },
            onError: (error) => toast(error.message, 'error'),
          })
        }
      />
    </div>
  )
}
