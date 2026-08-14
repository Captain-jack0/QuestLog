export function SettingsScreen() {
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Settings</h1>
      <div className="space-y-3">
        <div className="rounded-card bg-surface p-4 shadow-sm">
          <div className="font-semibold">Profile</div>
          <div className="text-sm text-muted">Sign-in arrives with task INF-02</div>
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
