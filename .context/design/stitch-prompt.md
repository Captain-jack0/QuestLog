# Stitch — QuestLog yeniden tasarım prompt'u

- tarih: 2026-10-13
- kaynak: `docs/01-business-analysis.md`, `docs/02-design-architecture.md`, `apps/web/src/index.css` tokenları, merge edilen PR'lar (#44, #45, #48, #59, #73–#78), açık issue'lar (#57, #67, #68, #76, #77, #79, #81) ve 2026-10-13 taslak task'ları (untouched-first boşlukları, görev → proje durumu, timer sesleri, arşivlenen alanlar, next step seçicisi).
- kullanım: önce **ana prompt** (stil + iskelet), sonra **ekran prompt'ları** sırayla. Stitch uzun tek prompt'u kısaltabiliyor.
- çıktı koda alınırken: tema tokenları ve `StatusChip.test.ts` kontrast eşiği (≥ 4.5:1, iki tema) sabit kalır.

## 1. Ana prompt

```text
Redesign "QuestLog", a mobile-first, gamified personal tracker for one person's whole life (work, home, side projects, learning, career). Its single promise: NEVER LOSE THE THREAD. Every project and task carries two pieces of resume context — "Where I left off" and "What's the next step" — so any thread can be picked up again in under 30 seconds. Daily check-ins earn XP, levels, streaks and badges so the tracker is something you want to open.

This is a REDESIGN of a working app. Keep every feature, screen and flow listed below; improve hierarchy, clarity and delight. Do not remove functionality, do not add social/competitive features.

DESIGN PRINCIPLES (non-negotiable)
1. Resume-first: on every card the most prominent text is the latest NEXT STEP, not the title.
2. Untouched-first: lists are ordered "least recently touched first" so neglected work rises to the top; in-progress tasks always stay pinned at the top of task lists; done/dropped sink to the end. The design must make this order feel intentional (e.g. subtle "last touched 9d ago" meta), never like a bug.
3. Two-minute loop: check in → glance at threads → update 1–2 statuses → done, on a phone, one-handed.
4. Calm over clever: one accent colour, generous whitespace, one primary action per screen, no dense grids.
5. Celebrate, never shame: XP toasts and level-ups are joyful; stale items are invitations ("pick this thread back up, or drop it?"), never red warnings. No XP loss, no public comparison, no guilt badges.
6. Mobile-first at 390px with a bottom tab bar; from tablet/desktop the nav becomes a left side rail and content spreads into 2–4 columns.

THEMES — keep both, one token set, switchable in Settings:
- "Quest" (default): deep navy night sky with a subtle CSS starfield — the gamified identity. paper #081230, surface #111F47, ink #E8EEFF, muted #94A8D6, line #203368, accent #4C8DFF, success #3ED598, flame (streak) #FFA84C, alert #FF6B81.
- "Calm": daylight paper for when the tool should disappear. paper #FAFAF7, surface #FFFFFF, ink #1F2933, muted #6B7280, line #E9E9E4, accent #2F4FB5, success #2F9E69, flame #E8833A, alert #E11D48.
- Per-area colours: 8 pastel options, used only as thin card edges / dots.
- All text and status chips must meet WCAG AA 4.5:1 in BOTH themes. Touch targets ≥ 44px. Visible keyboard focus.

TYPOGRAPHY: Inter, tabular figures for XP/timers. Use a ROLE-based scale, not raw sizes: micro 11px (chips, tab labels, chart axes), caption 12px (meta), body 14px, lead 16–18px (card titles, next step), title 20–24px (screen titles), display 30–48px (landing only).

STATUS SYSTEM — 7 statuses as small tinted chips, one tap to change (a row of chips, never a dropdown): Idea, Planned, In progress (solid accent), Paused, Blocked, Done, Dropped (struck through). Changing to Paused/Blocked/Done opens a short sheet: "Where did you leave off?" + "What's the next step?" (free text OR pick a task from THE SAME PROJECT).

GAMIFICATION (existing — must be clearly visible): XP awards (check-in 10, task done 10/25/50 by S/M/L difficulty, progress update 8, project done 100, pick focus 5, groom a stale item 15, focused time 10 per 25 min, max 60/day); global level + per-area levels (XP for level n = 100 × n^1.5); streak current/best with flame and up to 2 streak-freeze tokens; badges (First Quest, Threadkeeper, Week One, Fortnight, Monthly Legend, Finisher, Renaissance, Necromancer, Honest Quitter, Level 10); "+N ✨" XP toast slides up; level-up = single confetti burst.
GAMIFICATION (coming next — leave designed space for it, do not hard-code): richer badge detail & locked-badge previews, per-area level rings/progress, quest-style milestones, streak-freeze usage history, celebration moments when a project is completed. Keep it personal (no leaderboards).

TIMERS: a task or project can run a count-up timer or a 25/5 pomodoro; up to 3 timers at once, shown as a stacked TimerBar above the tab bar on every screen (project total on top line, task session below, pomodoro phase "🍅 Focus 18:32" / "☕ Break 03:10"). Sound + toast on start and on every pomodoro phase change (sound can be muted in Settings). On return after the phone slept: a sheet "Did your pomodoro keep going?" Yes/No.

SHARING: projects/areas can be shared with roles Owner, Admin, Editor, Viewer. Controls the role can't use are hidden, shared items carry a small "shared" badge, progress notes show the author ("you" for own notes).

TONE: friendly captain's log — "Welcome back, Captain. 3 threads are waiting." English UI copy.

Produce a cohesive design system first (colours for both themes, type roles, chips, cards, buttons, sheets, toasts, TimerBar, tab bar, side rail), then the screens.
```

## 2. Ekran prompt'ları (sırayla)

```text
TODAY (home): greeting + streak flame + today's XP. "Focus" — up to 3 items picked for today (+5 XP prompt to pick). "Hanging threads" — TASKS only, two groups: "Active" (in progress) and "Paused & blocked" (also holds in-progress tasks whose project is paused). Each row: task title, "Area · Project" meta, its NEXT STEP as the largest text, status chip, last-touched time, one-tap actions Done ✓ / Update ✎ / Snooze 💤. Oldest-touched first. Empty group hides its heading.
```

```text
AREAS: grid of life-area cards (colour edge, icon, area level + XP ring, open-item count), ordered least-recently-touched first. Bottom row "Archived (N)" opens archived areas (with Unarchive). A "Shared with me" section for projects shared without their area. Area detail: project cards with status chip, latest next step, tasks done/total progress bar (4px); done/dropped projects at the end.
```

```text
PROJECT DETAIL: header (title, area, status chips, ▶ Timer / 🍅 25m, share button for owner/admin). Big RESUME BOX on top: "Where I left off" + "Next step" in large type, editable in place. Task list: in-progress pinned on top, then untouched-first; each row has status chips, S/M/L difficulty, priority, ▶/🍅, quick-add row at the bottom. When the last open task is closed, owner/admin get a sheet "Complete the project too?" (Yes → +100 XP celebration). History timeline at the bottom: grouped by day, shows status transitions (Paused → In progress), task name, notes with author.
```

```text
PROGRESS: current level + XP bar to next level; per-area levels; weekly XP chart; weekly focus-time chart; badge shelf (earned + locked previews); streak calendar (GitHub-style dots) with freeze tokens marked; best streak. Joyful, never shaming — no red for missed days.
```

```text
SETTINGS + GLOBAL: Settings — profile, appearance (Quest / Calm), timer sounds on/off, daily digest time & toggle, push toggle, stale threshold, snooze defaults, data export, sign out. Global — Quick Add sheet (one field + area/project pickers, saved in 10s), "In progress" section in the desktop side rail (max 5 rows + "+N more") and a "● N in progress" chip above the mobile tab bar (becomes a badge on the TimerBar while a timer runs). Share dialog: invite by email or view-only link, member list with roles, revoke.
```
