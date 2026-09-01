-- Fix · rpc_groom_stale paid for finished work.
--
-- The original (focus_snooze_views.sql:91-136) read only `updated_at`: a task completed 40 days
-- ago looked exactly like an abandoned one, so it reported `stale: true` and paid 15 XP — once a
-- day, forever, for work already done. Staleness is neglect of *open* work, so the check now also
-- takes the status, using the same three the hanging-threads view lists
-- (focus_snooze_views.sql:155 for tasks, :165 for projects) and the client already mirrors in
-- STALE_STATUSES (apps/web/src/features/tasks/taskOrder.ts:41).
--
-- The staleness expression was duplicated (the `if` at :124 and the returned flag at :134); it is
-- one `v_stale` now, so the payout and the flag cannot drift apart again. `create or replace`
-- keeps the signature, so the grant at focus_snooze_views.sql:193 carries over untouched.
create or replace function rpc_groom_stale(p_item_type text, p_item_id uuid) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_stale_days int;
  v_updated timestamptz;
  v_status item_status;
  v_project uuid;
  v_task uuid;
  v_area uuid;
  v_stale boolean;
  v_xp int := 0;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select coalesce(stale_days, 14) into v_stale_days from profiles where id = v_user;
  v_stale_days := coalesce(v_stale_days, 14);

  if p_item_type = 'task' then
    select t.updated_at, t.status, t.project_id, t.id, p.area_id
      into v_updated, v_status, v_project, v_task, v_area
      from tasks t join projects p on p.id = t.project_id
     where t.id = p_item_id and t.user_id = v_user;
  elsif p_item_type = 'project' then
    select p.updated_at, p.status, p.id, null::uuid, p.area_id
      into v_updated, v_status, v_project, v_task, v_area
      from projects p where p.id = p_item_id and p.user_id = v_user;
  else
    raise exception 'p_item_type must be task or project, got %', p_item_type using errcode = '22023';
  end if;

  if v_updated is null then
    raise exception 'item not found' using errcode = 'P0002';
  end if;

  -- done/dropped are finished, idea/planned were never started: neither is a neglected thread.
  v_stale := v_status in ('in_progress', 'paused', 'blocked')
         and v_updated < now() - make_interval(days => v_stale_days);

  if v_stale and not exists (
       select 1 from xp_events
        where user_id = v_user and action_type = 'groom_stale'
          and coalesce(task_id, project_id) = p_item_id
          and created_at > now() - interval '1 day'
     ) then
    v_xp := award_xp(v_user, 'groom_stale', 15, v_area, v_project, v_task);
  end if;

  return json_build_object('xp_awarded', v_xp, 'stale', v_stale);
end;
$$;
