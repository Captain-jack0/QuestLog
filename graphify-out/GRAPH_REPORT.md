# Graph Report - QuestLog  (2026-10-14)

## Corpus Check
- 297 files · ~388,300 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 11 file(s) not represented in the graph (top: (none) 7, .example 2, .css 1)

## Summary
- 1273 nodes · 3263 edges · 74 communities (48 shown, 26 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 125 edges (avg confidence: 0.82)
- Token cost: 384,903 input · 0 output

## Community Hubs (Navigation)
- Shell Rail & Area Summaries
- Directive Records (Issues)
- Product Docs & Stitch Screens
- Edge Functions (Digest, Invite)
- Crew Agents & Orchestration
- Realtime Sync & Push Settings
- Bottom Sheet & Color Tests
- Timer Heartbeat & Pomodoro
- E2E Specs
- Sharing Membership RLS
- Icons, Chips & Toast
- Area Queries & Status Feedback
- Gamification & Focus SQL
- Top Bar & Navigation
- Card Primitives & Area Card
- CI, Backup & Deploy
- Picker & Focus Sheets
- Project History Timeline
- Time Tracking SQL
- App Shell, Auth & Quick Add
- Threads Queries & Shell Context
- Buttons, Fields & Project Sheet
- Project Queries
- Theme, Sentry & Bootstrap
- Core Schema
- Web Package & Vite Config
- Dev Dependencies
- Task Ordering & Staleness
- Task List Prefs & Filters
- TypeScript Config
- Project Card Stats & Schemas
- Timer Stack & Today Logic
- Task Item & Inline Edit
- Realtime E2E Spec
- Status Picker & Task Sheet
- rpc_update_status, XP & Badges
- Runtime Dependencies
- Status Change & Landing Preview
- Digest & Running Timer Views
- Project Ordering
- Service Worker TS Config
- Untouched-First Touch Triggers
- NPM Scripts
- View Introspection Tests
- Push Notifications SQL
- Vercel Config
- Cron Least Privilege
- Digest SQL Tests
- Service Worker
- Status Changed Timestamp
- Tailwind Config
- iOS Sheet Scroll Lock
- 375px Overflow Fix
- Push SQL Test

## God Nodes (most connected - your core abstractions)
1. `projects` - 54 edges
2. `ProjectDetailScreen()` - 53 edges
3. `Icon()` - 52 edges
4. `vitest` - 44 edges
5. `tasks` - 44 edges
6. `Button()` - 37 edges
7. `react` - 32 edges
8. `Card()` - 32 edges
9. `ItemStatus` - 28 edges
10. `AreaDetailScreen()` - 27 edges

## Surprising Connections (you probably didn't know these)
- `Quest and Calm theme tokens + AA contrast` --semantically_similar_to--> `Quest and Calm themes (CSS variables)`  [INFERRED] [semantically similar]
  .context/design/stitch-prompt.md → README.md
- `Stacked TimerBar, up to 3 timers` --semantically_similar_to--> `Timer and pomodoro`  [INFERRED] [semantically similar]
  .context/design/stitch-prompt.md → README.md
- `Gamification spec (XP values, levels, streak, badges)` --semantically_similar_to--> `XP, levels, streaks, badges`  [INFERRED] [semantically similar]
  .context/design/stitch-prompt.md → README.md
- `Lesson: unit tests must pass without .env.local` --references--> `Stack: React/Vite/TS/Tailwind, Supabase, Vercel`  [INFERRED]
  .context/lessons/ci-env-olmadan-test.md → README.md
- `CI workflow` --implements--> `INF-03 CI pipeline task`  [INFERRED]
  .github/workflows/ci.yml → docs/03-task-sheet.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Directive pipeline participants** — _claude_agents_cto, _claude_agents_architect, _claude_agents_cpo, _claude_agents_engineer, _claude_agents_reviewer, _claude_agents_qa [EXTRACTED 1.00]
- **Lessons on parallel/stacked branch integration** — _context_lessons_paralel_dal_entegrasyonu, _context_lessons_yigin_pr_base_tuzagi, _context_lessons_ci_env_olmadan_test [INFERRED 0.75]
- **Gamification spec across docs** — readme_gamification, readme_timer, readme_security_definer_rpcs, _context_design_stitch_prompt_gamification [INFERRED 0.75]
- **Sharing feature slices (#73, #74, #75, #78) stacked toward parent #26** — _context_directives_issue_73, _context_directives_issue_74, _context_directives_issue_75, _context_directives_issue_78, _context_directives_issue_73_sharing_feature_26 [EXTRACTED 1.00]
- **Celestial redesign foundation (tokens, typography, icons, shell, galaxy)** — _context_directives_tasarim_celestial_design_tokens, _context_directives_tasarim_celestial_typography_migration, _context_directives_tasarim_celestial_icon_component, _context_directives_tasarim_celestial_app_shell, _context_directives_tasarim_celestial_galaxy_layer [EXTRACTED 1.00]
- **Design-system hygiene issues (#55 icon scale, #56 text-3xs, #59 contrast)** — _context_directives_issue_55, _context_directives_issue_56, _context_directives_issue_59, _context_directives_tasarim_celestial [INFERRED 0.75]
- **Gamified progress loop (RPC, XP events, streak, badges)** — questlog_rpc_update_status, questlog_xp_events, questlog_streak_engine, questlog_badges [EXTRACTED 0.95]
- **CI quality gates** — _github_workflows_ci_build_job, _github_workflows_ci_db_job, _github_workflows_ci_e2e_job, _github_workflows_ci_verify_production_job [EXTRACTED 1.00]
- **Stitch mobile and web screen set** — docs_design_stitch_questlog_mobile_areas_life_realms_code, docs_design_stitch_questlog_mobile_progress_momentum_code, docs_design_stitch_questlog_mobile_project_detail_code, docs_design_stitch_questlog_mobile_quests_badges_code, docs_design_stitch_questlog_mobile_settings_global_code, docs_design_stitch_questlog_mobile_threads_stash_resume_code, docs_design_stitch_questlog_mobile_today_dashboard_code, docs_design_stitch_questlog_web_areas_life_buckets_code, docs_design_stitch_questlog_web_progress_momentum_code, docs_design_stitch_questlog_web_project_detail_code, docs_design_stitch_questlog_web_quests_gamification_code, docs_design_stitch_questlog_web_settings_global_quick_add_share_side_rail_code, docs_design_stitch_questlog_web_threads_untouched_resume_first_code, docs_design_stitch_questlog_web_today_dashboard_code [INFERRED 0.85]

## Communities (74 total, 26 thin omitted)

### Community 0 - "Shell Rail & Area Summaries"
Cohesion: 0.05
Nodes (84): InProgress(), SideNav(), Standing(), Chips(), levelProgress(), sharePercents(), sumSecondsByArea(), sumWeekSecondsByArea() (+76 more)

### Community 1 - "Directive Records (Issues)"
Cohesion: 0.05
Nodes (44): Directive template, Directive pipeline stages (triage, audit, clarify, plan, build, review, done), issue-44 Hanging threads tasks + digest, Migration hanging_threads_tasks_digest_status, issue-48 Timer heartbeat, Migration timer_heartbeat, issue-55 Icon size scale separate from typography, icon-sm/md/lg scale (+36 more)

### Community 2 - "Product Docs & Stitch Screens"
Cohesion: 0.06
Nodes (45): apps/web index.html (SPA entry), Business Analysis Document, Design & Technical Architecture, Detailed Task Sheet, Celestial Cartographer design system (DESIGN.md), Mobile Areas / Life Realms screen, Mobile Progress / Momentum screen, Mobile Project Detail screen (+37 more)

### Community 3 - "Edge Functions (Digest, Invite)"
Cohesion: 0.07
Nodes (32): body, admin, Recipient, sendOne(), DigestPayload, escape(), groupThreads(), renderDigest() (+24 more)

### Community 4 - "Crew Agents & Orchestration"
Cohesion: 0.10
Nodes (41): Architect (Cutler Beckett), CMO (Scrum), CPO (Elizabeth Swann), CTO (Barbossa), Designer (Tia Dalma), DevOps (Cotton), Engineer (Will Turner), Idea Planner (Carina Smyth) (+33 more)

### Community 5 - "Realtime Sync & Push Settings"
Cohesion: 0.08
Nodes (31): STALE_KEYS, staleKeys(), useRealtimeSync(), pushSupported(), subscribeToPush(), unsubscribeFromPush(), downloadJson(), ExportBundle (+23 more)

### Community 6 - "Bottom Sheet & Color Tests"
Cohesion: 0.07
Nodes (28): errorMarkers, sources, bodyLockStyle(), BottomSheetProps, FOCUSABLE, LOCK_KEYS, lockBody(), LockStyle (+20 more)

### Community 7 - "Timer Heartbeat & Pomodoro"
Cohesion: 0.11
Nodes (32): AutoStopped, autoStoppedMessage(), AwaitingPomodoro, Beat, HEARTBEAT_MS, HeartbeatOptions, resolvePomodoro(), ResolveResult (+24 more)

### Community 8 - "E2E Specs"
Cohesion: 0.05
Nodes (32): press(), AREAS, press(), devDependencies, eslint-config-prettier, @playwright/test, prettier, name (+24 more)

### Community 9 - "Sharing Membership RLS"
Cohesion: 0.08
Nodes (23): life_areas, area_members, area_members_user_idx, area_role(), life_areas_guard_owner_columns, project_members, project_members_user_idx, project_role() (+15 more)

### Community 10 - "Icons, Chips & Toast"
Cohesion: 0.12
Nodes (32): Icon(), ICON_PATHS, PATHS, ItemType, ItemTypeChip(), itemTypeLabel(), labels, StatusChip() (+24 more)

### Community 11 - "Area Queries & Status Feedback"
Cohesion: 0.11
Nodes (26): AreaSheetProps, areaKeys, useArchiveArea(), useAreaMutation(), useCreateArea(), useUpdateArea(), readable(), statusFeedback (+18 more)

### Community 12 - "Gamification & Focus SQL"
Cohesion: 0.12
Nodes (24): projects, tasks, xp_events, xp_events_user_area_idx, xp_events_user_created_idx, rpc_groom_stale(), rpc_pick_focus(), v_area_stats (+16 more)

### Community 13 - "Top Bar & Navigation"
Cohesion: 0.10
Nodes (26): Logo(), LogoMark(), NAV_ITEMS, NavItem, IS_MAC, Separator(), TopBar(), Whereabouts() (+18 more)

### Community 14 - "Card Primitives & Area Card"
Cohesion: 0.15
Nodes (22): Card(), CardProps, EmptyStateProps, ProgressBar(), CardSkeleton(), Skeleton(), AreaCard(), WeeklySplit() (+14 more)

### Community 15 - "CI, Backup & Deploy"
Cohesion: 0.09
Nodes (25): Backup workflow (nightly), CI workflow, CI build job, CI db job (supabase test db), CI e2e job (Playwright), CI verify-production job, Google Cloud Storage backup bucket, INF-03 CI pipeline task (+17 more)

### Community 16 - "Picker & Focus Sheets"
Cohesion: 0.12
Nodes (21): BottomSheet(), PickerList(), PickerListProps, PickerOption, PickerSheet(), PickerSheetProps, statusLabel(), styles (+13 more)

### Community 17 - "Project History Timeline"
Cohesion: 0.14
Nodes (20): ProjectXpEvent, HistoryTimeline(), LogBody(), ProgressLogWithNextTask, FOLD_WINDOW_MS, horizonOf(), projectTimeline(), time() (+12 more)

### Community 18 - "Time Tracking SQL"
Cohesion: 0.12
Nodes (17): daily_focus_seconds(), rpc_start_timer(), rpc_stop_timer(), time_entries, time_entries_one_running_per_user, time_entries_project_idx, time_entries_user_started_idx, v_running_timer (+9 more)

### Community 19 - "App Shell, Auth & Quick Add"
Cohesion: 0.18
Nodes (17): App(), AppShell(), useQuickAddShortcut(), AuthContext, AuthState, RequireAuth(), useAuth(), QuickAddSheet() (+9 more)

### Community 20 - "Threads Queries & Shell Context"
Cohesion: 0.15
Nodes (20): ShellContext, useShell(), EmptyState(), ALL_THREADS_LIMIT, fetchThreads(), HANGING_THREADS_LIMIT, SNOOZABLE_KEYS, SNOOZE_OPTIONS (+12 more)

### Community 21 - "Buttons, Fields & Project Sheet"
Cohesion: 0.16
Nodes (17): Button(), ButtonProps, compactFieldClass, fieldClass, rowFieldClass, ProjectSheetProps, ResumeCard(), ResumeCardProps (+9 more)

### Community 22 - "Project Queries"
Cohesion: 0.18
Nodes (20): projectKeys, toRow(), useCreateProject(), useMoveProject(), useOpenProjectCounts(), useProgressLogs(), useProjectMutation(), useProjectOptions() (+12 more)

### Community 23 - "Theme, Sentry & Bootstrap"
Cohesion: 0.16
Nodes (14): AuthProvider(), OPTIONS, Preview(), STARS, ThemePicker(), initSentry(), applyTheme(), isTheme() (+6 more)

### Community 24 - "Core Schema"
Cohesion: 0.15
Nodes (17): focus_items, focus_items_user_date_idx, handle_new_user(), life_areas_user_idx, on_auth_user_created, profiles_touch_updated_at, progress_logs, progress_logs_project_created_idx (+9 more)

### Community 25 - "Web Package & Vite Config"
Cohesion: 0.12
Nodes (17): name, private, type, version, autoprefixer, eslint, eslint-plugin-react-hooks, postcss (+9 more)

### Community 26 - "Dev Dependencies"
Cohesion: 0.11
Nodes (19): devDependencies, autoprefixer, eslint, eslint-plugin-react-hooks, postcss, tailwindcss, @types/canvas-confetti, @types/react (+11 more)

### Community 27 - "Task Ordering & Staleness"
Cohesion: 0.15
Nodes (14): DEFAULT_PREFS, compareTasks(), focusRank(), isOpen(), isStale(), matchesFilters(), partitionTasks(), PRIORITY_RANK (+6 more)

### Community 28 - "Task List Prefs & Filters"
Cohesion: 0.17
Nodes (14): clearedFilters(), isItemStatus(), parsePrefs(), pick(), storedPrefs(), TASK_VIEWS, TaskListPrefs, FILTER_STATUSES (+6 more)

### Community 29 - "TypeScript Config"
Cohesion: 0.11
Nodes (17): compilerOptions, isolatedModules, jsx, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+9 more)

### Community 30 - "Project Card Stats & Schemas"
Cohesion: 0.18
Nodes (11): projectCardView, aggregateProjectStats(), ProjectStats, AREA_COLORS, AREA_ICONS, areaSchema, profileSchema, ProgressLog (+3 more)

### Community 31 - "Timer Stack & Today Logic"
Cohesion: 0.20
Nodes (12): atTimerLimit(), MAX_RUNNING_TIMERS, runningOn(), TIMER_LIMIT_REASON, timerDeck(), clockOn(), focusLeadId(), isQuiet() (+4 more)

### Community 32 - "Task Item & Inline Edit"
Cohesion: 0.20
Nodes (12): EditableText(), EditableTextProps, BADGES, PriorityBadge(), TaskView, DifficultyLetter(), OpenButton(), TaskItem() (+4 more)

### Community 33 - "Realtime E2E Spec"
Cohesion: 0.16
Nodes (9): addTask(), env, Heard, ok(), project(), shareAsEditor(), signUp(), User (+1 more)

### Community 34 - "Status Picker & Task Sheet"
Cohesion: 0.18
Nodes (12): statusTone(), QUICK, StatusPicker(), StatusPickerProps, TaskSheetBase, TaskSheetProps, DIFFICULTIES, DIFFICULTY_LABELS (+4 more)

### Community 35 - "rpc_update_status, XP & Badges"
Cohesion: 0.18
Nodes (8): badges, streaks, user_badges, grant_badge(), rpc_update_status(), digest_payload(), v_hanging_threads, login()

### Community 36 - "Runtime Dependencies"
Cohesion: 0.17
Nodes (12): dependencies, canvas-confetti, @fontsource/inter, @hookform/resolvers, react, react-dom, react-hook-form, react-router-dom (+4 more)

### Community 37 - "Status Change & Landing Preview"
Cohesion: 0.31
Nodes (6): dropChange(), StatusChange, ItemStatus, AREAS, PreviewProject, PreviewTask

### Community 38 - "Digest & Running Timer Views"
Cohesion: 0.20
Nodes (6): profiles, digest_payload(), digest_recipients(), schedule_digest(), v_running_timer, v_running_timers

### Community 39 - "Project Ordering"
Cohesion: 0.28
Nodes (6): isOpen(), Orderable, orderProjects(), ids(), Row, OPEN_STATUSES

### Community 40 - "Service Worker TS Config"
Cohesion: 0.25
Nodes (7): compilerOptions, lib, types, exclude, extends, include, ./tsconfig.json

### Community 41 - "Untouched-First Touch Triggers"
Cohesion: 0.32
Nodes (6): life_areas_touch_updated_at, projects_touch_area, tasks_touch_project, time_entries_touch_item, touch_parent_area(), touch_parent_project()

### Community 42 - "NPM Scripts"
Cohesion: 0.29
Nodes (7): scripts, build, dev, lint, preview, test, typecheck

### Community 44 - "Push Notifications SQL"
Cohesion: 0.38
Nodes (4): push_recipients(), push_subscriptions, push_subscriptions_user_idx, schedule_push()

### Community 45 - "Vercel Config"
Cohesion: 0.29
Nodes (6): buildCommand, headers, installCommand, outputDirectory, rewrites, $schema

### Community 47 - "Digest SQL Tests"
Cohesion: 0.33
Nodes (5): busy, due_here, due_later, due_midday, held

### Community 48 - "Service Worker"
Cohesion: 0.40
Nodes (4): PushBody, workbox-precaching, workbox-routing, workbox-strategies

### Community 50 - "Status Changed Timestamp"
Cohesion: 0.60
Nodes (4): projects_stamp_status_changed_at, rpc_update_status(), stamp_status_changed_at(), tasks_stamp_status_changed_at

## Knowledge Gaps
- **44 isolated node(s):** `@types/canvas-confetti`, `@types/react`, `@types/react-dom`, `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser` (+39 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 402 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **26 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `Bottom Sheet & Color Tests` to `Shell Rail & Area Summaries`, `Edge Functions (Digest, Invite)`, `Realtime Sync & Push Settings`, `Status Change & Landing Preview`, `Project Ordering`, `Timer Heartbeat & Pomodoro`, `Icons, Chips & Toast`, `Area Queries & Status Feedback`, `Card Primitives & Area Card`, `Project History Timeline`, `Theme, Sentry & Bootstrap`, `Web Package & Vite Config`, `Task Ordering & Staleness`, `Project Card Stats & Schemas`, `Timer Stack & Today Logic`?**
  _High betweenness centrality (0.143) - this node is a cross-community bridge._
- **What connects `@types/canvas-confetti`, `@types/react`, `@types/react-dom` to the rest of the system?**
  _44 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Shell Rail & Area Summaries` be split into smaller, more focused modules?**
  _Cohesion score 0.051111111111111114 - nodes in this community are weakly interconnected._
- **Why does `apps/web index.html (SPA entry)` connect `Product Docs & Stitch Screens` to `Theme, Sentry & Bootstrap`?**
  _High betweenness centrality (0.054) - this node is a cross-community bridge._
- **Should `Directive Records (Issues)` be split into smaller, more focused modules?**
  _Cohesion score 0.050980392156862744 - nodes in this community are weakly interconnected._
- **Why does `@supabase/supabase-js` connect `Realtime E2E Spec` to `Web Package & Vite Config`, `App Shell, Auth & Quick Add`, `Realtime Sync & Push Settings`?**
  _High betweenness centrality (0.053) - this node is a cross-community bridge._
- **Should `Product Docs & Stitch Screens` be split into smaller, more focused modules?**
  _Cohesion score 0.06448979591836734 - nodes in this community are weakly interconnected._