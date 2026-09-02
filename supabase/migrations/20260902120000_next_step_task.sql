-- The next step can now point at a real task, not only at prose.
--
-- `on delete set null`, never cascade: `progress_logs.task_id` cascades (core_schema.sql:63)
-- because a log about a deleted task has nothing left to be about. This column is the opposite
-- relation — the log belongs to *another* item and merely references this task, quite possibly
-- from a different project. Cascading here would let deleting task B erase project A's unrelated
-- history, and progress_logs has no delete policy precisely because that history is the product.
--
-- Grants are table-level (rls.sql:33), so a new column needs no grant change.
alter table progress_logs
  add column next_step_task_id uuid references tasks on delete set null;

-- "The next step of X is X" is not a next step; it is a log that would resume onto itself.
alter table progress_logs
  add constraint progress_logs_next_step_not_self
  check (next_step_task_id is null or next_step_task_id is distinct from task_id);

-- Reads go the other way too: "which logs point at this task" is what makes the reference
-- findable at all, and without an index it is a sequential scan of the whole history.
create index progress_logs_next_step_task_idx on progress_logs (next_step_task_id);

-- ---------------------------------------------------------------------------------------
-- rpc_update_status gains the reference. Unlike groom_stale
-- (20260901120000_groom_stale_status.sql:13) this changes the signature, so `create or replace`
-- would not replace anything: it would add a second overload, and the existing seven-argument
-- call would then match both candidates — `function is not unique`, every status update dead.
-- Hence drop + create. Dropping also drops the grant (rpc_update_status.sql:236), which is
-- re-issued at the bottom of this file; without it nobody can call the RPC at all.
--
-- The new parameter is last and defaults to null, so the currently deployed client keeps
-- working against the new function and this migration is safe to apply before the frontend.
-- ---------------------------------------------------------------------------------------
drop function rpc_update_status(text, uuid, item_status, text, text, text, text);

create function rpc_update_status(
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
  v_old_updated timestamptz;
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

  -- Ownership check doubles as the row lookup: no row for this user => no such item.
  if p_item_type = 'task' then
    select t.project_id, t.status, t.difficulty, t.updated_at, p.area_id
      into v_project_id, v_old_status, v_difficulty, v_old_updated, v_area_id
      from tasks t join projects p on p.id = t.project_id
     where t.id = p_item_id and t.user_id = v_user;
    v_task_id := p_item_id;
  else
    select p.id, p.status, p.updated_at, p.area_id
      into v_project_id, v_old_status, v_old_updated, v_area_id
      from projects p
     where p.id = p_item_id and p.user_id = v_user;
  end if;

  if v_project_id is null then
    raise exception 'item not found' using errcode = 'P0002';
  end if;

  -- The referenced task must be the caller's own — same shape as the ownership guard in
  -- rpc_pick_focus (focus_snooze_views.sql:37-42), since security definer means the insert
  -- itself would not be filtered by RLS. Fetching the title in the same round trip is what
  -- makes the snapshot below free.
  if p_next_step_task_id is not null then
    select title into v_next_step_title
      from tasks where id = p_next_step_task_id and user_id = v_user;
    if v_next_step_title is null then
      raise exception 'next step task not found' using errcode = 'P0002';
    end if;
    if p_next_step_task_id is not distinct from v_task_id then
      raise exception 'a task cannot be its own next step' using errcode = '22023';
    end if;
    -- Snapshot: picking a task without typing anything still leaves readable prose behind, so
    -- every place that renders next_step keeps working untouched, and the sentence survives
    -- the task being deleted later (the reference goes null, the words do not).
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

  if p_item_type = 'task' then
    update tasks
       set status = p_new_status,
           completed_at = case when p_new_status = 'done' then now() else null end
     where id = p_item_id and user_id = v_user;
  else
    update projects
       set status = p_new_status,
           completed_at = case when p_new_status = 'done' then now() else null end
     where id = p_item_id and user_id = v_user;
  end if;

  insert into progress_logs (user_id, project_id, task_id, left_off, next_step, note, source,
                             next_step_task_id)
  values (v_user, v_project_id, v_task_id, p_left_off, v_next_step, p_note, p_source::log_source,
          p_next_step_task_id);

  -- XP (docs/01 §8). Check-in fires once per local day, before anything else.
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
    -- A completion already pays for itself; everything else is a progress update.
    v_xp := v_xp + award_xp(v_user, 'progress_update', 8, v_area_id, v_project_id, v_task_id);
  end if;

  -- Streak (docs/01 §8): a day counts with >=1 XP action; a gap burns a freeze token if held.
  select * into v_streak from streaks where user_id = v_user for update;
  if not found then
    insert into streaks (user_id, current, best, last_active_date, freeze_tokens)
    values (v_user, 1, 1, v_today, 0)
    returning * into v_streak;
  else
    if v_streak.last_active_date is null then
      v_streak.current := 1;
    elsif v_streak.last_active_date = v_today then
      null; -- already counted today
    elsif v_streak.last_active_date = v_today - 1 then
      v_streak.current := v_streak.current + 1;
    elsif v_streak.freeze_tokens > 0 then
      v_streak.freeze_tokens := v_streak.freeze_tokens - 1;
      v_streak.current := v_streak.current + 1;
    else
      v_streak.current := 1;
    end if;

    if v_streak.last_active_date is distinct from v_today then
      -- one token per completed 7-day week, never more than two in hand
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

  -- Badges. grant_badge is idempotent, so re-running an action never re-awards.
  if exists (select 1 from tasks where user_id = v_user and status = 'done') then
    if grant_badge(v_user, 'first_quest') then v_new_badges := v_new_badges || 'first_quest'::text; end if;
  end if;

  if (select count(*) from progress_logs where user_id = v_user) >= 10 then
    if grant_badge(v_user, 'threadkeeper') then v_new_badges := v_new_badges || 'threadkeeper'::text; end if;
  end if;

  if exists (select 1 from projects where user_id = v_user and status = 'done') then
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

  -- "Paused for over 30 days" is read from the item's last touch, which is what paused it.
  if v_old_status = 'paused'
     and p_new_status in ('in_progress', 'planned')
     and v_old_updated < now() - interval '30 days' then
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

-- Re-issued because the drop above took the original grant with it.
grant execute on function rpc_update_status(text, uuid, item_status, text, text, text, text, uuid) to authenticated;

-- ---------------------------------------------------------------------------------------
-- The view carries the reference to the screens. `create or replace` keeps the grant at
-- focus_snooze_views.sql:194 and every existing column in place; drop + create would take the
-- grant with it, exactly as the function above did. Appending at the end is the only shape
-- `create or replace view` accepts, and digest_payload (digest.sql:53-59) names the columns it
-- selects, so it is untouched by four new ones.
-- ---------------------------------------------------------------------------------------
create or replace view v_hanging_threads with (security_invoker = true) as
with latest_log as (
  select distinct on (coalesce(task_id, project_id))
         coalesce(task_id, project_id) as item_id,
         left_off, next_step, next_step_task_id, created_at as logged_at
    from progress_logs
   order by coalesce(task_id, project_id), created_at desc
)
select 'task' as item_type, t.id as item_id, t.user_id, t.title, t.status, t.updated_at,
       p.id as project_id, p.title as project_title, p.area_id, a.name as area_name, a.color as area_color,
       l.left_off, l.next_step, l.logged_at,
       coalesce(l.logged_at, t.updated_at) as last_activity_at,
       l.next_step_task_id,
       nt.title as next_step_task_title,
       nt.status as next_step_task_status,
       nt.project_id as next_step_task_project_id
  from tasks t
  join projects p on p.id = t.project_id
  left join life_areas a on a.id = p.area_id
  left join latest_log l on l.item_id = t.id
  -- on the primary key, so it can only ever add columns, never rows
  left join tasks nt on nt.id = l.next_step_task_id
 where t.status in ('in_progress', 'paused', 'blocked')
   and (t.snoozed_until is null or t.snoozed_until <= current_date)
union all
select 'project', p.id, p.user_id, p.title, p.status, p.updated_at,
       p.id, p.title, p.area_id, a.name, a.color,
       l.left_off, l.next_step, l.logged_at,
       coalesce(l.logged_at, p.updated_at),
       l.next_step_task_id, nt.title, nt.status, nt.project_id
  from projects p
  left join life_areas a on a.id = p.area_id
  left join latest_log l on l.item_id = p.id
  left join tasks nt on nt.id = l.next_step_task_id
 where p.status in ('in_progress', 'paused', 'blocked')
   and (p.snoozed_until is null or p.snoozed_until <= current_date);
