-- TM-01 · Up to three clocks at once (issue #45), honest seconds, capped XP.
begin;
create extension if not exists pgtap with schema extensions;
set search_path to public, extensions;

select plan(48);

insert into auth.users (id, email) values
  ('88888888-8888-8888-8888-888888888888', 'timer@example.com'),
  ('99999999-9999-9999-9999-999999999999', 'other@example.com');

create function login(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;

-- The second user's own project, for the per-user checks further down. Seeded as the owner:
-- nothing here is under test.
insert into projects (id, user_id, title)
values ('bbbb0000-0000-0000-0000-000000000099', '99999999-9999-9999-9999-999999999999', 'Theirs');

select login('88888888-8888-8888-8888-888888888888');

insert into life_areas (id, user_id, name)
values ('bbbb0000-0000-0000-0000-000000000001', '88888888-8888-8888-8888-888888888888', 'Work');
insert into projects (id, user_id, area_id, title)
values ('bbbb0000-0000-0000-0000-000000000002', '88888888-8888-8888-8888-888888888888',
        'bbbb0000-0000-0000-0000-000000000001', 'Ship it');
insert into tasks (id, user_id, project_id, title) values
  ('bbbb0000-0000-0000-0000-000000000003', '88888888-8888-8888-8888-888888888888',
   'bbbb0000-0000-0000-0000-000000000002', 'Write the timer'),
  ('bbbb0000-0000-0000-0000-000000000004', '88888888-8888-8888-8888-888888888888',
   'bbbb0000-0000-0000-0000-000000000002', 'Write the tests'),
  ('bbbb0000-0000-0000-0000-00000000000a', '88888888-8888-8888-8888-888888888888',
   'bbbb0000-0000-0000-0000-000000000002', 'One too many');

-- ---- starting ---------------------------------------------------------------------
select ok(
  (rpc_start_timer('task', 'bbbb0000-0000-0000-0000-000000000003') ->> 'id') is not null,
  'starting a timer returns the entry');

select is((select count(*)::int from time_entries where ended_at is null), 1,
          'exactly one timer is running');

select is((select task_id from v_running_timer), 'bbbb0000-0000-0000-0000-000000000003'::uuid,
          'the running timer view names the task');

-- starting a second one runs it next to the first (issue #45)
select ok(
  (rpc_start_timer('task', 'bbbb0000-0000-0000-0000-000000000004', 'pomodoro') ->> 'id') is not null,
  'a second start is allowed');

select is((select count(*)::int from time_entries where ended_at is null), 2,
          'and the first clock keeps running next to it');

select throws_ok(
  $$select rpc_start_timer('task', 'bbbb0000-0000-0000-0000-000000000003')$$,
  '23505', 'a timer is already running on this item',
  'the same task cannot get a second clock');

select ok(
  (rpc_start_timer('project', 'bbbb0000-0000-0000-0000-000000000002') ->> 'id') is not null,
  'a project clock runs next to clocks on its own tasks');

select throws_ok(
  $$select rpc_start_timer('project', 'bbbb0000-0000-0000-0000-000000000002')$$,
  '23505', 'a timer is already running on this item',
  'the same project cannot get a second project-level clock');

select throws_ok(
  $$select rpc_start_timer('task', 'bbbb0000-0000-0000-0000-00000000000a')$$,
  '54000', 'Up to 3 timers can run at once — stop one first',
  'a fourth clock is refused');

select is((select count(*)::int from v_running_timers), 3,
          'v_running_timers lists every running clock');

select is(
  (select array_agg(mode order by mode) from v_running_timers),
  array['pomodoro', 'timer', 'timer'], 'each clock keeps its own mode');

-- The task index holds even for a writer that skips the RPC's own check. (The project half has
-- no index on purpose — see the migration header and the task delete at the end of this file.)
reset role;
select throws_ok(
  $$insert into time_entries (user_id, project_id, task_id)
    values ('88888888-8888-8888-8888-888888888888', 'bbbb0000-0000-0000-0000-000000000002',
            'bbbb0000-0000-0000-0000-000000000003')$$,
  '23505', null, 'the database itself refuses a second open entry on a task');

-- An entry id the second user cannot read, kept aside for the stop below.
select set_config('test.foreign_entry',
  (select id::text from time_entries where task_id = 'bbbb0000-0000-0000-0000-000000000003'),
  true);

-- Both RPCs run as their owner, past RLS, so the next two are their own `user_id = v_user` at
-- work. The limit is per user: another account's clocks do not count against this one.
select login('99999999-9999-9999-9999-999999999999');
select ok(
  (rpc_start_timer('project', 'bbbb0000-0000-0000-0000-000000000099') ->> 'id') is not null,
  'a second user can start a clock while the first runs three');

select is(
  (rpc_stop_timer(current_setting('test.foreign_entry')::uuid) ->> 'stopped')::boolean,
  false, 'a stop naming another user''s entry stops nothing');

reset role;
select is((select count(*)::int from time_entries
            where user_id = '88888888-8888-8888-8888-888888888888' and ended_at is null), 3,
          'and the first user''s three clocks still run');
delete from time_entries where user_id = '99999999-9999-9999-9999-999999999999';

-- Staggered start times, so "newest" means something inside one transaction.
update time_entries set started_at = now() - interval '30 seconds'
 where task_id = 'bbbb0000-0000-0000-0000-000000000003';
update time_entries set started_at = now() - interval '20 seconds'
 where task_id = 'bbbb0000-0000-0000-0000-000000000004';
update time_entries set started_at = now() - interval '10 seconds'
 where task_id is null and ended_at is null;

select login('88888888-8888-8888-8888-888888888888');

-- ---- the old view, for clients that predate issue #45 -------------------------------
select is(
  array(select attname::text from pg_attribute
         where attrelid = 'public.v_running_timer'::regclass and attnum > 0 order by attnum),
  array['id', 'user_id', 'started_at', 'mode', 'project_id', 'task_id', 'project_title',
        'task_title', 'area_color', 'project_seconds_today', 'project_seconds_total'],
  'v_running_timer keeps its columns and their order');

select is((select count(*)::int from v_running_timer), 1,
          'v_running_timer still answers with one row, so maybeSingle() keeps working');

select is((select task_id from v_running_timer), null::uuid,
          'and that row is the newest clock');

select throws_ok(
  $$select rpc_start_timer('task', 'bbbb0000-0000-0000-0000-000000000009')$$,
  'P0002', 'item not found', 'a timer cannot be started on somebody else''s item');

-- ---- stopping: short sessions are mis-taps ------------------------------------------
select is(
  (rpc_stop_timer((select id from v_running_timers
                    where task_id = 'bbbb0000-0000-0000-0000-000000000004')) ->> 'discarded')::boolean,
  true, 'a session under a minute is thrown away, not logged');

select is(
  (select array_agg(task_id::text order by task_id) from v_running_timers),
  array['bbbb0000-0000-0000-0000-000000000003', null],
  'stopping one clock by id leaves the others running');

select is((rpc_stop_timer() ->> 'stopped')::boolean, true,
          'a stop without an id still stops something');

select is((select task_id from v_running_timers), 'bbbb0000-0000-0000-0000-000000000003'::uuid,
          'and what it stops is the newest clock');

do $$ begin perform rpc_stop_timer(); end $$;

select is((select count(*)::int from time_entries), 0, 'and mis-taps leave no row behind');

-- ---- stopping: a real session pays -------------------------------------------------
reset role;
insert into time_entries (user_id, project_id, task_id, started_at)
values ('88888888-8888-8888-8888-888888888888', 'bbbb0000-0000-0000-0000-000000000002',
        'bbbb0000-0000-0000-0000-000000000003', now() - interval '52 minutes');
select login('88888888-8888-8888-8888-888888888888');

select is((rpc_stop_timer() ->> 'xp_awarded')::int, 20,
          'two completed 25-minute blocks pay 20 XP');

select ok(
  (select seconds from time_entries order by created_at desc limit 1) between 3100 and 3200,
  'the stored duration matches the wall clock');

-- ---- the daily cap ------------------------------------------------------------------
-- Two long sessions running side by side: each pays on its own, the day's cap covers both.
reset role;
insert into time_entries (user_id, project_id, started_at)
values ('88888888-8888-8888-8888-888888888888', 'bbbb0000-0000-0000-0000-000000000002',
        now() - interval '5 hours');
insert into time_entries (user_id, project_id, task_id, started_at)
values ('88888888-8888-8888-8888-888888888888', 'bbbb0000-0000-0000-0000-000000000002',
        'bbbb0000-0000-0000-0000-000000000004', now() - interval '6 hours');
select login('88888888-8888-8888-8888-888888888888');

select is((rpc_stop_timer() ->> 'xp_awarded')::int, 40,
          'the day tops out at 60 XP of focus time');

select is((rpc_stop_timer() ->> 'xp_awarded')::int, 0,
          'and a second clock stopped the same day pays nothing past it');

select is(
  (select coalesce(sum(xp), 0)::int from xp_events
    where user_id = '88888888-8888-8888-8888-888888888888' and action_type = 'focus_time'),
  60, 'and the total never passes the cap');

-- ---- nested totals: a task's clock also counts on its project (issue #46) --------------
reset role;

-- The option itself, read from the catalogue. `create or replace view` replaces a view's
-- options with the ones in the new statement, so a migration that forgets to restate this one
-- silently turns the view into a way around RLS. The behaviour is asserted further down too.
select ok(
  (select reloptions @> array['security_invoker=true'] from pg_class
    where oid = 'public.v_running_timer'::regclass),
  'v_running_timer is still security_invoker after being replaced');

select ok(
  (select reloptions @> array['security_invoker=true'] from pg_class
    where oid = 'public.v_running_timers'::regclass),
  'v_running_timers is security_invoker');

-- UTC+14 and no DST: far enough from UTC that a view reading the UTC date instead of the
-- profile's would get one of the two midnight rows below wrong at any hour this runs.
update profiles set timezone = 'Pacific/Kiritimati'
 where id = '88888888-8888-8888-8888-888888888888';

-- A second project, so the totals here cannot be propped up by the sessions logged above.
insert into projects (id, user_id, area_id, title)
values ('bbbb0000-0000-0000-0000-000000000005', '88888888-8888-8888-8888-888888888888',
        'bbbb0000-0000-0000-0000-000000000001', 'Side quest');
insert into tasks (id, user_id, project_id, title) values
  ('bbbb0000-0000-0000-0000-000000000006', '88888888-8888-8888-8888-888888888888',
   'bbbb0000-0000-0000-0000-000000000005', 'Doomed task'),
  ('bbbb0000-0000-0000-0000-000000000007', '88888888-8888-8888-8888-888888888888',
   'bbbb0000-0000-0000-0000-000000000005', 'Kept task'),
  ('bbbb0000-0000-0000-0000-000000000008', '88888888-8888-8888-8888-888888888888',
   'bbbb0000-0000-0000-0000-000000000005', 'Next task');

insert into time_entries (user_id, project_id, task_id, started_at, ended_at, seconds) values
  -- today, on a task
  ('88888888-8888-8888-8888-888888888888', 'bbbb0000-0000-0000-0000-000000000005',
   'bbbb0000-0000-0000-0000-000000000006', now(), now(), 600),
  -- today by an instant, on the project alone: the user's local midnight
  ('88888888-8888-8888-8888-888888888888', 'bbbb0000-0000-0000-0000-000000000005', null,
   date_trunc('day', now() at time zone 'Pacific/Kiritimati') at time zone 'Pacific/Kiritimati',
   now(), 300),
  -- yesterday by a second
  ('88888888-8888-8888-8888-888888888888', 'bbbb0000-0000-0000-0000-000000000005',
   'bbbb0000-0000-0000-0000-000000000007',
   (date_trunc('day', now() at time zone 'Pacific/Kiritimati') at time zone 'Pacific/Kiritimati')
     - interval '1 second',
   now(), 1200),
  -- another account's seconds filed under this project. Nothing in the app can write this
  -- row, which is the point: the total must not count it whoever is reading.
  ('99999999-9999-9999-9999-999999999999', 'bbbb0000-0000-0000-0000-000000000005', null,
   now(), now(), 7000);

select login('88888888-8888-8888-8888-888888888888');

select ok(
  (rpc_start_timer('task', 'bbbb0000-0000-0000-0000-000000000007') ->> 'id') is not null,
  'a timer starts on a task of the second project');

select is((select project_seconds_total from v_running_timer), 2100,
          'the project total banks finished task and project sessions, not the running one');

select is((select project_seconds_today from v_running_timer), 900,
          'today is the user''s local day: local midnight counts, the second before does not');

-- Deleting a task nulls `task_id` on its entries (history_retention.test.sql); the seconds
-- were clocked on the project either way.
delete from tasks where id = 'bbbb0000-0000-0000-0000-000000000006';

select is((select project_seconds_total from v_running_timer), 2100,
          'deleting a task leaves its seconds in the project total');

-- The owner of the table is not filtered by RLS, so this is the sub-query's own filter at work.
reset role;
select is(
  (select project_seconds_total from v_running_timer
    where user_id = '88888888-8888-8888-8888-888888888888'),
  2100, 'another account''s seconds stay out even for a reader RLS does not filter');

-- And the views themselves still answer to RLS: with the first user's clock running, a second
-- user gets no row — no timer, no titles, no totals.
select login('99999999-9999-9999-9999-999999999999');
select is((select count(*)::int from v_running_timer), 0,
          'a second user sees neither the running timer nor its project totals');
select is((select count(*)::int from v_running_timers), 0,
          'nor any row of v_running_timers');

-- Ten minutes into the session, the user stops it and moves to another task of the project.
reset role;
update time_entries set started_at = now() - interval '10 minutes'
 where user_id = '88888888-8888-8888-8888-888888888888' and ended_at is null;
select login('88888888-8888-8888-8888-888888888888');

do $$ begin perform rpc_stop_timer(); end $$;

select is(
  (rpc_start_timer('task', 'bbbb0000-0000-0000-0000-000000000008') ->> 'task_id')::uuid,
  'bbbb0000-0000-0000-0000-000000000008'::uuid,
  'the next task of the same project gets a clock');

select is((select project_seconds_total from v_running_timer), 2700,
          'and the session just stopped is folded into the project total, which carries on');

-- A clock on another project runs alongside; each row carries its own project's total.
select is(
  rpc_start_timer('project', 'bbbb0000-0000-0000-0000-000000000002') ->> 'task_id',
  null, 'a project-level timer carries no task');

select is(
  (select project_seconds_total from v_running_timers
    where project_id = 'bbbb0000-0000-0000-0000-000000000002'),
  (select sum(seconds)::int from time_entries
    where project_id = 'bbbb0000-0000-0000-0000-000000000002' and ended_at is not null),
  'a timer on another project reports that project''s banked seconds');

select is(
  (select project_seconds_total from v_running_timers
    where project_id = 'bbbb0000-0000-0000-0000-000000000005'),
  2700, 'while the clock already running keeps its own project''s total');

-- ---- deleting a task whose clock runs next to its project's own --------------------------
-- `on delete set null` turns the task's open entry into a second project-level one. A unique
-- index on open project-level entries would refuse that and take the delete down with it.
select ok(
  (rpc_start_timer('task', 'bbbb0000-0000-0000-0000-00000000000a') ->> 'id') is not null,
  'a task clock starts while its project''s own clock runs');

reset role;
select lives_ok(
  $$delete from tasks where id = 'bbbb0000-0000-0000-0000-00000000000a'$$,
  'the task can still be deleted with both clocks open');

select is(
  (select count(*)::int from time_entries
    where project_id = 'bbbb0000-0000-0000-0000-000000000002' and task_id is null
      and ended_at is null),
  2, 'and its clock carries on, filed under the project');

-- ---- one user's starts and stops take turns ---------------------------------------------
-- The count of three and the "already running on this item" check only hold if two calls
-- cannot read the table at the same time; nothing above can race, so the lock is read back
-- from the catalogue. Drop it and these go red.
select ok(
  pg_get_functiondef('rpc_start_timer(text,uuid,text)'::regprocedure) ~ 'pg_advisory_xact_lock',
  'rpc_start_timer takes the per-user advisory lock');

select ok(
  pg_get_functiondef('rpc_stop_timer(uuid)'::regprocedure) ~ 'pg_advisory_xact_lock',
  'rpc_stop_timer takes the same lock');

select * from finish();
rollback;
