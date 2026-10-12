-- TM-02 · A timer nobody is watching stops where they left it (issue #48).
begin;
create extension if not exists pgtap with schema extensions;
set search_path to public, extensions;

select plan(24);

insert into auth.users (id, email) values
  ('48484848-0000-0000-0000-000000000001', 'beat@example.com'),
  ('48484848-0000-0000-0000-000000000002', 'stranger@example.com');

create function login(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;

insert into projects (id, user_id, title) values
  ('48480000-0000-0000-0000-000000000001', '48484848-0000-0000-0000-000000000001', 'Mine'),
  ('48480000-0000-0000-0000-000000000002', '48484848-0000-0000-0000-000000000002', 'Theirs');
insert into tasks (id, user_id, project_id, title) values
  ('48480000-0000-0000-0000-00000000000a', '48484848-0000-0000-0000-000000000001',
   '48480000-0000-0000-0000-000000000001', 'Left open'),
  ('48480000-0000-0000-0000-00000000000b', '48484848-0000-0000-0000-000000000001',
   '48480000-0000-0000-0000-000000000001', 'Forgotten');

-- ---- the heartbeat -------------------------------------------------------------------
select login('48484848-0000-0000-0000-000000000001');
select ok((rpc_start_timer('task', '48480000-0000-0000-0000-00000000000a') ->> 'id') is not null,
          'a timer starts');

reset role;
select is((select last_seen_at from time_entries where user_id = '48484848-0000-0000-0000-000000000001'),
          null, 'a fresh entry has not been seen yet, so an old client''s clock keeps running');

-- The stranger runs a clock of their own and beats.
insert into time_entries (user_id, project_id, started_at) values
  ('48484848-0000-0000-0000-000000000002', '48480000-0000-0000-0000-000000000002',
   now() - interval '1 hour');

select login('48484848-0000-0000-0000-000000000002');
select is(rpc_timer_heartbeat() ->> 'auto_stopped', '[]', 'a beat with nothing expired stops nothing');

reset role;
select is((select last_seen_at from time_entries where user_id = '48484848-0000-0000-0000-000000000001'),
          null, 'another user''s beat does not reach this user''s entry');
select is((select last_seen_at from time_entries where user_id = '48484848-0000-0000-0000-000000000002'),
          now(), 'the beat marks the caller''s own clock as seen');

select login('48484848-0000-0000-0000-000000000001');
do $$ begin perform rpc_timer_heartbeat(); end $$;
reset role;
select is((select last_seen_at from time_entries where user_id = '48484848-0000-0000-0000-000000000001'),
          now(), 'and the owner''s beat marks theirs');

-- ---- a heartbeat older than 5 minutes ends the entry at that beat ---------------------
-- 90 minutes in, last seen 60 minutes ago: 30 minutes of work, one 25-minute block.
update time_entries set started_at = now() - interval '90 minutes',
                        last_seen_at = now() - interval '60 minutes'
 where user_id = '48484848-0000-0000-0000-000000000001';
select set_config('test.stale',
  (select id::text from time_entries where user_id = '48484848-0000-0000-0000-000000000001'), true);

select login('48484848-0000-0000-0000-000000000001');
select is((select count(*)::int from v_running_timers), 0, 'the expired clock is gone from v_running_timers');
select is((select count(*)::int from v_running_timer), 0, 'and from v_running_timer');

select is(
  rpc_stop_timer(current_setting('test.stale')::uuid)::jsonb - 'id',
  '{"stopped": true, "seconds": 1800, "xp_awarded": 10, "daily_cap_reached": false}'::jsonb,
  'stopping it pays the 30 minutes up to the last beat, not the 90 up to now');

reset role;
select is((select ended_at from time_entries where id = current_setting('test.stale')::uuid),
          now() - interval '60 minutes', 'and the entry ends at its last beat');

-- A beat four minutes old is still a live clock.
insert into time_entries (user_id, project_id, task_id, started_at, last_seen_at) values
  ('48484848-0000-0000-0000-000000000001', '48480000-0000-0000-0000-000000000001',
   '48480000-0000-0000-0000-00000000000a', now() - interval '10 minutes', now() - interval '4 minutes');
select login('48484848-0000-0000-0000-000000000001');
select is((select count(*)::int from v_running_timers), 1, 'a beat under 5 minutes old keeps the clock on screen');
select is((rpc_stop_timer() ->> 'seconds')::int, 600, 'and a stop pays it up to now');

-- ---- the 12-hour cap -------------------------------------------------------------------
-- Never beaten (an old client), started 14 hours ago.
reset role;
insert into time_entries (user_id, project_id, task_id, started_at) values
  ('48484848-0000-0000-0000-000000000001', '48480000-0000-0000-0000-000000000001',
   '48480000-0000-0000-0000-00000000000b', now() - interval '14 hours');
select login('48484848-0000-0000-0000-000000000001');
select is((select count(*)::int from v_running_timers), 0, 'a session past 12 hours is off screen');

select is(
  (rpc_timer_heartbeat() -> 'auto_stopped' -> 0)::jsonb - 'id',
  '{"stopped": true, "seconds": 43200, "xp_awarded": 50, "daily_cap_reached": true}'::jsonb,
  'the next beat closes it at 12 hours, says so, and pays what is left of the daily cap');

reset role;
select is((select ended_at - started_at from time_entries
            where task_id = '48480000-0000-0000-0000-00000000000b'),
          interval '12 hours', 'the stored session is exactly 12 hours');
select is((select coalesce(sum(xp), 0)::int from xp_events
            where user_id = '48484848-0000-0000-0000-000000000001' and action_type = 'focus_time'),
          60, 'the XP written is that of the shortened sessions');

-- A never-beaten clock under 12 hours is the old behaviour: it runs.
insert into time_entries (user_id, project_id, started_at) values
  ('48484848-0000-0000-0000-000000000001', '48480000-0000-0000-0000-000000000001',
   now() - interval '11 hours');
select login('48484848-0000-0000-0000-000000000001');
select is((select count(*)::int from v_running_timers), 1, 'a never-beaten clock under 12 hours still runs');
reset role;
delete from time_entries where ended_at is null and user_id = '48484848-0000-0000-0000-000000000001';

-- ---- an expired clock does not hold its item ------------------------------------------
insert into time_entries (user_id, project_id, task_id, started_at, last_seen_at) values
  ('48484848-0000-0000-0000-000000000001', '48480000-0000-0000-0000-000000000001',
   '48480000-0000-0000-0000-00000000000a', now() - interval '20 minutes', now() - interval '19 minutes');
select login('48484848-0000-0000-0000-000000000001');
select lives_ok($$select rpc_start_timer('task', '48480000-0000-0000-0000-00000000000a')$$,
                'a task whose clock expired can be clocked again');
reset role;
select is((select count(*)::int from time_entries
            where task_id = '48480000-0000-0000-0000-00000000000a' and ended_at is null), 1,
          'with the expired entry closed first');

-- ---- a client that beats starts its entry seen -------------------------------------------
select login('48484848-0000-0000-0000-000000000001');
select set_config('test.beating',
  rpc_start_timer('task', '48480000-0000-0000-0000-00000000000b', 'timer', p_beats => true) ->> 'id', true);
reset role;
select is((select last_seen_at from time_entries where id = current_setting('test.beating')::uuid),
          now(), 'p_beats => true starts the entry with last_seen_at = now()');
select is((select count(*)::int from pg_proc where proname = 'rpc_start_timer'), 1,
          'rpc_start_timer has one signature, so a three-argument call is not ambiguous');

-- ---- the plumbing ---------------------------------------------------------------------
select ok(not has_function_privilege('authenticated', 'stop_expired_timers(uuid)', 'execute'),
          'a signed-in user cannot sweep somebody else''s timers');
select ok(not has_function_privilege('authenticated', 'finish_time_entry(uuid, time_entries, timestamptz)', 'execute'),
          'nor finish somebody else''s entry');
select ok(
  (select reloptions @> array['security_invoker=true'] from pg_class
    where oid = 'public.v_running_timers'::regclass),
  'v_running_timers is still security_invoker after being replaced');

select * from finish();
rollback;
