import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '../components/ui/Card'
import { CardSkeleton } from '../components/ui/Skeleton'
import { BottomSheet } from '../components/ui/BottomSheet'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { StatusChip } from '../components/ui/StatusChip'
import { ItemTypeChip, itemTypeLabel } from '../components/ui/ItemTypeChip'
import { useToast } from '../components/ui/Toast'
import { FocusPickerSheet } from '../features/focus/FocusPickerSheet'
import { useFocusItems, usePickFocus, useToggleFocusItem } from '../features/focus/queries'
import { useProfile, useStreak, useTodayXp } from '../features/gamification/queries'
import { SNOOZE_OPTIONS, useHangingThreads, useSnooze } from '../features/threads/queries'
import { UpdateStatusSheet, type PendingStatusChange } from '../features/status/UpdateStatusSheet'
import { dropChange } from '../features/status/drop'
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
                // focus_items holds exactly one of the two ids (rpc_pick_focus rejects
                // anything else, focus_snooze_views.sql:34), so project_id alone decides.
                const itemType = item.project_id ? 'project' : 'task'
                const titleClass = item.completed ? 'text-muted line-through' : 'font-medium'
                return (
                  <Card key={item.id} className="p-3">
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
            {threads.data?.map((thread) => {
              // v_hanging_threads gives a project row its *own* title as project_title — the
              // union's second leg selects p.title into both columns
              // (focus_snooze_views.sql:158-159) — so printing it under the heading spelled the
              // same words twice. A project's context is the area it lives in; only a task also
              // sits inside a project. Fixed here rather than in the view: project_id on that
              // row is load-bearing (the Link below routes on it), and a migration would sit in
              // CI green while production kept the duplicate — see the lesson
              // migration-uretime-gitmiyor-2026-09-01.
              const inProject = thread.item_type === 'task' ? thread.project_title : null
              const context = [thread.area_name, inProject].filter(Boolean).join(' · ')

              return (
                <Card
                  key={`${thread.item_type}-${thread.item_id}`}
                  edgeColor={thread.area_color}
                  className="pl-5"
                >
                  <div className="flex items-start justify-between gap-2">
                    {/* inline-flex, not a bare min-height: min-height does not apply to an inline
                        box, so on an <a> the utility alone would change nothing. `items-start`
                        rather than centring, because a one-line title centred in a 44px box drops
                        ~12px away from the timestamp it sits opposite; this keeps the two tops
                        level exactly as they were and spends the added height below the text. */}
                    <Link
                      to={`/projects/${thread.project_id}`}
                      className="inline-flex min-h-[44px] items-start font-semibold leading-tight"
                    >
                      {thread.title}
                    </Link>
                    <span className="shrink-0 text-xs text-muted">
                      {relativeTime(thread.last_activity_at)}
                    </span>
                  </div>
                  <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
                    <ItemTypeChip itemType={thread.item_type} />
                    {context && <span>{context}</span>}
                  </p>

                  {/* Not when the prose is only the picked task's title: the RPC snapshots the
                      title into next_step so every other reader still has words to show, and
                      here that would print the same line twice. */}
                  {thread.next_step && thread.next_step !== thread.next_step_task_title && (
                    <p className="mt-2 text-sm font-medium">
                      <span className="font-normal text-muted">Next: </span>
                      {thread.next_step}
                    </p>
                  )}

                  {/* The pointed-at task, live. Finishing it does not clear the reference — the
                      log is a record of what you decided, not a to-do that tidies itself — so the
                      chip is how you see it is already done. */}
                  {thread.next_step_task_id && thread.next_step_task_status && (
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                      <Link
                        to={`/projects/${thread.next_step_task_project_id}`}
                        className="inline-flex min-h-[44px] items-center font-medium text-accent"
                      >
                        ↳ {thread.next_step_task_title}
                      </Link>
                      <StatusChip status={thread.next_step_task_status} />
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
                          nextStepTaskId: thread.next_step_task_id,
                          nextStepTaskTitle: thread.next_step_task_title,
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
                          nextStepTaskId: thread.next_step_task_id,
                          nextStepTaskTitle: thread.next_step_task_title,
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

                  {/* Its own line, and not a fourth button in the row above. At 390px the card's
                      inner width is 322px, so four `flex-1` buttons get 74.5px each — 58.5px of
                      it usable after the padding — while "Update ✎" measures 64.3px and
                      "Snooze 💤" 69.5px in Inter 600 at 14px: two of the four labels would wrap
                      and the row would grow 44px → 53px anyway. The same 44px as a fixed-width
                      icon leaves 68.7px, still 0.9px short of Snooze.

                      Weight, not only width, decides the rest: those three keep the thread — this
                      one ends it — and an equal-width button sitting against "Done ✓" is the one
                      a thumb hits by mistake. So it is the quiet pill the edit sheet already uses
                      for this exact action (TaskSheet.tsx:140-151), right-aligned and auto-width,
                      which is both the smaller mis-tap target and the same word in the same tone
                      wherever you meet it. */}
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      // Every card in the list renders one of these, so the bare word would read
                      // as a list of identical "Drop" buttons. Same shape as the sheet's label.
                      aria-label={`Drop ${itemTypeLabel(thread.item_type).toLowerCase()}: ${thread.title}`}
                      disabled={updateStatus.isPending}
                      onClick={() =>
                        updateStatus.mutate(
                          // `dropped` is outside needsResumeContext, so it goes straight to the
                          // RPC with no sheet — the same call ProjectDetail.tsx:130 already makes
                          // for it. The variables live in drop.ts because nothing else guards
                          // them: no sheet collects them and there is no render test in this
                          // project to catch it if they change (drop.test.ts).
                          dropChange(thread.item_type, thread.item_id),
                          // The card just disappears, and the hook's own toast only says "+8 ✨".
                          // This is the one that answers "did I just delete it?" — same place the
                          // snooze confirmation below already speaks from.
                          { onSuccess: () => toast('Dropped — its history stays.') },
                        )
                      }
                      className="btn-quiet min-h-[44px] rounded-full border border-line px-4 text-xs font-semibold text-muted disabled:opacity-40"
                    >
                      Drop
                    </button>
                  </div>
                </Card>
              )
            })}
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
        onSubmit={({ leftOff, nextStep, note, nextStepTaskId }) =>
          pending &&
          updateStatus.mutate(
            {
              itemType: pending.itemType,
              itemId: pending.itemId,
              status: pending.status,
              leftOff,
              nextStep,
              nextStepTaskId,
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
