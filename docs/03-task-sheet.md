# QuestLog — Detailed Task Sheet

**Version:** 1.0 · **Date:** 13 August 2026
**Tracks:** Infrastructure/DevOps · Backend · Frontend · Gamification · Notifications · V2 (AI)
Each task lists: what it needs (dependencies), acceptance criteria, and a **ready-to-paste Claude Code prompt**.

**How to use:** work top-to-bottom within a phase; paste the prompt into Claude Code inside the repo. Keep `docs/` (these documents) in the repo — the prompts refer to them.

---

## Phase 0 — Infrastructure & Project Setup (DevOps)

### INF-01 · Repository & monorepo scaffold

**Needs:** GitHub repo created (empty). **Est:** 1–2h
**Accept:** npm-workspaces monorepo with `apps/web` (Vite + React + TS + Tailwind + Router + TanStack Query + Zod + RHF), `supabase/`, `docs/`; `npm run dev` shows a placeholder; ESLint + Prettier configured; `.env.example` present; README with setup steps.

> **Claude Code prompt:** Scaffold a monorepo named questlog using npm workspaces. Create `apps/web` with Vite + React 18 + TypeScript, Tailwind CSS, React Router v6, TanStack Query, React Hook Form and Zod. Add ESLint + Prettier with sensible strict TS settings. Create empty `supabase/` and `docs/` folders, a root README explaining setup, and `.env.example` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. The app should render a placeholder "QuestLog" screen with a bottom tab bar (Today, Areas, Add, Progress, Settings) using React Router. Mobile-first at 390px.

### INF-02 · Supabase project & local dev

**Needs:** INF-01; free Supabase account. **Est:** 1h
**Accept:** `supabase init` done; `supabase start` runs locally; web app connects with anon key; auth signup/login works end-to-end with a `/login` page (magic link + password).

> **Claude Code prompt:** Initialise Supabase in this repo (supabase init). Wire `apps/web` to Supabase: create `src/lib/supabase.ts` using env vars, add an auth context/provider with session persistence, a `/login` route supporting email magic-link and email+password, a signup flow, logout, and a route guard that redirects unauthenticated users to /login. Use supabase-js v2. Add instructions to README for `supabase start` local development.

### INF-03 · CI pipeline

**Needs:** INF-01. **Est:** 1h
**Accept:** GitHub Actions on PR: install, lint, typecheck, unit tests, build; badge in README; failing check blocks merge.

> **Claude Code prompt:** Add a GitHub Actions workflow `.github/workflows/ci.yml` that runs on pull_request and push to main: checkout, setup-node 20 with npm cache, npm ci, lint, typecheck (tsc --noEmit), vitest run, and vite build for apps/web. Make steps fail the build on error. Add a CI status badge to the README.

### INF-04 · Deployment (Vercel + Supabase cloud)

**Needs:** INF-02, INF-03. **Est:** 1–2h
**Accept:** production URL over HTTPS; env vars set in Vercel; `supabase db push` applies migrations to cloud project; deploy documented in README.

> **Claude Code prompt:** Prepare this repo for deployment: add a `vercel.json` for the Vite SPA in apps/web (SPA fallback rewrites), document in README the exact steps to (1) create the Supabase cloud project and link it with `supabase link`, (2) apply migrations with `supabase db push`, (3) deploy the frontend to Vercel with the required env vars, (4) set up Supabase Edge Function deployment via `supabase functions deploy`. Add an npm script `deploy:db` wrapping db push.

### INF-05 · Sentry + PWA shell

**Needs:** INF-04. **Est:** 1–2h
**Accept:** Sentry captures a test error from prod; app installable (manifest + icons + service worker registered); Lighthouse PWA pass.

> **Claude Code prompt:** Add Sentry (browser SDK, env-gated so it's disabled in dev) to apps/web with an ErrorBoundary. Then make the app an installable PWA: web manifest (name QuestLog, theme colour #5B5BD6, icons), service worker registration with vite-plugin-pwa in autoUpdate mode, and offline caching of the app shell only (network-first for API). Verify with a note in README on how to test install on Android/iOS.

---

## Phase 1 — Backend (Database & Rules)

### BE-01 · Core schema migration

**Needs:** INF-02. **Est:** 2–3h
**Accept:** migration creates `profiles, life_areas, projects, tasks, progress_logs, focus_items` with enums (`status`, `priority`, `difficulty`), FKs, indexes on `(user_id, updated_at)`; trigger auto-creates a profile row on signup; `updated_at` triggers.

> **Claude Code prompt:** Read docs/02-design-architecture.md section 5. Create a Supabase SQL migration implementing: enums item_status (idea, planned, in_progress, paused, blocked, done, dropped), priority (low, med, high), difficulty (S, M, L); tables profiles, life_areas, projects, tasks, progress_logs (append-only), focus_items exactly as specified, all with user_id uuid referencing auth.users, created_at/updated_at defaults, and useful indexes. Add a trigger creating a profiles row on auth.users insert, and updated_at touch triggers on projects and tasks.

### BE-02 · Row Level Security

**Needs:** BE-01. **Est:** 1–2h
**Accept:** RLS enabled on every table; policies allow only `auth.uid() = user_id`; progress_logs has insert+select only (no update/delete); anonymous access fully blocked; SQL tests included.

> **Claude Code prompt:** Write a migration enabling Row Level Security on all QuestLog tables. Policies: full CRUD for owner (auth.uid() = user_id) on life_areas, projects, tasks, focus_items, profiles (profiles: select/update own row only). progress_logs: INSERT and SELECT for owner only — no UPDATE or DELETE policies (append-only). Add a pgTAP or plain SQL test script under supabase/tests that verifies a second user cannot read or write the first user's rows.

### BE-03 · Gamification schema

**Needs:** BE-01. **Est:** 1–2h
**Accept:** `xp_events, streaks, badges, user_badges` created with RLS; `seed.sql` inserts the 10 badges from docs/01 §8; helper SQL function `level_for_xp(xp int)` implements `100 × n^1.5` curve.

> **Claude Code prompt:** Read docs/01-business-analysis.md section 8. Create a migration for xp_events, streaks (user_id PK, current, best, last_active_date, freeze_tokens), badges (code, name, description, icon) and user_badges, with owner-only RLS (badges table is public-read). Write supabase/seed.sql inserting the 10 launch badges defined in the doc. Add an immutable SQL function level_for_xp(total_xp int) returning the level for the curve xp_needed(n) = round(100 * n^1.5), plus a comment table of levels 1–20.

### BE-04 · Core RPC: update_status (the heart)

**Needs:** BE-02, BE-03. **Est:** 3–4h
**Accept:** one transactional RPC updates a task or project status, inserts progress_log (left_off/next_step), awards correct XP per docs/01 §8, updates streak (incl. freeze-token logic and weekly token grant), runs badge checks; returns `{xp_awarded, new_total_xp, level, leveled_up, streak, new_badges[]}`; unit-tested via SQL.

> **Claude Code prompt:** Read docs/01-business-analysis.md section 8 and docs/02-design-architecture.md section 6. Create a Postgres function rpc_update_status(p_item_type text, p_item_id uuid, p_new_status item_status, p_left_off text, p_next_step text, p_note text default null, p_source text default 'user') that in ONE transaction: updates the task/project status (setting completed_at when done), inserts a progress_logs row, inserts the correct xp_events per the XP table (check-in bonus 10 XP only on first action of the user's local day, task completion XP by difficulty S/M/L = 10/25/50, project completion 100, progress update 8), updates the streaks row (increment if new day, reset if gap > 1 day unless a freeze_token is consumed, grant one freeze token per completed 7-day week, cap 2, track best), evaluates and grants any newly earned badges, and returns a json summary {xp_awarded, total_xp, level, leveled_up, streak_current, new_badges}. Use the profile timezone for day boundaries. Add SQL tests covering: first action of day, streak continuation, streak break with and without freeze token, badge grant idempotency.

### BE-05 · Supporting RPCs & views

**Needs:** BE-04. **Est:** 2h
**Accept:** `rpc_pick_focus(date, items[])` (awards 5 XP once/day), `rpc_groom_stale(item)` (15 XP), views `v_hanging_threads` (active items ordered by last activity, joining latest progress_log, excluding snoozed) and `v_area_stats` (per-area XP, level, open counts); snooze column added where needed.

> **Claude Code prompt:** Add a migration with: (1) rpc_pick_focus(p_date date, p_items jsonb) storing up to 3 focus_items and awarding a single 5 XP event per day; (2) a snoozed_until date column on projects and tasks plus rpc_snooze(item_type, id, until); (3) rpc_groom_stale(item_type, id) awarding 15 XP when a stale item gets updated or dropped; (4) view v_hanging_threads returning the current user's in_progress/paused/blocked items with their latest progress_log (left_off, next_step, logged_at), excluding snoozed ones, ordered by oldest activity first; (5) view v_area_stats with per-area total XP, level (via level_for_xp), and open item counts. All security-definer functions must verify ownership.

---

## Phase 2 — Frontend (Core App)

### FE-01 · Design system & app shell

**Needs:** INF-02. **Est:** 2–3h
**Accept:** Tailwind theme with the §3 palette + Inter font; shared components (Card, Chip, Button, ProgressBar, Modal/Sheet, Toast); bottom tab shell wired to routes; looks right at 390px.

> **Claude Code prompt:** Read docs/02-design-architecture.md section 3. Configure the Tailwind theme with the palette (paper #FAFAF7, surface #FFFFFF, ink #1F2933, muted #6B7280, accent #5B5BD6, success #2F9E69, flame #E8833A), Inter via fontsource, rounded-2xl card radius. Build shared components in src/components: Card, StatusChip (one tinted style per item_status), Button (primary/ghost), ProgressBar (4px), BottomSheet modal, and a Toast system (for XP toasts later). Assemble the app shell: bottom tab bar (Today, Areas, center + button, Progress, Settings) with active states, min 44px touch targets, mobile-first.

### FE-02 · Areas & projects CRUD

**Needs:** FE-01, BE-02. **Est:** 3–4h
**Accept:** Areas grid (colour/icon/open count); create/edit/archive area (8 pastel colours, emoji icon); project list per area with status chip, latest next step, task progress bar; project create/edit; TanStack Query with optimistic updates.

> **Claude Code prompt:** Build the Areas feature per docs/02 sections 2 (S2) using supabase-js and TanStack Query. Areas screen: responsive card grid showing name, emoji icon, colour edge, open project count; FAB/sheet to create or edit an area (name, emoji picker from a fixed set, 8 pastel colour swatches, sort order); archive with confirm. Area detail: project list cards showing title, StatusChip, latest next_step (from most recent progress_log), and a small tasks-done progress bar; sheet to create/edit a project (title, description, priority, optional target date). Use optimistic updates and invalidate queries properly. Add Zod schemas in src/lib/schemas.ts shared by forms.

### FE-03 · Project detail + tasks + Resume box

**Needs:** FE-02. **Est:** 3–4h
**Accept:** Project screen with Resume box (latest left_off/next_step in large type), task list with checkable statuses and S/M/L, quick task add, collapsible progress-log timeline (user/AI source labels ready).

> **Claude Code prompt:** Build the Project detail screen (docs/02 S3): header with title, area colour, StatusChip and priority; a prominent "Resume" card at top showing the latest progress_log's left_off and next_step ("Where you left off" / "Next step") with relative time; a task list with inline status changes and difficulty badges (S/M/L), drag-free simple sort, and a quick-add input at the bottom of the list; a collapsed "History" section rendering the append-only progress_logs timeline with timestamps and a small "via AI" label when source='ai'. All mutations through TanStack Query.

### FE-04 · Status update flow through rpc_update_status

**Needs:** FE-03, BE-04. **Est:** 2–3h
**Accept:** every status change calls the RPC; moving to paused/blocked (and completing) opens the two-field sheet (left off / next step); response drives XP toast (+n ✨), level-up confetti, streak update in header; errors roll back optimistic state.

> **Claude Code prompt:** Wire all status changes in the app to the rpc_update_status Postgres function instead of direct table updates. When the user changes status to paused or blocked, or completes an item, open a BottomSheet with two textareas: "Where did you leave off?" and "What's the next step?" (both required for paused/blocked, optional prefilled for done) plus optional note. On success, read the RPC's json result: show an XP toast "+{xp} ✨", if leveled_up show a one-shot confetti burst (canvas-confetti) with "Level {n}!", update any streak display, and if new_badges is non-empty show a badge-earned toast. Handle failures by reverting optimistic updates.

### FE-05 · Today dashboard

**Needs:** FE-04, BE-05. **Est:** 3–4h
**Accept:** greeting + streak flame + today XP; Focus section (pick up to 3 via sheet listing active items; award via rpc_pick_focus; check-off works); Hanging Threads list from v_hanging_threads with next_step visible and Done/Update/Snooze actions; empty states friendly.

> **Claude Code prompt:** Build the Today screen (docs/02 S1) as the default route. Header: "Welcome back, Captain" greeting with display_name, streak flame icon with current streak, and XP earned today. Focus section: if no focus_items for today, show a "Pick today's focus" card opening a sheet that lists active tasks/projects (searchable) and lets the user select up to 3, saved via rpc_pick_focus; render chosen items with check-off. Hanging Threads section: query v_hanging_threads, render cards with item title, project/area context, stored next_step in emphasized type, last-activity relative time, and three actions: Done (rpc via FE-04 flow), Update (same sheet), Snooze (rpc_snooze with 3d/7d/30d options). Friendly empty states for a fresh account.

### FE-06 · Progress & badges screen

**Needs:** FE-04. **Est:** 2–3h
**Accept:** global level + XP bar to next level; per-area level chips; weekly XP bar chart (last 8 weeks); badge shelf (earned bright / locked grey with hint); streak calendar dots for ~12 weeks.

> **Claude Code prompt:** Build the Progress screen (docs/02 S6). Top: circular or bar display of global level with XP progress to next level using level_for_xp curve (duplicate the formula in src/lib/xp.ts with tests). Per-area: chips from v_area_stats. Chart: last 8 weeks of XP as a simple bar chart (use recharts) aggregated from xp_events. Badge shelf: grid of all badges — earned ones bright with earned date, unearned greyscale with a hint line. Bottom: a 12-week streak dot calendar built from xp_events days. Keep visual style calm per docs/02 section 3.

### FE-07 · Settings, profile & data export

**Needs:** FE-01, BE-01. **Est:** 2h
**Accept:** edit display name & timezone; digest time/enable; push enable placeholder; stale-days slider; JSON export downloads all user data; logout; delete-account note.

> **Claude Code prompt:** Build the Settings screen: profile section (display_name, timezone picker using Intl.supportedValuesOf('timeZone')), notifications section (digest_enabled toggle + digest_time time input, push_enabled toggle — wiring comes later), preferences (stale_days slider 7–30), data section with an "Export my data" button that fetches all the user's rows (areas, projects, tasks, progress_logs, xp_events, user_badges) client-side and downloads a single JSON file, and logout. Persist to the profiles table.

### FE-08 · Quick Add

**Needs:** FE-02. **Est:** 1–2h
**Accept:** center tab opens a sheet: single title input autofocused, optional area/project pickers defaulting to last used, saves task (or project when no project chosen but area picked + "as project" toggle); < 10s flow; works from anywhere.

> **Claude Code prompt:** Implement the Quick Add flow on the center tab button: a BottomSheet with an autofocused title input, an optional area picker and project picker (defaulting to the most recently used, stored in localStorage), and an "add as project" toggle when no project is selected. Enter key saves immediately with status 'idea', shows a toast, clears and stays open for rapid entry; swipe down closes. Ensure it is reachable from every screen and never more than one tap away.

---

## Phase 3 — Notifications

### NT-01 · Daily email digest

**Needs:** BE-05, INF-04; Resend account. **Est:** 3–4h
**Accept:** Edge Function `send-digest` renders streak, focus suggestions, hanging threads with next steps; pg_cron runs hourly and matches each user's local digest_time; test-send button in Settings; unsubscribe link flips digest_enabled.

> **Claude Code prompt:** Create a Supabase Edge Function send-digest that: selects users with digest_enabled whose profile digest_time matches the current hour in their timezone, gathers their streak, today's focus items, and top 5 v_hanging_threads rows, renders a clean mobile-friendly HTML email ("Good morning, Captain — 3 threads are waiting", each thread with its next_step), and sends via Resend API (RESEND_API_KEY secret). Add a pg_cron schedule running it hourly via pg_net. Include a signed unsubscribe link hitting a small edge function that sets digest_enabled=false. Add a "Send me a test digest" button in Settings calling the function for the current user. Document required secrets in README.

### NT-02 · Browser push reminder

**Needs:** INF-05, FE-07. **Est:** 3–4h
**Accept:** enabling push in Settings requests permission and stores subscription; Edge Function `send-push` sends daily reminder at digest_time+offset if no check-in yet that day; tapping notification opens Today; VAPID keys documented.

> **Claude Code prompt:** Implement Web Push: generate VAPID keys (document in README, store private key as function secret), extend the service worker to handle push and notificationclick (open /). In Settings, wire the push toggle to request Notification permission, subscribe via pushManager, and save the subscription to push_subscriptions. Create Edge Function send-push scheduled hourly: for users with push_enabled whose local time matches their reminder hour AND who have no xp_events yet today, send "🔥 Your {n}-day streak is waiting — 2-minute check-in?" via web-push. Handle expired subscriptions by deleting them.

---

## Phase 4 — Hardening & Release

### REL-01 · Tests & smoke E2E

**Needs:** Phase 2 done. **Est:** 3h
**Accept:** unit tests for xp.ts and critical hooks; Playwright smoke: signup → create area → project → task → complete with context → XP toast appears → Today shows thread; runs in CI.

> **Claude Code prompt:** Add Vitest unit tests for src/lib/xp.ts (level curve edge cases) and the status-update hook logic (mock supabase). Add a Playwright test (against local supabase) covering: sign up, create area "Work", create project "Test project", add task, complete it filling the context sheet, assert the XP toast and that Today's hanging threads / focus behave. Wire Playwright into CI as a separate job with supabase start.

### REL-02 · Polish pass & accessibility

**Needs:** REL-01. **Est:** 2–3h
**Accept:** keyboard navigable; visible focus rings; aria labels on icon buttons; colour contrast AA; loading skeletons; error boundaries with friendly copy; 90+ Lighthouse.

> **Claude Code prompt:** Do a polish and accessibility pass across all screens: add aria-labels to icon-only buttons, ensure focus-visible rings using the accent colour, check all text/background pairs meet WCAG AA (adjust Tailwind shades if needed), add skeleton loaders for Today/Areas/Project screens, friendly error and empty states everywhere, and fix anything Lighthouse (mobile) flags below 90 in performance/accessibility/best practices.

---

## Phase 5 — V2 Preview: AI Integration (build after v1 is in daily use)

### AI-01 · Personal access tokens + REST facade

**Accept:** tokens table (hashed, scopes read/write, revocable from Settings); Edge Function `api` exposing /v1 endpoints (areas, projects, tasks, status updates, progress) that authenticates tokens and calls the same RPCs; OpenAPI doc.

> **Claude Code prompt:** Create an api_tokens table (id, user_id, name, token_hash, scopes text[], last_used_at, revoked) with RLS, a Settings UI section to create (show-once) and revoke tokens, and a Supabase Edge Function `api` implementing REST endpoints GET /v1/areas, GET /v1/projects?status=, GET /v1/projects/:id (with latest resume context), POST /v1/items/:type/:id/status (body: status, left_off, next_step, note — calls rpc_update_status with p_source='ai'), POST /v1/progress. Authenticate via Bearer token compared against token_hash (sha256), enforce scopes, update last_used_at. Generate an openapi.yaml in docs/.

### AI-02 · MCP server package

**Accept:** `packages/mcp-server` (Node, MCP SDK, stdio) with tools list_areas, list_projects, get_project, update_status, append_progress, complete_task, suggest_next_focus; configured via QUESTLOG_API_URL + QUESTLOG_TOKEN; README shows Claude Desktop/Code config; AI writes appear labelled in the app timeline.

> **Claude Code prompt:** Read docs/02-design-architecture.md section 6. Create packages/mcp-server: a TypeScript MCP server (@modelcontextprotocol/sdk, stdio transport) wrapping the QuestLog REST API from AI-01. Tools: list_areas, list_projects (filter by area/status), get_project (returns tasks + latest left_off/next_step), update_status (item type/id, status, left_off, next_step), append_progress, complete_task, suggest_next_focus (returns the 3 oldest hanging threads). Config via env QUESTLOG_API_URL and QUESTLOG_TOKEN. Ship a README with example claude_desktop_config.json and Claude Code .mcp.json entries, and a smoke script. Errors must return helpful messages, never crash the server.

---

## Summary Board

| #      | Task                    | Track      | Est  | Depends on    |
| ------ | ----------------------- | ---------- | ---- | ------------- |
| INF-01 | Repo & scaffold         | DevOps     | 1–2h | —             |
| INF-02 | Supabase + auth         | DevOps     | 1h   | INF-01        |
| INF-03 | CI pipeline             | DevOps     | 1h   | INF-01        |
| INF-04 | Deploy Vercel/Supabase  | DevOps     | 1–2h | INF-02,03     |
| INF-05 | Sentry + PWA            | DevOps     | 1–2h | INF-04        |
| BE-01  | Core schema             | Backend    | 2–3h | INF-02        |
| BE-02  | RLS                     | Backend    | 1–2h | BE-01         |
| BE-03  | Gamification schema     | Backend    | 1–2h | BE-01         |
| BE-04  | rpc_update_status       | Backend    | 3–4h | BE-02,03      |
| BE-05  | RPCs & views            | Backend    | 2h   | BE-04         |
| FE-01  | Design system & shell   | Frontend   | 2–3h | INF-02        |
| FE-02  | Areas & projects        | Frontend   | 3–4h | FE-01, BE-02  |
| FE-03  | Project detail & tasks  | Frontend   | 3–4h | FE-02         |
| FE-04  | Status flow + XP toasts | Frontend   | 2–3h | FE-03, BE-04  |
| FE-05  | Today dashboard         | Frontend   | 3–4h | FE-04, BE-05  |
| FE-06  | Progress & badges       | Frontend   | 2–3h | FE-04         |
| FE-07  | Settings & export       | Frontend   | 2h   | FE-01, BE-01  |
| FE-08  | Quick Add               | Frontend   | 1–2h | FE-02         |
| NT-01  | Email digest            | Backend    | 3–4h | BE-05, INF-04 |
| NT-02  | Push reminder           | Backend    | 3–4h | INF-05, FE-07 |
| REL-01 | Tests & E2E             | DevOps     | 3h   | Phase 2       |
| REL-02 | Polish & a11y           | Frontend   | 2–3h | REL-01        |
| AI-01  | Tokens + REST API       | Backend v2 | —    | v1 live       |
| AI-02  | MCP server              | Backend v2 | —    | AI-01         |

**Total v1 estimate: ~45–60 focused hours** (≈ 6–8 weeks at ~8h/week). Suggested first session: INF-01 → INF-02 → FE-01 in one sitting, so you end day one with a deployed-ready shell you can actually open on your phone.
