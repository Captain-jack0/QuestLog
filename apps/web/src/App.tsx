import { useState } from 'react'
import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { RequireAuth } from './auth/AuthProvider'
import { TabBar } from './components/TabBar'
import { SideNav } from './components/SideNav'
import { QuickAddSheet } from './components/QuickAddSheet'
import { TimerBar } from './features/timer/TimerBar'
import { LoginScreen } from './screens/Login'
import { TodayScreen } from './screens/Today'
import { AreasScreen } from './screens/Areas'
import { AreaDetailScreen } from './screens/AreaDetail'
import { ProjectDetailScreen } from './screens/ProjectDetail'
import { ProgressScreen } from './screens/Progress'
import { SettingsScreen } from './screens/Settings'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginScreen />} />
      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route path="/" element={<TodayScreen />} />
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
 * Mobile keeps the bottom tab bar; from md the navigation moves to a rail and the content
 * gets the rest of the width instead of a phone-sized column stranded in the middle.
 */
function AppShell() {
  const [addOpen, setAddOpen] = useState(false)

  return (
    <div className="flex min-h-dvh">
      <SideNav onQuickAdd={() => setAddOpen(true)} />

      <main className="mx-auto w-full max-w-md flex-1 px-4 pb-24 pt-6 md:max-w-5xl md:px-8 md:pb-10 lg:max-w-6xl">
        <Outlet />
      </main>

      <TimerBar />
      <TabBar onQuickAdd={() => setAddOpen(true)} />
      <QuickAddSheet open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  )
}
