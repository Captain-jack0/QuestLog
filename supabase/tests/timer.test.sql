-- TM-01 · One clock at a time, honest seconds, capped XP.
begin;
create extension if not exists pgtap with schema extensions;
set search_path to public, extensions;

select plan(12);

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

select * from finish();
rollback;
