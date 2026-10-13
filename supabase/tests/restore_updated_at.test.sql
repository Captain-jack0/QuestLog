-- Issue #67 · rpc_restore_updated_at writes the backup's updated_at back without the touch
-- triggers re-stamping it, and only the restore key can call it.
--
-- The file is one transaction, so now() never moves: a row reading now() was stamped during
-- this test, a row reading the planted timestamp was not.
begin;
create extension if not exists pgtap with schema extensions;
set search_path to public, extensions;

select plan(10);

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

set local role service_role;

-- Parents first on purpose: if the project write still carried a touch up to the area, the area
-- restored before it would read now() afterwards. (task -> project cannot show here: since #74
-- touch_parent_project asks project_role(), which is null without a JWT, as in a real restore.)
select is(rpc_restore_updated_at('life_areas',
            '[{"id":"eeee0000-0000-0000-0000-0000000000a1","updated_at":"2026-09-01T10:00:00Z"}]'),
          1, 'one area restored');
select is(rpc_restore_updated_at('projects',
            '[{"id":"eeee0000-0000-0000-0000-0000000000b1","updated_at":"2026-09-02T10:00:00Z"}]'),
          1, 'one project restored');
select is(rpc_restore_updated_at('tasks',
            '[{"id":"eeee0000-0000-0000-0000-0000000000c1","updated_at":"2026-09-03T10:00:00Z"}]'),
          1, 'one task restored');

reset role;

select results_eq(
  $$select updated_at from life_areas where id = 'eeee0000-0000-0000-0000-0000000000a1'
    union all select updated_at from projects where id = 'eeee0000-0000-0000-0000-0000000000b1'
    union all select updated_at from tasks where id = 'eeee0000-0000-0000-0000-0000000000c1'$$,
  $$values ('2026-09-01T10:00:00Z'::timestamptz), ('2026-09-02T10:00:00Z'), ('2026-09-03T10:00:00Z')$$,
  'area, project and task keep the backup''s updated_at; no child write re-stamped a parent');

select is(current_setting('questlog.skip_touch', true), '',
          'the flag is lowered again, later writes in the transaction still touch');

set local role service_role;
-- Backups taken before life_areas had the column carry no updated_at at all.
select is(rpc_restore_updated_at('life_areas',
            '[{"id":"eeee0000-0000-0000-0000-0000000000a1"}]'),
          0, 'a row without updated_at is skipped, not nulled');
reset role;

select is((select updated_at from life_areas where id = 'eeee0000-0000-0000-0000-0000000000a1'),
          '2026-09-01T10:00:00Z'::timestamptz, 'and the skipped row is left as it was');

set local role service_role;
select throws_ok($$select rpc_restore_updated_at('profiles', '[]')$$, '22023', null,
                 'only the three touched tables are accepted');
reset role;

set local role authenticated;
select throws_ok($$select rpc_restore_updated_at('tasks', '[]')$$, '42501', null,
                 'a signed-in user cannot rewrite updated_at');
reset role;

set local role anon;
select throws_ok($$select rpc_restore_updated_at('tasks', '[]')$$, '42501', null,
                 'nor can an anonymous caller');
reset role;

select * from finish();
rollback;
