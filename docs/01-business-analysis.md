# QuestLog — Business Analysis Document

**Project (working title):** QuestLog — a gamified personal life & work tracker
**Version:** 1.0 · **Date:** 13 August 2026 · **Prepared for:** Captain Mery
**Status:** Draft for approval

---

## 1. Executive Summary

QuestLog is a personal, gamified progress-tracking web application. It solves one core problem: **losing the thread**. Its owner juggles house chores, work tasks, personal projects, a learning path, and a career path — and repeatedly loses track of _where she left off_ and _what the planned next step was_.

QuestLog's answer is a deliberately simple system built around three ideas:

1. **Everything lives in one place**, organised into Life Areas (Work, Home, Projects, Learning, Career, …).
2. **Every item always carries two pieces of context**: "Where I left off" and "My next step". Nothing is ever just a checkbox — it is a resumable thread.
3. **Showing up is rewarded.** XP, levels, and streaks turn daily check-ins into a game loop, so the tracker itself becomes something you _want_ to open.

Version 1 is a web application (React + Supabase). Version 2 adds an AI integration layer (API + MCP server) so Claude and other AI assistants can read and update task states automatically. Version 3 packages the product as a mobile app.

## 2. Problem Statement

**Current situation.** Tasks and projects are scattered across memory, chat histories, notes, and half-finished work sessions. When returning to any project — after a day or a month — significant time and mental energy is spent reconstructing: _What was I doing? What did I finish? What was the plan?_

**Consequences:**

- Context loss: restarting a task costs 15–30 minutes of "where was I?" every time.
- Abandoned threads: projects silently die not from decision but from forgetting.
- Mental overload: the head becomes the database, which creates constant background stress.
- No sense of progress: without visible progress, motivation drains.

**Why existing tools fail here.** Todoist/Notion/Jira are either too heavy (require configuration and discipline the tool itself doesn't reward) or too shallow (a done/not-done checkbox stores no resume context). None of them make "pick up where you left off" a first-class concept, and few make daily check-in genuinely rewarding.

**The gap QuestLog fills:** a _low-friction, resume-context-first, gamified_ tracker for one person's whole life, designed from day one to let an AI agent act as its co-pilot.

## 3. Goals, Objectives & Success Metrics

**Product goals**

- G1 — Never lose the thread: any project can be resumed in under 30 seconds by reading its "left off / next step" note.
- G2 — One daily ritual: a Today view (plus email digest and push reminder) makes a 2-minute daily check-in the core habit.
- G3 — Make consistency fun: XP, levels, and streaks reward the act of tracking itself.
- G4 — AI-ready: the data model and API are designed so an AI can update statuses on the user's behalf (v2).

**Measurable success criteria (personal KPIs)**

| Metric                                                                      | Target                        |
| --------------------------------------------------------------------------- | ----------------------------- |
| Daily check-in streak after month 1                                         | ≥ 5 days/week                 |
| Time to resume any project (read context → start working)                   | < 1 minute                    |
| Active items with a filled "next step" field                                | ≥ 90%                         |
| Projects abandoned _silently_ (no status change ≥ 30 days without "paused") | ~0                            |
| V1 delivered usable end-to-end                                              | ≤ 6–8 weeks of part-time work |

## 4. Stakeholders & Persona

| Role                    | Who                                 | Interest                                   |
| ----------------------- | ----------------------------------- | ------------------------------------------ |
| Owner / primary user    | Captain Mery                        | Uses the product daily; defines features   |
| Developer               | Captain Mery + Claude Code          | Builds v1 from the task sheet in this pack |
| AI agent (v2)           | Claude / other assistants           | Reads & writes task state via API/MCP      |
| Future users (optional) | Friends, other multi-project people | Potential later multi-user expansion       |

**Persona — "The Multi-Thread Human."** Runs many parallel threads: a job, a household, side projects, a learning plan, career development. Highly capable, but working memory is the bottleneck, not skill. Wants a system that is _simpler than her head, not another project to maintain_. Uses AI assistants heavily for actual work, so much of the "progress" happens inside AI conversations — which is why AI write-access matters.

## 5. Scope & Roadmap

### In scope — Version 1 (Web MVP)

- Life Areas → Projects → Tasks hierarchy, single user, secure login.
- Task states: **Idea → Planned → In Progress → Paused (left half-done) → Blocked → Done → Dropped**.
- Mandatory-by-design context fields on every project/task update: _Where I left off_ and _Next step_.
- Today dashboard: greeting, streak, today's picked focus items, "threads you left hanging", quick status updates.
- Gamification: XP per action, levels, daily streak, small badge set.
- Daily email digest (morning summary of open threads + next steps).
- Browser/PWA push notification reminder (simple daily "check in" ping).
- Progress/stats page: XP history, per-area balance, completed-per-week.

### Out of scope for v1 (planned later)

- **V2:** Public REST API with personal tokens; MCP server so Claude can list/update items; AI-written progress summaries; weekly AI review ("what you dropped, what to pick up").
- **V3:** Mobile app (PWA hardening first, then React Native/Expo if needed); optional multi-user/sharing; rewards shop; calendar integration.

### Explicitly not goals

- Team collaboration, time tracking, invoicing, complex Gantt/dependency planning — heaviness is the enemy.

## 6. Feature List (MoSCoW)

**Must have (v1)**

- M1 Authentication (email + password / magic link via Supabase Auth), single-user data isolation (RLS).
- M2 CRUD for Life Areas (name, colour, icon, order).
- M3 CRUD for Projects within areas (title, description, status, priority, target date optional).
- M4 CRUD for Tasks within projects (title, status, difficulty S/M/L, notes).
- M5 **Resume context**: every status update prompts "Where did you leave off?" + "What's the next step?" — stored as an append-only progress log.
- M6 Today dashboard (focus picker, hanging threads, quick updates, streak display).
- M7 XP engine: actions award XP (see §8), level curve, per-area XP.
- M8 Streak engine: a day counts if ≥1 meaningful action is logged; streak freeze token earned weekly.
- M9 Daily email digest at user-chosen time.
- M10 Deployed, HTTPS, installable as a basic PWA.

**Should have (v1 if time allows)**

- S1 Push notification daily reminder.
- S2 Badges (first 10 defined in §8).
- S3 Search & filters (by area, status, "stale > 14 days").
- S4 Markdown support in notes.

**Could have**

- C1 Weekly review screen ("close the week": sweep stale items, plan next week).
- C2 Dark mode. C3 Data export (JSON/CSV). C4 Keyboard-first quick-add.

**Won't have (this release)**

- W1 Multi-user/teams. W2 Native mobile apps. W3 AI integration (v2). W4 Rewards shop.

## 7. User Stories & Acceptance Criteria (key selection)

**US-01 — Capture anything fast.** _As the user, I want to add a task/project in under 10 seconds, so capturing doesn't interrupt my flow._
✓ Quick-add from any screen; only title required; defaults applied (area = last used, status = Idea).

**US-02 — Never lose my place.** _As the user, when I stop working on something, I want to record where I left off and the next step, so future-me resumes instantly._
✓ Changing status to Paused/Blocked opens a 2-field prompt (left off / next step); both saved to progress log with timestamp; latest entry shown on the project card.

**US-03 — Daily ritual.** _As the user, I want a Today view that shows my streak, my chosen focus items, and threads left hanging, so a 2-minute check-in keeps everything current._
✓ Today shows: streak + XP; up to 3 chosen focus items; "hanging threads" = items In Progress/Paused with no update ≥ N days; one-tap status updates.

**US-04 — Feel progress.** _As the user, I want XP and levels for my actions, so consistency feels rewarding._
✓ XP toast on every action; level-up celebration; per-area levels visible; XP rules documented in-app.

**US-05 — Morning digest.** _As the user, I want a morning email listing open threads and next steps, so my day starts oriented._
✓ Digest at chosen time (default 08:00 local); contains streak, focus suggestions, hanging threads with their "next step" text; unsubscribe/time-change link.

**US-06 — Guilt-free pausing.** _As the user, I want a "Paused" state that is honest and penalty-free, so the system reflects reality instead of shaming me._
✓ Pausing awards (small) XP for updating context; paused items excluded from "stale" nagging for a chosen snooze period.

**US-07 (v2) — AI updates my board.** _As the user, I want Claude to mark tasks done / add progress notes from our work sessions, so the tracker stays current without manual entry._
✓ Personal API token; MCP tools: list areas/projects/tasks, update status, append progress note, set next step; every AI write is labelled "via AI" in the log.

## 8. Gamification Design (v1)

**Philosophy:** reward _tracking behaviour_, not just completion — the product's job is context-keeping, so context-keeping earns XP. Keep numbers small and legible.

**XP awards**

| Action                                             | XP           |
| -------------------------------------------------- | ------------ |
| Daily check-in (first action of the day)           | 10           |
| Complete a task (S / M / L difficulty)             | 10 / 25 / 50 |
| Update progress log (left off + next step)         | 8            |
| Complete a project                                 | 100          |
| Pick today's focus items                           | 5            |
| Groom a stale item (update or consciously drop it) | 15           |

**Levels:** XP needed for level _n_ = `100 × n^1.5` (rounded) — fast early levels, slowing curve. Global level + per-area levels from the same events.

**Streaks:** a day counts with ≥1 XP-earning action. 1 streak-freeze token earned per full 7-day week (max 2 held). Streak display: current / best.

**Badges (initial set):** First Quest (first task done) · Threadkeeper (10 progress logs) · Week One (7-day streak) · Fortnight (14-day) · Monthly Legend (30-day) · Finisher (first project done) · Renaissance (activity in 4+ areas in one week) · Necromancer (revive an item paused > 30 days) · Honest Quitter (first conscious Drop) · Level 10.

**Anti-patterns to avoid:** no XP loss/punishment; no public comparison; no red guilt-badges; stale-item nudges are phrased as invitations ("want to pick this thread back up, or drop it?").

## 9. Non-Functional Requirements

- **Simplicity:** every core flow (add, update, check-in) ≤ 3 taps; the UI never shows more than one level of hierarchy at once.
- **Performance:** dashboard loads < 2s on mobile; optimistic UI updates.
- **Availability/cost:** free-tier friendly (Vercel + Supabase free tiers) — €0/month at v1 scale.
- **Security:** Supabase Auth; Row Level Security on all tables; HTTPS only; API tokens (v2) scoped & revocable.
- **Privacy:** single-tenant personal data; no analytics beyond self-hosted basics; export possible.
- **Portability:** data model documented; export keeps you free to migrate.

## 10. Assumptions, Constraints, Risks

**Assumptions:** solo developer with Claude Code assistance; part-time build; free-tier infrastructure is sufficient; the user checks email daily.

**Constraints:** budget ≈ €0–5/month (domain optional); development time is evenings/weekends; scope discipline is critical.

| Risk                                     | Likelihood | Impact | Mitigation                                                                   |
| ---------------------------------------- | ---------- | ------ | ---------------------------------------------------------------------------- |
| Scope creep kills momentum               | High       | High   | MoSCoW enforced; v1 = Must list only; new ideas go to a "v2 parking lot"     |
| The tracker itself gets abandoned        | Medium     | High   | Gamification + digest + push; 2-minute check-in design; guilt-free states    |
| Gamification feels hollow after novelty  | Medium     | Medium | XP tied to the _useful_ behaviour (context logging); badges expand over time |
| Free tier limits (email sends, DB pause) | Low        | Medium | Resend free tier 100 emails/day ≫ needs; Supabase activity keeps DB warm     |
| AI write-access mistakes (v2)            | Medium     | Medium | AI writes labelled + reversible; append-only log; scoped tokens              |

## 11. Glossary

**Life Area** — top-level bucket (Work, Home, Projects, Learning, Career). **Thread** — any project/task with resume context; "hanging thread" = active but not updated recently. **Resume context** — the pair "where I left off" + "next step". **Check-in** — any XP-earning action in a day. **Focus items** — up to 3 items chosen for today. **Stale** — active item without updates for N days (default 14).

---

_Companion documents: 02 — Design & Architecture, 03 — Task Sheet (backend / frontend / DevOps, with Claude Code prompts)._
