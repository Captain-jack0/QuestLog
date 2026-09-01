import { ITEM_STATUSES, type ItemStatus } from '../../lib/schemas'
import { SORT_KEYS, type SortKey } from './taskOrder'

export const TASK_VIEWS = ['card', 'row'] as const
export type TaskView = (typeof TASK_VIEWS)[number]

export type TaskListPrefs = {
  /** Independent filter chips; empty means "no status filter", not "nothing shown". */
  status: ItemStatus[]
  staleOnly: boolean
  highPriorityOnly: boolean
  quickOnly: boolean
  showCompleted: boolean
  sort: SortKey
  view: TaskView
}

export const DEFAULT_PREFS: TaskListPrefs = {
  status: [],
  staleOnly: false,
  highPriorityOnly: false,
  quickOnly: false,
  showCompleted: false,
  sort: 'created',
  view: 'card',
}

/**
 * The one definition of "no filters". Two places offer a way back — the bar's "Show all" and
 * the filtered empty state — and a field added here would otherwise have to be remembered in
 * both. `showCompleted`, `sort` and `view` are not filters and survive.
 */
export function clearedFilters(prefs: TaskListPrefs): TaskListPrefs {
  return { ...prefs, status: [], staleOnly: false, highPriorityOnly: false, quickOnly: false }
}

const STORAGE_KEY = 'questlog:tasks-view'

function isItemStatus(value: unknown): value is ItemStatus {
  return typeof value === 'string' && (ITEM_STATUSES as readonly string[]).includes(value)
}

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

/**
 * Field by field, no schema version: a field added later is missing from an old record and
 * takes its default, a field dropped later is ignored. A stale or hand-edited value can
 * never leave the list in a state the UI cannot render.
 */
export function parsePrefs(raw: unknown): TaskListPrefs {
  if (typeof raw !== 'object' || raw === null) return DEFAULT_PREFS
  const saved = raw as Record<string, unknown>

  return {
    status: Array.isArray(saved.status) ? saved.status.filter(isItemStatus) : DEFAULT_PREFS.status,
    staleOnly: bool(saved.staleOnly, DEFAULT_PREFS.staleOnly),
    highPriorityOnly: bool(saved.highPriorityOnly, DEFAULT_PREFS.highPriorityOnly),
    quickOnly: bool(saved.quickOnly, DEFAULT_PREFS.quickOnly),
    showCompleted: bool(saved.showCompleted, DEFAULT_PREFS.showCompleted),
    sort: pick(saved.sort, SORT_KEYS, DEFAULT_PREFS.sort),
    view: pick(saved.view, TASK_VIEWS, DEFAULT_PREFS.view),
  }
}

export function storedPrefs(): TaskListPrefs {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (!saved) return DEFAULT_PREFS
  try {
    return parsePrefs(JSON.parse(saved))
  } catch {
    // Not JSON at all — an unreadable preference is not worth an error, defaults are correct.
    return DEFAULT_PREFS
  }
}

export function savePrefs(prefs: TaskListPrefs): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
}
