# QuestLog 🧭

[![CI](https://github.com/Captain-jack0/QuestLog/actions/workflows/ci.yml/badge.svg)](https://github.com/Captain-jack0/QuestLog/actions/workflows/ci.yml)

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

### Database

`supabase/migrations` holds the whole schema; `npm run db:reset` rebuilds the local database
from scratch and `npm run test:db` runs the pgTAP suite against it (RLS isolation, XP,
streaks, freeze tokens, badge idempotency). Both need the local stack running.

`src/lib/database.types.ts` is generated — after changing a migration, refresh it with
`npx supabase gen types typescript --local > apps/web/src/lib/database.types.ts`.

Clients only ever **read** `xp_events`, `streaks` and `user_badges` — every write goes
through the security-definer RPCs (`rpc_update_status`, `rpc_pick_focus`, `rpc_groom_stale`,
`rpc_snooze`), so XP cannot be minted from the browser. `progress_logs` has no update or
delete path at all.

## Repo layout

```
apps/web/        React app (Vite)
  src/screens/   Login · Today · Areas · AreaDetail · ProjectDetail · Progress · Settings
  src/components/ui/  Card · Button · StatusChip · ProgressBar · BottomSheet · Toast
  src/features/  areas/ · projects/ · tasks/ · status/ (query hooks + sheets)
  src/auth/      AuthProvider · useAuth · RequireAuth guard
  src/lib/       supabase client · generated DB types · zod schemas · XP rules
supabase/        config.toml, migrations, pgTAP tests & edge functions
docs/            the three project documents
.github/         CI: lint + typecheck + test + build on every PR
vercel.json      SPA build + fallback rewrite for the Vercel deploy
```

## Deployment

Frontend on Vercel, database and auth on Supabase cloud. Both are free-tier friendly.

### 1. Supabase cloud project

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>   # ref is in the project URL / dashboard
npm run deploy:db                                    # = supabase db push, applies supabase/migrations
```

In the dashboard: **Authentication → URL Configuration** → set Site URL to your Vercel
production URL and add it (plus `http://localhost:5173`) to the redirect allow-list, or
magic links will bounce back to the wrong origin.

### 2. Frontend on Vercel

Import the GitHub repo at [vercel.com/new](https://vercel.com/new) and keep the **root**
directory — `vercel.json` already points the build at the workspace:

| Setting          | Value                                                                |
| ---------------- | -------------------------------------------------------------------- |
| Install command  | `npm ci`                                                             |
| Build command    | `npm run build`                                                      |
| Output directory | `apps/web/dist`                                                      |
| Env vars         | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (Production + Preview) |

Env vars are baked in at build time, so re-deploy after changing them. Use the **cloud**
project's URL + anon key here, not the local ones. The rewrite in `vercel.json` sends any
path with no matching file to `index.html`, so deep links like `/settings` survive a hard
refresh while `/assets/*` still serves the real bundles.

CLI alternative: `npx vercel link` once, then `npx vercel --prod`.

### 3. Error reporting & PWA install

Set `VITE_SENTRY_DSN` in Vercel to turn on Sentry — it stays off in dev and when the DSN is
empty, so nothing is reported from local work. A `Crashed` fallback screen catches render
errors either way.

The build emits a service worker (`autoUpdate`) that precaches the app shell only; Supabase
REST/auth calls are network-first with a 5s timeout. To test install: open the production
URL on Android Chrome → menu → _Install app_; on iOS Safari → Share → _Add to Home Screen_.
Service workers need HTTPS (or localhost), so `npm run preview` is the local check —
`npm run dev` does not register one.

### 4. Daily email digest (NT-01)

```bash
npx supabase secrets set RESEND_API_KEY=re_xxx \
  UNSUBSCRIBE_SECRET="$(openssl rand -hex 32)" \
  DIGEST_FROM="QuestLog <digest@your-domain>"

npx supabase functions deploy send-digest
npx supabase functions deploy unsubscribe --no-verify-jwt   # clicked from an inbox, no session
```

Then schedule the hourly run once, from the SQL editor of the linked project:

```sql
select schedule_digest(
  'https://<project-ref>.functions.supabase.co',
  '<service-role-key>'   -- stays in the database, never in the repo
);
```

`digest_recipients()` picks the users whose **local** hour matches their `digest_time`, so
the job runs hourly and each person gets one mail a day. Accounts with nothing waiting are
skipped rather than mailed. Every email carries a signed unsubscribe link that flips
`digest_enabled` off; Settings has a **Send me a test digest** button that mails only you.

| Secret               | What it is                                  |
| -------------------- | ------------------------------------------- |
| `RESEND_API_KEY`     | Resend API key (free tier: 100 mails/day)   |
| `UNSUBSCRIBE_SECRET` | Random string signing the unsubscribe links |
| `DIGEST_FROM`        | Verified sender address                     |

### 5. Push reminders (NT-02)

```bash
npx web-push generate-vapid-keys        # prints a public/private pair
```

Put the **public** half in `VITE_VAPID_PUBLIC_KEY` (Vercel env + your `.env.local`) and keep
the private half server-side:

```bash
npx supabase secrets set VAPID_PUBLIC_KEY=B... VAPID_PRIVATE_KEY=... \
  VAPID_SUBJECT="mailto:you@your-domain"

npx supabase functions deploy send-push
```

```sql
select schedule_push(
  'https://<project-ref>.functions.supabase.co',
  '<service-role-key>'
);
```

The nudge goes out **10 hours after the digest time** and only to people who have not earned
any XP yet that day — checking in makes it disappear. Subscriptions the browser has thrown
away (404/410 from the push service) are deleted on the spot. Tapping the notification
focuses an open tab or opens Today.

Push needs HTTPS and a real install: use `npm run preview` or the deployed site, not
`npm run dev`.

## Status

Every v1 task in `docs/03-task-sheet.md` is built: infrastructure (INF-01…05), the database
and its rules (BE-01…05), all screens (FE-01…08), digest and push (NT-01, NT-02) and the
release pass (REL-01, REL-02).

What is **not** done, on purpose:

- the cloud deploy itself — it needs your Supabase, Vercel, Resend and VAPID credentials
  (all steps are in [Deployment](#deployment))
- Phase 5, the AI layer (AI-01 personal access tokens + REST facade, AI-02 MCP server),
  which the task sheet says to start once v1 is in daily use

## Building it

Work through `docs/03-task-sheet.md` top to bottom. Each task has a ready-to-paste
Claude Code prompt. Phase 5 is the only one left.

## Scripts

| Command             | What it does                                                      |
| ------------------- | ----------------------------------------------------------------- |
| `npm run dev`       | Start the dev server                                              |
| `npm run build`     | Typecheck + production build                                      |
| `npm run typecheck` | TypeScript check only                                             |
| `npm run lint`      | ESLint over `apps/web/src`                                        |
| `npm run test`      | Vitest unit tests (`vitest` for watch mode)                       |
| `npm run format`    | Prettier write over the repo (`format:check` in CI)               |
| `npm run test:db`   | pgTAP tests against the local database                            |
| `npm run db:reset`  | Rebuild the local database from migrations + seed                 |
| `npm run deploy:db` | `supabase db push` — apply migrations to the linked cloud project |
