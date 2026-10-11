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

export const HEARTBEAT_MS = 60_000

interface HeartbeatOptions {
  /** One beat; resolves to what the server closed since the last one. */
  beat: () => Promise<AutoStopped[]>
  onAutoStopped: (stopped: AutoStopped[]) => void
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
  running,
  targets,
  isVisible = () => document.visibilityState === 'visible',
}: HeartbeatOptions): () => void {
  const go = () =>
    void beat().then((stopped) => {
      if (stopped.length > 0) onAutoStopped(stopped)
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
