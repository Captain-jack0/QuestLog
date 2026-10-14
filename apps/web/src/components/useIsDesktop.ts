import { useSyncExternalStore } from 'react'

/** Tailwind's `md` breakpoint — where the rail takes over from the tab bar. */
const QUERY = '(min-width: 768px)'

function subscribe(onChange: () => void) {
  const media = window.matchMedia(QUERY)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

/**
 * The shell mounts the rail or the tab bar, never both hidden by CSS: the rail carries the timer
 * deck, and two mounted decks would beat the timer heartbeat twice and ask the pomodoro question
 * twice. Mounting one also keeps the hidden layout's links out of the DOM, where a plain CSS
 * locator (e2e `a[href^="/projects/"]`) would still count them.
 */
export function useIsDesktop() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches)
}
