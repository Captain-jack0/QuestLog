-- Issue #73 · Sharing 1/6: membership, role helpers, role-aware RLS.
-- Cast: owner O, admin A, editor E, viewer V (members of O's project and area), stranger S, anon.
begin;
create extension if not exists pgtap with schema extensions;
set search_path to public, extensions;

select plan(71);

insert into auth.users (id, email) values
  ('c0000000-0000-0000-0000-000000000001', 'owner@example.com'),
  ('c0000000-0000-0000-0000-000000000002', 'admin@example.com'),
  ('c0000000-0000-0000-0000-000000000003', 'editor@example.com'),
  ('c0000000-0000-0000-0000-000000000004', 'viewer@example.com'),
  ('c0000000-0000-0000-0000-000000000005', 'stranger@example.com');

create function login(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;

-- Rows a statement touched, as the current role. RLS turns a forbidden update/delete into 0.
create function affected(q text) returns int language plpgsql as $$
declare n int;
begin
  execute q;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- ---- seed (as postgres, past RLS; nothing here is under test) ---------------------------
insert into life_areas (id, user_id, name) values
  ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Work'),
  ('d0000000-0000-0000-0000-000000000008', 'c0000000-0000-0000-0000-000000000005', 'Theirs');
insert into projects (id, user_id, area_id, title) values
  ('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001',
   'd0000000-0000-0000-0000-000000000001', 'Shared'),
  ('d0000000-0000-0000-0000-000000000007', 'c0000000-0000-0000-0000-000000000005',
   'd0000000-0000-0000-0000-000000000008', 'Stranger''s');
insert into tasks (id, user_id, project_id, title) values
  ('d0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001',
   'd0000000-0000-0000-0000-000000000002', 'Keep'),
  ('d0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000001',
   'd0000000-0000-0000-0000-000000000002', 'Delete me');
insert into project_members (project_id, user_id, role, joined_at) values
  ('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002', 'admin',  '2026-01-01'),
  ('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000003', 'editor', '2026-01-01'),
  ('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000004', 'viewer', '2026-01-01');
insert into area_members (area_id, user_id, role, joined_at) values
  ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'admin',  '2026-01-01'),
  ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003', 'editor', '2026-01-01'),
  ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000004', 'viewer', '2026-01-01');
-- One note from before the members joined, one from after.
insert into progress_logs (id, user_id, project_id, left_off, created_at) values
  ('d0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000001',
   'd0000000-0000-0000-0000-000000000002', 'before', '2025-12-31'),
  ('d0000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000001',
   'd0000000-0000-0000-0000-000000000002', 'after', '2026-01-02');

-- ---- helper signatures (no claims yet) -------------------------------------------------
select is(pg_get_function_identity_arguments('public.project_role'::regproc), 'p_project uuid',
          'project_role takes only p_project uuid');
select is(pg_get_function_identity_arguments('public.area_role'::regproc), 'p_area uuid',
          'area_role takes only p_area uuid');
select is(pg_get_function_identity_arguments('public.project_visible_since'::regproc), 'p_project uuid',
          'project_visible_since takes only p_project uuid');
select is((select count(*)::int from pg_proc
            where oid in ('public.project_role'::regproc, 'public.area_role'::regproc,
                          'public.project_visible_since'::regproc) and prosecdef), 3,
          'all three helpers are security definer');
select is((select count(*)::int from pg_proc
            where oid in ('public.project_role'::regproc, 'public.area_role'::regproc,
                          'public.project_visible_since'::regproc)
              and 'search_path=public' = any(proconfig)), 3,
          'all three helpers pin search_path');
select is((select bool_or(has_function_privilege('anon', f, 'execute'))
             from unnest(array['public.project_role(uuid)', 'public.area_role(uuid)',
                               'public.project_visible_since(uuid)']) f), false,
          'anon cannot execute the helpers');
select is((select bool_and(has_function_privilege('authenticated', f, 'execute'))
             from unnest(array['public.project_role(uuid)', 'public.area_role(uuid)',
                               'public.project_visible_since(uuid)']) f), true,
          'authenticated can execute the helpers');
select is(project_role('d0000000-0000-0000-0000-000000000002'), null, 'no claims: project_role is null');
select is(area_role('d0000000-0000-0000-0000-000000000001'), null, 'no claims: area_role is null');
select is(project_visible_since('d0000000-0000-0000-0000-000000000002'), null,
          'no claims: project_visible_since is null');

-- ---- table grants -----------------------------------------------------------------------
select is(has_table_privilege('anon', 'project_members', 'select')
          or has_table_privilege('anon', 'area_members', 'select'), false,
          'anon holds no select on the membership tables');
select is((select bool_or(has_table_privilege('authenticated', t, p))
             from unnest(array['project_members', 'area_members']) t,
                  unnest(array['insert', 'update', 'delete']) p), false,
          'authenticated holds no write grant on the membership tables');
select is(has_table_privilege('authenticated', 'project_members', 'select')
          and has_table_privilege('authenticated', 'area_members', 'select'), true,
          'authenticated may read the membership tables');

-- ---- O: the owner ------------------------------------------------------------------------
select login('c0000000-0000-0000-0000-000000000001');
select is((select count(*)::int from progress_logs), 2, 'O sees every note, before and after joins');
select is((select count(*)::int from project_members), 3, 'O sees the project''s members');
select is((select count(*)::int from area_members), 3, 'O sees the area''s members');
select is(project_role('d0000000-0000-0000-0000-000000000002'), 'admin'::member_role, 'O is the implicit admin');
select is(project_visible_since('d0000000-0000-0000-0000-000000000002'), '-infinity'::timestamptz,
          'O sees notes from the beginning of time');

-- ---- S: a stranger -----------------------------------------------------------------------
select login('c0000000-0000-0000-0000-000000000005');
select is((select count(*)::int from projects where id = 'd0000000-0000-0000-0000-000000000002'), 0, 'S cannot see the project');
select is((select count(*)::int from life_areas where id = 'd0000000-0000-0000-0000-000000000001'), 0, 'S cannot see the area');
select is((select count(*)::int from tasks where project_id = 'd0000000-0000-0000-0000-000000000002'), 0, 'S cannot see its tasks');
select is((select count(*)::int from progress_logs where project_id = 'd0000000-0000-0000-0000-000000000002'), 0, 'S cannot see its notes');
select is((select count(*)::int from project_members), 0, 'S cannot see project members');
select is((select count(*)::int from area_members), 0, 'S cannot see area members');
select is(project_role('d0000000-0000-0000-0000-000000000002'), null, 'S has no role');
select throws_ok(
  $$insert into tasks (user_id, project_id, title)
    values ('c0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000002', 'x')$$,
  '42501', null, 'S cannot add a task');
select is(affected($$update tasks set title = 'x' where project_id = 'd0000000-0000-0000-0000-000000000002'$$), 0, 'S cannot edit tasks');
select is(affected($$delete from tasks where project_id = 'd0000000-0000-0000-0000-000000000002'$$), 0, 'S cannot delete tasks');
select is(affected($$update projects set title = 'x' where id = 'd0000000-0000-0000-0000-000000000002'$$), 0, 'S cannot edit the project');
select is(affected($$delete from projects where id = 'd0000000-0000-0000-0000-000000000002'$$), 0, 'S cannot delete the project');
select is(affected($$update life_areas set name = 'x' where id = 'd0000000-0000-0000-0000-000000000001'$$), 0, 'S cannot edit the area');
select throws_ok(
  $$insert into progress_logs (user_id, project_id, left_off)
    values ('c0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000002', 'x')$$,
  '42501', null, 'S cannot log progress');
select throws_ok(
  $$insert into project_members (project_id, user_id, role)
    values ('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000005', 'admin')$$,
  '42501', null, 'S cannot add themselves to the project');
select throws_ok(
  $$insert into area_members (area_id, user_id, role)
    values ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000005', 'admin')$$,
  '42501', null, 'S cannot add themselves to the area');

-- ---- V: viewer ---------------------------------------------------------------------------
select login('c0000000-0000-0000-0000-000000000004');
select lives_ok('select * from project_members', 'V reads project_members without recursion (42P17)');
select lives_ok('select * from area_members', 'V reads area_members without recursion (42P17)');
select is((select count(*)::int from projects where id = 'd0000000-0000-0000-0000-000000000002'), 1, 'V sees the project');
select is((select count(*)::int from life_areas where id = 'd0000000-0000-0000-0000-000000000001'), 1, 'V sees the area');
select is((select count(*)::int from tasks where project_id = 'd0000000-0000-0000-0000-000000000002'), 2, 'V sees its tasks');
select is((select array_agg(left_off) from progress_logs), array['after'],
          'V sees the note written after joining, not the one before');
select is((select count(*)::int from project_members), 3, 'V sees fellow project members');
select is((select count(*)::int from area_members), 3, 'V sees fellow area members');
select throws_ok(
  $$insert into tasks (user_id, project_id, title)
    values ('c0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000002', 'x')$$,
  '42501', null, 'V cannot add a task');
select is(affected($$update tasks set title = 'x' where project_id = 'd0000000-0000-0000-0000-000000000002'$$), 0, 'V cannot edit tasks');
select is(affected($$delete from tasks where project_id = 'd0000000-0000-0000-0000-000000000002'$$), 0, 'V cannot delete tasks');
select throws_ok(
  $$insert into progress_logs (user_id, project_id, left_off)
    values ('c0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000002', 'x')$$,
  '42501', null, 'V cannot log progress');
select is(affected($$update projects set title = 'x' where id = 'd0000000-0000-0000-0000-000000000002'$$), 0, 'V cannot edit the project');
select is(affected($$update life_areas set name = 'x' where id = 'd0000000-0000-0000-0000-000000000001'$$), 0, 'V cannot edit the area');

-- ---- E: editor ---------------------------------------------------------------------------
select login('c0000000-0000-0000-0000-000000000003');
select lives_ok(
  $$insert into tasks (id, user_id, project_id, title)
    values ('d0000000-0000-0000-0000-000000000009', 'c0000000-0000-0000-0000-000000000003',
            'd0000000-0000-0000-0000-000000000002', 'E''s task')$$,
  'E adds a task');
select is(affected($$update tasks set title = 'Kept' where id = 'd0000000-0000-0000-0000-000000000003'$$), 1, 'E edits the owner''s task');
select is(affected($$delete from tasks where id = 'd0000000-0000-0000-0000-000000000004'$$), 1, 'E deletes a task');
select lives_ok(
  $$insert into progress_logs (user_id, project_id, task_id, left_off)
    values ('c0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000002',
            'd0000000-0000-0000-0000-000000000003', 'E was here')$$,
  'E logs progress');
select is(affected($$update projects set title = 'x' where id = 'd0000000-0000-0000-0000-000000000002'$$), 0, 'E cannot edit the project row');
select is(affected($$update life_areas set name = 'x' where id = 'd0000000-0000-0000-0000-000000000001'$$), 0, 'E cannot edit the area row');
select throws_ok(
  $$insert into tasks (user_id, project_id, title)
    values ('c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'x')$$,
  '42501', null, 'E cannot add a task in someone else''s name');
select throws_ok(
  $$update tasks set user_id = 'c0000000-0000-0000-0000-000000000003'
     where id = 'd0000000-0000-0000-0000-000000000003'$$,
  '42501', null, 'E cannot take over a task (tasks.user_id is immutable)');
-- #66 under a shared parent: editing one project grants nothing on another.
select throws_ok(
  $$insert into tasks (user_id, project_id, title)
    values ('c0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000007', 'x')$$,
  '42501', null, 'E cannot add a task to a stranger''s project');
select throws_ok(
  $$update tasks set project_id = 'd0000000-0000-0000-0000-000000000007'
     where id = 'd0000000-0000-0000-0000-000000000003'$$,
  '42501', null, 'nor move a shared task under it');

-- ---- A: admin ----------------------------------------------------------------------------
select login('c0000000-0000-0000-0000-000000000002');
select is(affected($$update projects set title = 'Renamed' where id = 'd0000000-0000-0000-0000-000000000002'$$), 1, 'A edits the project row');
select throws_ok(
  $$update projects set user_id = 'c0000000-0000-0000-0000-000000000002'
     where id = 'd0000000-0000-0000-0000-000000000002'$$,
  '42501', null, 'A cannot take over the project');
select throws_ok(
  $$update projects set area_id = null where id = 'd0000000-0000-0000-0000-000000000002'$$,
  '42501', null, 'A cannot move the project out of its area');
select is(affected($$update life_areas set name = 'Renamed' where id = 'd0000000-0000-0000-0000-000000000001'$$), 1, 'A edits the area row');
select throws_ok(
  $$update life_areas set user_id = 'c0000000-0000-0000-0000-000000000002'
     where id = 'd0000000-0000-0000-0000-000000000001'$$,
  '42501', null, 'A cannot take over the area');
select lives_ok(
  $$insert into tasks (user_id, project_id, title)
    values ('c0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000002', 'A''s task')$$,
  'A adds a task');

-- ---- E is removed --------------------------------------------------------------------------
reset role;
delete from project_members where user_id = 'c0000000-0000-0000-0000-000000000003';
select login('c0000000-0000-0000-0000-000000000003');
select is((select count(*)::int from tasks where id = 'd0000000-0000-0000-0000-000000000009'), 0,
          'a removed member no longer sees the task they created');
select is(affected($$update tasks set title = 'x' where id = 'd0000000-0000-0000-0000-000000000009'$$), 0,
          'nor edits it');
select throws_ok(
  $$insert into tasks (user_id, project_id, title)
    values ('c0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000002', 'x')$$,
  '42501', null, 'nor adds new ones');

-- ---- anon ----------------------------------------------------------------------------------
-- Production still carries the legacy auto-expose select grant (rls.test.sql:76-93); grant it
-- here so RLS, not the missing grant, is what returns zero rows.
reset role;
grant select on projects, life_areas, tasks, progress_logs to anon;
select set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
set local role anon;
select is((select count(*)::int from projects), 0, 'anon sees no projects');
select is((select count(*)::int from life_areas), 0, 'anon sees no areas');
select is((select count(*)::int from tasks), 0, 'anon sees no tasks');
select is((select count(*)::int from progress_logs), 0, 'anon sees no notes');

select * from finish();
rollback;
