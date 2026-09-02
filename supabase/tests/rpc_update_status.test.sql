-- BE-04/BE-05 · XP, streaks, badges and the supporting RPCs.
begin;
create extension if not exists pgtap with schema extensions;
set search_path to public, extensions;

select plan(33);

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

-- Dropped up front rather than through rpc_update_status: this row only exists to be groomed,
-- and going through the RPC would pay it XP and log progress the assertions below count on.
insert into tasks (id, user_id, project_id, title, difficulty, status) values
  ('aaaa0000-0000-0000-0000-000000000006', '11111111-1111-1111-1111-111111111111',
   'aaaa0000-0000-0000-0000-000000000002', 'Rewrite it in assembly', 'L', 'dropped');

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
-- The touch triggers would stamp now() over our backdating. Four items land on the same age and
-- differ only in status: ...0003 paused (a real hanging thread), ...0005 done, ...0006 dropped,
-- and project ...0002 done. Backdating ...0003 is safe for the view test below: its
-- last_activity_at comes from its progress logs (coalesce(l.logged_at, t.updated_at)), and
-- next_step is picked by progress_logs.created_at, which none of this touches.
alter table tasks disable trigger tasks_touch_updated_at;
update tasks set updated_at = now() - interval '40 days'
 where id in ('aaaa0000-0000-0000-0000-000000000003',
              'aaaa0000-0000-0000-0000-000000000005',
              'aaaa0000-0000-0000-0000-000000000006');
alter table tasks enable trigger tasks_touch_updated_at;
alter table projects disable trigger projects_touch_updated_at;
update projects set updated_at = now() - interval '40 days'
 where id = 'aaaa0000-0000-0000-0000-000000000002';
alter table projects enable trigger projects_touch_updated_at;
select login('11111111-1111-1111-1111-111111111111');

select is(
  (rpc_groom_stale('task', 'aaaa0000-0000-0000-0000-000000000003') ->> 'xp_awarded')::int,
  15, 'grooming a genuinely open, stale item pays 15');

-- Age alone used to be enough: a finished task read as stale and paid out again every day.
select is(
  (rpc_groom_stale('task', 'aaaa0000-0000-0000-0000-000000000005') ->> 'stale')::boolean,
  false, 'a completed item is never stale, however old');

select is(
  (rpc_groom_stale('task', 'aaaa0000-0000-0000-0000-000000000005') ->> 'xp_awarded')::int,
  0, 'a completed item pays nothing, however old');

select is(
  (rpc_groom_stale('task', 'aaaa0000-0000-0000-0000-000000000006') ->> 'xp_awarded')::int,
  0, 'a dropped item pays nothing, however old');

-- the project branch reads its own status, so it needs its own case
select is(
  (rpc_groom_stale('project', 'aaaa0000-0000-0000-0000-000000000002') ->> 'xp_awarded')::int,
  0, 'a completed project pays nothing, however old');

select is(
  (rpc_groom_stale('task', 'aaaa0000-0000-0000-0000-000000000004') ->> 'xp_awarded')::int,
  0, 'grooming a fresh item pays nothing');

-- ---- hanging threads ---------------------------------------------------------------
select is(
  (select next_step from v_hanging_threads
    where item_id = 'aaaa0000-0000-0000-0000-000000000003'),
  'resume tomorrow', 'the paused task hangs with its latest next step');

-- ---- level curve & the payload the client reads --------------------------------------
select is(level_for_xp(0), 1, 'no XP is level 1');
select is(level_for_xp(282), 1, 'one XP short of level 2 is still level 1');
select is(level_for_xp(283), 2, 'level 2 lands exactly on the curve');

select is(
  (rpc_update_status('task', 'aaaa0000-0000-0000-0000-000000000004', 'in_progress',
                     'reopened', 'polish it') ->> 'leveled_up')::boolean,
  false, 'leveled_up is false while the total stays under the next threshold');

-- ---- the next step as a task reference ----------------------------------------------
-- Last on purpose: these calls write logs and pay XP, so running them earlier would move the
-- totals every assertion above counts.
select login('11111111-1111-1111-1111-111111111111');

-- `do`, not a bare select: the call has to happen between assertions without printing a row
-- into the TAP stream.
do $$ begin perform rpc_update_status('task', 'aaaa0000-0000-0000-0000-000000000003',
     'paused', 'stuck again', '', null, 'user', 'aaaa0000-0000-0000-0000-000000000004'); end $$;

select is(
  (select next_step from progress_logs order by created_at desc limit 1),
  'Write RLS', 'a picked task with no prose snapshots its title into next_step');

select is(
  (select next_step_task_title from v_hanging_threads
    where item_id = 'aaaa0000-0000-0000-0000-000000000003'),
  'Write RLS', 'the view carries the referenced task through to the client');

do $$ begin perform rpc_update_status('task', 'aaaa0000-0000-0000-0000-000000000003',
     'paused', 'stuck again', 'my own words', null, 'user',
     'aaaa0000-0000-0000-0000-000000000004'); end $$;

select is(
  (select next_step from progress_logs order by created_at desc limit 1),
  'my own words', 'prose wins over the snapshot when both are given');

select throws_ok(
  $$select rpc_update_status('task', 'aaaa0000-0000-0000-0000-000000000003', 'paused', 'x', 'y',
                             null, 'user', 'aaaa0000-0000-0000-0000-000000000003')$$,
  '22023',
  'a task cannot be its own next step',
  'an item cannot point at itself as its own next step');

-- Someone else's task must be indistinguishable from a missing one.
reset role;
insert into life_areas (id, user_id, name)
values ('bbbb0000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Theirs');
insert into projects (id, user_id, area_id, title)
values ('bbbb0000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222',
        'bbbb0000-0000-0000-0000-000000000001', 'Their project');
insert into tasks (id, user_id, project_id, title)
values ('bbbb0000-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222',
        'bbbb0000-0000-0000-0000-000000000002', 'Their task');
select login('11111111-1111-1111-1111-111111111111');

select throws_ok(
  $$select rpc_update_status('task', 'aaaa0000-0000-0000-0000-000000000003', 'paused', 'x', 'y',
                             null, 'user', 'bbbb0000-0000-0000-0000-000000000003')$$,
  'P0002',
  'next step task not found',
  'another user''s task cannot be referenced as a next step');

select * from finish();
rollback;
