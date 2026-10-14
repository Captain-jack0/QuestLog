-- Issue #68 · Necromancer reads status_changed_at; only a real status change moves it.
-- now() is frozen for the whole transaction, so "untouched" is asserted against a planted
-- past value and "stamped" against now(). Planting happens as postgres with no JWT: an end user
-- cannot set the column (the stamp trigger overrides them), which is asserted below too.
begin;
create extension if not exists pgtap with schema extensions;
set search_path to public, extensions;

select plan(24);

insert into auth.users (id, email) values
  ('68680000-0000-0000-0000-000000000001', 'necro@example.com');

create function login(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;

-- Back to the migration/restore context: no role switch, no JWT, auth.uid() is null.
create function as_postgres() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  execute 'reset role';
end;
$$;
grant execute on function as_postgres() to authenticated;

select col_not_null('tasks', 'status_changed_at', 'tasks.status_changed_at is not null');
select col_not_null('projects', 'status_changed_at', 'projects.status_changed_at is not null');

select login('68680000-0000-0000-0000-000000000001');

insert into life_areas (id, user_id, name)
values ('68680000-0000-0000-0000-0000000000a1', '68680000-0000-0000-0000-000000000001', 'Crypt');
insert into projects (id, user_id, area_id, title, status) values
  ('68680000-0000-0000-0000-0000000000b1', '68680000-0000-0000-0000-000000000001',
   '68680000-0000-0000-0000-0000000000a1', 'Paused 10 days', 'paused'),
  ('68680000-0000-0000-0000-0000000000b2', '68680000-0000-0000-0000-000000000001',
   '68680000-0000-0000-0000-0000000000a1', 'Paused 31 days', 'paused'),
  ('68680000-0000-0000-0000-0000000000b3', '68680000-0000-0000-0000-000000000001',
   '68680000-0000-0000-0000-0000000000a1', 'Paused from the edit sheet', 'in_progress');
insert into tasks (id, user_id, project_id, title, status) values
  ('68680000-0000-0000-0000-0000000000c1', '68680000-0000-0000-0000-000000000001',
   '68680000-0000-0000-0000-0000000000b2', 'Old task', 'paused');

-- ---- an end user cannot choose the value -------------------------------------------
insert into projects (id, user_id, area_id, title, status, status_changed_at) values
  ('68680000-0000-0000-0000-0000000000b4', '68680000-0000-0000-0000-000000000001',
   '68680000-0000-0000-0000-0000000000a1', 'Forger', 'paused', now() - interval '90 days');
select is((select status_changed_at from projects where id = '68680000-0000-0000-0000-0000000000b4'),
          now(), 'a user insert cannot backdate status_changed_at');
update projects set status_changed_at = now() - interval '90 days'
 where id = '68680000-0000-0000-0000-0000000000b4';
select is((select status_changed_at from projects where id = '68680000-0000-0000-0000-0000000000b4'),
          now(), 'a user update cannot backdate status_changed_at');

-- ---- plant the ages (no user => the trigger leaves the value as written) -----------
select as_postgres();
update projects set status_changed_at = now() - interval '10 days'
 where id = '68680000-0000-0000-0000-0000000000b1';
update projects set status_changed_at = now() - interval '31 days'
 where id = '68680000-0000-0000-0000-0000000000b2';
update projects set status_changed_at = now() - interval '40 days'
 where id = '68680000-0000-0000-0000-0000000000b3';
update tasks set status_changed_at = now() - interval '31 days'
 where id = '68680000-0000-0000-0000-0000000000c1';
select is((select status_changed_at from projects where id = '68680000-0000-0000-0000-0000000000b2'),
          now() - interval '31 days', 'without a user (restore path) the written value stands');
select login('68680000-0000-0000-0000-000000000001');

-- ---- paused 10 days: no badge ------------------------------------------------------
select ok(
  not (rpc_update_status('project', '68680000-0000-0000-0000-0000000000b1', 'in_progress',
                         'back', 'go') -> 'new_badges')::jsonb ? 'necromancer',
  'paused 10 days then revived: no necromancer');

-- ---- the edit sheet path: a direct PostgREST status write is stamped ---------------
-- useUpdateProject PATCHes status as the user; status_changed_at was 40 days old.
update projects set status = 'paused' where id = '68680000-0000-0000-0000-0000000000b3';
select is((select status_changed_at from projects where id = '68680000-0000-0000-0000-0000000000b3'),
          now(), 'a direct status update (edit sheet) stamps status_changed_at');
select ok(
  not (rpc_update_status('project', '68680000-0000-0000-0000-0000000000b3', 'in_progress',
                         'back', 'go') -> 'new_badges')::jsonb ? 'necromancer',
  'paused moments ago via the edit sheet then revived: no necromancer');

-- ---- touches on the 31-day project do not move status_changed_at ------------------
-- Adding a task touches the project (updated_at = now()); under the old rule that alone
-- cost the badge.
insert into tasks (id, user_id, project_id, title) values
  ('68680000-0000-0000-0000-0000000000c2', '68680000-0000-0000-0000-000000000001',
   '68680000-0000-0000-0000-0000000000b2', 'Added while paused');
select is((select updated_at from projects where id = '68680000-0000-0000-0000-0000000000b2'),
          now(), 'adding a task touched the project''s updated_at');
select is((select status_changed_at from projects where id = '68680000-0000-0000-0000-0000000000b2'),
          now() - interval '31 days', 'adding a task left the project''s status_changed_at');

update projects set title = 'Paused 31 days (edited)'
 where id = '68680000-0000-0000-0000-0000000000b2';
select is((select status_changed_at from projects where id = '68680000-0000-0000-0000-0000000000b2'),
          now() - interval '31 days', 'editing a project left status_changed_at');

update tasks set title = 'Old task (edited)' where id = '68680000-0000-0000-0000-0000000000c1';
select is((select status_changed_at from tasks where id = '68680000-0000-0000-0000-0000000000c1'),
          now() - interval '31 days', 'editing a task left status_changed_at');

select rpc_start_timer('task', '68680000-0000-0000-0000-0000000000c1');
select rpc_stop_timer();
select rpc_start_timer('project', '68680000-0000-0000-0000-0000000000b2');
select rpc_stop_timer();
select is((select status_changed_at from tasks where id = '68680000-0000-0000-0000-0000000000c1'),
          now() - interval '31 days', 'a focus session left the task''s status_changed_at');
select is((select status_changed_at from projects where id = '68680000-0000-0000-0000-0000000000b2'),
          now() - interval '31 days', 'a focus session left the project''s status_changed_at');

select rpc_snooze('task', '68680000-0000-0000-0000-0000000000c1', current_date + 7);
select rpc_snooze('project', '68680000-0000-0000-0000-0000000000b2', current_date + 7);
select is((select status_changed_at from tasks where id = '68680000-0000-0000-0000-0000000000c1'),
          now() - interval '31 days', 'snoozing left the task''s status_changed_at');
select is((select status_changed_at from projects where id = '68680000-0000-0000-0000-0000000000b2'),
          now() - interval '31 days', 'snoozing left the project''s status_changed_at');

-- A progress update that keeps the status is not a status change.
select rpc_update_status('task', '68680000-0000-0000-0000-0000000000c1', 'paused', 'still', 'later');
select is((select status_changed_at from tasks where id = '68680000-0000-0000-0000-0000000000c1'),
          now() - interval '31 days', 'same-status update left status_changed_at');

-- ---- paused 31 days, touched recently: revive earns the badge ---------------------
select ok(
  (rpc_update_status('project', '68680000-0000-0000-0000-0000000000b2', 'in_progress',
                     'back from the dead', 'go') -> 'new_badges')::jsonb ? 'necromancer',
  'paused 31 days (task added meanwhile) then revived: necromancer');
select is((select status_changed_at from projects where id = '68680000-0000-0000-0000-0000000000b2'),
          now(), 'the status change stamped the project''s status_changed_at');

-- ---- existing holders: grant_badge is one per user ---------------------------------
select ok(
  not (rpc_update_status('task', '68680000-0000-0000-0000-0000000000c1', 'planned',
                         'revived too', 'go') -> 'new_badges')::jsonb ? 'necromancer',
  'a second qualifying revive does not re-grant necromancer');
select is((select status_changed_at from tasks where id = '68680000-0000-0000-0000-0000000000c1'),
          now(), 'the status change stamped the task''s status_changed_at');
select is((select count(*)::int from user_badges ub join badges b on b.id = ub.badge_id
            where ub.user_id = '68680000-0000-0000-0000-000000000001' and b.code = 'necromancer'),
          1, 'the holder keeps exactly one necromancer');

-- ---- the stamp never touches updated_at's rules ------------------------------------
-- As postgres (backfill/restore context): writing status_changed_at under skip_touch, as the
-- migration's backfill does, leaves updated_at alone.
select as_postgres();
select set_config('questlog.skip_touch', 'on', true);
update projects set updated_at = now() - interval '45 days'
 where id = '68680000-0000-0000-0000-0000000000b1';
update projects set status_changed_at = updated_at
 where id = '68680000-0000-0000-0000-0000000000b1';
select set_config('questlog.skip_touch', 'off', true);
select is((select updated_at from projects where id = '68680000-0000-0000-0000-0000000000b1'),
          now() - interval '45 days', 'the backfill statement leaves updated_at as it was');
select is((select status_changed_at from projects where id = '68680000-0000-0000-0000-0000000000b1'),
          now() - interval '45 days', 'the backfill statement copies updated_at');

select * from finish();
rollback;
