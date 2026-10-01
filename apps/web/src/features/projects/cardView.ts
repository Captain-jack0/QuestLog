import type { ItemStatus } from '../../lib/schemas'
import type { ProjectStats } from './stats'

export interface ProjectCardView {
  /** The "Next: ..." line only makes sense for work still in flight. */
  showNext: boolean
  /** The task-progress block (bar + label) at all — false when there's nothing to show. */
  showStats: boolean
  /** The bar itself — only once there's at least one task to count. */
  showProgress: boolean
  barDone: number
  barTotal: number
  /** Visually fill the bar for a done project even if some tasks never got marked done
   *  (dropped, etc) — the real counts still drive aria via ProgressBar's own done/total. */
  barFull: boolean
  label: string | null
  tone: 'accent' | 'success'
}

/** Pure presentation rule for a project card, done vs active. No React, no I/O. */
export function projectCardView(
  status: ItemStatus,
  stat: ProjectStats | undefined,
): ProjectCardView {
  const isDone = status === 'done'
  const hasTasks = (stat?.tasksTotal ?? 0) > 0

  return {
    showNext: !isDone && Boolean(stat?.nextStep),
    showStats: isDone || hasTasks,
    showProgress: hasTasks,
    barDone: stat?.tasksDone ?? 0,
    barTotal: stat?.tasksTotal ?? 0,
    barFull: isDone,
    label: isDone
      ? 'Completed'
      : hasTasks
        ? `${stat!.tasksDone}/${stat!.tasksTotal} tasks done`
        : null,
    tone: isDone ? 'success' : 'accent',
  }
}
