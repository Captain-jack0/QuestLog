import { NavLink } from 'react-router-dom'
import { NAV_ITEMS, type NavItem } from './navigation'
import { Icon } from './ui/Icon'

/**
 * Mobile navigation: the rail's five, nothing else. Quick add lives in the top bar now (CEO,
 * 2026-10-13), so every slot is a place, not an action.
 */
export function TabBar() {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto grid max-w-md grid-cols-5 px-1 py-1">
        {NAV_ITEMS.map((item) => (
          <li key={item.to}>
            <Tab {...item} />
          </li>
        ))}
      </ul>
    </nav>
  )
}

/** Active is a filled pill behind the icon and bolder ink, not colour alone. */
function Tab({ to, label, icon }: NavItem) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-xl text-micro ${
          isActive ? 'text-accent-ink' : 'font-normal text-muted'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={`flex h-7 w-12 items-center justify-center rounded-full ${
              isActive ? 'bg-accent/15' : ''
            }`}
          >
            <Icon name={icon} className="icon-xl" />
          </span>
          {label}
        </>
      )}
    </NavLink>
  )
}
