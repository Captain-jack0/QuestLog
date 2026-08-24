import { Link } from 'react-router-dom'
import { Logo, LogoMark } from '../components/Logo'
import { BrainScene } from './landing/BrainScene'
import { AppPreview } from './landing/AppPreview'

/**
 * The page a visitor lands on. It names the problem in the words of the person who has it —
 * someone who starts five things and loses four — shows the product working, and offers one
 * door in.
 */

const PROBLEMS = [
  {
    icon: 'pi-search',
    title: 'You started it. Where did it go?',
    body: 'Three tabs, two notebooks, one half-written message. The work exists; the thread back to it does not.',
  },
  {
    icon: 'pi-clock',
    title: 'Restarting costs more than the work',
    body: 'Twenty minutes of "what was I even doing" before the first real minute of doing it.',
  },
  {
    icon: 'pi-chart-bar',
    title: 'Finishing nothing feels like doing nothing',
    body: 'Plenty happened today. None of it looks like progress — not from outside, and not from inside either.',
  },
]

const FEATURES = [
  {
    icon: 'pi-bookmark',
    label: 'Resume context',
    title: 'Every thread remembers two things',
    body: 'Where you left off, and the next step. Written once when you stop, waiting exactly there when you come back. No re-reading, no re-deciding.',
  },
  {
    icon: 'pi-flag',
    label: 'Today',
    title: 'Three things, not thirty',
    body: 'Pick up to three for today. Everything else stays visible but quiet, sorted by whatever has been waiting longest.',
  },
  {
    icon: 'pi-stopwatch',
    label: 'Timer & pomodoro',
    title: 'A clock that runs on one thing',
    body: 'Start a timer or a 25-minute pomodoro on a single task. The database itself refuses a second clock, so there is never a question of what you are on.',
  },
  {
    icon: 'pi-star',
    label: 'XP, streaks, badges',
    title: 'Credit for keeping the thread',
    body: 'Logging where you left off earns as much as finishing. The reward lands on the behaviour that actually keeps you moving.',
  },
  {
    icon: 'pi-bell',
    label: 'Digest & nudges',
    title: 'A morning email, not a wall of red',
    body: 'What is waiting, with its next step, once a day. An evening nudge only if the day went by without a single check-in.',
  },
  {
    icon: 'pi-lock',
    label: 'Yours',
    title: 'Export everything, any time',
    body: 'One button gives you every row as JSON. Row-level security means nobody sees your log but you — not even by accident.',
  },
]

const STEPS = [
  {
    icon: 'pi-plus',
    title: 'Drop it in',
    body: 'One field, ten seconds, from any screen. It lands in an area you already have.',
  },
  {
    icon: 'pi-pause',
    title: 'Stop out loud',
    body: 'When you put something down, say where you left off and what comes next. That is the whole discipline.',
  },
  {
    icon: 'pi-replay',
    title: 'Pick it back up',
    body: 'Today shows the oldest waiting threads with their next step. You start working, not remembering.',
  },
]

export function LandingScreen() {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-line bg-paper/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
          <Logo />
          <nav className="flex items-center gap-1">
            <a
              href="#how"
              className="link-quiet hidden min-h-[40px] items-center rounded-xl px-3 text-sm text-muted sm:flex"
            >
              How it works
            </a>
            <a
              href="#features"
              className="link-quiet hidden min-h-[40px] items-center rounded-xl px-3 text-sm text-muted sm:flex"
            >
              Features
            </a>
            <Link
              to="/login"
              className="link-quiet flex min-h-[40px] items-center rounded-xl px-3 text-sm font-semibold text-muted"
            >
              Sign in
            </Link>
            <Link
              to="/login"
              state={{ mode: 'signup' }}
              className="btn-primary flex min-h-[40px] items-center rounded-xl bg-accent px-4 text-sm font-semibold text-white transition"
            >
              Start free
            </Link>
          </nav>
        </div>
      </header>

      <main>
        {/* hero */}
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-16 lg:grid-cols-[1.05fr_1fr] lg:py-24">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-line px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-muted">
              <i className="pi pi-sparkles text-[10px] text-accent" aria-hidden />
              Built for minds that start a lot
            </p>
            <h1 className="mt-5 font-display text-5xl leading-[1.05] md:text-7xl">
              Nothing you started
              <br />
              has to disappear
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">
              QuestLog keeps the thread for every unfinished thing — where you left off, what comes
              next, and how long it has been waiting. So starting five things does not mean losing
              four.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/login"
                state={{ mode: 'signup' }}
                className="btn-primary flex min-h-[48px] items-center gap-2 rounded-xl bg-accent px-6 font-semibold text-white transition"
              >
                Start your log
                <i className="pi pi-arrow-right text-xs" aria-hidden />
              </Link>
              <Link
                to="/login"
                className="btn-quiet flex min-h-[48px] items-center rounded-xl border border-line px-6 font-semibold transition"
              >
                Sign in
              </Link>
            </div>
            <p className="mt-4 text-sm text-muted">Free · works offline · installs to your phone</p>
          </div>

          <BrainScene />
        </section>

        {/* the product, working */}
        <section className="border-y border-line bg-surface/30">
          <div className="mx-auto max-w-6xl px-5 py-16 lg:py-20">
            <div className="mb-8 max-w-2xl">
              <h2 className="font-display text-3xl leading-tight md:text-5xl">
                This is what you sign in to
              </h2>
              <p className="mt-3 text-muted">
                Have a poke around — the tabs work and the focus items tick off.
              </p>
            </div>
            <AppPreview />
          </div>
        </section>

        {/* the problem */}
        <section className="mx-auto max-w-6xl px-5 py-16 lg:py-24">
          <h2 className="max-w-2xl font-display text-3xl leading-tight md:text-5xl">
            The problem was never motivation
          </h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {PROBLEMS.map((item) => (
              <div key={item.title} className="border-t border-line pt-5">
                <i className={`pi ${item.icon} text-accent`} aria-hidden />
                <h3 className="mt-3 text-lg font-semibold leading-snug">{item.title}</h3>
                <p className="mt-2 leading-relaxed text-muted">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* how it works */}
        <section id="how" className="border-y border-line bg-surface/30 scroll-mt-20">
          <div className="mx-auto max-w-6xl px-5 py-16 lg:py-24">
            <h2 className="font-display text-3xl leading-tight md:text-5xl">Three moves</h2>
            <p className="mt-3 max-w-xl text-muted">
              No system to learn, no weekly review to fall behind on.
            </p>
            <ol className="mt-10 grid gap-6 md:grid-cols-3">
              {STEPS.map((step, i) => (
                <li key={step.title} className="rounded-card border border-line bg-surface p-6">
                  <span className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/15 font-semibold text-accent">
                      {i + 1}
                    </span>
                    <i className={`pi ${step.icon} text-muted`} aria-hidden />
                  </span>
                  <h3 className="mt-4 text-lg font-semibold">{step.title}</h3>
                  <p className="mt-2 leading-relaxed text-muted">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* features */}
        <section id="features" className="mx-auto max-w-6xl px-5 py-16 scroll-mt-20 lg:py-24">
          <h2 className="max-w-2xl font-display text-3xl leading-tight md:text-5xl">
            The thread is the product
          </h2>
          <p className="mt-3 max-w-xl text-muted">
            Not another list of things you are failing to do. A place where stopping is part of the
            workflow.
          </p>
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((item) => (
              <article
                key={item.label}
                className="card-hover rounded-card border border-line bg-surface p-6"
              >
                <i className={`pi ${item.icon} text-accent`} aria-hidden />
                <p className="mt-3 text-xs font-semibold uppercase tracking-[0.15em] text-muted">
                  {item.label}
                </p>
                <h3 className="mt-1 text-lg font-semibold leading-snug">{item.title}</h3>
                <p className="mt-2 leading-relaxed text-muted">{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* closing */}
        <section className="border-t border-line bg-surface/30">
          <div className="mx-auto max-w-3xl px-5 py-20 text-center lg:py-28">
            <LogoMark className="mx-auto h-10 w-10" />
            <h2 className="mt-6 font-display text-4xl leading-tight md:text-6xl">
              Pick the thread back up
            </h2>
            <p className="mx-auto mt-4 max-w-md text-muted">
              Free, yours to export at any time, and it installs to your phone like an app.
            </p>
            <Link
              to="/login"
              state={{ mode: 'signup' }}
              className="btn-primary mt-8 inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-accent px-6 font-semibold text-white transition"
            >
              Start your log
              <i className="pi pi-arrow-right text-xs" aria-hidden />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Logo />
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted">
              A log for people who start more than they finish. Every thread keeps its own answer to
              “where was I?”
            </p>
          </div>

          <div>
            <p className="text-sm font-semibold">Product</p>
            <ul className="mt-3 space-y-2 text-sm text-muted">
              <li>
                <a href="#how" className="hover:text-ink">
                  How it works
                </a>
              </li>
              <li>
                <a href="#features" className="hover:text-ink">
                  Features
                </a>
              </li>
              <li>
                <Link to="/login" state={{ mode: 'signup' }} className="hover:text-ink">
                  Start free
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-sm font-semibold">Your data</p>
            <ul className="mt-3 space-y-2 text-sm text-muted">
              <li>Export as JSON, any time</li>
              <li>Row-level security per account</li>
              <li>Nightly off-site backups</li>
            </ul>
          </div>

          <div>
            <p className="text-sm font-semibold">Elsewhere</p>
            <ul className="mt-3 space-y-2 text-sm text-muted">
              <li>
                <a
                  href="https://github.com/Captain-jack0/QuestLog"
                  className="inline-flex items-center gap-2 hover:text-ink"
                >
                  <i className="pi pi-github text-xs" aria-hidden />
                  Source on GitHub
                </a>
              </li>
              <li>
                <a
                  href="mailto:hello@captainmery.com"
                  className="inline-flex items-center gap-2 hover:text-ink"
                >
                  <i className="pi pi-envelope text-xs" aria-hidden />
                  hello@captainmery.com
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-line">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-6 text-sm text-muted">
            <span>© {new Date().getFullYear()} QuestLog</span>
            <Link to="/login" className="font-semibold hover:text-ink">
              Sign in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
