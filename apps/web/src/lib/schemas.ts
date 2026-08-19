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
  priority: z.enum(['low', 'med', 'high']),
  status: z.enum(['idea', 'planned', 'in_progress', 'paused', 'blocked', 'done', 'dropped']),
  target_date: z.string().optional().or(z.literal('')),
})

export type ProjectInput = z.infer<typeof projectSchema>
