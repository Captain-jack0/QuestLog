-- TM-01 · One clock at a time, honest seconds, capped XP.
begin;
create extension if not exists pgtap with schema extensions;
set search_path to public, extensions;

select plan(23);

insert into auth.users (id, email) values
  ('88888888-8888-8888-8888-888888888888', 'timer@example.com');

create function login(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;

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
   'bbbb0000-0000-0000-0000-000000000002', 'Write the tests');

-- ---- starting ---------------------------------------------------------------------
select ok(
  (rpc_start_timer('task', 'bbbb0000-0000-0000-0000-000000000003') ->> 'id') is not null,
  'starting a timer returns the entry');

select is((select count(*)::int from time_entries where ended_at is null), 1,
          'exactly one timer is running');

select is((select task_id from v_running_timer), 'bbbb0000-0000-0000-0000-000000000003'::uuid,
          'the running timer view names the task');

-- starting a second one replaces the first rather than running two clocks
select ok(
  (rpc_start_timer('task', 'bbbb0000-0000-0000-0000-000000000004') ->> 'id') is not null,
  'a second start is allowed');

select is((select count(*)::int from time_entries where ended_at is null), 1,
          'starting again leaves only one clock running');

select throws_ok(
  $$select rpc_start_timer('task', 'bbbb0000-0000-0000-0000-000000000009')$$,
  'P0002', 'item not found', 'a timer cannot be started on somebody else''s item');

-- ---- stopping: short sessions are mis-taps ------------------------------------------
select is((rpc_stop_timer() ->> 'discarded')::boolean, true,
          'a session under a minute is thrown away, not logged');

select is((select count(*)::int from time_entries), 0, 'and it leaves no row behind');

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
reset role;
insert into time_entries (user_id, project_id, started_at)
values ('88888888-8888-8888-8888-888888888888', 'bbbb0000-0000-0000-0000-000000000002',
        now() - interval '5 hours');
select login('88888888-8888-8888-8888-888888888888');

select is((rpc_stop_timer() ->> 'xp_awarded')::int, 40,
          'the day tops out at 60 XP of focus time');

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

insert into auth.users (id, email) values
  ('99999999-9999-9999-9999-999999999999', 'other@example.com');

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

-- And the view itself still answers to RLS: with the first user's clock running, a second
-- user gets no row — no timer, no titles, no totals.
select login('99999999-9999-9999-9999-999999999999');
select is((select count(*)::int from v_running_timer), 0,
          'a second user sees neither the running timer nor its project totals');

-- Ten minutes into the session, the user moves to another task of the same project.
reset role;
update time_entries set started_at = now() - interval '10 minutes'
 where user_id = '88888888-8888-8888-8888-888888888888' and ended_at is null;
select login('88888888-8888-8888-8888-888888888888');

select is(
  (rpc_start_timer('task', 'bbbb0000-0000-0000-0000-000000000008') ->> 'task_id')::uuid,
  'bbbb0000-0000-0000-0000-000000000008'::uuid,
  'the clock moves to another task of the same project');

select is((select project_seconds_total from v_running_timer), 2700,
          'and the session it stopped is folded into the project total, which carries on');

-- A different project: the total is that project's, not a carry-over from the last one.
select is(
  rpc_start_timer('project', 'bbbb0000-0000-0000-0000-000000000002') ->> 'task_id',
  null, 'a project-level timer carries no task');

select is(
  (select project_seconds_total from v_running_timer),
  (select sum(seconds)::int from time_entries
    where project_id = 'bbbb0000-0000-0000-0000-000000000002' and ended_at is not null),
  'a timer on another project reports that project''s banked seconds');

select * from finish();
rollback;
