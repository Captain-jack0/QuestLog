import { NavLink } from 'react-router-dom'
import { useState } from 'react'
import { QuickAddSheet } from './QuickAddSheet'

const tabs = [
  { to: '/', label: 'Today', icon: '🏠' },
  { to: '/areas', label: 'Areas', icon: '🗂️' },
  { to: '/progress', label: 'Progress', icon: '📈' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
]

export function TabBar() {
  const [addOpen, setAddOpen] = useState(false)

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-gray-100 bg-surface pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-md items-center justify-around px-2 py-1">
          {tabs.slice(0, 2).map((t) => (
            <Tab key={t.to} {...t} />
          ))}
          <button
            aria-label="Quick add"
            onClick={() => setAddOpen(true)}
            className="flex h-12 w-12 -translate-y-3 items-center justify-center rounded-full bg-accent text-2xl text-white shadow-lg active:scale-95"
          >
            +
          </button>
          {tabs.slice(2).map((t) => (
            <Tab key={t.to} {...t} />
          ))}
        </div>
      </nav>
      <QuickAddSheet open={addOpen} onClose={() => setAddOpen(false)} />
    </>
  )
}

function Tab({ to, label, icon }: { to: string; label: string; icon: string }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `flex min-h-[44px] min-w-[64px] flex-col items-center justify-center rounded-xl py-1 text-[11px] ${
          isActive ? 'font-semibold text-accent' : 'text-muted'
        }`
      }
    >
      <span className="text-lg leading-none">{icon}</span>
      <span className="mt-0.5">{label}</span>
    </NavLink>
  )
}
