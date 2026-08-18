-- BE-03 · Gamification schema (docs/01 §8)

create table xp_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  action_type text not null,
  xp int not null check (xp > 0),
  area_id uuid references life_areas on delete set null,
  project_id uuid references projects on delete set null,
  task_id uuid references tasks on delete set null,
  created_at timestamptz not null default clock_timestamp()
);

create table streaks (
  user_id uuid primary key references auth.users on delete cascade,
  current int not null default 0,
  best int not null default 0,
  last_active_date date,
  freeze_tokens int not null default 0 check (freeze_tokens between 0 and 2)
);

create table badges (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text not null,
  icon text not null
);

create table user_badges (
  user_id uuid not null references auth.users on delete cascade,
  badge_id uuid not null references badges on delete cascade,
  earned_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);

create index xp_events_user_created_idx on xp_events (user_id, created_at desc);
create index xp_events_user_area_idx on xp_events (user_id, area_id);

alter table xp_events enable row level security;
alter table streaks enable row level security;
alter table badges enable row level security;
alter table user_badges enable row level security;

-- XP, streaks and badges are read-only for clients: they are written by the security-definer
-- RPCs in BE-04/BE-05, so nobody can mint their own XP.
create policy xp_events_select_own on xp_events for select to authenticated using (auth.uid() = user_id);
create policy streaks_select_own on streaks for select to authenticated using (auth.uid() = user_id);
create policy user_badges_select_own on user_badges for select to authenticated using (auth.uid() = user_id);

-- the badge catalogue is the same for everyone
create policy badges_select_all on badges for select to authenticated using (true);

grant select on xp_events, streaks, user_badges, badges to authenticated;

/*
 * Level curve: XP needed to reach level n = round(100 * n^1.5), level 1 = 0.
 * Mirrored on the client in apps/web/src/lib/xp.ts (kept in sync by its unit tests).
 *
 *   lvl  1:      0     lvl  6:  1_470     lvl 11:  3_648     lvl 16:  6_400
 *   lvl  2:    283     lvl  7:  1_852     lvl 12:  4_157     lvl 17:  7_009
 *   lvl  3:    520     lvl  8:  2_263     lvl 13:  4_687     lvl 18:  7_637
 *   lvl  4:    800     lvl  9:  2_700     lvl 14:  5_238     lvl 19:  8_282
 *   lvl  5:  1_118     lvl 10:  3_162     lvl 15:  5_809     lvl 20:  8_944
 */
create function level_for_xp(total_xp int) returns int
language sql immutable as $$
  -- ponytail: capped at level 200 (~282k XP); raise the bound if anyone ever gets near it.
  select coalesce(max(n), 1)
  from generate_series(1, 200) as n
  where (case when n = 1 then 0 else round(100 * power(n, 1.5)) end) <= greatest(coalesce(total_xp, 0), 0);
$$;

-- The launch badge set (docs/01 §8). Lives in the migration so cloud deploys get it too;
-- supabase/seed.sql is for local sample data only.
insert into badges (code, name, description, icon) values
  ('first_quest',    'First Quest',    'Complete your first task.',                        '🗡️'),
  ('threadkeeper',   'Threadkeeper',   'Write 10 progress logs.',                          '🧵'),
  ('week_one',       'Week One',       'Keep a 7-day streak.',                             '🔥'),
  ('fortnight',      'Fortnight',      'Keep a 14-day streak.',                            '🌙'),
  ('monthly_legend', 'Monthly Legend', 'Keep a 30-day streak.',                            '👑'),
  ('finisher',       'Finisher',       'Complete your first project.',                     '🏁'),
  ('renaissance',    'Renaissance',    'Be active in 4+ life areas within one week.',      '🎨'),
  ('necromancer',    'Necromancer',    'Revive an item that was paused for over 30 days.', '🪄'),
  ('honest_quitter', 'Honest Quitter', 'Consciously drop something for the first time.',    '🕊️'),
  ('level_10',       'Level 10',       'Reach level 10.',                                  '⭐')
on conflict (code) do nothing;
