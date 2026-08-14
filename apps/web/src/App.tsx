import { Routes, Route, Navigate } from 'react-router-dom'
import { TabBar } from './components/TabBar'
import { TodayScreen } from './screens/Today'
import { AreasScreen } from './screens/Areas'
import { ProgressScreen } from './screens/Progress'
import { SettingsScreen } from './screens/Settings'

export default function App() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      <main className="flex-1 px-4 pb-24 pt-6">
        <Routes>
          <Route path="/" element={<TodayScreen />} />
          <Route path="/areas" element={<AreasScreen />} />
          <Route path="/progress" element={<ProgressScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <TabBar />
    </div>
  )
}
