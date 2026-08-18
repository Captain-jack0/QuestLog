-- BE-04/BE-05 · XP, streaks, badges and the supporting RPCs.
begin;
create extension if not exists pgtap with schema extensions;
set search_path to public, extensions;

select plan(20);

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

select login('11111111-1111-1111-1111-111111111111');

insert into life_areas (id, user_id, name)
values ('aaaa0000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Work');
insert into projects (id, user_id, area_id, title)
values ('aaaa0000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
        'aaaa0000-0000-0000-0000-000000000001', 'Ship QuestLog');
insert into tasks (id, user_id, project_id, title, difficulty) values
  ('aaaa0000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111',
   'aaaa0000-0000-0000-0000-000000000002', 'Write the schema', 'M'),
  ('aaaa0000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111',
   'aaaa0000-0000-0000-0000-000000000002', 'Write RLS', 'S'),
  ('aaaa0000-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111',
   'aaaa0000-0000-0000-0000-000000000002', 'Write the RPC', 'L');

-- ---- first action of the day ------------------------------------------------------
select is(
  (rpc_update_status('task', 'aaaa0000-0000-0000-0000-000000000003', 'in_progress',
                     'nothing yet', 'draft the tables') ->> 'xp_awarded')::int,
  18, 'first action of the day: 10 check-in + 8 progress update');

select is((select count(*) from progress_logs)::int, 1, 'the RPC wrote a progress log');
select is((select status::text from tasks where id = 'aaaa0000-0000-0000-0000-000000000003'),
          'in_progress', 'the RPC moved the task');
select is((select current from streaks where user_id = '11111111-1111-1111-1111-111111111111'),
          1, 'streak starts at 1');

-- ---- completion XP and the first badge --------------------------------------------
select is(
  (rpc_update_status('task', 'aaaa0000-0000-0000-0000-000000000004', 'done',
                     'RLS written', 'ship it') ->> 'xp_awarded')::int,
  10, 'S task completion pays 10 and no second check-in');

select is(
  (rpc_update_status('task', 'aaaa0000-0000-0000-0000-000000000005', 'done',
                     'RPC written', 'test it') -> 'new_badges')::text,
  '[]', 'first_quest is not granted twice');

select ok(
  exists (select 1 from user_badges ub join badges b on b.id = ub.badge_id
           where ub.user_id = '11111111-1111-1111-1111-111111111111' and b.code = 'first_quest'),
  'first_quest was granted on the first completed task');

select is(
  (rpc_update_status('project', 'aaaa0000-0000-0000-0000-000000000002', 'done',
                     'all tasks done', 'announce it') ->> 'xp_awarded')::int,
  100, 'project completion pays 100');

select ok(
  exists (select 1 from user_badges ub join badges b on b.id = ub.badge_id
           where ub.user_id = '11111111-1111-1111-1111-111111111111' and b.code = 'finisher'),
  'finisher was granted on the first completed project');

-- ---- streaks ----------------------------------------------------------------------
reset role;
update streaks set current = 3, best = 3, last_active_date = current_date - 1, freeze_tokens = 0
 where user_id = '11111111-1111-1111-1111-111111111111';
select login('11111111-1111-1111-1111-111111111111');

select is(
  (rpc_update_status('task', 'aaaa0000-0000-0000-0000-000000000003', 'paused',
                     'stuck on RLS', 'ask for help') ->> 'streak_current')::int,
  4, 'yesterday + today continues the streak');

reset role;
update streaks set current = 9, best = 9, last_active_date = current_date - 5, freeze_tokens = 0
 where user_id = '11111111-1111-1111-1111-111111111111';
select login('11111111-1111-1111-1111-111111111111');

select is(
  (rpc_update_status('task', 'aaaa0000-0000-0000-0000-000000000003', 'in_progress',
                     'unstuck', 'keep going') ->> 'streak_current')::int,
  1, 'a gap with no freeze token resets the streak');

select is((select best from streaks where user_id = '11111111-1111-1111-1111-111111111111'),
          9, 'best survives a reset');

reset role;
update streaks set current = 5, best = 9, last_active_date = current_date - 5, freeze_tokens = 1
 where user_id = '11111111-1111-1111-1111-111111111111';
select login('11111111-1111-1111-1111-111111111111');

select is(
  (rpc_update_status('task', 'aaaa0000-0000-0000-0000-000000000003', 'paused',
                     'paused again', 'resume tomorrow') ->> 'streak_current')::int,
  6, 'a freeze token keeps the streak alive across a gap');

select is((select freeze_tokens from streaks where user_id = '11111111-1111-1111-1111-111111111111'),
          0, 'the freeze token was consumed');

-- ---- ownership --------------------------------------------------------------------
select login('22222222-2222-2222-2222-222222222222');
select throws_ok(
  $$select rpc_update_status('task', 'aaaa0000-0000-0000-0000-000000000003', 'done', 'x', 'y')$$,
  'P0002',
  'item not found',
  'another user cannot update someone else''s task');

-- ---- focus & grooming -------------------------------------------------------------
select login('11111111-1111-1111-1111-111111111111');

select is(
  (rpc_pick_focus(current_date,
     '[{"task_id":"aaaa0000-0000-0000-0000-000000000003"},
       {"task_id":"aaaa0000-0000-0000-0000-000000000004"},
       {"task_id":"aaaa0000-0000-0000-0000-000000000005"},
       {"project_id":"aaaa0000-0000-0000-0000-000000000002"}]'::jsonb) ->> 'items')::int,
  3, 'focus is capped at 3 items');

select is(
  (rpc_pick_focus(current_date,
     '[{"task_id":"aaaa0000-0000-0000-0000-000000000003"}]'::jsonb) ->> 'xp_awarded')::int,
  0, 'picking focus a second time on the same day pays nothing');

reset role;
-- the touch trigger would stamp now() over our backdating
alter table tasks disable trigger tasks_touch_updated_at;
update tasks set updated_at = now() - interval '40 days'
 where id = 'aaaa0000-0000-0000-0000-000000000005';
alter table tasks enable trigger tasks_touch_updated_at;
select login('11111111-1111-1111-1111-111111111111');

select is(
  (rpc_groom_stale('task', 'aaaa0000-0000-0000-0000-000000000005') ->> 'xp_awarded')::int,
  15, 'grooming a stale item pays 15');

select is(
  (rpc_groom_stale('task', 'aaaa0000-0000-0000-0000-000000000004') ->> 'xp_awarded')::int,
  0, 'grooming a fresh item pays nothing');

-- ---- hanging threads ---------------------------------------------------------------
select is(
  (select next_step from v_hanging_threads
    where item_id = 'aaaa0000-0000-0000-0000-000000000003'),
  'resume tomorrow', 'the paused task hangs with its latest next step');

select * from finish();
rollback;
