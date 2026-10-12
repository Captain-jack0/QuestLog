-- TM-03 · A pomodoro whose beats stopped waits for the user's answer (issue #48, decision D).
begin;
create extension if not exists pgtap with schema extensions;
set search_path to public, extensions;

select plan(36);

insert into auth.users (id, email) values
  ('4848d000-0000-0000-0000-000000000001', 'tomato@example.com'),
  ('4848d000-0000-0000-0000-000000000002', 'stranger@example.com');

create function login(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;

insert into projects (id, user_id, title) values
  ('4848d000-0000-0000-0001-000000000001', '4848d000-0000-0000-0000-000000000001', 'Novel');
insert into tasks (id, user_id, project_id, title)
select ('4848d000-0000-0000-0002-00000000000' || n)::uuid, '4848d000-0000-0000-0000-000000000001',
       '4848d000-0000-0000-0001-000000000001', t
  from (values (1, 'Chapter'), (2, 'Inbox'), (3, 'Fresh'), (4, 'Retry'), (5, 'Edit'), (6, 'Cap'))
       as v(n, t);

-- ---- a waiting pomodoro survives the sweeps; a stale timer does not --------------------
insert into time_entries (id, user_id, project_id, task_id, mode, started_at, last_seen_at) values
  ('4848d000-0000-0000-0003-000000000001', '4848d000-0000-0000-0000-000000000001',
   '4848d000-0000-0000-0001-000000000001', '4848d000-0000-0000-0002-000000000001', 'pomodoro',
   now() - interval '40 minutes', now() - interval '30 minutes'),
  ('4848d000-0000-0000-0003-000000000002', '4848d000-0000-0000-0000-000000000001',
   '4848d000-0000-0000-0001-000000000001', '4848d000-0000-0000-0002-000000000002', 'timer',
   now() - interval '20 minutes', now() - interval '15 minutes');

select login('4848d000-0000-0000-0000-000000000001');
select set_config('test.beat', rpc_timer_heartbeat()::text, true);
select is(current_setting('test.beat')::jsonb #>> '{auto_stopped,0,id}',
          '4848d000-0000-0000-0003-000000000002', 'the beat still closes a stale timer');
select is(jsonb_array_length(current_setting('test.beat')::jsonb -> 'auto_stopped'), 1,
          'and only the timer');
select is(current_setting('test.beat')::jsonb #>> '{needs_confirm,0,id}',
          '4848d000-0000-0000-0003-000000000001', 'the stale pomodoro is listed to be asked about');
select is(current_setting('test.beat')::jsonb #>> '{needs_confirm,0,task_title}', 'Chapter',
          'with its task''s name');

reset role;
select is((select (ended_at, last_seen_at)::text from time_entries
            where id = '4848d000-0000-0000-0003-000000000001'),
          (null::timestamptz, now() - interval '30 minutes')::text,
          'it stays open, and the beat did not count as a yes');

select login('4848d000-0000-0000-0000-000000000001');
select is((select count(*)::int from v_running_timers), 0, 'it is off screen while it waits');

select set_config('test.fresh',
  rpc_start_timer('task', '4848d000-0000-0000-0002-000000000003', 'timer', p_beats => true) ->> 'id', true);
do $$ begin perform rpc_stop_timer(current_setting('test.fresh')::uuid); end $$;
reset role;
select is((select ended_at from time_entries where id = '4848d000-0000-0000-0003-000000000001'),
          null, 'a start and a stop elsewhere leave it waiting');

-- ---- only its owner can answer ---------------------------------------------------------
select login('4848d000-0000-0000-0000-000000000002');
select throws_ok($$select rpc_resolve_pomodoro('4848d000-0000-0000-0003-000000000001', false)$$,
                 'P0002', 'pomodoro not found', 'nobody else can answer for it');
reset role;
select is((select (ended_at, last_seen_at)::text from time_entries
            where id = '4848d000-0000-0000-0003-000000000001'),
          (null::timestamptz, now() - interval '30 minutes')::text, 'and their try changed nothing');

-- ---- yes: it kept going ------------------------------------------------------------------
select login('4848d000-0000-0000-0000-000000000001');
select is(rpc_resolve_pomodoro('4848d000-0000-0000-0003-000000000001', true)::jsonb,
          '{"id": "4848d000-0000-0000-0003-000000000001", "resolved": true, "continued": true}'::jsonb,
          'yes keeps it running');
select is((select count(*)::int from v_running_timers), 1, 'back on screen');
select is(rpc_stop_timer('4848d000-0000-0000-0003-000000000001')::jsonb - 'id',
          '{"stopped": true, "seconds": 2400, "xp_awarded": 10, "daily_cap_reached": false}'::jsonb,
          'and its stop pays all 40 minutes, the locked ones included');

-- ---- no: it ended at the last beat -------------------------------------------------------
reset role;
insert into time_entries (id, user_id, project_id, task_id, mode, started_at, last_seen_at) values
  ('4848d000-0000-0000-0003-000000000003', '4848d000-0000-0000-0000-000000000001',
   '4848d000-0000-0000-0001-000000000001', '4848d000-0000-0000-0002-000000000005', 'pomodoro',
   now() - interval '60 minutes', now() - interval '25 minutes');
select login('4848d000-0000-0000-0000-000000000001');
select is(rpc_resolve_pomodoro('4848d000-0000-0000-0003-000000000003', false)::jsonb - 'id',
          '{"stopped": true, "seconds": 2100, "xp_awarded": 10, "daily_cap_reached": false,
            "resolved": true, "continued": false}'::jsonb,
          'no pays the 35 minutes up to the last beat');
reset role;
select is((select ended_at from time_entries where id = '4848d000-0000-0000-0003-000000000003'),
          now() - interval '25 minutes', 'and ends it there');
select login('4848d000-0000-0000-0000-000000000001');
select throws_ok($$select rpc_resolve_pomodoro('4848d000-0000-0000-0003-000000000003', true)$$,
                 'P0002', 'pomodoro not found', 'an ended pomodoro cannot be answered again');

-- ---- a pomodoro still beating is not asked about ---------------------------------------
reset role;
insert into time_entries (id, user_id, project_id, task_id, mode, started_at, last_seen_at) values
  ('4848d000-0000-0000-0003-000000000004', '4848d000-0000-0000-0000-000000000001',
   '4848d000-0000-0000-0001-000000000001', '4848d000-0000-0000-0002-000000000004', 'pomodoro',
   now() - interval '30 minutes', now() - interval '1 minute');
select login('4848d000-0000-0000-0000-000000000001');
select is(rpc_resolve_pomodoro('4848d000-0000-0000-0003-000000000004', false)::jsonb,
          '{"id": "4848d000-0000-0000-0003-000000000004", "resolved": false}'::jsonb,
          'a stray answer for a live pomodoro does nothing');
reset role;
select is((select ended_at from time_entries where id = '4848d000-0000-0000-0003-000000000004'),
          null, 'it keeps running');

-- ---- a waiting pomodoro does not lock the user out --------------------------------------
update time_entries set last_seen_at = now() - interval '20 minutes'
 where id = '4848d000-0000-0000-0003-000000000004';
select login('4848d000-0000-0000-0000-000000000001');
select lives_ok($$select rpc_start_timer('task', '4848d000-0000-0000-0002-000000000004', 'pomodoro', p_beats => true)$$,
                'its item can be clocked again');
reset role;
select is((select ended_at from time_entries where id = '4848d000-0000-0000-0003-000000000004'),
          now() - interval '20 minutes', 'which answers no for it: ended at its last beat');

-- Two live clocks (the new pomodoro on Retry and a timer on Inbox) plus a waiting one.
insert into time_entries (id, user_id, project_id, task_id, mode, started_at, last_seen_at) values
  ('4848d000-0000-0000-0003-000000000005', '4848d000-0000-0000-0000-000000000001',
   '4848d000-0000-0000-0001-000000000001', '4848d000-0000-0000-0002-000000000001', 'pomodoro',
   now() - interval '50 minutes', now() - interval '45 minutes'),
  ('4848d000-0000-0000-0003-000000000006', '4848d000-0000-0000-0000-000000000001',
   '4848d000-0000-0000-0001-000000000001', '4848d000-0000-0000-0002-000000000002', 'timer',
   now() - interval '2 minutes', now());
select login('4848d000-0000-0000-0000-000000000001');
select lives_ok($$select rpc_start_timer('task', '4848d000-0000-0000-0002-000000000003')$$,
                'nor hold one of the three slots');
reset role;
select is((select ended_at from time_entries where id = '4848d000-0000-0000-0003-000000000005'),
          now() - interval '45 minutes', 'the waiting one gives its slot up at its last beat');
delete from time_entries where ended_at is null and user_id = '4848d000-0000-0000-0000-000000000001';

-- ---- a stop (sign-out) ends a waiting pomodoro at its last beat --------------------------
insert into time_entries (id, user_id, project_id, task_id, mode, started_at, last_seen_at) values
  ('4848d000-0000-0000-0003-000000000007', '4848d000-0000-0000-0000-000000000001',
   '4848d000-0000-0000-0001-000000000001', '4848d000-0000-0000-0002-000000000001', 'pomodoro',
   now() - interval '40 minutes', now() - interval '20 minutes');
select login('4848d000-0000-0000-0000-000000000001');
select is((rpc_stop_timer('4848d000-0000-0000-0003-000000000007') ->> 'seconds')::int, 1200,
          'stopping a waiting pomodoro pays up to its last beat, not up to now');

-- ---- unanswered for 12 hours, it ends at its last beat -----------------------------------
reset role;
insert into time_entries (id, user_id, project_id, task_id, mode, started_at, last_seen_at) values
  ('4848d000-0000-0000-0003-000000000008', '4848d000-0000-0000-0000-000000000001',
   '4848d000-0000-0000-0001-000000000001', '4848d000-0000-0000-0002-000000000006', 'pomodoro',
   now() - interval '13 hours', now() - interval '10 hours');
select login('4848d000-0000-0000-0000-000000000001');
select set_config('test.beat', rpc_timer_heartbeat()::text, true);
select is((current_setting('test.beat')::jsonb -> 'auto_stopped' -> 0) - 'id',
          '{"stopped": true, "seconds": 10800, "xp_awarded": 40, "daily_cap_reached": true}'::jsonb,
          'past the cap the beat closes it at its last beat, three hours in, within the daily XP cap');
select is(current_setting('test.beat')::jsonb -> 'needs_confirm', '[]'::jsonb, 'and asks nothing');
reset role;
select is((select ended_at from time_entries where id = '4848d000-0000-0000-0003-000000000008'),
          now() - interval '10 hours', 'the stored end is the last beat');
select is((select coalesce(sum(xp), 0)::int from xp_events
            where user_id = '4848d000-0000-0000-0000-000000000001' and action_type = 'focus_time'),
          60, 'XP was written through finish_time_entry, daily cap and all');

-- ---- a member who loses the project no longer learns its names (#74) ---------------------
insert into projects (id, user_id, title) values
  ('4848d000-0000-0000-0001-000000000002', '4848d000-0000-0000-0000-000000000002', 'Shared secret');
insert into tasks (id, user_id, project_id, title) values
  ('4848d000-0000-0000-0002-000000000007', '4848d000-0000-0000-0000-000000000002',
   '4848d000-0000-0000-0001-000000000002', 'Secret task');
insert into project_members (project_id, user_id, role, joined_at) values
  ('4848d000-0000-0000-0001-000000000002', '4848d000-0000-0000-0000-000000000001', 'editor', '2026-01-01');

select login('4848d000-0000-0000-0000-000000000001');
select set_config('test.shared',
  rpc_start_timer('task', '4848d000-0000-0000-0002-000000000007', 'pomodoro', p_beats => true) ->> 'id', true);
reset role;
update time_entries set started_at = now() - interval '10 minutes', last_seen_at = now() - interval '6 minutes'
 where id = current_setting('test.shared')::uuid;

select login('4848d000-0000-0000-0000-000000000001');
select is(rpc_timer_heartbeat()::jsonb #>> '{needs_confirm,0,project_title}', 'Shared secret',
          'a member is asked about it by name');

reset role;
delete from project_members
 where project_id = '4848d000-0000-0000-0001-000000000002'
   and user_id = '4848d000-0000-0000-0000-000000000001';
select login('4848d000-0000-0000-0000-000000000001');
select set_config('test.beat', rpc_timer_heartbeat()::text, true);
select is(current_setting('test.beat')::jsonb #>> '{needs_confirm,0,id}', current_setting('test.shared'),
          'once removed, the pomodoro is still theirs to answer');
select is(current_setting('test.beat')::jsonb #> '{needs_confirm,0,project_title}', 'null'::jsonb,
          'but without the project''s name');
select is(current_setting('test.beat')::jsonb #> '{needs_confirm,0,task_title}', 'null'::jsonb,
          'or the task''s');

-- ---- a stop without an id takes the newest clock on screen, not a waiting pomodoro --------
-- The waiting pomodoro above started 10 minutes ago; this live timer 20.
reset role;
insert into time_entries (user_id, project_id, task_id, started_at, last_seen_at) values
  ('4848d000-0000-0000-0000-000000000001', '4848d000-0000-0000-0001-000000000001',
   '4848d000-0000-0000-0002-000000000001', now() - interval '20 minutes', now());
select login('4848d000-0000-0000-0000-000000000001');
select is((rpc_stop_timer() ->> 'seconds')::int, 1200, 'a stop without an id stops the live timer');
reset role;
select is((select ended_at from time_entries where id = current_setting('test.shared')::uuid), null,
          'and leaves the newer, waiting pomodoro to its answer');

-- ---- the plumbing ---------------------------------------------------------------------
select is((select (prosecdef, proconfig)::text from pg_proc where proname = 'rpc_resolve_pomodoro'),
          (true, array['search_path=public'])::text,
          'rpc_resolve_pomodoro is security definer with a fixed search_path');
select ok(has_function_privilege('authenticated', 'rpc_resolve_pomodoro(uuid, boolean)', 'execute'),
          'a signed-in user may answer');
select set_config('request.jwt.claims', '', true);
select throws_ok($$select rpc_resolve_pomodoro('4848d000-0000-0000-0003-000000000001', true)$$,
                 '28000', 'not authenticated', 'nobody signed out can');
select login('4848d000-0000-0000-0000-000000000001');
select throws_ok($$select rpc_resolve_pomodoro('4848d000-0000-0000-0003-000000000001', null)$$,
                 '22023', 'p_continued must be true or false', 'a missing answer is refused');

select * from finish();
rollback;
