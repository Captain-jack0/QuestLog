-- BE-04 · The heart: one transactional status update (docs/01 §8, docs/02 §6)

-- Small helpers, used here and by BE-05. security definer + explicit user_id checks by callers.

create function award_xp(
  p_user uuid,
  p_action text,
  p_xp int,
  p_area uuid default null,
  p_project uuid default null,
  p_task uuid default null
) returns int
language sql security definer set search_path = public as $$
  insert into xp_events (user_id, action_type, xp, area_id, project_id, task_id)
  values (p_user, p_action, p_xp, p_area, p_project, p_task)
  returning xp;
$$;

/** Grants a badge if the user does not have it yet. Returns true only on a fresh grant. */
create function grant_badge(p_user uuid, p_code text) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_badge uuid;
begin
  select id into v_badge from badges where code = p_code;
  if v_badge is null then
    return false;
  end if;
  insert into user_badges (user_id, badge_id) values (p_user, v_badge)
  on conflict do nothing;
  return found;
end;
$$;

create function rpc_update_status(
  p_item_type text,
  p_item_id uuid,
  p_new_status item_status,
  p_left_off text,
  p_next_step text,
  p_note text default null,
  p_source text default 'user'
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

  insert into progress_logs (user_id, project_id, task_id, left_off, next_step, note, source)
  values (v_user, v_project_id, v_task_id, p_left_off, p_next_step, p_note, p_source::log_source);

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

revoke execute on function award_xp(uuid, text, int, uuid, uuid, uuid) from public;
revoke execute on function grant_badge(uuid, text) from public;
grant execute on function rpc_update_status(text, uuid, item_status, text, text, text, text) to authenticated;
