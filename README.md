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
npm run dev          # → http://localhost:5173
```

The app runs immediately with placeholder screens (no backend needed yet).

### Connect Supabase (task INF-02)

1. Create a free project at supabase.com
2. `cp .env.example .env.local` (repo root) and fill in the URL + anon key
3. Follow task INF-02 in `docs/03-task-sheet.md`

## Repo layout

```
apps/web/        React app (Vite)
  src/screens/   Today · Areas · Progress · Settings
  src/components/ Shared UI (TabBar, QuickAddSheet, ...)
  src/lib/       supabase client · XP rules
supabase/        migrations & edge functions (filled by Phase 1 tasks)
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
