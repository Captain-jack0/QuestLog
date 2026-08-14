export function TodayScreen() {
  return (
    <div>
      <header className="mb-6">
        <p className="text-sm text-muted">Thursday</p>
        <h1 className="text-2xl font-bold">Welcome back, Captain</h1>
        <div className="mt-2 flex items-center gap-3 text-sm">
          <span className="rounded-full bg-flame/10 px-3 py-1 font-semibold text-flame">
            🔥 0-day streak
          </span>
          <span className="rounded-full bg-accent/10 px-3 py-1 font-semibold text-accent">
            ✨ 0 XP today
          </span>
        </div>
      </header>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
          Today's focus
        </h2>
        <div className="rounded-card border border-dashed border-gray-300 bg-surface p-5 text-center text-muted">
          Pick up to 3 things to focus on today
          <br />
          <span className="text-xs">(built in task FE-05)</span>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
          Hanging threads
        </h2>
        <div className="rounded-card bg-surface p-5 shadow-sm">
          <p className="font-medium">No threads yet 🎉</p>
          <p className="mt-1 text-sm text-muted">
            When you pause something, its "next step" will wait for you right here.
          </p>
        </div>
      </section>
    </div>
  )
}
