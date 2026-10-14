import { runningOn } from '../features/timer/stack'

/** `limit` is the hanging-threads query's row cap: at the cap the true count may be higher. */
export function waitingLine(count: number, limit: number): string {
  if (count === 0) return 'Nothing is waiting on you.'
  if (count === 1) return '1 thread is waiting.'
  return `${count >= limit ? `${limit}+` : count} threads are waiting.`
}

interface LeadRow {
  id: string
  completed: boolean
  project_id: string | null
  task_id: string | null
}

/** The focus row's clock, if one runs (a project row is the project, otherwise its task). */
function clockOn<T extends { project_id: string; task_id: string | null }>(
  clocks: readonly T[],
  row: LeadRow,
) {
  return row.project_id
    ? runningOn(clocks, 'project', row.project_id)
    : runningOn(clocks, 'task', row.task_id ?? '')
}

/**
 * The one focus card that gets the filled start: the first open one, and only while no card's
 * open card's clock runs — then the filled button is that clock's Stop, Today's single filled
 * action. A clock still running on a ticked-off card does not take the lead from the next open one.
 */
export function focusLeadId<T extends { project_id: string; task_id: string | null }>(
  items: readonly LeadRow[],
  clocks: readonly T[],
): string | undefined {
  if (items.some((row) => !row.completed && clockOn(clocks, row))) return undefined
  return items.find((row) => !row.completed)?.id
}

/** Banked seconds from which a focus card says "Resume" instead of "Start" (and shows the total). */
export const RESUME_AFTER_SECONDS = 60

export function isResume(bankedSeconds: number): boolean {
  return bankedSeconds >= RESUME_AFTER_SECONDS
}

/** Every focus card but the lead gets the ghost start, so Today keeps one filled action. */
export function isQuiet(itemId: string, leadId: string | undefined): boolean {
  return itemId !== leadId
}
