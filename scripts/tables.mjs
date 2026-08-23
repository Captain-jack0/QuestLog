/**
 * Every table a backup carries, parents first so a restore can replay them in order
 * without tripping over foreign keys.
 */
export const TABLES = [
  'profiles',
  'life_areas',
  'projects',
  'tasks',
  'progress_logs',
  'focus_items',
  'xp_events',
  'streaks',
  'badges',
  'user_badges',
  'time_entries',
  'push_subscriptions',
]
