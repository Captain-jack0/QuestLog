import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '../../components/ui/Card'
import { CardSkeleton } from '../../components/ui/Skeleton'
import { BottomSheet } from '../../components/ui/BottomSheet'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { Icon } from '../../components/ui/Icon'
import { StatusChip } from '../../components/ui/StatusChip'
import { ItemTypeChip, itemTypeLabel } from '../../components/ui/ItemTypeChip'
import { useToast } from '../../components/ui/Toast'
import { UpdateStatusSheet, type PendingStatusChange } from '../status/UpdateStatusSheet'
import { dropChange } from '../status/drop'
import { useUpdateStatus } from '../status/useUpdateStatus'
import { relativeTime } from '../../lib/time'
import { groupThreads } from './groupThreads'
import { SNOOZE_OPTIONS, useHangingThreads, useSnooze, type HangingThread } from './queries'

type Snoozing = { itemType: 'task' | 'project'; itemId: string }

/**
 * The hanging threads, as Today and the Threads screen both show them: one list, the cards and
 * the sheets their buttons open. Lifted out of Today whole so the two screens cannot drift.
 */
export function ThreadList() {
  const toast = useToast()
  const threads = useHangingThreads()
  const snooze = useSnooze()
  const updateStatus = useUpdateStatus()

  const [pending, setPending] = useState<PendingStatusChange | null>(null)
  const [snoozeFor, setSnoozeFor] = useState<Snoozing | null>(null)

  // Two lists, not one: work in motion on top, deliberately parked work below with its status
  // spelled out — a paused project should not queue alongside what actually needs picking up.
  // An empty list drops its heading with it.
  const { active, parked } = groupThreads(threads.data ?? [])
  const threadSections = [
    { key: 'active', heading: 'Active', threads: active, showStatus: false },
    { key: 'parked', heading: 'Paused & blocked', threads: parked, showStatus: true },
  ].filter((section) => section.threads.length > 0)

  const change = (thread: HangingThread, status: 'done' | 'in_progress') =>
    setPending({
      itemType: thread.item_type,
      itemId: thread.item_id,
      title: thread.title,
      status,
      leftOff: thread.left_off,
      nextStep: thread.next_step,
      nextStepTaskId: thread.next_step_task_id,
      nextStepTaskTitle: thread.next_step_task_title,
    })

  const drop = (thread: HangingThread) =>
    updateStatus.mutate(
      // `dropped` is outside needsResumeContext, so it goes straight to the RPC with no sheet —
      // the same call ProjectDetail.tsx:130 already makes for it. The variables live in drop.ts
      // because nothing else guards them: no sheet collects them and there is no render test in
      // this project to catch it if they change (drop.test.ts).
      dropChange(thread.item_type, thread.item_id),
      // The card just disappears, and the hook's own toast only says "+8 ✨". This is the one that
      // answers "did I just delete it?" — same place the snooze confirmation below speaks from.
      { onSuccess: () => toast('Dropped — its history stays.') },
    )

  return (
    <>
      {threads.isPending && <CardSkeleton rows={2} />}

      {threads.data?.length === 0 && (
        <EmptyState
          title="No threads yet 🎉"
          description="When you pause something, its next step will wait for you right here."
        />
      )}

      {threadSections.map((section) => (
        <section
          key={section.key}
          aria-labelledby={`threads-${section.key}`}
          className="mb-4 last:mb-0"
        >
          <h3
            id={`threads-${section.key}`}
            className="mb-2 text-micro font-semibold uppercase tracking-wide text-muted"
          >
            {section.heading}
          </h3>
          <div className="grid gap-3 xl:grid-cols-2">
            {section.threads.map((thread) => (
              <ThreadCard
                key={`${thread.item_type}-${thread.item_id}`}
                thread={thread}
                showStatus={section.showStatus}
                dropping={updateStatus.isPending}
                onDone={() => change(thread, 'done')}
                onUpdate={() => change(thread, 'in_progress')}
                onSnooze={() =>
                  setSnoozeFor({ itemType: thread.item_type, itemId: thread.item_id })
                }
                onDrop={() => drop(thread)}
              />
            ))}
          </div>
        </section>
      ))}

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
    </>
  )
}

interface ThreadCardProps {
  thread: HangingThread
  showStatus: boolean
  dropping: boolean
  onDone: () => void
  onUpdate: () => void
  onSnooze: () => void
  onDrop: () => void
}

function ThreadCard({
  thread,
  showStatus,
  dropping,
  onDone,
  onUpdate,
  onSnooze,
  onDrop,
}: ThreadCardProps) {
  // Every thread is a task (#44); this says which area and project it belongs to.
  const context = [thread.area_name, thread.project_title].filter(Boolean).join(' · ')

  return (
    <Card edgeColor={thread.area_color} className="pl-5">
      <div className="flex items-start justify-between gap-2">
        {/* inline-flex, not a bare min-height: min-height does not apply to an inline box, so on
            an <a> the utility alone would change nothing. `items-start` rather than centring,
            because a one-line title centred in a 44px box drops ~12px away from the timestamp it
            sits opposite; this keeps the two tops level and spends the added height below. */}
        <Link
          to={`/projects/${thread.project_id}`}
          className="inline-flex min-h-[44px] items-start font-semibold leading-tight"
        >
          {thread.title}
        </Link>
        <span className="shrink-0 text-caption text-muted">
          {relativeTime(thread.last_activity_at)}
        </span>
      </div>
      <p className="flex flex-wrap items-center gap-1.5 text-caption text-muted">
        <ItemTypeChip itemType={thread.item_type} />
        {showStatus && <StatusChip status={thread.display_status} />}
        {context && <span>{context}</span>}
      </p>

      {/* Not when the prose is only the picked task's title: the RPC snapshots the title into
          next_step so every other reader still has words to show, and here that would print the
          same line twice. */}
      {thread.next_step && thread.next_step !== thread.next_step_task_title && (
        <p className="mt-2 text-body font-medium">
          <span className="font-normal text-muted">Next: </span>
          {thread.next_step}
        </p>
      )}

      {/* The pointed-at task, live. Finishing it does not clear the reference — the log is a
          record of what you decided, not a to-do that tidies itself — so the chip is how you see
          it is already done. */}
      {thread.next_step_task_id && thread.next_step_task_status && (
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-body">
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
        <Button variant="ghost" className="flex-1 px-2 py-2 text-body" onClick={onDone}>
          <Icon name="check" /> Done
        </Button>
        <Button variant="ghost" className="flex-1 px-2 py-2 text-body" onClick={onUpdate}>
          <Icon name="edit" /> Update
        </Button>
        <Button variant="ghost" className="flex-1 px-2 py-2 text-body" onClick={onSnooze}>
          <Icon name="bedtime" /> Snooze
        </Button>
      </div>

      {/* Its own line, and not a fourth button in the row above. At 390px the card's inner width
          is 322px, so four `flex-1` buttons get 74.5px each — 58.5px of it usable after the
          padding — while "Snooze" with its 14px icon measures about 66px in Inter 600 at 14px: it
          would wrap and the row would grow 44px → 53px anyway.

          Weight, not only width, decides the rest: those three keep the thread — this one ends
          it — and an equal-width button sitting against "Done ✓" is the one a thumb hits by
          mistake. So it is the quiet pill the edit sheet already uses for this exact action
          (TaskSheet.tsx:140-151), right-aligned and auto-width, which is both the smaller mis-tap
          target and the same word in the same tone wherever you meet it. */}
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          // Every card in the list renders one of these, so the bare word would read as a list of
          // identical "Drop" buttons. Same shape as the sheet's label.
          aria-label={`Drop ${itemTypeLabel(thread.item_type).toLowerCase()}: ${thread.title}`}
          disabled={dropping}
          onClick={onDrop}
          className="btn-quiet min-h-[44px] rounded-full border border-line px-4 text-caption font-semibold text-muted disabled:opacity-40"
        >
          Drop
        </button>
      </div>
    </Card>
  )
}
