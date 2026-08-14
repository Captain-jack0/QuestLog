const placeholderAreas = [
  { name: 'Work', icon: '💼', color: '#A5B4FC' },
  { name: 'Home', icon: '🏡', color: '#FBCFE8' },
  { name: 'Projects', icon: '🛠️', color: '#BBF7D0' },
  { name: 'Learning', icon: '📚', color: '#FDE68A' },
  { name: 'Career', icon: '🧭', color: '#BAE6FD' },
]

export function AreasScreen() {
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Life Areas</h1>
      <div className="grid grid-cols-2 gap-3">
        {placeholderAreas.map((a) => (
          <div
            key={a.name}
            className="rounded-card border-l-4 bg-surface p-4 shadow-sm"
            style={{ borderLeftColor: a.color }}
          >
            <div className="text-2xl">{a.icon}</div>
            <div className="mt-1 font-semibold">{a.name}</div>
            <div className="text-xs text-muted">0 open · Lv 1</div>
          </div>
        ))}
        <button className="rounded-card border border-dashed border-gray-300 p-4 text-muted">
          + New area
        </button>
      </div>
      <p className="mt-4 text-center text-xs text-muted">Real CRUD arrives in task FE-02</p>
    </div>
  )
}
