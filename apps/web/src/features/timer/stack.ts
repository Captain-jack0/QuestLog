/**
 * Pure part of the parallel timers (issue #45): which clock sits on top of TimerBar's deck and
 * when the start buttons give up. Imports nothing, for the reason given in totals.ts.
 */

/** The same ceiling rpc_start_timer enforces (20261008120000_parallel_timers.sql). */
export const MAX_RUNNING_TIMERS = 3

/** Word for word the server's refusal, so the button and the toast say the same thing. */
export const TIMER_LIMIT_REASON = 'Up to 3 timers can run at once — stop one first'

export function atTimerLimit(running: readonly unknown[]): boolean {
  return running.length >= MAX_RUNNING_TIMERS
}

/**
 * The deck, newest clock first — the card shown whole while the deck is closed — and how many
 * sit under it, for the "+N" badge. Sorted here rather than trusted from the view, which has no
 * order of its own.
 */
export function timerDeck<T extends { started_at: string }>(
  timers: readonly T[],
): { cards: T[]; hidden: number } {
  const cards = [...timers].sort((a, b) => Date.parse(b.started_at) - Date.parse(a.started_at))
  return { cards, hidden: Math.max(cards.length - 1, 0) }
}
