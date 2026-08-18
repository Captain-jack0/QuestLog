# QuestLog 🧭

A gamified personal life & work tracker — never lose the thread again.

Every project and task always carries two pieces of context: **where I left off** and
**what's the next step**. Daily check-ins earn XP, levels and streaks.

Full documentation lives in [`docs/`](docs/):

- `01-business-analysis.md` — what we're building and why
- `02-design-architecture.md` — screens, visual design, data model, stack
- `03-task-sheet.md` — the build plan, task by task, **with Claude Code prompts**

## Stack

React 18 + Vite + TypeScript + Tailwind · TanStack Query · React Router ·
Supabase (Postgres, Auth, RLS, Edge Functions) · Resend · Vercel

## Getting started

```bash
npm install          # installs the workspace (apps/web)
cp .env.example .env.local   # then fill it in — see below
npm run dev          # → http://localhost:5173
```

Supabase credentials are required: the app throws on boot without them, and every
route except `/login` is behind an auth guard.

### Option A — local Supabase (needs Docker Desktop running)

```bash
npx supabase start   # first run pulls the containers; prints API URL + anon key
npx supabase stop
```

Copy the printed `API URL` → `VITE_SUPABASE_URL` and `anon key` → `VITE_SUPABASE_ANON_KEY`
into `.env.local`. Local mail (magic links, signup confirmations) is caught by Mailpit at
the `MAILPIT_URL` from the same output — nothing is sent to real inboxes.

### Option B — Supabase cloud

1. Create a free project at [supabase.com](https://supabase.com)
2. Project Settings → API → copy the **Project URL** and **anon public** key into `.env.local`
3. Authentication → URL Configuration → add `http://localhost:5173` as a redirect URL,
   so magic links and signup confirmations come back to the dev server

### Auth

`/login` supports email + password sign-in, signup, and magic link. Sessions persist in
localStorage and refresh automatically; sign out lives on the Settings tab.

## Repo layout

```
apps/web/        React app (Vite)
  src/screens/   Login · Today · Areas · Progress · Settings
  src/components/ Shared UI (TabBar, QuickAddSheet, ...)
  src/auth/      AuthProvider · useAuth · RequireAuth guard
  src/lib/       supabase client · XP rules
supabase/        config.toml, migrations & edge functions (filled by Phase 1 tasks)
docs/            the three project documents
.github/         CI: lint + typecheck + build on every PR
```

## Building it

Work through `docs/03-task-sheet.md` top to bottom. Each task has a ready-to-paste
Claude Code prompt. Suggested first session: INF-02 → INF-03 → FE-01.

## Scripts

| Command             | What it does                                        |
| ------------------- | --------------------------------------------------- |
| `npm run dev`       | Start the dev server                                |
| `npm run build`     | Typecheck + production build                        |
| `npm run typecheck` | TypeScript check only                               |
| `npm run lint`      | ESLint over `apps/web/src`                          |
| `npm run format`    | Prettier write over the repo (`format:check` in CI) |
