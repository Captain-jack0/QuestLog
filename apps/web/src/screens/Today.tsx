import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '../components/ui/Card'
import { CardSkeleton } from '../components/ui/Skeleton'
import { BottomSheet } from '../components/ui/BottomSheet'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { useToast } from '../components/ui/Toast'
import { FocusPickerSheet } from '../features/focus/FocusPickerSheet'
import { useFocusItems, usePickFocus, useToggleFocusItem } from '../features/focus/queries'
import { useProfile, useStreak, useTodayXp } from '../features/gamification/queries'
import { SNOOZE_OPTIONS, useHangingThreads, useSnooze } from '../features/threads/queries'
import { UpdateStatusSheet, type PendingStatusChange } from '../features/status/UpdateStatusSheet'
import { useUpdateStatus } from '../features/status/useUpdateStatus'
import { localDateKey, relativeTime } from '../lib/time'

export function TodayScreen() {
  const today = localDateKey()
  const toast = useToast()

  const profile = useProfile()
  const streak = useStreak()
  const todayXp = useTodayXp()
  const focus = useFocusItems(today)
  const threads = useHangingThreads()

  const pickFocus = usePickFocus(today)
  const toggleFocus = useToggleFocusItem(today)
  const snooze = useSnooze()
  const updateStatus = useUpdateStatus()

  const [pickerOpen, setPickerOpen] = useState(false)
  const [pending, setPending] = useState<PendingStatusChange | null>(null)
  const [snoozeFor, setSnoozeFor] = useState<{
    itemType: 'task' | 'project'
    itemId: string
  } | null>(null)

  const name = profile.data?.display_name ?? 'Captain'
  const weekday = new Date().toLocaleDateString(undefined, { weekday: 'long' })

  return (
    <div>
      <header className="mb-6">
        <p className="text-sm text-muted">{weekday}</p>
        <h1 className="text-2xl font-bold">Welcome back, {name}</h1>
        <div className="mt-2 flex items-center gap-3 text-sm">
          <span className="rounded-full bg-flame/10 px-3 py-1 font-semibold text-flame-ink tabular">
            🔥 {streak.data?.current ?? 0}-day streak
          </span>
          <span className="rounded-full bg-accent/10 px-3 py-1 font-semibold text-accent tabular">
            ✨ {todayXp.data ?? 0} XP today
          </span>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:items-start">
        <section className="mb-6 lg:mb-0">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
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
                return (
                  <Card key={item.id} className="p-3">
                    <label className="flex min-h-[44px] items-center gap-3">
                      <input
                        type="checkbox"
                        aria-label={`Done: ${title}`}
                        checked={item.completed}
                        onChange={(e) =>
                          toggleFocus.mutate({ id: item.id, completed: e.target.checked })
                        }
                        className="h-6 w-6 shrink-0 accent-accent"
                      />
                      <span className={item.completed ? 'text-muted line-through' : 'font-medium'}>
                        {title}
                      </span>
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
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
            Hanging threads
          </h2>

          {threads.isPending && <CardSkeleton rows={2} />}

          {threads.data?.length === 0 && (
            <EmptyState
              title="No threads yet 🎉"
              description="When you pause something, its next step will wait for you right here."
            />
          )}

          <div className="grid gap-3 xl:grid-cols-2">
            {threads.data?.map((thread) => (
              <Card
                key={`${thread.item_type}-${thread.item_id}`}
                edgeColor={thread.area_color}
                className="pl-5"
              >
                <div className="flex items-start justify-between gap-2">
                  <Link
                    to={`/projects/${thread.project_id}`}
                    className="font-semibold leading-tight"
                  >
                    {thread.title}
                  </Link>
                  <span className="shrink-0 text-xs text-muted">
                    {relativeTime(thread.last_activity_at)}
                  </span>
                </div>
                <p className="text-xs text-muted">
                  {thread.area_name ? `${thread.area_name} · ` : ''}
                  {thread.project_title}
                </p>

                {thread.next_step && (
                  <p className="mt-2 text-sm font-medium">
                    <span className="font-normal text-muted">Next: </span>
                    {thread.next_step}
                  </p>
                )}

                <div className="mt-3 flex gap-2">
                  <Button
                    className="flex-1 px-2 py-2 text-sm"
                    onClick={() =>
                      setPending({
                        itemType: thread.item_type,
                        itemId: thread.item_id,
                        title: thread.title,
                        status: 'done',
                        leftOff: thread.left_off,
                        nextStep: thread.next_step,
                      })
                    }
                  >
                    Done ✓
                  </Button>
                  <Button
                    variant="ghost"
                    className="flex-1 px-2 py-2 text-sm"
                    onClick={() =>
                      setPending({
                        itemType: thread.item_type,
                        itemId: thread.item_id,
                        title: thread.title,
                        status: 'in_progress',
                        leftOff: thread.left_off,
                        nextStep: thread.next_step,
                      })
                    }
                  >
                    Update ✎
                  </Button>
                  <Button
                    variant="ghost"
                    className="flex-1 px-2 py-2 text-sm"
                    onClick={() =>
                      setSnoozeFor({ itemType: thread.item_type, itemId: thread.item_id })
                    }
                  >
                    Snooze 💤
                  </Button>
                </div>
              </Card>
            ))}
          </div>
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

      <UpdateStatusSheet
        pending={pending}
        saving={updateStatus.isPending}
        onClose={() => setPending(null)}
        onSubmit={({ leftOff, nextStep, note }) =>
          pending &&
          updateStatus.mutate(
            {
              itemType: pending.itemType,
              itemId: pending.itemId,
              status: pending.status,
              leftOff,
              nextStep,
              note,
            },
            { onSuccess: () => setPending(null) },
          )
        }
      />

      {snoozeFor && (
        <BottomSheet open onClose={() => setSnoozeFor(null)} title="Snooze until…">
          <div className="space-y-2">
            {SNOOZE_OPTIONS.map((option) => (
              <Button
                key={option.days}
                variant="ghost"
                block
                onClick={() =>
                  snooze.mutate(
                    { ...snoozeFor, days: option.days },
                    {
                      onSuccess: () => {
                        setSnoozeFor(null)
                        toast(`Snoozed for ${option.label}`)
                      },
                      onError: (error) => toast(error.message, 'error'),
                    },
                  )
                }
              >
                {option.label}
              </Button>
            ))}
          </div>
        </BottomSheet>
      )}
    </div>
  )
}
