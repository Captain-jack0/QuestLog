import { NavLink } from 'react-router-dom'
import { NAV_ITEMS } from './navigation'
import { Button } from './ui/Button'

/** Desktop navigation: a fixed rail so the content never has to hunt for the tab bar. */
export function SideNav({ onQuickAdd }: { onQuickAdd: () => void }) {
  return (
    <nav
      aria-label="Main"
      className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col gap-1 border-r border-line bg-surface px-3 py-6 md:flex lg:w-64"
    >
      <p className="mb-4 px-3 text-lg font-bold">QuestLog 🧭</p>

      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) =>
            `flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-sm ${
              isActive ? 'bg-accent/10 font-semibold text-accent' : 'text-ink hover:bg-paper'
            }`
          }
        >
          <span className="text-lg leading-none">{item.icon}</span>
          {item.label}
        </NavLink>
      ))}

      <Button block className="mt-4" onClick={onQuickAdd}>
        + Quick add
      </Button>
    </nav>
  )
}
