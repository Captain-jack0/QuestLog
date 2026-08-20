# QuestLog — Design & Technical Architecture

**Version:** 1.0 · **Date:** 13 August 2026 · **Stack decision:** React + Supabase
**Companion to:** 01 — Business Analysis · 03 — Task Sheet

---

## 1. Design Principles

1. **Calm over clever.** The user's head is already complicated; the UI must not be. One accent colour, generous whitespace, no dense grids, one primary action per screen.
2. **Resume-first.** The most prominent text on any card is not the title — it is the latest _next step_. The product's whole promise ("never lose the thread") must be visible at a glance.
3. **Two-minute loop.** Every daily interaction (check in → glance at threads → update 1–2 statuses → done) must complete in under two minutes on a phone.
4. **Celebrate, never shame.** XP toasts and level-ups are joyful; stale items are _invitations_, never red warnings.
5. **Mobile-first.** Designed at 390px width first; desktop is the enhancement. Bottom tab bar navigation, thumb-reachable actions.

## 2. Information Architecture & Screens

```
Bottom tabs:  [Today]  [Areas]  [+ Quick Add]  [Progress]  [Settings]
```

**S1 — Today (home).** Greeting + streak flame + today's XP. "Focus" section: up to 3 items picked for today (or a prompt to pick them). "Hanging threads": items In Progress/Paused whose last update is oldest, each showing its stored _next step_ and one-tap actions (Done ✓ / Update ✎ / Snooze 💤). Daily check-in is implicit — any action counts.

**S2 — Areas.** Grid of Life Area cards (colour, icon, level, open-item count). Tapping opens the area's project list. Projects show status chip + latest next step + progress bar (tasks done/total).

**S3 — Project detail.** Header carries a ▶ Timer / 🍅 25m pair, and so does every task row; the running clock rides above the tab bar on every screen with one tap to stop.

**S3 — Project detail.** Header (title, area, status, priority). **Resume box** at top: latest "where I left off" + "next step" in large type. Task list below with status chips and S/M/L difficulty. Progress log (append-only timeline) collapsed at the bottom.

**S4 — Quick Add (modal).** One text field + optional area/project pickers with smart defaults. Enter → saved → toast. Ten seconds max.

**S5 — Update flow (modal).** When status changes to Paused/Blocked (and optionally on any update): two fields — "Where did you leave off?" / "What's the next step?" — then XP toast.

**S6 — Progress.** Current level + XP bar; per-area levels; weekly XP chart; **weekly focus-time chart**; badge shelf; streak calendar (GitHub-style dots).

**S7 — Settings.** Profile, digest time & toggle, push toggle, stale threshold, snooze defaults, data export, (v2) API tokens.

## 3. Visual Design

- **Typography:** Inter (UI) — clean, free, excellent at small sizes. Numbers in tabular figures for XP.
- **Two themes, one set of tokens:** every colour is a CSS variable, switched by `<html data-theme>`. **Quest** (default) is a deep navy night sky with a CSS starfield — the gamified identity; **Calm** is the daylight palette below, for when the tool should disappear. Settings → Appearance switches them instantly.
- **Palette (calm, one accent):** Background `#FAFAF7` (paper), surface `#FFFFFF`, ink `#1F2933`, muted `#6B7280`, accent **indigo `#5B5BD6`**, success `#2F9E69`, warm highlight for streak flame `#E8833A`. Dark mode later (C2).
- **Per-area colours:** user-picked from an 8-colour pastel set — used only as thin card edges/dots, so the UI stays quiet.
- **Layout:** mobile-first single column with a bottom tab bar; from `md` the navigation becomes a left rail and the content spreads into 2–4 fluid columns, so a desktop window is never a phone strip between two empty margins.
- **Status is one tap:** a row of chips, never a dropdown. Resume context and task titles are editable in place.
- **Components:** rounded-2xl cards, soft shadows, status as small tinted chips, progress bars 4px, oversized touch targets (min 44px).
- **Motion:** XP toast slides up (+10 ✨), level-up gets a single confetti burst; everything else instant. No parallax, no noise.
- **Tone of voice:** friendly captain's-log. "Welcome back, Captain. 3 threads are waiting."

## 4. Tech Stack (decided)

| Layer               | Choice                                                           | Why                                                                                    |
| ------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Frontend            | **React 18 + Vite + TypeScript**                                 | Fast dev server, simple build, TS catches drift; huge ecosystem, ideal for Claude Code |
| Styling             | **Tailwind CSS** + Headless primitives (Radix)                   | Rapid, consistent, tiny CSS output                                                     |
| Data fetching/state | **TanStack Query** + light Zustand where needed                  | Cache + optimistic updates without boilerplate                                         |
| Routing             | React Router v6                                                  | Standard                                                                               |
| Forms/validation    | React Hook Form + Zod                                            | Zod schemas reused for API validation                                                  |
| Backend             | **Supabase** (Postgres + Auth + RLS + Edge Functions + Realtime) | Zero-ops backend, free tier, SQL you own                                               |
| Email               | **Resend** (via Edge Function)                                   | 100 emails/day free; React Email templates                                             |
| Push                | Web Push (VAPID) via service worker + Edge Function              | No native app needed                                                                   |
| Scheduling          | Supabase **pg_cron** → Edge Function                             | Daily digest + push trigger                                                            |
| Hosting             | **Vercel** (frontend) + Supabase cloud                           | Git-push deploys, free tier                                                            |
| CI/CD               | GitHub Actions                                                   | Lint, typecheck, test, migration check on PR                                           |
| Testing             | Vitest + React Testing Library + Playwright (smoke)              | Right-sized for solo project                                                           |
| Monitoring          | Sentry (free tier)                                               | Know when it breaks                                                                    |

**PWA:** manifest + service worker from v1 (installable, push-capable) → this _is_ the v3 mobile bridge; React Native/Expo only if PWA proves insufficient.

## 5. Data Model (Postgres / Supabase)

```
profiles        (id PK = auth.users.id, display_name, timezone, digest_time,
                 digest_enabled, push_enabled, stale_days int default 14,
                 created_at)

life_areas      (id PK, user_id FK, name, color, icon, sort_order,
                 archived bool, created_at)

projects        (id PK, user_id FK, area_id FK, title, description,
                 status enum, priority enum(low/med/high), target_date date null,
                 created_at, updated_at, completed_at null)

tasks           (id PK, user_id FK, project_id FK, title,
                 status enum, difficulty enum(S/M/L), sort_order,
                 created_at, updated_at, completed_at null)

progress_logs   (id PK, user_id FK, project_id FK, task_id FK null,
                 left_off text, next_step text, note text null,
                 source enum(user/ai) default user, created_at)   -- append-only

xp_events       (id PK, user_id FK, action_type text, xp int,
                 area_id FK null, project_id null, task_id null, created_at)

streaks         (user_id PK, current int, best int, last_active_date date,
                 freeze_tokens int default 0)

badges          (id PK, code unique, name, description, icon)
user_badges     (user_id FK, badge_id FK, earned_at, PK(user_id, badge_id))

focus_items     (id PK, user_id FK, date date, task_id null, project_id null,
                 completed bool default false)

push_subscriptions (id PK, user_id FK, endpoint, keys jsonb, created_at)

time_entries    (id PK, user_id FK, project_id FK, task_id null,
                 started_at, ended_at null, seconds null,
                 mode enum(timer/pomodoro))
                 -- partial unique index on (user_id) where ended_at is null:
                 -- the database itself allows only one running clock per user

status enum: idea | planned | in_progress | paused | blocked | done | dropped
```

**Key rules**

- Every table carries `user_id` with **RLS: `user_id = auth.uid()`** on all operations — full isolation by default, multi-user-ready later.
- `progress_logs` is append-only (no update/delete policy) — the honest history is a feature.
- XP/level/streak are **derived from `xp_events`** (single source of truth); levels computed, never stored.
- Views: `v_hanging_threads` (active items ordered by last update, respecting snooze), `v_area_stats` (per-area XP/level/open counts), `v_running_timer` (the clock that is running now).
- Time is **derived from `started_at`**, never ticked in the client, so a sleeping tab, a reload or a phone lock cannot drift the count.

## 6. API & Logic Design

**V1 — Supabase client + RPCs.** CRUD goes through supabase-js with RLS. Multi-step logic lives in Postgres functions (RPC) so rules stay server-side and reusable by the v2 API:

- `rpc.update_status(item, new_status, left_off, next_step)` → writes status + progress_log + xp_event + streak touch in one transaction.
- `rpc.complete_task(task_id)` / `rpc.complete_project(project_id)` → completion + XP + badge checks.
- `rpc.pick_focus(date, item_ids[])`, `rpc.daily_summary(user_id)` (used by digest).

**Edge Functions:** `send-digest` (pg_cron hourly → users whose local digest time matches → Resend email), `send-push` (same pattern), `export-data` (JSON dump).

**V2 — AI integration layer** (designed now, built later):

- Personal Access Tokens table (hashed, scoped: read / write, revocable) + a thin REST facade (`/api/v1/...`) as an Edge Function over the same RPCs.
- **MCP server** (small Node package, runs anywhere) exposing tools: `list_areas`, `list_projects(area?, status?)`, `get_project(id)` (incl. resume context), `update_status(...)`, `append_progress(left_off, next_step, note)`, `complete_task(id)`, `suggest_next_focus()`. Every AI write records `source='ai'` — visibly labelled in the timeline.
- Because all writes route through the same RPCs, **AI actions earn XP and obey the same rules as human actions.**

## 7. Repository & Code Structure

```
questlog/
├── apps/web/                 # React app (Vite)
│   ├── src/features/         # today/ areas/ projects/ gamification/ settings/
│   ├── src/components/       # shared UI
│   ├── src/lib/              # supabase client, xp rules, zod schemas
│   └── public/               # PWA manifest, icons, service worker
├── supabase/
│   ├── migrations/           # SQL migrations (source of truth)
│   ├── functions/            # edge functions: send-digest, send-push, api (v2)
│   └── seed.sql              # badges, demo data
├── packages/mcp-server/      # v2 — MCP integration
├── .github/workflows/ci.yml
└── docs/                     # these PDFs' markdown sources
```

Monorepo-lite (npm workspaces) — one repo, everything Claude Code needs in one place.

## 8. Environments & DevOps

- **Local:** `supabase start` (Docker) + `npm run dev`; `.env` from `.env.example`.
- **Migrations:** written via Supabase CLI, committed, applied by CI (`supabase db push`) — never edited in the dashboard.
- **CI (GitHub Actions):** on PR → lint + typecheck + unit tests + build; on merge to `main` → deploy (Vercel auto) + apply migrations + deploy edge functions.
- **Secrets:** Vercel/GitHub encrypted secrets; Supabase service key never ships to the client.
- **Backups:** Supabase daily backups + weekly `export-data` JSON to email (belt and braces).

## 9. Decision Log

| Decision              | Choice                               | Rationale                                                                              |
| --------------------- | ------------------------------------ | -------------------------------------------------------------------------------------- |
| Vite vs Next.js       | **Vite SPA**                         | No SEO/SSR need for a personal tool; simpler mental model; user chose React + Supabase |
| Auth                  | Supabase email magic-link + password | Zero custom auth code                                                                  |
| Where game rules live | Postgres RPCs                        | One rulebook for UI, digest, and future AI writes                                      |
| Mobile strategy       | PWA first                            | 90% of value, 5% of effort; Expo later only if needed                                  |
| Email provider        | Resend                               | Free tier, clean DX, React Email templates                                             |

---

_Next: 03 — Task Sheet, the build plan with Claude Code prompts._
