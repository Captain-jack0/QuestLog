-- Issue #74 (sharing 2/6, parent #26) · Security definer paths and the touch triggers learn roles.
--
-- RLS never sees a security definer function, so every RPC below did its own ownership lookup as
-- `user_id = v_user`. With members (#73) that check is both too narrow (an editor cannot move a
-- shared task) and aimed at the wrong column (tasks.user_id is the creator, not the owner). Each
-- lookup now asks project_role() — which answers only for auth.uid() — and XP, badges and timers
-- keep going to the caller.
--
-- Signatures are unchanged, so every function is `create or replace` (grants and trigger bindings
-- survive; they are restated at the bottom anyway). Bodies are the latest definitions verbatim
-- except for the lines marked `#74`. No row is updated or deleted: until #75 nobody is a member,
-- the owner is 'admin', and every check reads exactly as before for every existing account.

-- ---------------------------------------------------------------------------------------
-- rpc_update_status — base: 20260902120000_next_step_task.sql:35-258
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

  -- Role check doubles as the row lookup: no row for this caller => no such item.
  -- #74: a task is the editor's to move, a project row only the admin's (as in RLS, #73).
  if p_item_type = 'task' then
    select t.project_id, t.status, t.difficulty, t.updated_at, p.area_id
      into v_project_id, v_old_status, v_difficulty, v_old_updated, v_area_id
      from tasks t join projects p on p.id = t.project_id
     where t.id = p_item_id and project_role(t.project_id) >= 'editor';
    v_task_id := p_item_id;
  else
    select p.id, p.status, p.updated_at, p.area_id
      into v_project_id, v_old_status, v_old_updated, v_area_id
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

-- ---------------------------------------------------------------------------------------
-- rpc_groom_stale — base: 20260901120000_groom_stale_status.sql:13-65
-- ---------------------------------------------------------------------------------------
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

  -- #74: grooming is a status decision, so it takes the rpc_update_status roles.
  if p_item_type = 'task' then
    select t.updated_at, t.status, t.project_id, t.id, p.area_id
      into v_updated, v_status, v_project, v_task, v_area
      from tasks t join projects p on p.id = t.project_id
     where t.id = p_item_id and project_role(t.project_id) >= 'editor';
  elsif p_item_type = 'project' then
    select p.updated_at, p.status, p.id, null::uuid, p.area_id
      into v_updated, v_status, v_project, v_task, v_area
      from projects p where p.id = p_item_id and project_role(p.id) = 'admin';
  else
    raise exception 'p_item_type must be task or project, got %', p_item_type using errcode = '22023';
  end if;

  if v_updated is null then
    raise exception 'item not found' using errcode = 'P0002';
  end if;

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

-- ---------------------------------------------------------------------------------------
-- rpc_pick_focus — base: 20260818120400_focus_snooze_views.sql:10-60
-- ---------------------------------------------------------------------------------------
create or replace function rpc_pick_focus(p_date date, p_items jsonb) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_item jsonb;
  v_task uuid;
  v_project uuid;
  v_count int := 0;
  v_xp int := 0;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if jsonb_typeof(p_items) <> 'array' then
    raise exception 'p_items must be a json array' using errcode = '22023';
  end if;

  delete from focus_items where user_id = v_user and date = p_date;

  for v_item in select * from jsonb_array_elements(p_items) loop
    exit when v_count >= 3;
    v_task := nullif(v_item ->> 'task_id', '')::uuid;
    v_project := nullif(v_item ->> 'project_id', '')::uuid;

    if num_nonnulls(v_task, v_project) <> 1 then
      raise exception 'each focus item needs exactly one of task_id / project_id' using errcode = '22023';
    end if;
    -- #74: anything the caller can see may go on their own focus list.
    if v_task is not null and not exists (select 1 from tasks where id = v_task and project_role(project_id) is not null) then
      raise exception 'task not found' using errcode = 'P0002';
    end if;
    if v_project is not null and not exists (select 1 from projects where id = v_project and project_role(id) is not null) then
      raise exception 'project not found' using errcode = 'P0002';
    end if;

    insert into focus_items (user_id, date, task_id, project_id)
    values (v_user, p_date, v_task, v_project);
    v_count := v_count + 1;
  end loop;

  if v_count > 0 and not exists (
    select 1 from xp_events
     where user_id = v_user and action_type = 'pick_focus'
       and created_at >= p_date::timestamptz and created_at < (p_date + 1)::timestamptz
  ) then
    v_xp := award_xp(v_user, 'pick_focus', 5);
  end if;

  return json_build_object('items', v_count, 'xp_awarded', v_xp);
end;
$$;

-- ---------------------------------------------------------------------------------------
-- rpc_snooze — base: 20261007120000_snooze_is_not_a_touch.sql:80-110
--
-- #74: the project owner only [default, CEO may change]. snoozed_until is one shared column, so
-- a member's snooze would also drop the item off the owner's Today. Owner, not 'admin': an
-- admin member is still not the person whose Today this is.
-- ---------------------------------------------------------------------------------------
create or replace function rpc_snooze(p_item_type text, p_item_id uuid, p_until date) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_found boolean;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if p_item_type = 'task' then
    perform set_config('questlog.skip_touch', 'on', true);
    update tasks t set snoozed_until = p_until
     where t.id = p_item_id
       and exists (select 1 from projects p where p.id = t.project_id and p.user_id = v_user);
  elsif p_item_type = 'project' then
    perform set_config('questlog.skip_touch', 'on', true);
    update projects set snoozed_until = p_until where id = p_item_id and user_id = v_user;
  else
    raise exception 'p_item_type must be task or project, got %', p_item_type using errcode = '22023';
  end if;
  get diagnostics v_found = row_count;
  perform set_config('questlog.skip_touch', '', true);

  if not v_found then
    raise exception 'item not found' using errcode = 'P0002';
  end if;
  return json_build_object('snoozed_until', p_until);
end;
$$;

-- ---------------------------------------------------------------------------------------
-- rpc_start_timer — base: 20261008120000_parallel_timers.sql:31-90 (#45's redefinition)
-- ---------------------------------------------------------------------------------------
create or replace function rpc_start_timer(p_item_type text, p_item_id uuid, p_mode text default 'timer')
returns json
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_project uuid;
  v_task uuid;
  v_entry time_entries%rowtype;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_mode not in ('timer', 'pomodoro') then
    raise exception 'p_mode must be timer or pomodoro' using errcode = '22023';
  end if;

  -- #74: clocking work is editing work. The entry below is still the caller's own.
  if p_item_type = 'task' then
    select t.project_id, t.id into v_project, v_task
      from tasks t where t.id = p_item_id and project_role(t.project_id) >= 'editor';
  elsif p_item_type = 'project' then
    select p.id, null::uuid into v_project, v_task
      from projects p where p.id = p_item_id and project_role(p.id) >= 'editor';
  else
    raise exception 'p_item_type must be task or project, got %', p_item_type using errcode = '22023';
  end if;

  if v_project is null then
    raise exception 'item not found' using errcode = 'P0002';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 45));

  if exists (
    select 1 from time_entries
     where user_id = v_user and ended_at is null
       and task_id is not distinct from v_task
       and (v_task is not null or project_id = v_project)
  ) then
    raise exception 'a timer is already running on this item' using errcode = '23505';
  end if;

  if (select count(*) from time_entries where user_id = v_user and ended_at is null) >= 3 then
    raise exception 'Up to 3 timers can run at once — stop one first' using errcode = '54000';
  end if;

  insert into time_entries (user_id, project_id, task_id, mode)
  values (v_user, v_project, v_task, p_mode)
  returning * into v_entry;

  return json_build_object(
    'id', v_entry.id,
    'started_at', v_entry.started_at,
    'project_id', v_entry.project_id,
    'task_id', v_entry.task_id,
    'mode', v_entry.mode
  );
end;
$$;

-- ---------------------------------------------------------------------------------------
-- Touch triggers. `user_id = new.user_id` kept a touch inside one account; with members the
-- right question is whether the caller may edit the parent (#74). Still security invoker, so a
-- direct write is filtered by the parent's update policy as well.
--
-- touch_parent_project — base: 20261007120000_snooze_is_not_a_touch.sql:51-61
-- touch_timed_item     — base: 20261005120000_untouched_first_ordering.sql:96-108
-- touch_parent_area is unchanged.
-- ---------------------------------------------------------------------------------------
create or replace function touch_parent_project() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_setting('questlog.skip_touch', true) = 'on' then
    return null;
  end if;
  update projects set updated_at = now()
   where id = new.project_id and project_role(new.project_id) >= 'editor';
  return null;
end;
$$;

create or replace function touch_timed_item() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.task_id is not null then
    update tasks set updated_at = now()
     where id = new.task_id and project_role(new.project_id) >= 'editor';
  else
    update projects set updated_at = now()
     where id = new.project_id and project_role(new.project_id) >= 'editor';
  end if;
  return null;
end;
$$;

-- ---------------------------------------------------------------------------------------
-- Personal-screen views (CEO decision on #74). They are security_invoker, so until #73 RLS alone
-- kept them to the caller's rows; members now pass RLS on shared projects and areas, and those
-- rows would land on the member's own Today, area stats and timer. Each view now names whose
-- screen it is. Same columns in the same order (`create or replace view` only appends), and
-- `security_invoker` restated because `create or replace view` drops options it is not given.
-- ---------------------------------------------------------------------------------------

-- Base: 20260902120000_next_step_task.sql:270-305. The project owner's threads — all tasks in
-- their projects, whoever created them. `logged_by` appended last (#74).
--
-- No claims (auth.uid() is null) => no filter: digest_payload reads this view as the definer on
-- service_role's behalf and filters by p_user itself. That context bypasses RLS anyway. anon
-- (which production may still grant select on views) gets no rows either: auth.uid() is null,
-- but every policy underneath is `to authenticated`, so RLS returns nothing.
create or replace view v_hanging_threads with (security_invoker = true) as
with latest_log as (
  select distinct on (coalesce(task_id, project_id))
         coalesce(task_id, project_id) as item_id,
         left_off, next_step, next_step_task_id, created_at as logged_at,
         user_id as logged_by
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
       nt.project_id as next_step_task_project_id,
       l.logged_by
  from tasks t
  join projects p on p.id = t.project_id
  left join life_areas a on a.id = p.area_id
  left join latest_log l on l.item_id = t.id
  left join tasks nt on nt.id = l.next_step_task_id
 where t.status in ('in_progress', 'paused', 'blocked')
   and (t.snoozed_until is null or t.snoozed_until <= current_date)
   and (auth.uid() is null or p.user_id = auth.uid())
union all
select 'project', p.id, p.user_id, p.title, p.status, p.updated_at,
       p.id, p.title, p.area_id, a.name, a.color,
       l.left_off, l.next_step, l.logged_at,
       coalesce(l.logged_at, p.updated_at),
       l.next_step_task_id, nt.title, nt.status, nt.project_id,
       l.logged_by
  from projects p
  left join life_areas a on a.id = p.area_id
  left join latest_log l on l.item_id = p.id
  left join tasks nt on nt.id = l.next_step_task_id
 where p.status in ('in_progress', 'paused', 'blocked')
   and (p.snoozed_until is null or p.snoozed_until <= current_date)
   and (auth.uid() is null or p.user_id = auth.uid());

-- Base: 20260818120400_focus_snooze_views.sql:168-189. The area owner's areas.
create or replace view v_area_stats with (security_invoker = true) as
select a.id as area_id,
       a.user_id,
       a.name,
       a.color,
       a.icon,
       coalesce(x.total_xp, 0) as total_xp,
       level_for_xp(coalesce(x.total_xp, 0)::int) as level,
       coalesce(pr.open_projects, 0) as open_projects,
       coalesce(tk.open_tasks, 0) as open_tasks
  from life_areas a
  left join (
    select area_id, sum(xp)::int as total_xp from xp_events where area_id is not null group by area_id
  ) x on x.area_id = a.id
  left join (
    select area_id, count(*)::int as open_projects from projects
     where status in ('idea', 'planned', 'in_progress', 'paused', 'blocked') group by area_id
  ) pr on pr.area_id = a.id
  left join (
    select p.area_id, count(*)::int as open_tasks from tasks t join projects p on p.id = t.project_id
     where t.status in ('idea', 'planned', 'in_progress', 'paused', 'blocked') group by p.area_id
  ) tk on tk.area_id = a.id
 where a.user_id = auth.uid();

-- Base: 20261008120000_parallel_timers.sql:208-211. A timer belongs to whoever started it.
create or replace view v_running_timer with (security_invoker = true) as
select distinct on (r.user_id) r.*
  from v_running_timers r
 where r.user_id = auth.uid()
 order by r.user_id, r.started_at desc;

-- ---------------------------------------------------------------------------------------
-- digest_payload — base: 20260819120000_digest.sql:33-67
--
-- #74: a focus row keeps its title only while p_user still owns or belongs to the project; a
-- row that would render without one is dropped (render.ts escapes the title, null would break
-- it). Inline `exists`: this runs for service_role, where auth.uid() is null and project_role()
-- cannot answer for p_user.
--
-- #74: threads follow the project owner, like the Today screen — not `h.user_id`, which on a task
-- row is whoever created it: a removed member's digest would otherwise still carry the owner's
-- project, area and next step, and the owner's would miss tasks members added to their projects.
-- ---------------------------------------------------------------------------------------
create or replace function digest_payload(p_user uuid)
returns json
language sql security definer set search_path = public as $$
  select json_build_object(
    'display_name', coalesce((select display_name from profiles where id = p_user), 'Captain'),
    'streak', coalesce((select json_build_object('current', current, 'best', best)
                          from streaks where user_id = p_user),
                       json_build_object('current', 0, 'best', 0)),
    'focus', coalesce((
      select json_agg(json_build_object('title', coalesce(t.title, pr.title), 'completed', f.completed)
             order by f.created_at)
        from focus_items f
        left join tasks t on t.id = f.task_id
         and exists (select 1 from projects x where x.id = t.project_id
                        and (x.user_id = p_user
                             or exists (select 1 from project_members m
                                         where m.project_id = x.id and m.user_id = p_user)))
        left join projects pr on pr.id = f.project_id
         and (pr.user_id = p_user
              or exists (select 1 from project_members m
                          where m.project_id = pr.id and m.user_id = p_user))
       where f.user_id = p_user
         and f.date = (now() at time zone coalesce((select timezone from profiles where id = p_user), 'UTC'))::date
         and (t.id is not null or pr.id is not null)
    ), '[]'::json),
    'threads', coalesce((
      select json_agg(thread order by thread ->> 'last_activity_at')
        from (
          select json_build_object(
                   'title', h.title,
                   'project_title', h.project_title,
                   'area_name', h.area_name,
                   'next_step', h.next_step,
                   'last_activity_at', h.last_activity_at
                 ) as thread
            from v_hanging_threads h
           where exists (select 1 from projects x where x.id = h.project_id and x.user_id = p_user)
           order by h.last_activity_at
           limit 5
        ) top_threads
    ), '[]'::json)
  );
$$;

-- ---------------------------------------------------------------------------------------
-- Grants. `create or replace` kept them all; restated so this file reads whole.
-- ---------------------------------------------------------------------------------------
grant execute on function rpc_update_status(text, uuid, item_status, text, text, text, text, uuid) to authenticated;
grant execute on function rpc_groom_stale(text, uuid) to authenticated;
grant execute on function rpc_pick_focus(date, jsonb) to authenticated;
grant execute on function rpc_snooze(text, uuid, date) to authenticated;
grant execute on function rpc_start_timer(text, uuid, text) to authenticated;
revoke execute on function digest_payload(uuid) from public, anon, authenticated;
grant execute on function digest_payload(uuid) to service_role;
grant select on v_hanging_threads, v_area_stats, v_running_timer to authenticated;
