-- Issue #68 · Necromancer reads when the status last changed, not when the row was last touched.
--
-- The badge ("revive something paused for 30+ days") compared against updated_at. But adding a
-- task, editing, a focus session — every touch since 20261005120000_untouched_first_ordering.sql
-- — restamps updated_at, so a project paused for months but touched last week revived without
-- the badge. status_changed_at moves only when `status` does. touch_updated_at never names it.
--
-- Who stamps: a BEFORE trigger, not rpc_update_status. The RPC is not the only writer of
-- `status` — the project edit sheet (useUpdateProject) PATCHes it straight through PostgREST —
-- and a trigger also closes the column to clients: a user who could write it could backdate it
-- and collect the badge.
--
-- Only the necromancer condition reads the column; isStale / hanging threads / grooming keep
-- reading updated_at on purpose (they are about neglect, not about status age).
-- Existing badge holders are untouched: grant_badge is idempotent and nothing here revokes.

-- ---------------------------------------------------------------------------------------
-- 1. The column, backfilled from updated_at (best available guess for existing rows)
-- ---------------------------------------------------------------------------------------
alter table tasks add column status_changed_at timestamptz not null default now();
alter table projects add column status_changed_at timestamptz not null default now();

-- The backfill is an UPDATE; without the flag touch_updated_at would restamp updated_at to now()
-- and the propagation triggers would carry it to projects and areas (20261007120000).
-- It runs before the stamp trigger below exists (and with auth.uid() null, which it ignores).
select set_config('questlog.skip_touch', 'on', true);
update tasks set status_changed_at = updated_at;
update projects set status_changed_at = updated_at;
select set_config('questlog.skip_touch', 'off', true);

-- ---------------------------------------------------------------------------------------
-- 2. The stamp
-- ---------------------------------------------------------------------------------------
-- End-user requests (auth.uid() set) never choose the value: insert => now(), update => now()
-- if the status changed, else the old value. Without a user (service_role restore, postgres,
-- migrations) the row is left alone, so scripts/restore.mjs puts the backup's value back.
create function stamp_status_changed_at() returns trigger
language plpgsql as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    new.status_changed_at := now();
  else
    new.status_changed_at := old.status_changed_at;
  end if;
  return new;
end;
$$;

create trigger projects_stamp_status_changed_at before insert or update on projects
  for each row execute function stamp_status_changed_at();
create trigger tasks_stamp_status_changed_at before insert or update on tasks
  for each row execute function stamp_status_changed_at();

-- ---------------------------------------------------------------------------------------
-- 2. rpc_update_status — base: 20261009130000_sharing_role_aware_rpcs.sql:17-231
--    Verbatim except the lines marked `#68`.
-- ---------------------------------------------------------------------------------------
create or replace function rpc_update_status(
  p_item_type text,
  p_item_id uuid,
  p_new_status item_status,
  p_left_off text,
  p_next_step text,
  p_note text default null,
  p_source text default 'user',
  p_next_step_task_id uuid default null
) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_tz text;
  v_today date;
  v_project_id uuid;
  v_task_id uuid;
  v_area_id uuid;
  v_old_status item_status;
  v_old_status_changed timestamptz;  -- #68: was v_old_updated; read before the UPDATE below
  v_difficulty difficulty;
  v_first_today boolean;
  v_next_step text := p_next_step;
  v_next_step_title text;
  v_xp int := 0;
  v_prev_total int;
  v_total int;
  v_level int;
  v_prev_level int;
  v_streak streaks%rowtype;
  v_new_badges text[] := '{}';
  v_active_areas int;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_item_type not in ('task', 'project') then
    raise exception 'p_item_type must be task or project, got %', p_item_type using errcode = '22023';
  end if;

  select coalesce(timezone, 'UTC') into v_tz from profiles where id = v_user;
  v_tz := coalesce(v_tz, 'UTC');
  v_today := (now() at time zone v_tz)::date;

  -- Role check doubles as the row lookup: no row for this caller => no such item.
  -- #74: a task is the editor's to move, a project row only the admin's (as in RLS, #73).
  if p_item_type = 'task' then
    select t.project_id, t.status, t.difficulty, t.status_changed_at, p.area_id  -- #68
      into v_project_id, v_old_status, v_difficulty, v_old_status_changed, v_area_id
      from tasks t join projects p on p.id = t.project_id
     where t.id = p_item_id and project_role(t.project_id) >= 'editor';
    v_task_id := p_item_id;
  else
    select p.id, p.status, p.status_changed_at, p.area_id  -- #68
      into v_project_id, v_old_status, v_old_status_changed, v_area_id
      from projects p
     where p.id = p_item_id and project_role(p.id) = 'admin';
  end if;

  if v_project_id is null then
    raise exception 'item not found' using errcode = 'P0002';
  end if;

  -- #74: the referenced task must be one the caller can see.
  if p_next_step_task_id is not null then
    select title into v_next_step_title
      from tasks where id = p_next_step_task_id and project_role(project_id) is not null;
    if v_next_step_title is null then
      raise exception 'next step task not found' using errcode = 'P0002';
    end if;
    if p_next_step_task_id is not distinct from v_task_id then
      raise exception 'a task cannot be its own next step' using errcode = '22023';
    end if;
    if coalesce(trim(p_next_step), '') = '' then
      v_next_step := v_next_step_title;
    end if;
  end if;

  select not exists (
    select 1 from xp_events
     where user_id = v_user and (created_at at time zone v_tz)::date = v_today
  ) into v_first_today;

  select coalesce(sum(xp), 0) into v_prev_total from xp_events where user_id = v_user;
  v_prev_level := level_for_xp(v_prev_total);

  -- #74: same conditions as the lookup above.
  if p_item_type = 'task' then
    update tasks
       set status = p_new_status,
           completed_at = case when p_new_status = 'done' then now() else null end
     where id = p_item_id and project_role(project_id) >= 'editor';
  else
    update projects
       set status = p_new_status,
           completed_at = case when p_new_status = 'done' then now() else null end
     where id = p_item_id and project_role(id) = 'admin';
  end if;

  insert into progress_logs (user_id, project_id, task_id, left_off, next_step, note, source,
                             next_step_task_id)
  values (v_user, v_project_id, v_task_id, p_left_off, v_next_step, p_note, p_source::log_source,
          p_next_step_task_id);

  if v_first_today then
    v_xp := v_xp + award_xp(v_user, 'daily_check_in', 10, v_area_id, v_project_id, v_task_id);
  end if;

  if p_new_status = 'done' and v_old_status is distinct from 'done' then
    if p_item_type = 'task' then
      v_xp := v_xp + award_xp(
        v_user, 'task_done',
        case v_difficulty when 'S' then 10 when 'M' then 25 else 50 end,
        v_area_id, v_project_id, v_task_id);
    else
      v_xp := v_xp + award_xp(v_user, 'project_done', 100, v_area_id, v_project_id, null);
    end if;
  else
    v_xp := v_xp + award_xp(v_user, 'progress_update', 8, v_area_id, v_project_id, v_task_id);
  end if;

  select * into v_streak from streaks where user_id = v_user for update;
  if not found then
    insert into streaks (user_id, current, best, last_active_date, freeze_tokens)
    values (v_user, 1, 1, v_today, 0)
    returning * into v_streak;
  else
    if v_streak.last_active_date is null then
      v_streak.current := 1;
    elsif v_streak.last_active_date = v_today then
      null;
    elsif v_streak.last_active_date = v_today - 1 then
      v_streak.current := v_streak.current + 1;
    elsif v_streak.freeze_tokens > 0 then
      v_streak.freeze_tokens := v_streak.freeze_tokens - 1;
      v_streak.current := v_streak.current + 1;
    else
      v_streak.current := 1;
    end if;

    if v_streak.last_active_date is distinct from v_today then
      if v_streak.current % 7 = 0 then
        v_streak.freeze_tokens := least(v_streak.freeze_tokens + 1, 2);
      end if;
      v_streak.best := greatest(v_streak.best, v_streak.current);
      v_streak.last_active_date := v_today;

      update streaks
         set current = v_streak.current,
             best = v_streak.best,
             last_active_date = v_streak.last_active_date,
             freeze_tokens = v_streak.freeze_tokens
       where user_id = v_user;
    end if;
  end if;

  select coalesce(sum(xp), 0) into v_total from xp_events where user_id = v_user;
  v_level := level_for_xp(v_total);

  -- #74: first_quest / finisher follow the person who did the work, not who owns the row.
  if exists (select 1 from xp_events where user_id = v_user and action_type = 'task_done') then
    if grant_badge(v_user, 'first_quest') then v_new_badges := v_new_badges || 'first_quest'::text; end if;
  end if;

  if (select count(*) from progress_logs where user_id = v_user) >= 10 then
    if grant_badge(v_user, 'threadkeeper') then v_new_badges := v_new_badges || 'threadkeeper'::text; end if;
  end if;

  if exists (select 1 from xp_events where user_id = v_user and action_type = 'project_done') then
    if grant_badge(v_user, 'finisher') then v_new_badges := v_new_badges || 'finisher'::text; end if;
  end if;

  if p_new_status = 'dropped' then
    if grant_badge(v_user, 'honest_quitter') then v_new_badges := v_new_badges || 'honest_quitter'::text; end if;
  end if;

  if v_streak.current >= 7 then
    if grant_badge(v_user, 'week_one') then v_new_badges := v_new_badges || 'week_one'::text; end if;
  end if;
  if v_streak.current >= 14 then
    if grant_badge(v_user, 'fortnight') then v_new_badges := v_new_badges || 'fortnight'::text; end if;
  end if;
  if v_streak.current >= 30 then
    if grant_badge(v_user, 'monthly_legend') then v_new_badges := v_new_badges || 'monthly_legend'::text; end if;
  end if;

  if v_level >= 10 then
    if grant_badge(v_user, 'level_10') then v_new_badges := v_new_badges || 'level_10'::text; end if;
  end if;

  select count(distinct area_id) into v_active_areas
    from xp_events
   where user_id = v_user and area_id is not null and created_at > now() - interval '7 days';
  if v_active_areas >= 4 then
    if grant_badge(v_user, 'renaissance') then v_new_badges := v_new_badges || 'renaissance'::text; end if;
  end if;

  if v_old_status = 'paused'
     and p_new_status in ('in_progress', 'planned')
     and v_old_status_changed < now() - interval '30 days' then  -- #68
    if grant_badge(v_user, 'necromancer') then v_new_badges := v_new_badges || 'necromancer'::text; end if;
  end if;

  return json_build_object(
    'xp_awarded', v_xp,
    'total_xp', v_total,
    'level', v_level,
    'leveled_up', v_level > v_prev_level,
    'streak_current', v_streak.current,
    'streak_best', v_streak.best,
    'freeze_tokens', v_streak.freeze_tokens,
    'new_badges', to_json(v_new_badges)
  );
end;
$$;

grant execute on function rpc_update_status(text, uuid, item_status, text, text, text, text, uuid) to authenticated;
