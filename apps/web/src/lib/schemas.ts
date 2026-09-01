import { z } from 'zod'
import type { Database } from './database.types'

type Tables = Database['public']['Tables']

export type LifeArea = Tables['life_areas']['Row']
export type Project = Tables['projects']['Row']
export type Task = Tables['tasks']['Row']
export type ProgressLog = Tables['progress_logs']['Row']

export type ItemStatus = Database['public']['Enums']['item_status']
export type Priority = Database['public']['Enums']['priority']
export type Difficulty = Database['public']['Enums']['difficulty']

/** Pastel edges only — the UI stays quiet (docs/02 §3). */
export const AREA_COLORS = [
  '#A5B4FC',
  '#BFDBFE',
  '#A7F3D0',
  '#FDE68A',
  '#FBCFE8',
  '#DDD6FE',
  '#FED7AA',
  '#C7D2DE',
] as const

export const AREA_ICONS = ['🧭', '💼', '🏠', '📚', '🎯', '🌱', '💪', '🎨', '🧪', '💰'] as const

export const ITEM_STATUSES: ItemStatus[] = [
  'idea',
  'planned',
  'in_progress',
  'paused',
  'blocked',
  'done',
  'dropped',
]

/** Statuses that still want your attention. */
export const OPEN_STATUSES: ItemStatus[] = ['idea', 'planned', 'in_progress', 'paused', 'blocked']

/**
 * Never add a value here without touching rpc_update_status first: its XP case
 * (20260818120300_rpc_update_status.sql:126) ends in `else 50`, so an unhandled
 * difficulty silently pays out the top award.
 */
export const DIFFICULTIES = ['S', 'M', 'L'] as const satisfies readonly Difficulty[]

/** The bare enum letter means nothing on screen; the label names the size the XP tier buys. */
export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  S: 'S · Quick',
  M: 'M · A session',
  L: 'L · Deep work',
}

export const PRIORITIES = ['low', 'med', 'high'] as const satisfies readonly Priority[]

/** 'med' is not a word anyone says out loud. */
export const PRIORITY_LABELS: Record<Priority, string> = {
  low: 'Low',
  med: 'Medium',
  high: 'High',
}

export const areaSchema = z.object({
  name: z.string().trim().min(1, 'Give the area a name').max(60, 'Keep it under 60 characters'),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Pick a colour'),
  icon: z.string().min(1, 'Pick an icon'),
  sort_order: z.number().int().min(0),
})

export type AreaInput = z.infer<typeof areaSchema>

export const projectSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Give the project a title')
    .max(120, 'Keep it under 120 characters'),
  description: z.string().trim().max(2000).optional().or(z.literal('')),
  priority: z.enum(PRIORITIES),
  status: z.enum(['idea', 'planned', 'in_progress', 'paused', 'blocked', 'done', 'dropped']),
  target_date: z.string().optional().or(z.literal('')),
})

export type ProjectInput = z.infer<typeof projectSchema>

export const taskSchema = z.object({
  title: z.string().trim().min(1, 'Give the task a title').max(120, 'Keep it under 120 characters'),
  description: z.string().trim().max(2000).optional().or(z.literal('')),
  difficulty: z.enum(DIFFICULTIES),
  priority: z.enum(PRIORITIES),
})

export type TaskInput = z.infer<typeof taskSchema>

export const profileSchema = z.object({
  display_name: z.string().trim().min(1, 'What should QuestLog call you?').max(60),
  timezone: z.string().min(1, 'Pick a timezone'),
  digest_enabled: z.boolean(),
  digest_time: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM'),
  push_enabled: z.boolean(),
  stale_days: z.number().int().min(7, 'At least 7 days').max(30, 'At most 30 days'),
})

export type ProfileInput = z.infer<typeof profileSchema>
