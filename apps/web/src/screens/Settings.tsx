import { useAuth } from '../auth/AuthProvider'
import { supabase } from '../lib/supabase'

export function SettingsScreen() {
  const { session } = useAuth()

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Settings</h1>
      <div className="space-y-3">
        <div className="rounded-card bg-surface p-4 shadow-sm">
          <div className="font-semibold">Profile</div>
          <div className="text-sm text-muted">{session?.user.email}</div>
          <button
            type="button"
            onClick={() => void supabase.auth.signOut()}
            className="mt-3 min-h-[44px] w-full rounded-xl border border-gray-200 py-2 font-semibold text-flame active:scale-[0.99]"
          >
            Sign out
          </button>
        </div>
        <div className="rounded-card bg-surface p-4 shadow-sm">
          <div className="font-semibold">Daily digest</div>
          <div className="text-sm text-muted">Email settings arrive with task NT-01</div>
        </div>
        <div className="rounded-card bg-surface p-4 shadow-sm">
          <div className="font-semibold">Push reminders</div>
          <div className="text-sm text-muted">Arrives with task NT-02</div>
        </div>
      </div>
    </div>
  )
}
