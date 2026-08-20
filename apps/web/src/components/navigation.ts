/** One source of truth for the bottom bar (mobile) and the sidebar (desktop). */
export interface NavItem {
  to: string
  label: string
  icon: string
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Today', icon: '🏠' },
  { to: '/areas', label: 'Areas', icon: '🗂️' },
  { to: '/progress', label: 'Progress', icon: '📈' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
]
