-- Issue #74 · Sharing 2/6: security definer RPCs, touch triggers and personal views are role-aware.
-- Cast: owner O, admin A, editor E, viewer V (members of O's three projects and area), stranger S,
-- and R, a former member (no membership row) who still has a focus row and a running timer.
--
-- Everything is backdated 30 days first, so a row reads now() only if this file touched it.
begin;
create extension if not exists pgtap with schema extensions;
set search_path to public, extensions;

select plan(78);

insert into auth.users (id, email) values
  ('e0000000-0000-0000-0000-000000000001', 'owner@example.com'),
  ('e0000000-0000-0000-0000-000000000002', 'admin@example.com'),
  ('e0000000-0000-0000-0000-000000000003', 'editor@example.com'),
  ('e0000000-0000-0000-0000-000000000004', 'viewer@example.com'),
  ('e0000000-0000-0000-0000-000000000005', 'stranger@example.com'),
  ('e0000000-0000-0000-0000-000000000006', 'former@example.com');

create function login(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;

-- Read past RLS, so an assertion measures the data and not the caller's view of it.
create function updated(p_id uuid) returns timestamptz
language sql security definer set search_path = public as $$
  select coalesce((select updated_at from tasks where id = p_id),
                  (select updated_at from projects where id = p_id));
$$;
create function xp_count(p_user uuid, p_action text) returns int
language sql security definer set search_path = public as $$
  select count(*)::int from xp_events where user_id = p_user and action_type = p_action;
$$;
-- Every row an RPC could write, folded into one value.
create function state_of() returns text
language sql security definer set search_path = public as $$
  select md5(
    coalesce((select string_agg(concat_ws('|', id, status, updated_at, snoozed_until, completed_at), ',' order by id) from tasks), '')
    || coalesce((select string_agg(concat_ws('|', id, status, updated_at, snoozed_until, completed_at), ',' order by id) from projects), '')
    || (select count(*) from time_entries) || '|' || (select count(*) from xp_events)
    || '|' || (select count(*) from progress_logs) || '|' || (select count(*) from focus_items));
$$;

-- ---- seed (as postgres, past RLS; nothing here is under test) ---------------------------
insert into life_areas (id, user_id, name) values
  ('f0000000-0000-0000-0000-0000000000a1', 'e0000000-0000-0000-0000-000000000001', 'Work');
insert into projects (id, user_id, area_id, title, status) values
  ('f0000000-0000-0000-0000-0000000000b1', 'e0000000-0000-0000-0000-000000000001',
   'f0000000-0000-0000-0000-0000000000a1', 'Shared', 'in_progress'),
  ('f0000000-0000-0000-0000-0000000000b2', 'e0000000-0000-0000-0000-000000000001',
   'f0000000-0000-0000-0000-0000000000a1', 'Admin closes', 'in_progress'),
  ('f0000000-0000-0000-0000-0000000000b3', 'e0000000-0000-0000-0000-000000000001',
   'f0000000-0000-0000-0000-0000000000a1', 'Snooze and clock', 'in_progress'),
  ('f0000000-0000-0000-0000-0000000000b4', 'e0000000-0000-0000-0000-000000000001',
   null, 'Former member''s clock', 'planned'),
  ('f0000000-0000-0000-0000-0000000000b5', 'e0000000-0000-0000-0000-000000000001',
   null, 'E only reads', 'planned'),
  ('f0000000-0000-0000-0000-0000000000b9', 'e0000000-0000-0000-0000-000000000005',
   null, 'Stranger''s', 'in_progress');
insert into tasks (id, user_id, project_id, title, status) values
  ('f0000000-0000-0000-0000-0000000000c1', 'e0000000-0000-0000-0000-000000000001',
   'f0000000-0000-0000-0000-0000000000b1', 'Finish me', 'in_progress'),
  ('f0000000-0000-0000-0000-0000000000c2', 'e0000000-0000-0000-0000-000000000001',
   'f0000000-0000-0000-0000-0000000000b1', 'Next step', 'in_progress'),
  ('f0000000-0000-0000-0000-0000000000c3', 'e0000000-0000-0000-0000-000000000001',
   'f0000000-0000-0000-0000-0000000000b1', 'Clocked by E', 'in_progress'),
  ('f0000000-0000-0000-0000-0000000000ce', 'e0000000-0000-0000-0000-000000000003',
   'f0000000-0000-0000-0000-0000000000b1', 'E''s task', 'in_progress'),
  ('f0000000-0000-0000-0000-0000000000cf', 'e0000000-0000-0000-0000-000000000003',
   'f0000000-0000-0000-0000-0000000000b1', 'Snoozed by O', 'in_progress'),
  ('f0000000-0000-0000-0000-0000000000c9', 'e0000000-0000-0000-0000-000000000005',
   'f0000000-0000-0000-0000-0000000000b9', 'Stranger''s task', 'in_progress'),
  ('f0000000-0000-0000-0000-0000000000c4', 'e0000000-0000-0000-0000-000000000006',
   'f0000000-0000-0000-0000-0000000000b4', 'Former member''s secret', 'in_progress'),
  ('f0000000-0000-0000-0000-0000000000c5', 'e0000000-0000-0000-0000-000000000001',
   'f0000000-0000-0000-0000-0000000000b5', 'Read-only target', 'idea');
insert into project_members (project_id, user_id, role, joined_at)
select p, u, r::member_role, '2026-01-01'
  from unnest(array['f0000000-0000-0000-0000-0000000000b1', 'f0000000-0000-0000-0000-0000000000b2',
                    'f0000000-0000-0000-0000-0000000000b3']::uuid[]) p,
       (values ('e0000000-0000-0000-0000-000000000002'::uuid, 'admin'),
               ('e0000000-0000-0000-0000-000000000003'::uuid, 'editor'),
               ('e0000000-0000-0000-0000-000000000004'::uuid, 'viewer')) m(u, r);
insert into project_members (project_id, user_id, role, joined_at) values
  ('f0000000-0000-0000-0000-0000000000b5', 'e0000000-0000-0000-0000-000000000003', 'viewer', '2026-01-01');
insert into area_members (area_id, user_id, role, joined_at) values
  ('f0000000-0000-0000-0000-0000000000a1', 'e0000000-0000-0000-0000-000000000002', 'admin',  '2026-01-01'),
  ('f0000000-0000-0000-0000-0000000000a1', 'e0000000-0000-0000-0000-000000000003', 'editor', '2026-01-01'),
  ('f0000000-0000-0000-0000-0000000000a1', 'e0000000-0000-0000-0000-000000000004', 'viewer', '2026-01-01');
insert into progress_logs (user_id, project_id, task_id, left_off) values
  ('e0000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-0000000000b1',
   'f0000000-0000-0000-0000-0000000000ce', 'E logged this');
insert into time_entries (id, user_id, project_id, task_id, started_at) values
  ('f0000000-0000-0000-0000-0000000000e1', 'e0000000-0000-0000-0000-000000000001',
   'f0000000-0000-0000-0000-0000000000b1', 'f0000000-0000-0000-0000-0000000000c1', now() - interval '10 minutes'),
  ('f0000000-0000-0000-0000-0000000000e2', 'e0000000-0000-0000-0000-000000000003',
   'f0000000-0000-0000-0000-0000000000b1', 'f0000000-0000-0000-0000-0000000000c3', now() - interval '30 minutes'),
  ('f0000000-0000-0000-0000-0000000000e3', 'e0000000-0000-0000-0000-000000000003',
   'f0000000-0000-0000-0000-0000000000b3', null, now() - interval '30 minutes'),
  ('f0000000-0000-0000-0000-0000000000e4', 'e0000000-0000-0000-0000-000000000006',
   'f0000000-0000-0000-0000-0000000000b1', 'f0000000-0000-0000-0000-0000000000c2', now() - interval '30 minutes'),
  ('f0000000-0000-0000-0000-0000000000e5', 'e0000000-0000-0000-0000-000000000006',
   'f0000000-0000-0000-0000-0000000000b4', null, now() - interval '30 minutes');
insert into focus_items (user_id, date, task_id, project_id) values
  ('e0000000-0000-0000-0000-000000000006', (now() at time zone 'UTC')::date,
   'f0000000-0000-0000-0000-0000000000c1', null),
  ('e0000000-0000-0000-0000-000000000006', (now() at time zone 'UTC')::date,
   null, 'f0000000-0000-0000-0000-0000000000b1');

alter table tasks disable trigger user;
alter table projects disable trigger user;
alter table life_areas disable trigger user;
update tasks set updated_at = now() - interval '30 days' where id::text like 'f0000000-%';
update projects set updated_at = now() - interval '30 days' where id::text like 'f0000000-%';
update life_areas set updated_at = now() - interval '30 days' where id::text like 'f0000000-%';
alter table tasks enable trigger user;
alter table projects enable trigger user;
alter table life_areas enable trigger user;

-- ---- shape: signatures, security_invoker, column order ------------------------------------
select is(
  (select array_agg(pg_get_function_identity_arguments(f) order by f::text)
     from unnest(array['public.rpc_update_status'::regproc, 'public.rpc_groom_stale'::regproc,
                       'public.rpc_pick_focus'::regproc, 'public.rpc_snooze'::regproc,
                       'public.rpc_start_timer'::regproc]) f),
  array['p_item_type text, p_item_id uuid',
        'p_date date, p_items jsonb',
        'p_item_type text, p_item_id uuid, p_until date',
        'p_item_type text, p_item_id uuid, p_mode text',
        'p_item_type text, p_item_id uuid, p_new_status item_status, p_left_off text, p_next_step text, p_note text, p_source text, p_next_step_task_id uuid'],
  'no RPC signature changed');
select is(
  (select count(*)::int from pg_proc
    where oid in ('public.rpc_update_status'::regproc, 'public.rpc_groom_stale'::regproc,
                  'public.rpc_pick_focus'::regproc, 'public.rpc_snooze'::regproc,
                  'public.rpc_start_timer'::regproc, 'public.digest_payload'::regproc)
      and prosecdef),
  6, 'the RPCs and digest_payload are still security definer');
select is(
  (select bool_and(has_function_privilege('authenticated', f, 'execute'))
     from unnest(array['public.rpc_update_status(text, uuid, item_status, text, text, text, text, uuid)',
                       'public.rpc_groom_stale(text, uuid)', 'public.rpc_pick_focus(date, jsonb)',
                       'public.rpc_snooze(text, uuid, date)', 'public.rpc_start_timer(text, uuid, text)']) f),
  true, 'authenticated can still call every RPC');
select is(has_function_privilege('authenticated', 'public.digest_payload(uuid)', 'execute'), false,
          'digest_payload stays service_role only');
select is(
  (select count(*)::int from pg_class
    where oid in ('public.v_hanging_threads'::regclass, 'public.v_area_stats'::regclass,
                  'public.v_running_timer'::regclass)
      and 'security_invoker=true' = any(reloptions)),
  3, 'the three personal views keep security_invoker');
select is(
  (select array_agg(attname::text order by attnum) from pg_attribute
    where attrelid = 'public.v_hanging_threads'::regclass and attnum > 0),
  array['item_type', 'item_id', 'user_id', 'title', 'status', 'updated_at', 'project_id',
        'project_title', 'area_id', 'area_name', 'area_color', 'left_off', 'next_step', 'logged_at',
        'last_activity_at', 'next_step_task_id', 'next_step_task_title', 'next_step_task_status',
        'next_step_task_project_id', 'logged_by'],
  'v_hanging_threads keeps its columns in order and ends with logged_by');

-- ---- personal views: a member's screens show only their own data ---------------------------
select login('e0000000-0000-0000-0000-000000000001');
-- 5 tasks of P1, R's task in P4 + P1, P2, P3: everything in O's projects, whoever created it.
select is((select count(*)::int from v_hanging_threads), 9, 'O sees every thread of their projects');
select is((select logged_by from v_hanging_threads where item_id = 'f0000000-0000-0000-0000-0000000000ce'),
          'e0000000-0000-0000-0000-000000000003'::uuid,
          'including the editor''s task, with the editor as logged_by');
select is((select count(*)::int from v_area_stats), 1, 'O sees their area''s stats');
select is((select id from v_running_timer), 'f0000000-0000-0000-0000-0000000000e1'::uuid,
          'O sees their own running timer');

select login('e0000000-0000-0000-0000-000000000003');
select is((select count(*)::int from v_hanging_threads), 0, 'E''s Today shows none of O''s threads');
select is((select count(*)::int from v_area_stats), 0, 'E''s stats show none of O''s areas');
select is((select array_agg(user_id) from v_running_timer),
          array['e0000000-0000-0000-0000-000000000003'::uuid], 'E''s timer view shows only E''s timer');

select login('e0000000-0000-0000-0000-000000000004');
select is((select count(*)::int from v_hanging_threads), 0, 'V''s Today shows none of O''s threads');
select is((select count(*)::int from v_area_stats), 0, 'V''s stats show none of O''s areas');
select is((select count(*)::int from v_running_timer), 0, 'V''s timer view is empty');

-- ---- V and S: every writing RPC refuses, nothing changes ----------------------------------
reset role;
do $$ begin perform set_config('t.before', state_of(), true); end $$;

select login('e0000000-0000-0000-0000-000000000004');
select throws_ok($$select rpc_update_status('task', 'f0000000-0000-0000-0000-0000000000c1', 'done', 'x', 'y')$$,
                 'P0002', 'item not found', 'V cannot move a task');
select throws_ok($$select rpc_update_status('project', 'f0000000-0000-0000-0000-0000000000b1', 'done', 'x', 'y')$$,
                 'P0002', 'item not found', 'V cannot move the project');
select throws_ok($$select rpc_groom_stale('task', 'f0000000-0000-0000-0000-0000000000c1')$$,
                 'P0002', 'item not found', 'V cannot groom a task');
select throws_ok($$select rpc_groom_stale('project', 'f0000000-0000-0000-0000-0000000000b1')$$,
                 'P0002', 'item not found', 'V cannot groom the project');
select throws_ok($$select rpc_start_timer('task', 'f0000000-0000-0000-0000-0000000000c1')$$,
                 'P0002', 'item not found', 'V cannot clock a task');
select throws_ok($$select rpc_start_timer('project', 'f0000000-0000-0000-0000-0000000000b1')$$,
                 'P0002', 'item not found', 'V cannot clock the project');
select throws_ok($$select rpc_snooze('task', 'f0000000-0000-0000-0000-0000000000c1', current_date + 7)$$,
                 'P0002', 'item not found', 'V cannot snooze a task');
select throws_ok($$select rpc_snooze('project', 'f0000000-0000-0000-0000-0000000000b1', current_date + 7)$$,
                 'P0002', 'item not found', 'V cannot snooze the project');

select login('e0000000-0000-0000-0000-000000000005');
select throws_ok($$select rpc_update_status('task', 'f0000000-0000-0000-0000-0000000000c1', 'done', 'x', 'y')$$,
                 'P0002', 'item not found', 'S cannot move a task');
select throws_ok($$select rpc_update_status('project', 'f0000000-0000-0000-0000-0000000000b1', 'done', 'x', 'y')$$,
                 'P0002', 'item not found', 'S cannot move the project');
select throws_ok($$select rpc_groom_stale('task', 'f0000000-0000-0000-0000-0000000000c1')$$,
                 'P0002', 'item not found', 'S cannot groom a task');
select throws_ok($$select rpc_groom_stale('project', 'f0000000-0000-0000-0000-0000000000b1')$$,
                 'P0002', 'item not found', 'S cannot groom the project');
select throws_ok($$select rpc_start_timer('task', 'f0000000-0000-0000-0000-0000000000c1')$$,
                 'P0002', 'item not found', 'S cannot clock a task');
select throws_ok($$select rpc_start_timer('project', 'f0000000-0000-0000-0000-0000000000b1')$$,
                 'P0002', 'item not found', 'S cannot clock the project');
select throws_ok($$select rpc_snooze('task', 'f0000000-0000-0000-0000-0000000000c1', current_date + 7)$$,
                 'P0002', 'item not found', 'S cannot snooze a task');
select throws_ok($$select rpc_snooze('project', 'f0000000-0000-0000-0000-0000000000b1', current_date + 7)$$,
                 'P0002', 'item not found', 'S cannot snooze the project');
select throws_ok($$select rpc_pick_focus((now() at time zone 'UTC')::date, '[{"task_id": "f0000000-0000-0000-0000-0000000000c1"}]')$$,
                 'P0002', 'task not found', 'S cannot put O''s task on their focus list');
select throws_ok($$select rpc_pick_focus((now() at time zone 'UTC')::date, '[{"project_id": "f0000000-0000-0000-0000-0000000000b1"}]')$$,
                 'P0002', 'project not found', 'S cannot put O''s project on their focus list');

reset role;
select is(state_of(), current_setting('t.before'), 'no refused call changed a single row');

-- ---- V may still pick shared work as focus (reading is enough) -----------------------------
select login('e0000000-0000-0000-0000-000000000004');
select is((rpc_pick_focus((now() at time zone 'UTC')::date,
             '[{"task_id": "f0000000-0000-0000-0000-0000000000c1"},
               {"project_id": "f0000000-0000-0000-0000-0000000000b1"}]') ->> 'items')::int,
          2, 'V puts a shared task and project on their own focus list');

-- ---- A: the admin moves and grooms the project ----------------------------------------------
select login('e0000000-0000-0000-0000-000000000002');
select is((rpc_groom_stale('project', 'f0000000-0000-0000-0000-0000000000b1') ->> 'xp_awarded')::int,
          15, 'A grooms the stale shared project');
select is(xp_count('e0000000-0000-0000-0000-000000000002', 'groom_stale'), 1, 'and the XP is A''s');
select ok((rpc_update_status('project', 'f0000000-0000-0000-0000-0000000000b2', 'done', 'all', 'none')
             -> 'new_badges')::jsonb ? 'finisher',
          'A finishes O''s project and earns finisher');
select is((select status from projects where id = 'f0000000-0000-0000-0000-0000000000b2'),
          'done'::item_status, 'the project is done');
select is(xp_count('e0000000-0000-0000-0000-000000000002', 'project_done'), 1, 'project_done XP is A''s');
select throws_ok($$select rpc_snooze('task', 'f0000000-0000-0000-0000-0000000000c1', current_date + 7)$$,
                 'P0002', 'item not found', 'A cannot snooze: snoozing is the owner''s alone');
select throws_ok($$select rpc_snooze('project', 'f0000000-0000-0000-0000-0000000000b1', current_date + 7)$$,
                 'P0002', 'item not found', 'not even the project');

-- ---- E: the editor works on tasks but not on the project row ---------------------------------
select login('e0000000-0000-0000-0000-000000000003');
select throws_ok($$select rpc_update_status('project', 'f0000000-0000-0000-0000-0000000000b1', 'done', 'x', 'y')$$,
                 'P0002', 'item not found', 'E cannot change the project''s status');
select throws_ok($$select rpc_groom_stale('project', 'f0000000-0000-0000-0000-0000000000b1')$$,
                 'P0002', 'item not found', 'nor groom the project');
select throws_ok($$select rpc_snooze('task', 'f0000000-0000-0000-0000-0000000000ce', current_date + 7)$$,
                 'P0002', 'item not found', 'E cannot snooze even the task they created');
select throws_ok($$select rpc_snooze('project', 'f0000000-0000-0000-0000-0000000000b1', current_date + 7)$$,
                 'P0002', 'item not found', 'nor the project');
select throws_ok(
  $$select rpc_update_status('task', 'f0000000-0000-0000-0000-0000000000ce', 'paused', 'x', 'y',
                             null, 'user', 'f0000000-0000-0000-0000-0000000000c9')$$,
  'P0002', 'next step task not found', 'E cannot point a next step at a stranger''s task');

select is((rpc_groom_stale('task', 'f0000000-0000-0000-0000-0000000000c1') ->> 'xp_awarded')::int,
          15, 'E grooms O''s stale task');

-- E's own task, O's project: the touch reaches the project through the role, not the creator.
do $$ begin
  perform rpc_update_status('task', 'f0000000-0000-0000-0000-0000000000ce', 'paused', 'stuck', '',
                            null, 'user', 'f0000000-0000-0000-0000-0000000000c2');
end $$;
select is(updated('f0000000-0000-0000-0000-0000000000b1'), now(),
          'E''s status change on their task touches O''s project');
select is((select next_step from progress_logs
            where task_id = 'f0000000-0000-0000-0000-0000000000ce' order by created_at desc limit 1),
          'Next step', 'E may name O''s task as the next step');
-- The next step only has to be visible: E is a viewer on P5.
select lives_ok(
  $$select rpc_update_status('task', 'f0000000-0000-0000-0000-0000000000ce', 'paused', 'x', '',
                             null, 'user', 'f0000000-0000-0000-0000-0000000000c5')$$,
  'E may name a task of a project they only read as the next step');

select is(xp_count('e0000000-0000-0000-0000-000000000001', 'task_done'), 0, 'O has no task_done yet');
select ok((rpc_update_status('task', 'f0000000-0000-0000-0000-0000000000c1', 'done', 'all', 'none')
             -> 'new_badges')::jsonb ? 'first_quest',
          'E finishes O''s task and earns first_quest');
select is((select status from tasks where id = 'f0000000-0000-0000-0000-0000000000c1'),
          'done'::item_status, 'the task is done');
select is(xp_count('e0000000-0000-0000-0000-000000000003', 'task_done'), 1, 'task_done XP is E''s');
select is(xp_count('e0000000-0000-0000-0000-000000000001', 'task_done')
          + xp_count('e0000000-0000-0000-0000-000000000001', 'progress_update')
          + xp_count('e0000000-0000-0000-0000-000000000001', 'daily_check_in'),
          0, 'and O''s XP did not move');

-- ---- timers: E's clocks are E's, and stopping one touches the shared item ---------------------
select is((rpc_stop_timer('f0000000-0000-0000-0000-0000000000e2') ->> 'stopped')::boolean, true,
          'E stops the clock on O''s task');
select is(updated('f0000000-0000-0000-0000-0000000000c3'), now(),
          'a finished session touches the shared task');
select is((rpc_stop_timer('f0000000-0000-0000-0000-0000000000e3') ->> 'stopped')::boolean, true,
          'E stops a project-level clock');
select is(updated('f0000000-0000-0000-0000-0000000000b3'), now(),
          'which touches the shared project');

do $$ begin
  perform set_config('t.entry',
    rpc_start_timer('task', 'f0000000-0000-0000-0000-0000000000c2') ->> 'id', true);
end $$;
select is((select user_id from time_entries where id = current_setting('t.entry')::uuid),
          'e0000000-0000-0000-0000-000000000003'::uuid, 'E''s timer on a shared task is E''s row');
select lives_ok($$select rpc_start_timer('project', 'f0000000-0000-0000-0000-0000000000b1')$$,
                'E clocks the shared project');

select login('e0000000-0000-0000-0000-000000000001');
select is((select count(*)::int from v_running_timer
            where user_id = 'e0000000-0000-0000-0000-000000000003'), 0,
          'E''s timers do not show in O''s v_running_timer');
select is((select id from v_running_timer), 'f0000000-0000-0000-0000-0000000000e1'::uuid,
          'O still sees their own');

-- R is no longer a member: their old clock on O's task stops, but touches nothing of O's.
select login('e0000000-0000-0000-0000-000000000006');
select is((rpc_stop_timer('f0000000-0000-0000-0000-0000000000e4') ->> 'stopped')::boolean, true,
          'a former member can stop their own clock');
select is(updated('f0000000-0000-0000-0000-0000000000c2'), now() - interval '30 days',
          'but it does not touch the task they lost access to');
do $$ begin perform rpc_stop_timer('f0000000-0000-0000-0000-0000000000e5'); end $$;
select is(updated('f0000000-0000-0000-0000-0000000000b4'), now() - interval '30 days',
          'nor a project they lost access to');

-- ---- O: the owner snoozes, anyone's task in their project ------------------------------------
select login('e0000000-0000-0000-0000-000000000001');
select lives_ok($$select rpc_snooze('task', 'f0000000-0000-0000-0000-0000000000cf', current_date + 7)$$,
                'O snoozes the editor''s task in O''s project');
select is((select snoozed_until from tasks where id = 'f0000000-0000-0000-0000-0000000000cf'),
          current_date + 7, 'the snooze lands');
select lives_ok($$select rpc_snooze('project', 'f0000000-0000-0000-0000-0000000000b3', current_date + 7)$$,
                'O snoozes their project');
select is((select snoozed_until from projects where id = 'f0000000-0000-0000-0000-0000000000b3'),
          current_date + 7, 'that snooze lands too');

-- ---- digest_payload, as the service role ----------------------------------------------------
reset role;
select set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
set local role service_role;

select is((digest_payload('e0000000-0000-0000-0000-000000000006') -> 'focus')::text, '[]',
          'a former member''s focus rows leak no titles');
select is(
  (select array_agg(e ->> 'title' order by e ->> 'title')
     from json_array_elements(digest_payload('e0000000-0000-0000-0000-000000000004') -> 'focus') e),
  array['Finish me', 'Shared'], 'a current member''s focus keeps its titles');
-- Threads follow the project owner, as on Today. Titles are checked rather than a count, so the
-- task branch and the project branch of v_hanging_threads are each measured.
select ok((digest_payload('e0000000-0000-0000-0000-000000000001') -> 'threads')::jsonb
            @> '[{"title": "E''s task"}]',
          'the owner''s digest lists a task a member added to their project');
select ok((digest_payload('e0000000-0000-0000-0000-000000000001') -> 'threads')::jsonb
            @> '[{"title": "Shared", "project_title": "Shared"}]',
          'and their own project thread');
select is((digest_payload('e0000000-0000-0000-0000-000000000006') -> 'threads')::text, '[]',
          'a former member''s digest carries no thread of the owner''s (title, project, area)');
select is((digest_payload('e0000000-0000-0000-0000-000000000003') -> 'threads')::text, '[]',
          'a current member''s digest lists no shared work (out of scope for #74)');

select * from finish();
rollback;
