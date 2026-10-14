-- Issue #60 · Deleting a project is a soft delete only its owner can make and undo; a member
-- leaves instead. Hidden everywhere, removed nowhere: earned XP and badges stay.
-- Cast: owner O, admin member A, editor E, viewer V, stranger S. P is deleted, Q stays live.
begin;
create extension if not exists pgtap with schema extensions;
set search_path to public, extensions;

select plan(50);

insert into auth.users (id, email) values
  ('d6000000-0000-0000-0000-000000000001', 'sd-owner@example.com'),
  ('d6000000-0000-0000-0000-000000000002', 'sd-admin@example.com'),
  ('d6000000-0000-0000-0000-000000000003', 'sd-editor@example.com'),
  ('d6000000-0000-0000-0000-000000000004', 'sd-viewer@example.com'),
  ('d6000000-0000-0000-0000-000000000005', 'sd-stranger@example.com');

create function login(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;

-- Read past RLS, so an assertion measures the data and not the caller's view of it.
create function earned(p_user uuid) returns text
language sql security definer set search_path = public as $$
  select (select coalesce(sum(xp), 0) from xp_events where user_id = p_user) || '|'
      || (select count(*) from user_badges where user_id = p_user);
$$;
create function rows_under(p_project uuid) returns text
language sql security definer set search_path = public as $$
  select (select count(*) from tasks where project_id = p_project) || '|'
      || (select count(*) from progress_logs where project_id = p_project) || '|'
      || (select count(*) from focus_items f
           where f.project_id = p_project
              or f.task_id in (select id from tasks where project_id = p_project)) || '|'
      || (select count(*) from time_entries where project_id = p_project);
$$;
create function project_updated(p_project uuid) returns timestamptz
language sql security definer set search_path = public as $$
  select updated_at from projects where id = p_project;
$$;
create function open_timers(p_project uuid) returns int
language sql security definer set search_path = public as $$
  select count(*)::int from time_entries where project_id = p_project and ended_at is null;
$$;

-- ---- seed (as postgres, past RLS) ---------------------------------------------------------
insert into life_areas (id, user_id, name) values
  ('d6000000-0000-0000-0000-0000000000a1', 'd6000000-0000-0000-0000-000000000001', 'Work');
insert into projects (id, user_id, area_id, title, status, updated_at) values
  ('d6000000-0000-0000-0000-0000000000b1', 'd6000000-0000-0000-0000-000000000001',
   'd6000000-0000-0000-0000-0000000000a1', 'Doomed', 'in_progress', '2026-01-01'),
  ('d6000000-0000-0000-0000-0000000000b2', 'd6000000-0000-0000-0000-000000000001',
   'd6000000-0000-0000-0000-0000000000a1', 'Survivor', 'in_progress', '2026-01-01');
insert into tasks (id, user_id, project_id, title, status) values
  ('d6000000-0000-0000-0000-0000000000c1', 'd6000000-0000-0000-0000-000000000001',
   'd6000000-0000-0000-0000-0000000000b1', 'Owner''s thread', 'in_progress'),
  ('d6000000-0000-0000-0000-0000000000c2', 'd6000000-0000-0000-0000-000000000003',
   'd6000000-0000-0000-0000-0000000000b1', 'Editor''s task', 'planned');
insert into project_members (project_id, user_id, role, joined_at)
select p, u, r::member_role, '2026-01-01'
  from unnest(array['d6000000-0000-0000-0000-0000000000b1',
                    'd6000000-0000-0000-0000-0000000000b2']::uuid[]) p,
       (values ('d6000000-0000-0000-0000-000000000002'::uuid, 'admin'),
               ('d6000000-0000-0000-0000-000000000003'::uuid, 'editor'),
               ('d6000000-0000-0000-0000-000000000004'::uuid, 'viewer')) m(u, r);
insert into progress_logs (user_id, project_id, task_id, left_off, next_step, created_at) values
  ('d6000000-0000-0000-0000-000000000001', 'd6000000-0000-0000-0000-0000000000b1',
   'd6000000-0000-0000-0000-0000000000c1', 'halfway', 'finish it', '2026-02-01');
insert into focus_items (user_id, date, project_id) values
  ('d6000000-0000-0000-0000-000000000001', current_date, 'd6000000-0000-0000-0000-0000000000b1');
insert into xp_events (user_id, action_type, xp, area_id, project_id, task_id) values
  ('d6000000-0000-0000-0000-000000000001', 'task_done', 25, 'd6000000-0000-0000-0000-0000000000a1',
   'd6000000-0000-0000-0000-0000000000b1', 'd6000000-0000-0000-0000-0000000000c1');
insert into badges (id, code, name, description, icon) values
  ('d6000000-0000-0000-0000-0000000000e1', 'sd_test_badge', 'Test', 'Test badge', '*');
insert into user_badges (user_id, badge_id) values
  ('d6000000-0000-0000-0000-000000000001', 'd6000000-0000-0000-0000-0000000000e1');
-- E's clock on P: 10 minutes, beaten just now — live, so the delete must stop it.
insert into time_entries (user_id, project_id, task_id, started_at, last_seen_at) values
  ('d6000000-0000-0000-0000-000000000003', 'd6000000-0000-0000-0000-0000000000b1',
   'd6000000-0000-0000-0000-0000000000c2', now() - interval '10 minutes', now());

create temp table before_delete as
select earned('d6000000-0000-0000-0000-000000000001') as owner_earned,
       rows_under('d6000000-0000-0000-0000-0000000000b1') as rows_p;
grant select on before_delete to authenticated;

-- A link invite to P from before the delete: accepting it must wait for the undo.
create temp table invite_token (token text);
grant all on invite_token to authenticated;
select login('d6000000-0000-0000-0000-000000000001');
insert into invite_token
select rpc_create_invite('project', 'd6000000-0000-0000-0000-0000000000b1') ->> 'token';
reset role;

-- ---- only the owner deletes --------------------------------------------------------------
select login('d6000000-0000-0000-0000-000000000002');
select throws_ok($$ select rpc_delete_project('d6000000-0000-0000-0000-0000000000b1') $$,
  '42501', null, 'an admin member cannot delete');
select throws_ok($$ update projects set deleted_at = now() where id = 'd6000000-0000-0000-0000-0000000000b2' $$,
  '42501', null, 'nor set deleted_at by hand through projects_update_admin');
select login('d6000000-0000-0000-0000-000000000003');
select throws_ok($$ select rpc_delete_project('d6000000-0000-0000-0000-0000000000b1') $$,
  '42501', null, 'an editor cannot delete');
select login('d6000000-0000-0000-0000-000000000004');
select throws_ok($$ select rpc_delete_project('d6000000-0000-0000-0000-0000000000b1') $$,
  '42501', null, 'a viewer cannot delete');
select login('d6000000-0000-0000-0000-000000000005');
select throws_ok($$ select rpc_delete_project('d6000000-0000-0000-0000-0000000000b1') $$,
  '42501', null, 'a stranger cannot delete');
reset role;
select login('d6000000-0000-0000-0000-000000000001');
select throws_ok($$ update projects set deleted_at = now() where id = 'd6000000-0000-0000-0000-0000000000b2' $$,
  '42501', null, 'the owner cannot set deleted_at by hand either: only through the RPC');

select lives_ok($$ select rpc_delete_project('d6000000-0000-0000-0000-0000000000b1') $$,
  'the owner deletes');
select lives_ok($$ select rpc_delete_project('d6000000-0000-0000-0000-0000000000b1') $$,
  'deleting twice is a no-op');

-- ---- hidden for the owner ------------------------------------------------------------------
select is((select count(*)::int from projects where id = 'd6000000-0000-0000-0000-0000000000b1'), 0,
  'owner: the deleted project is gone from projects');
select is((select count(*)::int from projects where id = 'd6000000-0000-0000-0000-0000000000b2'), 1,
  'owner: the other project is still there');
select is((select count(*)::int from tasks where project_id = 'd6000000-0000-0000-0000-0000000000b1'), 0,
  'owner: its tasks are gone');
select is((select count(*)::int from progress_logs where project_id = 'd6000000-0000-0000-0000-0000000000b1'), 0,
  'owner: its progress notes are gone');
select is((select count(*)::int from v_hanging_threads where project_id = 'd6000000-0000-0000-0000-0000000000b1'), 0,
  'owner: its tasks leave the hanging threads');
select is((select open_projects from v_area_stats where area_id = 'd6000000-0000-0000-0000-0000000000a1'), 1,
  'owner: the area counts one open project, not two');
select is((select open_tasks from v_area_stats where area_id = 'd6000000-0000-0000-0000-0000000000a1'), 0,
  'owner: nor its open tasks');
select is((select count(*)::int from focus_items f join projects p on p.id = f.project_id), 0,
  'owner: a focus row on it has no project to show');
select is((select count(*)::int from v_running_timers where project_id = 'd6000000-0000-0000-0000-0000000000b1'), 0,
  'owner: no running timer on it');
select is((select count(*)::int from rpc_list_members('project', 'd6000000-0000-0000-0000-0000000000b1')), 0,
  'owner: no member list for it');
select throws_ok($$ select rpc_start_timer('project', 'd6000000-0000-0000-0000-0000000000b1') $$,
  'P0002', null, 'owner: no timer can start on it');
select is(earned('d6000000-0000-0000-0000-000000000001'), (select owner_earned from before_delete),
  'owner: earned XP and badges are unchanged');
select is((select total_xp from v_area_stats where area_id = 'd6000000-0000-0000-0000-0000000000a1'), 25,
  'owner: the area keeps the XP earned in the deleted project');
select throws_ok($$ select rpc_create_invite('project', 'd6000000-0000-0000-0000-0000000000b1') $$,
  '42501', null, 'owner: no new invite to a deleted project');
select throws_ok($$ select rpc_set_member_role('project', 'd6000000-0000-0000-0000-0000000000b1',
                                               'd6000000-0000-0000-0000-000000000004', 'editor') $$,
  '42501', null, 'owner: no role change on a deleted project');
select login('d6000000-0000-0000-0000-000000000005');
select throws_ok($$ select rpc_accept_invite((select token from invite_token)) $$,
  '22023', null, 'stranger: an invite to a deleted project cannot be accepted');

-- ---- hidden for a member -------------------------------------------------------------------
select login('d6000000-0000-0000-0000-000000000003');
select is((select count(*)::int from projects where id = 'd6000000-0000-0000-0000-0000000000b1'), 0,
  'editor: the deleted project is gone');
select is((select count(*)::int from tasks where project_id = 'd6000000-0000-0000-0000-0000000000b1'), 0,
  'editor: its tasks are gone, the ones they wrote too');
select is((select count(*)::int from progress_logs where project_id = 'd6000000-0000-0000-0000-0000000000b1'), 0,
  'editor: its progress notes are gone');
select throws_ok($$ select rpc_start_timer('task', 'd6000000-0000-0000-0000-0000000000c2') $$,
  'P0002', null, 'editor: no timer can start on its tasks');
select throws_ok($$ select rpc_update_status('task', 'd6000000-0000-0000-0000-0000000000c2', 'done', '', '') $$,
  null, null, 'editor: its tasks cannot change status');

-- A member can still leave while it is deleted (rpc_remove_member lets p_user = caller through).
select login('d6000000-0000-0000-0000-000000000002');
select lives_ok($$ select rpc_remove_member('project', 'd6000000-0000-0000-0000-0000000000b1',
                                            'd6000000-0000-0000-0000-000000000002') $$,
  'admin member: leaves the project while it is deleted');

-- ---- removed nowhere -----------------------------------------------------------------------
reset role;
select is(open_timers('d6000000-0000-0000-0000-0000000000b1'), 0, 'the editor''s running timer was stopped');
select is((select count(*)::int from time_entries
            where project_id = 'd6000000-0000-0000-0000-0000000000b1' and seconds >= 600), 1,
  'and its ten minutes were kept');
select is(rows_under('d6000000-0000-0000-0000-0000000000b1'), (select rows_p from before_delete),
  'tasks, notes, focus and time rows are all still in the table');
-- The stopped timer touched the project (a real stop); the delete and the undo must not.
create temp table after_delete as
select project_updated('d6000000-0000-0000-0000-0000000000b1') as updated_p;
grant select on after_delete to authenticated;
select ok(not (digest_payload('d6000000-0000-0000-0000-000000000001')::text like '%Owner''s thread%'),
  'digest: the deleted project''s thread is not in it');
select ok(not (digest_payload('d6000000-0000-0000-0000-000000000001')::text like '%Doomed%'),
  'digest: nor its focus row');

-- ---- only the owner restores ---------------------------------------------------------------
select login('d6000000-0000-0000-0000-000000000002');
select throws_ok($$ select rpc_restore_project('d6000000-0000-0000-0000-0000000000b1') $$,
  '42501', null, 'an admin member cannot restore');
select login('d6000000-0000-0000-0000-000000000001');
select lives_ok($$ select rpc_restore_project('d6000000-0000-0000-0000-0000000000b1') $$,
  'the owner restores');
select is((select count(*)::int from projects where id = 'd6000000-0000-0000-0000-0000000000b1'), 1,
  'owner: the project is back');
select is((select count(*)::int from tasks where project_id = 'd6000000-0000-0000-0000-0000000000b1'), 2,
  'owner: with both tasks');
select is((select count(*)::int from progress_logs where project_id = 'd6000000-0000-0000-0000-0000000000b1'), 1,
  'owner: and its note');
select is((select count(*)::int from v_hanging_threads where project_id = 'd6000000-0000-0000-0000-0000000000b1'), 1,
  'owner: and its hanging thread');
select is(project_updated('d6000000-0000-0000-0000-0000000000b1'), (select updated_p from after_delete),
  'delete and undo are not touches: the project keeps its place in the lists');
select lives_ok($$ select rpc_create_invite('project', 'd6000000-0000-0000-0000-0000000000b1') $$,
  'owner: invites work again after the undo');
select lives_ok($$ select rpc_set_member_role('project', 'd6000000-0000-0000-0000-0000000000b1',
                                              'd6000000-0000-0000-0000-000000000004', 'editor') $$,
  'owner: so do role changes');
select login('d6000000-0000-0000-0000-000000000005');
select lives_ok($$ select rpc_accept_invite((select token from invite_token)) $$,
  'stranger: the old invite can be accepted once the project is back');
select login('d6000000-0000-0000-0000-000000000002');
select is((select count(*)::int from projects where id = 'd6000000-0000-0000-0000-0000000000b1'), 0,
  'the member who left while it was deleted does not get it back with the undo');
select login('d6000000-0000-0000-0000-000000000003');
select is((select count(*)::int from tasks where project_id = 'd6000000-0000-0000-0000-0000000000b1'), 2,
  'editor: the tasks are back for the member too');

-- ---- a member leaves, the owner cannot -----------------------------------------------------
select lives_ok($$ select rpc_remove_member('project', 'd6000000-0000-0000-0000-0000000000b1',
                                            'd6000000-0000-0000-0000-000000000003') $$,
  'the editor leaves the project');
select is((select count(*)::int from projects where id = 'd6000000-0000-0000-0000-0000000000b1'), 0,
  'and no longer sees it');
select login('d6000000-0000-0000-0000-000000000001');
select throws_ok($$ select rpc_remove_member('project', 'd6000000-0000-0000-0000-0000000000b1',
                                             'd6000000-0000-0000-0000-000000000001') $$,
  '42501', null, 'the owner cannot leave their own project');

select * from finish();
rollback;
