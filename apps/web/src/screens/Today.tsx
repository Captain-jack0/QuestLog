import { useState } from 'react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { Icon } from '../components/ui/Icon'
import { ItemTypeChip, itemTypeLabel } from '../components/ui/ItemTypeChip'
import { CardSkeleton } from '../components/ui/Skeleton'
import { StatusChip } from '../components/ui/StatusChip'
import { useToast } from '../components/ui/Toast'
import { useShell } from '../components/shellContext'
import { FocusPickerSheet, MAX_FOCUS } from '../features/focus/FocusPickerSheet'
import {
  useFocusItems,
  useFocusNextSteps,
  usePickFocus,
  useToggleFocusItem,
  type FocusRow,
} from '../features/focus/queries'
import { useProfile, useStreak, useTodayXp } from '../features/gamification/queries'
import { effectiveStreak } from '../features/gamification/aggregate'
import { ThreadList } from '../features/threads/ThreadList'
import { HANGING_THREADS_LIMIT, useHangingThreads } from '../features/threads/queries'
import { formatMinutes } from '../features/timer/pomodoro'
import { useProjectTotals, useRunningTimer, useTaskTotals } from '../features/timer/queries'
import { runningOn } from '../features/timer/stack'
import { TimerButton } from '../features/timer/TimerButton'
import { LOCALE, localDateKey, stardate } from '../lib/time'
import { focusLeadId, isQuiet, isResume, waitingLine } from './todayLogic'

export function TodayScreen() {
  const today = localDateKey()
  const toast = useToast()
  const shell = useShell()

  const profile = useProfile()
  const focus = useFocusItems(today)
  const threads = useHangingThreads()

  const pickFocus = usePickFocus(today)
  const [pickerOpen, setPickerOpen] = useState(false)

  const name = profile.data?.display_name ?? 'Captain'
  const waiting = threads.data?.length

  return (
    <div>
      <header className="mb-6">
        <p className="flex flex-wrap items-center gap-x-2 text-micro uppercase text-muted">
          {/* Decoration (CEO, Clarify): the stardate is never the only date on screen. */}
          <span aria-hidden className="text-accent-ink">
            Stardate {stardate()}
          </span>
          <span aria-hidden>·</span>
          <time dateTime={today}>
            {new Date().toLocaleDateString(LOCALE, {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            })}
          </time>
        </p>
        <h1 className="mt-1 text-title-lg md:text-display-sm">Welcome back, {name}</h1>
        {waiting !== undefined && (
          <p className="mt-1 text-lead text-muted">{waitingLine(waiting, HANGING_THREADS_LIMIT)}</p>
        )}
        <Standing />
      </header>

      {/* Looks like a field, opens the shell's Quick add sheet — one capture form, not two. The
          name is the visible prompt behind a hidden "Capture a thread:", so it contains what you
          see; it never says "Quick add", which is the top bar's button (e2e matches that name as a
          substring). No aria-label on purpose: getByLabel matches those, and the prompt shares
          words with the resume sheet's "What's the next step?" field. Opens on click only — a
          dialog that opened on focus would trap anyone tabbing past. */}
      {shell && (
        <button
          type="button"
          onClick={shell.openQuickAdd}
          className="btn-quiet mb-6 flex min-h-[52px] w-full items-center gap-3 rounded-card border border-line bg-surface-sunken px-4 text-left"
        >
          <Icon name="add" className="icon-xl text-accent-ink" />
          <span className="min-w-0 flex-1 truncate text-body text-muted">
            <span className="sr-only">Capture a thread: </span>
            Where did you pause? What&apos;s the next step?
          </span>
        </button>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:items-start">
        <section aria-labelledby="today-focus" className="mb-6 lg:mb-0">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <h2
              id="today-focus"
              className="text-body font-semibold uppercase tracking-wide text-muted"
            >
              Today&apos;s focus
            </h2>
            {focus.data && (
              <span className="text-caption text-muted tabular">
                {focus.data.length} / {MAX_FOCUS} pinned
              </span>
            )}
          </div>

          {focus.isPending && <CardSkeleton rows={1} />}
          {focus.isError && (
            <p className="text-body text-muted">Today&apos;s focus could not load.</p>
          )}

          {focus.data?.length === 0 && (
            <EmptyState
              title="Pick up to 3 things to focus on today"
              description="+5 ✨ for choosing"
              onAction={() => setPickerOpen(true)}
            />
          )}

          {focus.data && focus.data.length > 0 && (
            <div className="space-y-3">
              <FocusCards items={focus.data} today={today} />
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

/**
 * Streak, shields and today's XP — the same numbers the top bar and the rail show. The streak is
 * the effective one and waits for the profile's timezone; the rest wait for their own data.
 */
function Standing() {
  const profile = useProfile()
  const streak = useStreak()
  const todayXp = useTodayXp()
  const chip = 'flex items-center gap-1.5 rounded-full px-3 py-1 text-body font-semibold tabular'

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {!profile.isPending && !streak.isPending && (
        <span className={`${chip} bg-flame/10 text-flame-ink`}>
          <Icon name="local_fire_department" />
          {effectiveStreak(streak.data ?? null, profile.data?.timezone)}-day streak
        </span>
      )}
      {streak.data && (
        // The idea chip's pair (StatusChip), already held to AA in both themes.
        <span className={`${chip} bg-line/30 text-muted`}>
          <Icon name="shield" />
          {streak.data.freeze_tokens} {streak.data.freeze_tokens === 1 ? 'shield' : 'shields'}
        </span>
      )}
      {todayXp.data !== undefined && (
        <span className={`${chip} bg-success/10 text-success-ink`}>+{todayXp.data} XP today</span>
      )}
    </div>
  )
}

/**
 * The picked items, each led by its next step. Only the first open card gets the filled start,
 * and only while no card's clock runs (then the filled button is that clock's Stop): Today keeps
 * one filled button, and that is the one to press.
 */
function FocusCards({ items, today }: { items: FocusRow[]; today: string }) {
  const toggleFocus = useToggleFocusItem(today)
  const nextSteps = useFocusNextSteps(items)
  const running = useRunningTimer()
  const taskTotals = useTaskTotals(items.flatMap((item) => (item.task_id ? [item.task_id] : [])))
  const projectTotals = useProjectTotals(
    items.flatMap((item) => (item.project_id ? [item.project_id] : [])),
  )

  const clocks = running.data ?? []
  const itemOf = (row: FocusRow) =>
    row.project_id
      ? { itemType: 'project' as const, itemId: row.project_id }
      : { itemType: 'task' as const, itemId: row.task_id ?? '' }
  const leadId = focusLeadId(items, clocks)

  return (
    <>
      {items.map((item) => {
        // focus_items holds exactly one of the two ids (rpc_pick_focus rejects anything else,
        // focus_snooze_views.sql:34), so project_id alone decides.
        const { itemType, itemId } = itemOf(item)
        const title = item.tasks?.title ?? item.projects?.title ?? 'Untitled'
        const status = item.tasks?.status ?? item.projects?.status
        const area = item.tasks?.projects?.life_areas ?? item.projects?.life_areas ?? null
        const where = [area?.name, item.tasks?.projects?.title].filter(Boolean).join(' · ')
        const nextStep = nextSteps.data?.[item.id] ?? null
        const banked =
          (itemType === 'task' ? taskTotals.data?.[itemId] : projectTotals.data?.[itemId]) ?? 0
        const titleTone = item.completed ? 'text-muted line-through' : ''

        return (
          <Card key={item.id} edgeColor={area?.color} className="pl-5">
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 truncate text-micro uppercase text-muted">{where}</p>
              {status && <StatusChip status={status} />}
            </div>

            {nextStep && (
              <p className="mt-1 text-lead">
                <span className="text-muted">Next: </span>
                {nextStep}
              </p>
            )}

            <label className="mt-1 flex min-h-[44px] items-center gap-3">
              {/* The chip at the end of the row is real text, but an explicit aria-label outranks
                  the wrapping <label>, so the kind has to be repeated in the name — otherwise
                  someone tabbing the list hears "Redesign" without ever learning which Redesign
                  they are ticking. */}
              <input
                type="checkbox"
                aria-label={`Done: ${title} — ${itemTypeLabel(itemType)}`}
                checked={item.completed}
                onChange={(e) => toggleFocus.mutate({ id: item.id, completed: e.target.checked })}
                className="h-6 w-6 shrink-0 accent-accent"
              />
              <span
                className={`min-w-0 flex-1 ${
                  nextStep ? 'text-body-medium' : 'text-lead font-semibold'
                } ${titleTone}`}
              >
                {title}
              </span>
              <ItemTypeChip itemType={itemType} />
            </label>

            {!item.completed && (
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-caption text-muted tabular">
                  {isResume(banked) && (
                    <>
                      <Icon name="schedule" /> {formatMinutes(banked)} focused
                    </>
                  )}
                </span>
                {runningOn(clocks, itemType, itemId) ? (
                  // Its clock runs: the plain button is this clock's Stop.
                  <TimerButton itemType={itemType} itemId={itemId} title={title} />
                ) : (
                  <TimerButton
                    focus
                    resume={isResume(banked)}
                    quiet={isQuiet(item.id, leadId)}
                    itemType={itemType}
                    itemId={itemId}
                    title={title}
                  />
                )}
              </div>
            )}
          </Card>
        )
      })}
    </>
  )
}
