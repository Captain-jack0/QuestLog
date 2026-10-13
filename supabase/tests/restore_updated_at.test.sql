-- Issue #67 · rpc_restore_updated_at writes the backup's updated_at back without the touch
-- triggers re-stamping it, and only the restore key can call it.
--
-- The file is one transaction, so now() never moves: a row reading now() was touched by a
-- trigger, a row reading the planted timestamp was not.
begin;
create extension if not exists pgtap with schema extensions;
set search_path to public, extensions;

select plan(8);

insert into auth.users (id, email) values
  ('66666666-6666-6666-6666-666666666666', 'restore@example.com');

-- Replays a restore: rows arrive in dependency order, each insert touching its parent.
insert into life_areas (id, user_id, name) values
  ('eeee0000-0000-0000-0000-0000000000a1', '66666666-6666-6666-6666-666666666666', 'Area');
insert into projects (id, user_id, area_id, title) values
  ('eeee0000-0000-0000-0000-0000000000b1', '66666666-6666-6666-6666-666666666666',
   'eeee0000-0000-0000-0000-0000000000a1', 'Project');
insert into tasks (id, user_id, project_id, title) values
  ('eeee0000-0000-0000-0000-0000000000c1', '66666666-6666-6666-6666-666666666666',
   'eeee0000-0000-0000-0000-0000000000b1', 'Task');

select is((select updated_at from life_areas where id = 'eeee0000-0000-0000-0000-0000000000a1'),
          now(), 'precondition: the restore''s inserts stamped the area with now()');

set local role service_role;

-- Children first on purpose: if the task write still touched its project, the project pass
-- would hide it; this order lets the project assertion catch it.
select is(rpc_restore_updated_at('tasks',
            '[{"id":"eeee0000-0000-0000-0000-0000000000c1","updated_at":"2026-09-03T10:00:00Z"}]'),
          1, 'one task restored');
select is(rpc_restore_updated_at('projects',
            '[{"id":"eeee0000-0000-0000-0000-0000000000b1","updated_at":"2026-09-02T10:00:00Z"}]'),
          1, 'one project restored');
select is(rpc_restore_updated_at('life_areas',
            '[{"id":"eeee0000-0000-0000-0000-0000000000a1","updated_at":"2026-09-01T10:00:00Z"}]'),
          1, 'one area restored');

reset role;

select results_eq(
  $$select updated_at from life_areas where id = 'eeee0000-0000-0000-0000-0000000000a1'
    union all select updated_at from projects where id = 'eeee0000-0000-0000-0000-0000000000b1'
    union all select updated_at from tasks where id = 'eeee0000-0000-0000-0000-0000000000c1'$$,
  $$values ('2026-09-01T10:00:00Z'::timestamptz), ('2026-09-02T10:00:00Z'), ('2026-09-03T10:00:00Z')$$,
  'area, project and task keep the backup''s updated_at; no write re-stamped a parent');

select is(current_setting('questlog.skip_touch', true), '',
          'the flag is lowered again, later writes in the transaction still touch');

set local role service_role;
select throws_ok($$select rpc_restore_updated_at('profiles', '[]')$$, '22023', null,
                 'only the three touched tables are accepted');
reset role;

set local role authenticated;
select throws_ok($$select rpc_restore_updated_at('tasks', '[]')$$, '42501', null,
                 'a signed-in user cannot rewrite updated_at');
reset role;

select * from finish();
rollback;
