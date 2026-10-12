-- BE-02 · RLS: a second user must not see or touch the first user's rows.
begin;
create extension if not exists pgtap with schema extensions;
set search_path to public, extensions;

select plan(24);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'b@example.com');

create function login(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;

-- ---- user A creates a full thread -------------------------------------------------
select login('11111111-1111-1111-1111-111111111111');

insert into life_areas (id, user_id, name)
values ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Work');
insert into projects (id, user_id, area_id, title)
values ('aaaaaaaa-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
        'aaaaaaaa-0000-0000-0000-000000000001', 'Ship QuestLog');
insert into tasks (id, user_id, project_id, title)
values ('aaaaaaaa-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111',
        'aaaaaaaa-0000-0000-0000-000000000002', 'Write the schema');
insert into progress_logs (id, user_id, project_id, task_id, left_off, next_step)
values ('aaaaaaaa-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111',
        'aaaaaaaa-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000003',
        'schema drafted', 'add RLS');

select is((select count(*) from life_areas)::int, 1, 'owner sees their own area');
select is((select count(*) from profiles)::int, 1, 'owner sees only their own profile');

-- append-only: neither a grant nor a policy exists for update/delete
select throws_ok(
  $$update progress_logs set left_off = 'rewritten history'$$,
  '42501',
  null,
  'progress_logs cannot be updated, even by the owner'
);
select throws_ok(
  $$delete from progress_logs$$,
  '42501',
  null,
  'progress_logs cannot be deleted, even by the owner'
);
select is((select count(*) from progress_logs)::int, 1, 'the log survived both attempts');

-- ---- user B is locked out ---------------------------------------------------------
select login('22222222-2222-2222-2222-222222222222');

select is((select count(*) from life_areas)::int, 0, 'other user sees no areas');
select is((select count(*) from projects)::int, 0, 'other user sees no projects');
select is((select count(*) from tasks)::int, 0, 'other user sees no tasks');
select is((select count(*) from progress_logs)::int, 0, 'other user sees no progress logs');

update projects set title = 'hijacked';
select is((select count(*) from projects where title = 'hijacked')::int, 0,
          'other user cannot update rows they cannot see');

select throws_ok(
  $$insert into tasks (user_id, project_id, title)
    values ('11111111-1111-1111-1111-111111111111',
            'aaaaaaaa-0000-0000-0000-000000000002', 'planted')$$,
  '42501',
  null,
  'other user cannot insert rows owned by someone else'
);

-- ---- issue #66: B's own rows cannot point at A's parents ---------------------------------
-- Foreign keys are checked past RLS, so only the parent-ownership clauses in the write policies
-- (20261008130000_rls_parent_ownership.sql) stop these. Each throws_ok below goes green-to-red
-- when its clause is deleted from that migration.
insert into life_areas (id, user_id, name)
values ('bbbbbbbb-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Home');
insert into projects (id, user_id, title)
values ('bbbbbbbb-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'Garden');
insert into tasks (id, user_id, project_id, title)
values ('bbbbbbbb-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222',
        'bbbbbbbb-0000-0000-0000-000000000002', 'Dig');

select throws_ok(
  $$insert into tasks (user_id, project_id, title)
    values ('22222222-2222-2222-2222-222222222222',
            'aaaaaaaa-0000-0000-0000-000000000002', 'Planted')$$,
  '42501', null, 'a task cannot be added to someone else''s project');
select throws_ok(
  $$update tasks set project_id = 'aaaaaaaa-0000-0000-0000-000000000002'
     where id = 'bbbbbbbb-0000-0000-0000-000000000003'$$,
  '42501', null, 'nor moved under it');
select throws_ok(
  $$insert into projects (user_id, area_id, title)
    values ('22222222-2222-2222-2222-222222222222',
            'aaaaaaaa-0000-0000-0000-000000000001', 'Planted')$$,
  '42501', null, 'a project cannot be attached to someone else''s area');
select throws_ok(
  $$update projects set area_id = 'aaaaaaaa-0000-0000-0000-000000000001'
     where id = 'bbbbbbbb-0000-0000-0000-000000000002'$$,
  '42501', null, 'nor moved into it');
select throws_ok(
  $$insert into focus_items (user_id, date, task_id)
    values ('22222222-2222-2222-2222-222222222222', current_date,
            'aaaaaaaa-0000-0000-0000-000000000003')$$,
  '42501', null, 'someone else''s task cannot be put in focus');
select throws_ok(
  $$insert into focus_items (user_id, date, project_id)
    values ('22222222-2222-2222-2222-222222222222', current_date,
            'aaaaaaaa-0000-0000-0000-000000000002')$$,
  '42501', null, 'nor someone else''s project');
select throws_ok(
  $$insert into progress_logs (user_id, project_id, left_off)
    values ('22222222-2222-2222-2222-222222222222',
            'aaaaaaaa-0000-0000-0000-000000000002', 'planted')$$,
  '42501', null, 'progress cannot be logged on someone else''s project');
select throws_ok(
  $$insert into progress_logs (user_id, project_id, task_id, left_off)
    values ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-0000-0000-0000-000000000002',
            'aaaaaaaa-0000-0000-0000-000000000003', 'planted')$$,
  '42501', null, 'nor on someone else''s task');
select throws_ok(
  $$insert into progress_logs (user_id, project_id, task_id, left_off, next_step_task_id)
    values ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-0000-0000-0000-000000000002',
            'bbbbbbbb-0000-0000-0000-000000000003', 'planted',
            'aaaaaaaa-0000-0000-0000-000000000003')$$,
  '42501', null, 'nor point its next step at someone else''s task');

-- The checks must not over-reach: B's own parents still work.
select lives_ok(
  $$update projects set area_id = 'bbbbbbbb-0000-0000-0000-000000000001'
     where id = 'bbbbbbbb-0000-0000-0000-000000000002'$$,
  'a project can still move into its owner''s own area');
select lives_ok(
  $$insert into focus_items (user_id, date, task_id)
    values ('22222222-2222-2222-2222-222222222222', current_date,
            'bbbbbbbb-0000-0000-0000-000000000003')$$,
  'an own task can still be put in focus');
select lives_ok(
  $$insert into progress_logs (user_id, project_id, task_id, left_off)
    values ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-0000-0000-0000-000000000002',
            'bbbbbbbb-0000-0000-0000-000000000003', 'dug')$$,
  'progress can still be logged on an own task');

-- ---- anonymous is locked out (in this local role) ---------------------------------
-- This proves the local test role, not production. 20260818120100_rls.sql:29-30 says
-- "anon gets nothing at all" about table grants — and in production that is not true:
-- the same query returns 200 with rows already filtered to zero by RLS, not a 42501.
-- The tables there were created while Supabase still auto-exposed new public entities to
-- the Data API roles, and no migration has revoked that since. Locally the difference is
-- config.toml:19-24 — `auto_expose_new_tables` is unset, so nothing is exposed without an
-- explicit grant and the query fails before RLS even runs. That is the platform's new
-- default (the legacy flag is removed on 2026-10-30), so this file describes where the
-- platform is going; production carries the residue of where it was. Issue #34 chose to
-- keep the residue and rely on RLS. The production claim — anon can read the table, RLS
-- empties it — is verified against the live database in scripts/verify-deploy.mjs, not here.
set local role anon;
select throws_ok(
  'select count(*) from projects',
  '42501',
  null,
  'anon has no SELECT grant on this local role (prod still carries the legacy auto-expose grant)'
);

select * from finish();
rollback;
