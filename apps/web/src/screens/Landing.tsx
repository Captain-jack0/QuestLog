import { Link } from 'react-router-dom'
import { HeroCube } from './landing/HeroCube'

/**
 * The page a visitor lands on. It has one job: say what this is for, in the words of the
 * person who needs it — someone who starts five things and loses four — and then get out of
 * the way with a single door in.
 */

const PROBLEMS = [
  {
    title: 'You started it. Where did it go?',
    body: 'Three tabs, two notebooks, one half-written message. The work exists; the thread to it does not.',
  },
  {
    title: 'Picking it back up costs more than doing it',
    body: 'Twenty minutes of "what was I even doing" before the first real minute of work.',
  },
  {
    title: 'Finishing nothing feels like doing nothing',
    body: 'Plenty happened today. None of it looks like progress from the outside — or the inside.',
  },
]

const ANSWERS = [
  {
    label: 'Resume context',
    title: 'Every thread remembers two things',
    body: 'Where you left off, and the next step. You write them once when you stop, and the thread waits for you exactly there — no re-reading, no re-deciding.',
  },
  {
    label: 'Today',
    title: 'Three things, not thirty',
    body: 'Pick up to three for today. Everything else stays visible but quiet, sorted by what has been waiting longest.',
  },
  {
    label: 'Timer',
    title: 'A clock that only runs on one thing',
    body: 'Start a timer or a 25-minute pomodoro on one task. The database itself refuses a second clock, so there is never a question of what you are working on.',
  },
  {
    label: 'XP, streaks, badges',
    title: 'Credit for keeping the thread, not just cutting it',
    body: 'Logging where you left off earns as much as finishing. The reward lands on the behaviour that actually keeps you moving.',
  },
]

export function LandingScreen() {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <span className="flex items-center gap-2 font-semibold">
          <span aria-hidden>🧭</span> QuestLog
        </span>
        <nav className="flex items-center gap-2">
          <Link
            to="/login"
            className="flex min-h-[40px] items-center rounded-xl px-4 text-sm font-semibold text-muted hover:text-ink"
          >
            Sign in
          </Link>
          <Link
            to="/login"
            state={{ mode: 'signup' }}
            className="flex min-h-[40px] items-center rounded-xl bg-accent px-4 text-sm font-semibold text-white"
          >
            Start free
          </Link>
        </nav>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-5 pb-20 pt-10 text-center md:pt-16">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">
            For minds that start a lot
          </p>
          <h1 className="mx-auto mt-4 max-w-3xl text-4xl font-bold leading-[1.1] md:text-6xl">
            Nothing you started
            <br />
            has to disappear
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-muted">
            QuestLog keeps the thread for every unfinished thing: where you left off, what comes
            next, and how long it has been waiting. Built for people who begin five things before
            lunch.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/login"
              state={{ mode: 'signup' }}
              className="flex min-h-[48px] items-center rounded-xl bg-accent px-6 font-semibold text-white"
            >
              Start your log
            </Link>
            <Link
              to="/login"
              className="flex min-h-[48px] items-center rounded-xl border border-line px-6 font-semibold"
            >
              Sign in
            </Link>
          </div>

          <div className="mt-14 md:mt-20">
            <HeroCube />
          </div>
        </section>

        <section className="border-y border-line bg-surface/40">
          <div className="mx-auto grid max-w-6xl gap-8 px-5 py-16 md:grid-cols-3">
            {PROBLEMS.map((item) => (
              <div key={item.title}>
                <h2 className="text-lg font-semibold leading-snug">{item.title}</h2>
                <p className="mt-2 text-muted">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-20">
          <h2 className="max-w-2xl text-3xl font-bold leading-tight md:text-4xl">
            The thread is the product
          </h2>
          <p className="mt-3 max-w-xl text-muted">
            Not another list of things you are failing to do. A place where stopping is part of the
            workflow.
          </p>

          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {ANSWERS.map((item) => (
              <article
                key={item.label}
                className="rounded-card border border-line bg-surface p-6 shadow-quest"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-accent">
                  {item.label}
                </p>
                <h3 className="mt-2 text-xl font-semibold leading-snug">{item.title}</h3>
                <p className="mt-2 leading-relaxed text-muted">{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-t border-line">
          <div className="mx-auto max-w-3xl px-5 py-20 text-center">
            <h2 className="text-3xl font-bold leading-tight md:text-4xl">
              Pick the thread back up
            </h2>
            <p className="mx-auto mt-3 max-w-md text-muted">
              Free, and yours to export at any time. Install it to your phone like an app.
            </p>
            <Link
              to="/login"
              state={{ mode: 'signup' }}
              className="mt-7 inline-flex min-h-[48px] items-center rounded-xl bg-accent px-6 font-semibold text-white"
            >
              Start your log
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-8 text-sm text-muted">
          <span>QuestLog 🧭 — never lose the thread again</span>
          <Link to="/login" className="font-semibold hover:text-ink">
            Sign in
          </Link>
        </div>
      </footer>
    </div>
  )
}
