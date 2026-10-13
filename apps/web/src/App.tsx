import { useEffect, useState } from 'react'
import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { RequireAuth, useAuth } from './auth/AuthProvider'
import { TabBar } from './components/TabBar'
import { SideNav } from './components/SideNav'
import { TopBar } from './components/TopBar'
import { QuickAddSheet } from './components/QuickAddSheet'
import type { ShellContext } from './components/shellContext'
import { useIsDesktop } from './components/useIsDesktop'
import { TimerBar } from './features/timer/TimerBar'
import { useRunningTimer } from './features/timer/queries'
import { useRealtimeSync } from './features/realtime/useRealtimeSync'
import { LoginScreen } from './screens/Login'
import { LandingScreen } from './screens/Landing'
import { TodayScreen } from './screens/Today'
import { ThreadsScreen } from './screens/Threads'
import { AreasScreen } from './screens/Areas'
import { AreaDetailScreen } from './screens/AreaDetail'
import { ProjectDetailScreen } from './screens/ProjectDetail'
import { ProgressScreen } from './screens/Progress'
import { SettingsScreen } from './screens/Settings'

export default function App() {
  const { session, loading } = useAuth()

  return (
    <Routes>
      <Route path="/login" element={<LoginScreen />} />
      {/* The root is the landing page for visitors and Today for anyone signed in, so a
          bookmark keeps working and a stranger still gets an explanation. */}
      {!loading && !session && <Route path="/" element={<LandingScreen />} />}
      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route path="/" element={<TodayScreen />} />
        <Route path="/threads" element={<ThreadsScreen />} />
        <Route path="/areas" element={<AreasScreen />} />
        <Route path="/areas/:areaId" element={<AreaDetailScreen />} />
        <Route path="/projects/:projectId" element={<ProjectDetailScreen />} />
        <Route path="/progress" element={<ProgressScreen />} />
        <Route path="/settings" element={<SettingsScreen />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

/**
 * ⌘K / Ctrl+K opens Quick add from anywhere, a text field included. Not over another dialog
 * (two focus traps would fight), and with Quick add already open there is nothing to do.
 */
function useQuickAddShortcut(setOpen: (open: boolean) => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey || e.key.toLowerCase() !== 'k') return
      // Ours either way: the browser's own Ctrl+K jumps to its search bar.
      e.preventDefault()
      if (!document.querySelector('[role="dialog"]')) setOpen(true)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [setOpen])
}

/**
 * Phone: top bar, content, the timer deck over a five-tab bar. From md the tabs become a rail
 * with the deck at its foot, and the content gets the rest of the width instead of a
 * phone-sized column stranded in the middle. One layout is mounted at a time (useIsDesktop).
 */
function AppShell() {
  const [addOpen, setAddOpen] = useState(false)
  const desktop = useIsDesktop()
  const running = useRunningTimer()
  // RequireAuth renders the shell only with a session.
  useRealtimeSync(useAuth().session!.user.id)
  useQuickAddShortcut(setAddOpen)

  // On a phone the content has to clear the tab bar, and the deck too while a clock runs.
  const clearance = running.data?.length
    ? 'pb-[calc(10rem+env(safe-area-inset-bottom))]'
    : 'pb-[calc(6rem+env(safe-area-inset-bottom))]'

  return (
    <div className="flex min-h-dvh">
      {desktop && <SideNav />}

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar desktop={desktop} onQuickAdd={() => setAddOpen(true)} />
        <main
          className={`mx-auto w-full max-w-md flex-1 px-4 pt-4 md:max-w-5xl md:px-8 md:pb-10 md:pt-6 lg:max-w-6xl ${clearance}`}
        >
          <Outlet context={{ openQuickAdd: () => setAddOpen(true) } satisfies ShellContext} />
        </main>
      </div>

      {!desktop && <TimerBar />}
      {!desktop && <TabBar />}
      <QuickAddSheet open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  )
}
