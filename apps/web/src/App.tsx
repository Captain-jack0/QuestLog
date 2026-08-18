import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { RequireAuth } from './auth/AuthProvider'
import { TabBar } from './components/TabBar'
import { LoginScreen } from './screens/Login'
import { TodayScreen } from './screens/Today'
import { AreasScreen } from './screens/Areas'
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
        <Route path="/progress" element={<ProgressScreen />} />
        <Route path="/settings" element={<SettingsScreen />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function AppShell() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      <main className="flex-1 px-4 pb-24 pt-6">
        <Outlet />
      </main>
      <TabBar />
    </div>
  )
}
