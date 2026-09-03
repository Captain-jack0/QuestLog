-- Deleting a task keeps the history; deleting a project takes it. Both on purpose.
--
-- Not an RLS test and not a timer test: no policy and no RPC is involved here. What is under
-- test is the foreign key referential action, which runs past RLS and past table grants — so
-- these rows can only be defended by the action itself (20260902130000_history_survives_task_delete.sql).
begin;
create extension if not exists pgtap with schema extensions;
set search_path to public, extensions;

select plan(9);

-- ---- the names are load-bearing ------------------------------------------------------
-- Two foreign keys point from progress_logs at tasks, so PostgREST disambiguates embeds by
-- constraint name. The embed at apps/web/src/features/projects/queries.ts:44 hard-codes the
-- *other* one (`progress_logs_next_step_task_id_fkey`), so renaming the two asserted below
-- would not break that call — this assertion earns its place for a different reason: setting
-- the action means dropping and re-adding the constraint, and a re-add under a drifted name
-- would leave the embed vocabulary of the whole table up for grabs with nothing failing at
-- build time. The names and the action are sealed together because they were changed together.
select is(
  (select count(*)::int from pg_constraint
    where connamespace = 'public'::regnamespace
      and contype = 'f'
      and confdeltype = 'n'
      and conname in ('progress_logs_task_id_fkey', 'time_entries_task_id_fkey')),
  2,
  'both task references keep their names and set null on delete');

insert into auth.users (id, email) values
  ('77777777-7777-7777-7777-777777777777', 'history@example.com');

create function login(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;

select login('77777777-7777-7777-7777-777777777777');

-- Two threads: one whose task gets deleted, one whose whole project gets deleted.
insert into projects (id, user_id, title) values
  ('cccc0000-0000-0000-0000-000000000001', '77777777-7777-7777-7777-777777777777', 'Kept'),
  ('cccc0000-0000-0000-0000-000000000002', '77777777-7777-7777-7777-777777777777', 'Abandoned');
insert into tasks (id, user_id, project_id, title) values
  ('cccc0000-0000-0000-0000-000000000003', '77777777-7777-7777-7777-777777777777',
   'cccc0000-0000-0000-0000-000000000001', 'Write the schema'),
  ('cccc0000-0000-0000-0000-000000000004', '77777777-7777-7777-7777-777777777777',
   'cccc0000-0000-0000-0000-000000000002', 'Never started');
insert into progress_logs (id, user_id, project_id, task_id, left_off) values
  ('cccc0000-0000-0000-0000-000000000005', '77777777-7777-7777-7777-777777777777',
   'cccc0000-0000-0000-0000-000000000001', 'cccc0000-0000-0000-0000-000000000003', 'schema drafted'),
  ('cccc0000-0000-0000-0000-000000000006', '77777777-7777-7777-7777-777777777777',
   'cccc0000-0000-0000-0000-000000000002', 'cccc0000-0000-0000-0000-000000000004', 'got nowhere');

-- authenticated may only select time_entries (time_tracking.sql:29), so seed them as owner of
-- the table. ended_at is set on both: two open timers would trip time_entries_one_running_per_user.
reset role;
insert into time_entries (id, user_id, project_id, task_id, ended_at, seconds) values
  ('cccc0000-0000-0000-0000-000000000007', '77777777-7777-7777-7777-777777777777',
   'cccc0000-0000-0000-0000-000000000001', 'cccc0000-0000-0000-0000-000000000003', now(), 1500),
  ('cccc0000-0000-0000-0000-000000000008', '77777777-7777-7777-7777-777777777777',
   'cccc0000-0000-0000-0000-000000000002', 'cccc0000-0000-0000-0000-000000000004', now(), 900);
select login('77777777-7777-7777-7777-777777777777');

-- ---- deleting a task: the record of the work outlives the task -----------------------
delete from tasks where id = 'cccc0000-0000-0000-0000-000000000003';

-- Sanity first: without this the survival checks below could pass because nothing was deleted.
select is((select count(*)::int from tasks where id = 'cccc0000-0000-0000-0000-000000000003'), 0,
          'the task is really gone');

-- Counted rather than read: `(select task_id ...) is null` would also be true for a row that
-- no longer exists, which is the failure this whole file is about. Counting a row that both
-- exists and is nulled cannot pass vacuously.
select is((select count(*)::int from progress_logs where id = 'cccc0000-0000-0000-0000-000000000005'), 1,
          'the log outlives the task it was about');
select is((select count(*)::int from progress_logs
            where id = 'cccc0000-0000-0000-0000-000000000005' and task_id is null), 1,
          'and it lets go of the task instead of following it down');

select is((select count(*)::int from time_entries where id = 'cccc0000-0000-0000-0000-000000000007'), 1,
          'the hours clocked against the task outlive it too');
select is((select count(*)::int from time_entries
            where id = 'cccc0000-0000-0000-0000-000000000007' and task_id is null), 1,
          'and they also let go of the task');

-- ---- deleting a project: the history goes with it, deliberately ----------------------
-- The asymmetry is the decision. A task delete is tidying up; a project delete is a withdrawal,
-- and it is the one place the record is allowed to go. A change that made task_id `restrict`
-- to avoid the null would abort this delete, and this block is what would catch it.
delete from projects where id = 'cccc0000-0000-0000-0000-000000000002';

select is((select count(*)::int from tasks where id = 'cccc0000-0000-0000-0000-000000000004'), 0,
          'deleting a project still takes its tasks');
select is((select count(*)::int from progress_logs where id = 'cccc0000-0000-0000-0000-000000000006'), 0,
          'and its history');
select is((select count(*)::int from time_entries where id = 'cccc0000-0000-0000-0000-000000000008'), 0,
          'and its time entries');

select * from finish();
rollback;
