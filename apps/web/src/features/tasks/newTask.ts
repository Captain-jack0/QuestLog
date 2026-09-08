import { normalizeDescription } from '../../lib/description'
import type { Difficulty, Priority } from '../../lib/schemas'

export interface NewTask {
  projectId: string
  userId: string
  title: string
  description?: string
  difficulty: Difficulty
  priority?: Priority
  sortOrder: number
}

/**
 * The row an add produces, built once and used twice: the insert sends it, and the optimistic
 * placeholder is assembled on top of it. Two hand-written copies would be two chances to drift,
 * and a placeholder that disagrees with the insert flickers on refetch — which is exactly what
 * a dropped `description` looked like before this existed.
 *
 * It lives outside `queries.ts` because that module builds a Supabase client at import time, so
 * a test importing this from there would try to stand one up.
 * See `.context/lessons/yerel-yesil-ci-yesili-degil-2026-09-03.md`.
 */
export function newTaskRow(input: NewTask) {
  return {
    project_id: input.projectId,
    user_id: input.userId,
    title: input.title,
    description: normalizeDescription(input.description),
    difficulty: input.difficulty,
    // Defaulted here rather than left to the column default: the optimistic row has to show the
    // value the insert will store, and the column's is invisible from this side.
    priority: input.priority ?? 'med',
    sort_order: input.sortOrder,
  }
}
