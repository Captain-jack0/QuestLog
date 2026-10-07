-- Issue #42 · `updated_at` means "last touched", and a touch travels up: task -> project -> area.
--
-- The whole file is one transaction, so now() never moves. Rows created in here are born with
-- updated_at = now(), which would make "was touched" indistinguishable from "was never touched"
-- — so everything is backdated ten days first. After that a row reads exactly now() if a trigger
-- touched it, and exactly now() - 10 days if nothing did.
begin;
create extension if not exists pgtap with schema extensions;
set search_path to public, extensions;

select plan(35);

insert into auth.users (id, email) values
  ('44444444-4444-4444-4444-444444444444', 'owner@example.com'),
  ('55555555-5555-5555-5555-555555555555', 'stranger@example.com');

create function login(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;

select login('44444444-4444-4444-4444-444444444444');

-- One chain per scenario (a = area, b = project, c = task; the digit names the chain), so no
-- assertion can pass on a touch left behind by an earlier one. b6 and b0 have no area.
insert into life_areas (id, user_id, name) values
  ('dddd0000-0000-0000-0000-0000000000a1', '44444444-4444-4444-4444-444444444444', 'Edit a task'),
  ('dddd0000-0000-0000-0000-0000000000a2', '44444444-4444-4444-4444-444444444444', 'Status RPC'),
  ('dddd0000-0000-0000-0000-0000000000a3', '44444444-4444-4444-4444-444444444444', 'Edit a project'),
  ('dddd0000-0000-0000-0000-0000000000a4', '44444444-4444-4444-4444-444444444444', 'Add a task'),
  ('dddd0000-0000-0000-0000-0000000000a5', '44444444-4444-4444-4444-444444444444', 'Add a project'),
  ('dddd0000-0000-0000-0000-0000000000a7', '44444444-4444-4444-4444-444444444444', 'Focus session'),
  ('dddd0000-0000-0000-0000-0000000000a8', '44444444-4444-4444-4444-444444444444', 'Edit an area'),
  ('dddd0000-0000-0000-0000-0000000000a9', '44444444-4444-4444-4444-444444444444', 'Left alone'),
  ('dddd0000-0000-0000-0000-0000000000aa', '44444444-4444-4444-4444-444444444444', 'Snooze a task'),
  ('dddd0000-0000-0000-0000-0000000000ab', '44444444-4444-4444-4444-444444444444', 'Snooze a project');
insert into projects (id, user_id, area_id, title) values
  ('dddd0000-0000-0000-0000-0000000000b1', '44444444-4444-4444-4444-444444444444',
   'dddd0000-0000-0000-0000-0000000000a1', 'Edit a task'),
  ('dddd0000-0000-0000-0000-0000000000b2', '44444444-4444-4444-4444-444444444444',
   'dddd0000-0000-0000-0000-0000000000a2', 'Status RPC'),
  ('dddd0000-0000-0000-0000-0000000000b3', '44444444-4444-4444-4444-444444444444',
   'dddd0000-0000-0000-0000-0000000000a3', 'Edit a project'),
  ('dddd0000-0000-0000-0000-0000000000b4', '44444444-4444-4444-4444-444444444444',
   'dddd0000-0000-0000-0000-0000000000a4', 'Add a task'),
  ('dddd0000-0000-0000-0000-0000000000b6', '44444444-4444-4444-4444-444444444444',
   null, 'No area'),
  ('dddd0000-0000-0000-0000-0000000000b7', '44444444-4444-4444-4444-444444444444',
   'dddd0000-0000-0000-0000-0000000000a7', 'Focus session'),
  ('dddd0000-0000-0000-0000-0000000000b9', '44444444-4444-4444-4444-444444444444',
   'dddd0000-0000-0000-0000-0000000000a9', 'Left alone'),
  ('dddd0000-0000-0000-0000-0000000000b0', '44444444-4444-4444-4444-444444444444',
   null, 'Project-only session'),
  ('dddd0000-0000-0000-0000-0000000000ba', '44444444-4444-4444-4444-444444444444',
   'dddd0000-0000-0000-0000-0000000000aa', 'Snooze a task'),
  ('dddd0000-0000-0000-0000-0000000000bb', '44444444-4444-4444-4444-444444444444',
   'dddd0000-0000-0000-0000-0000000000ab', 'Snooze a project');
insert into tasks (id, user_id, project_id, title) values
  ('dddd0000-0000-0000-0000-0000000000c1', '44444444-4444-4444-4444-444444444444',
   'dddd0000-0000-0000-0000-0000000000b1', 'Edit me'),
  ('dddd0000-0000-0000-0000-0000000000c2', '44444444-4444-4444-4444-444444444444',
   'dddd0000-0000-0000-0000-0000000000b2', 'Start me'),
  ('dddd0000-0000-0000-0000-0000000000c6', '44444444-4444-4444-4444-444444444444',
   'dddd0000-0000-0000-0000-0000000000b6', 'Edit me, no area'),
  ('dddd0000-0000-0000-0000-0000000000c7', '44444444-4444-4444-4444-444444444444',
   'dddd0000-0000-0000-0000-0000000000b7', 'Clock me'),
  ('dddd0000-0000-0000-0000-0000000000c9', '44444444-4444-4444-4444-444444444444',
   'dddd0000-0000-0000-0000-0000000000b9', 'Leave me alone'),
  ('dddd0000-0000-0000-0000-0000000000ca', '44444444-4444-4444-4444-444444444444',
   'dddd0000-0000-0000-0000-0000000000ba', 'Snooze me');

-- Every user trigger off while backdating: the touch triggers would stamp now() over it, and
-- the propagation triggers would undo it one level up. Foreign key triggers are not user
-- triggers and stay on.
reset role;
alter table tasks disable trigger user;
alter table projects disable trigger user;
alter table life_areas disable trigger user;
update tasks set updated_at = now() - interval '10 days'
 where user_id = '44444444-4444-4444-4444-444444444444';
update projects set updated_at = now() - interval '10 days'
 where user_id = '44444444-4444-4444-4444-444444444444';
update life_areas set updated_at = now() - interval '10 days'
 where user_id = '44444444-4444-4444-4444-444444444444';
alter table tasks enable trigger user;
alter table projects enable trigger user;
alter table life_areas enable trigger user;
select login('44444444-4444-4444-4444-444444444444');

-- ---- the functions run with the caller's rights ---------------------------------------
-- A second lock, not the one that matters: it keeps a direct write filtered by the parent's RLS
-- policy. What actually keeps a touch inside one account is the ownership condition in each
-- UPDATE, and the stranger block at the bottom is its test.
select is(
  (select count(*)::int from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname in ('touch_parent_project', 'touch_parent_area', 'touch_timed_item')
      and not prosecdef),
  3,
  'the three propagation functions are security invoker');

-- ---- editing a task: the owner's own write, under RLS -----------------------------------
update tasks set title = 'Edited' where id = 'dddd0000-0000-0000-0000-0000000000c1';

select is((select updated_at from tasks where id = 'dddd0000-0000-0000-0000-0000000000c1'),
          now(), 'an edited task is touched');
select is((select updated_at from projects where id = 'dddd0000-0000-0000-0000-0000000000b1'),
          now(), 'editing a task touches its project');
select is((select updated_at from life_areas where id = 'dddd0000-0000-0000-0000-0000000000a1'),
          now(), 'and, through the project, its area');
select is((select updated_at from projects where id = 'dddd0000-0000-0000-0000-0000000000b2'),
          now() - interval '10 days', 'a project whose tasks were left alone keeps its place');
select is((select updated_at from life_areas where id = 'dddd0000-0000-0000-0000-0000000000a2'),
          now() - interval '10 days', 'and so does its area');

-- ---- a status change: the same write from inside a security definer RPC -----------------
-- `do`, not a bare select: the call must not print a row into the TAP stream.
do $$ begin perform rpc_update_status('task', 'dddd0000-0000-0000-0000-0000000000c2',
     'in_progress', 'nothing yet', 'get going'); end $$;

select is((select updated_at from projects where id = 'dddd0000-0000-0000-0000-0000000000b2'),
          now(), 'a status change through the RPC touches the project');
select is((select updated_at from life_areas where id = 'dddd0000-0000-0000-0000-0000000000a2'),
          now(), 'and its area');

-- ---- editing a project ------------------------------------------------------------------
update projects set title = 'Edited' where id = 'dddd0000-0000-0000-0000-0000000000b3';

select is((select updated_at from life_areas where id = 'dddd0000-0000-0000-0000-0000000000a3'),
          now(), 'editing a project touches its area');

-- ---- adding rows ------------------------------------------------------------------------
insert into tasks (user_id, project_id, title)
values ('44444444-4444-4444-4444-444444444444', 'dddd0000-0000-0000-0000-0000000000b4', 'New');

select is((select updated_at from projects where id = 'dddd0000-0000-0000-0000-0000000000b4'),
          now(), 'a new task touches its project');
select is((select updated_at from life_areas where id = 'dddd0000-0000-0000-0000-0000000000a4'),
          now(), 'and its area');

insert into projects (user_id, area_id, title)
values ('44444444-4444-4444-4444-444444444444', 'dddd0000-0000-0000-0000-0000000000a5', 'New');

select is((select updated_at from life_areas where id = 'dddd0000-0000-0000-0000-0000000000a5'),
          now(), 'a new project touches its area');

-- ---- a project without an area ----------------------------------------------------------
select lives_ok(
  $$update tasks set title = 'Edited' where id = 'dddd0000-0000-0000-0000-0000000000c6'$$,
  'a task whose project has no area still saves');
select is((select updated_at from projects where id = 'dddd0000-0000-0000-0000-0000000000b6'),
          now(), 'and still touches the project');

-- ---- editing an area --------------------------------------------------------------------
update life_areas set name = 'Edited' where id = 'dddd0000-0000-0000-0000-0000000000a8';

select is((select updated_at from life_areas where id = 'dddd0000-0000-0000-0000-0000000000a8'),
          now(), 'an edited area is touched');

-- ---- a finished focus session -----------------------------------------------------------
-- authenticated may only select time_entries (time_tracking.sql:29), so the running entry is
-- seeded as the table owner, the way timer.test.sql does it.
reset role;
insert into time_entries (user_id, project_id, task_id, started_at)
values ('44444444-4444-4444-4444-444444444444', 'dddd0000-0000-0000-0000-0000000000b7',
        'dddd0000-0000-0000-0000-0000000000c7', now() - interval '30 minutes');
select login('44444444-4444-4444-4444-444444444444');

select ok((rpc_stop_timer() ->> 'seconds')::int >= 60,
          'a half-hour session is kept, not discarded');
select is((select updated_at from tasks where id = 'dddd0000-0000-0000-0000-0000000000c7'),
          now(), 'a finished focus session touches the task it was clocked against');
select is((select updated_at from projects where id = 'dddd0000-0000-0000-0000-0000000000b7'),
          now(), 'which touches the project');
select is((select updated_at from life_areas where id = 'dddd0000-0000-0000-0000-0000000000a7'),
          now(), 'which touches the area');

reset role;
insert into time_entries (user_id, project_id, started_at)
values ('44444444-4444-4444-4444-444444444444', 'dddd0000-0000-0000-0000-0000000000b0',
        now() - interval '30 minutes');
select login('44444444-4444-4444-4444-444444444444');

do $$ begin perform rpc_stop_timer(); end $$;

select is((select updated_at from projects where id = 'dddd0000-0000-0000-0000-0000000000b0'),
          now(), 'a session clocked against a project alone touches the project');

-- A session under a minute is deleted, not ended (time_tracking.sql:116-119): a mis-tap must
-- not send the task to the bottom of its list.
do $$ begin
  perform rpc_start_timer('task', 'dddd0000-0000-0000-0000-0000000000c9');
  perform rpc_stop_timer();
end $$;

select is((select updated_at from tasks where id = 'dddd0000-0000-0000-0000-0000000000c9'),
          now() - interval '10 days', 'a discarded mis-tap touches nothing');

-- Deleting a task detaches its time entries (`on delete set null`), which is an UPDATE of
-- time_entries too. It is not a session ending, and a delete is not a touch.
reset role;
insert into time_entries (user_id, project_id, task_id, started_at, ended_at, seconds)
values ('44444444-4444-4444-4444-444444444444', 'dddd0000-0000-0000-0000-0000000000b9',
        'dddd0000-0000-0000-0000-0000000000c9', now() - interval '2 hours',
        now() - interval '1 hour', 3600);
select login('44444444-4444-4444-4444-444444444444');

delete from tasks where id = 'dddd0000-0000-0000-0000-0000000000c9';

select is((select updated_at from projects where id = 'dddd0000-0000-0000-0000-0000000000b9'),
          now() - interval '10 days',
          'deleting a task with clocked time is not a focus session on its project');

-- ---- snoozing is not a touch (20261007120000_snooze_is_not_a_touch.sql) -------------------
-- "Stop nagging me" is the opposite of having worked on it: the item, its project and its area
-- all keep their place in the lists.
do $$ begin perform rpc_snooze('task', 'dddd0000-0000-0000-0000-0000000000ca', current_date + 7); end $$;

select is((select snoozed_until from tasks where id = 'dddd0000-0000-0000-0000-0000000000ca'),
          current_date + 7, 'the snooze itself lands');
select is((select updated_at from tasks where id = 'dddd0000-0000-0000-0000-0000000000ca'),
          now() - interval '10 days', 'a snoozed task keeps its place');
select is((select updated_at from projects where id = 'dddd0000-0000-0000-0000-0000000000ba'),
          now() - interval '10 days', 'and so does its project');
select is((select updated_at from life_areas where id = 'dddd0000-0000-0000-0000-0000000000aa'),
          now() - interval '10 days', 'and its area');

do $$ begin perform rpc_snooze('project', 'dddd0000-0000-0000-0000-0000000000bb', current_date + 7); end $$;

select is((select updated_at from projects where id = 'dddd0000-0000-0000-0000-0000000000bb'),
          now() - interval '10 days', 'a snoozed project keeps its place');
select is((select updated_at from life_areas where id = 'dddd0000-0000-0000-0000-0000000000ab'),
          now() - interval '10 days', 'and so does its area');

-- The flag rpc_snooze raises is lowered again before it returns. This file is one transaction,
-- so a flag left up here would silence every touch below — and in production, every statement
-- that shares the transaction.
update tasks set title = 'Edited' where id = 'dddd0000-0000-0000-0000-0000000000ca';

select is((select updated_at from tasks where id = 'dddd0000-0000-0000-0000-0000000000ca'),
          now(), 'the next write after a snooze is a touch again');

-- rpc_snooze reads row_count to tell "not yours / not there" apart from success; the set_config
-- calls around its UPDATE must not get between the two.
select throws_ok(
  $$select rpc_snooze('task', 'dddd0000-0000-0000-0000-0000000000ff', current_date + 7)$$,
  'P0002', 'item not found', 'snoozing a task that is not there still fails');

-- ---- somebody else's write cannot reach up ------------------------------------------------
-- The foreign keys are checked past RLS, so a stranger *can* point a task of their own at a
-- project they cannot see, and a project of their own at an area they cannot see.
select login('55555555-5555-5555-5555-555555555555');
insert into tasks (id, user_id, project_id, title)
values ('dddd0000-0000-0000-0000-0000000000f9', '55555555-5555-5555-5555-555555555555',
        'dddd0000-0000-0000-0000-0000000000b9', 'Planted task');
select login('44444444-4444-4444-4444-444444444444');

select is((select updated_at from projects where id = 'dddd0000-0000-0000-0000-0000000000b9'),
          now() - interval '10 days', 'a stranger''s task does not touch a project they do not own');

-- The direct write above is stopped twice over (the project's RLS policy would filter it too).
-- Inside a security definer RPC there is no RLS left to lean on: the UPDATE runs as the function
-- owner and so do the triggers. Only the ownership condition stands between the stranger's own
-- rows and the owner's project and area.
select login('55555555-5555-5555-5555-555555555555');
insert into projects (id, user_id, area_id, title)
values ('dddd0000-0000-0000-0000-0000000000f8', '55555555-5555-5555-5555-555555555555',
        'dddd0000-0000-0000-0000-0000000000a9', 'Planted project');
do $$ begin
  perform rpc_snooze('task', 'dddd0000-0000-0000-0000-0000000000f9', current_date + 7);
  perform rpc_snooze('project', 'dddd0000-0000-0000-0000-0000000000f8', current_date + 7);
end $$;
select login('44444444-4444-4444-4444-444444444444');

select is((select updated_at from projects where id = 'dddd0000-0000-0000-0000-0000000000b9'),
          now() - interval '10 days',
          'nor does it through a security definer RPC, where RLS does not apply');
select is((select updated_at from life_areas where id = 'dddd0000-0000-0000-0000-0000000000a9'),
          now() - interval '10 days',
          'and a stranger''s project cannot touch an area they do not own that way either');

-- rpc_snooze no longer touches anything for anyone, so the two asserts above would pass without
-- the ownership condition. An edit is a touch on every path: this is the one that still proves
-- the condition is what stops a planted task from reaching up.
select login('55555555-5555-5555-5555-555555555555');
update tasks set title = 'Edited' where id = 'dddd0000-0000-0000-0000-0000000000f9';

select is((select updated_at from tasks where id = 'dddd0000-0000-0000-0000-0000000000f9'),
          now(), 'the stranger''s own planted task is touched');
select login('44444444-4444-4444-4444-444444444444');

select is((select updated_at from projects where id = 'dddd0000-0000-0000-0000-0000000000b9'),
          now() - interval '10 days',
          'but editing it cannot touch the project it was planted under');

select * from finish();
rollback;
