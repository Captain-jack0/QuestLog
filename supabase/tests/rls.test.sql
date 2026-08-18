-- BE-02 · RLS: a second user must not see or touch the first user's rows.
begin;
create extension if not exists pgtap with schema extensions;
set search_path to public, extensions;

select plan(12);

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

-- ---- anonymous is locked out ------------------------------------------------------
set local role anon;
select throws_ok(
  'select count(*) from projects',
  '42501',
  null,
  'anon has no table privileges at all'
);

select * from finish();
rollback;
