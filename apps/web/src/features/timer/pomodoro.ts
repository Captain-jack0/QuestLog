export const FOCUS_SECONDS = 25 * 60
export const BREAK_SECONDS = 5 * 60

export interface PomodoroPhase {
  /** 'focus' while the 25 minutes run, 'break' for the 5 that follow. */
  phase: 'focus' | 'break'
  /** Seconds left in the current phase. */
  remaining: number
  /** How many focus blocks are already behind you in this run. */
  completed: number
}

/**
 * Where a pomodoro run stands after `elapsed` seconds — derived, never ticked, so a
 * backgrounded tab or a reload cannot drift.
 */
export function pomodoroPhase(elapsed: number): PomodoroPhase {
  const cycle = FOCUS_SECONDS + BREAK_SECONDS
  const seconds = Math.max(elapsed, 0)
  const intoCycle = seconds % cycle
  const completed = Math.floor(seconds / cycle)

  return intoCycle < FOCUS_SECONDS
    ? { phase: 'focus', remaining: FOCUS_SECONDS - intoCycle, completed }
    : { phase: 'break', remaining: cycle - intoCycle, completed: completed + 1 }
}

/** mm:ss for anything under an hour, h:mm:ss beyond it. */
export function formatDuration(seconds: number): string {
  const total = Math.max(Math.floor(seconds), 0)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = total % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${pad(minutes)}:${pad(secs)}`
}

/** "1h 40m" for summaries where seconds are noise. */
export function formatMinutes(seconds: number): string {
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${minutes % 60}m`
}
