import { onPageWake, type PageWakeTargets } from '../../lib/pageWake'

/** One clock the server closed on its own — the `auto_stopped` items of rpc_timer_heartbeat. */
export interface AutoStopped {
  id: string
  seconds: number
  xp_awarded: number
  discarded?: boolean
}

/** What the app says on return when clocks stopped without the user (issue #48). */
export function autoStoppedMessage(stopped: AutoStopped[]): string {
  const minutes = Math.round(
    stopped.reduce((sum, e) => sum + (e.discarded ? 0 : e.seconds), 0) / 60,
  )
  const xp = stopped.reduce((sum, e) => sum + e.xp_awarded, 0)
  const what = stopped.length === 1 ? 'Your timer' : `${stopped.length} timers`
  return `${what} stopped while you were away — ${minutes} min logged${xp > 0 ? ` · +${xp} ✨` : ''}`
}

/** A pomodoro whose beats stopped — a locked phone — waiting for "did it keep going?" (#48 D). */
export interface AwaitingPomodoro {
  id: string
  started_at: string
  last_seen_at: string
  project_title: string | null
  task_title: string | null
}

/** What one beat answers: clocks the server closed, and pomodoros it is waiting to ask about. */
export interface Beat {
  auto_stopped: AutoStopped[]
  needs_confirm: AwaitingPomodoro[]
}

/** rpc_resolve_pomodoro's answer: a stop result for "no", `continued` for "yes". */
export interface ResolveResult {
  id: string
  resolved: boolean
  continued?: boolean
  stopped?: boolean
  seconds?: number
  xp_awarded?: number
  discarded?: boolean
  daily_cap_reached?: boolean
}

/**
 * Sends the user's answer for one pomodoro: yes keeps it running from now, no ends it at its
 * last beat. `call` is the RPC, injected so the arguments can be checked without a server.
 */
export async function resolvePomodoro(
  call: (args: { p_entry_id: string; p_continued: boolean }) => PromiseLike<{
    data: unknown
    error: unknown
  }>,
  entryId: string,
  continued: boolean,
): Promise<ResolveResult> {
  const { data, error } = await call({ p_entry_id: entryId, p_continued: continued })
  if (error) throw error
  return data as ResolveResult
}

export const HEARTBEAT_MS = 60_000

interface HeartbeatOptions {
  /** One beat; resolves to what the server closed since the last one and what it asks about,
   *  or null when the beat was lost — which then reports nothing. */
  beat: () => Promise<Beat | null>
  onAutoStopped: (stopped: AutoStopped[]) => void
  /** The server's whole current list, on every beat that landed — empty included, so a question
   *  answered in another tab closes here too. Replace, do not append. */
  onNeedsConfirm: (awaiting: AwaitingPomodoro[]) => void
  running: boolean
  targets?: PageWakeTargets
  isVisible?: () => boolean
}

/**
 * Beats once now — whatever expired while the app was away, or the clock that just started — and,
 * while clocks run, every minute and on every return to the page. Returns the cleanup.
 */
export function runHeartbeat({
  beat,
  onAutoStopped,
  onNeedsConfirm,
  running,
  targets,
  isVisible = () => document.visibilityState === 'visible',
}: HeartbeatOptions): () => void {
  const go = () =>
    void beat().then((result) => {
      if (!result) return
      if (result.auto_stopped.length > 0) onAutoStopped(result.auto_stopped)
      onNeedsConfirm(result.needs_confirm)
    })
  go()
  if (!running) return () => {}
  const id = setInterval(go, HEARTBEAT_MS)
  const off = onPageWake(() => {
    if (isVisible()) go()
  }, targets)
  return () => {
    clearInterval(id)
    off()
  }
}

/**
 * Stops the clocks, then signs out whatever the stop does. A failing or hanging stop gets
 * `timeoutMs` and no more: sign-out must go through, and the server ends an unbeaten clock itself.
 */
export async function stopThenSignOut(
  stopAll: () => Promise<unknown>,
  signOut: () => Promise<unknown>,
  timeoutMs = 3000,
) {
  await Promise.race([
    stopAll().catch(() => {}),
    new Promise((resolve) => setTimeout(resolve, timeoutMs)),
  ])
  await signOut()
}
