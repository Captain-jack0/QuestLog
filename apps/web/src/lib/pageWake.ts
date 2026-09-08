/** The two event targets `onPageWake` listens on, injectable so it can be tested. */
export interface PageWakeTargets {
  doc: EventTarget
  win: EventTarget
}

/**
 * Calls `onWake` when the page changes visibility or is restored from the back/forward
 * cache.
 *
 * Backgrounded tabs get their timers throttled — Chrome drops a `setInterval` to roughly
 * once a minute, iOS suspends the page outright — so anything that ticks shows a stale
 * value for as long as it takes the next tick to arrive after the user comes back. Work
 * derived from a timestamp is correct again the moment it recomputes; this is the signal
 * to recompute.
 *
 * `visibilitychange` also fires when the page *hides*, and `pageshow` fires on the first
 * load as well, so the callback must be idempotent — recompute, do not increment.
 *
 * Returns the unsubscribe function.
 */
export function onPageWake(
  onWake: () => void,
  targets: PageWakeTargets = { doc: document, win: window },
): () => void {
  const wake = () => onWake()
  targets.doc.addEventListener('visibilitychange', wake)
  targets.win.addEventListener('pageshow', wake)

  return () => {
    targets.doc.removeEventListener('visibilitychange', wake)
    targets.win.removeEventListener('pageshow', wake)
  }
}
