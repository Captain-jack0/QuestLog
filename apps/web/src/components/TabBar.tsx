import { NavLink } from 'react-router-dom'
import { NAV_ITEMS } from './navigation'

/** Mobile navigation. Hidden from md up, where SideNav takes over. */
export function TabBar({ onQuickAdd }: { onQuickAdd: () => void }) {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <div className="mx-auto flex max-w-md items-center justify-around px-2 py-1">
        {NAV_ITEMS.slice(0, 2).map((item) => (
          <Tab key={item.to} {...item} />
        ))}
        <button
          type="button"
          aria-label="Quick add"
          onClick={onQuickAdd}
          className="btn-primary flex h-12 w-12 -translate-y-3 items-center justify-center rounded-full border-2 border-accent text-2xl text-accent shadow-lg active:scale-95"
        >
          +
        </button>
        {NAV_ITEMS.slice(2).map((item) => (
          <Tab key={item.to} {...item} />
        ))}
      </div>
    </nav>
  )
}

function Tab({ to, label, icon }: { to: string; label: string; icon: string }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `flex min-h-[44px] min-w-[64px] flex-col items-center justify-center rounded-xl py-1 text-2xs ${
          isActive ? 'font-semibold text-accent' : 'text-muted'
        }`
      }
    >
      <span className="text-lg leading-none">{icon}</span>
      <span className="mt-0.5">{label}</span>
    </NavLink>
  )
}
