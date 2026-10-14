import { ThreadList } from '../features/threads/ThreadList'

/**
 * Every hanging thread on its own page. For now the same list Today shows; filters, search and
 * the settled count come with the full screen (PR-11).
 */
export function ThreadsScreen() {
  return (
    <div>
      <header className="mb-6">
        <h1 className="text-title-lg font-bold">Threads</h1>
        <p className="text-body text-muted">Oldest untouched first.</p>
      </header>
      <h2 className="sr-only">Hanging threads</h2>
      <ThreadList />
    </div>
  )
}
