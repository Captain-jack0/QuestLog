import { useOutletContext } from 'react-router-dom'

/** What AppShell hands the signed-in screens through `<Outlet context>`. */
export interface ShellContext {
  /** Opens the one Quick add sheet the shell owns (the top bar's "+" and ⌘K open the same). */
  openQuickAdd: () => void
}

/** Undefined outside AppShell, so a screen rendered on its own draws no dead control. */
export const useShell = () => useOutletContext<ShellContext | undefined>()
