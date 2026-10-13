import type { IconName } from './ui/Icon'

/** One source of truth for the bottom bar (mobile) and the sidebar (desktop). */
export interface NavItem {
  to: string
  label: string
  icon: IconName
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Today', icon: 'today' },
  { to: '/areas', label: 'Areas', icon: 'grid_view' },
  { to: '/progress', label: 'Progress', icon: 'trending_up' },
  { to: '/settings', label: 'Settings', icon: 'settings' },
]
