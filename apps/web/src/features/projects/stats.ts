export interface ProjectStats {
  tasksDone: number
  tasksTotal: number
  nextStep: string | null
}

/** Pure part of useProjectStats: logs must arrive newest first. */
export function aggregateProjectStats(
  projectIds: string[],
  tasks: { project_id: string; status: string }[],
  logs: { project_id: string; next_step: string | null }[],
): Record<string, ProjectStats> {
  const stats: Record<string, ProjectStats> = {}
  for (const id of projectIds) stats[id] = { tasksDone: 0, tasksTotal: 0, nextStep: null }

  for (const task of tasks) {
    const entry = stats[task.project_id]
    if (!entry) continue
    entry.tasksTotal += 1
    if (task.status === 'done') entry.tasksDone += 1
  }
  for (const log of logs) {
    const entry = stats[log.project_id]
    if (entry && entry.nextStep === null) entry.nextStep = log.next_step
  }
  return stats
}
