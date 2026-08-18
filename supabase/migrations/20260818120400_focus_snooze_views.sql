-- BE-05 · Supporting RPCs & views

alter table projects add column snoozed_until date;
alter table tasks add column snoozed_until date;

/**
 * Replaces today's focus selection with up to 3 items and pays 5 XP the first time
 * a selection is made on p_date. p_items: [{"task_id": uuid} | {"project_id": uuid}, ...]
 */
create function rpc_pick_focus(p_date date, p_items jsonb) returns json
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
    if v_task is not null and not exists (select 1 from tasks where id = v_task and user_id = v_user) then
      raise exception 'task not found' using errcode = 'P0002';
    end if;
    if v_project is not null and not exists (select 1 from projects where id = v_project and user_id = v_user) then
      raise exception 'project not found' using errcode = 'P0002';
    end if;

    insert into focus_items (user_id, date, task_id, project_id)
    values (v_user, p_date, v_task, v_project);
    v_count := v_count + 1;
  end loop;

  -- 5 XP once per day, however many times the selection is edited
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

create function rpc_snooze(p_item_type text, p_item_id uuid, p_until date) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_found boolean;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_item_type = 'task' then
    update tasks set snoozed_until = p_until where id = p_item_id and user_id = v_user;
  elsif p_item_type = 'project' then
    update projects set snoozed_until = p_until where id = p_item_id and user_id = v_user;
  else
    raise exception 'p_item_type must be task or project, got %', p_item_type using errcode = '22023';
  end if;

  get diagnostics v_found = row_count;
  if not v_found then
    raise exception 'item not found' using errcode = 'P0002';
  end if;
  return json_build_object('snoozed_until', p_until);
end;
$$;

/**
 * 15 XP for facing a stale thread — call this *before* the status update, while the item
 * still carries its old timestamp. Pays at most once per item per day.
 */
create function rpc_groom_stale(p_item_type text, p_item_id uuid) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_stale_days int;
  v_updated timestamptz;
  v_project uuid;
  v_task uuid;
  v_area uuid;
  v_xp int := 0;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select coalesce(stale_days, 14) into v_stale_days from profiles where id = v_user;
  v_stale_days := coalesce(v_stale_days, 14);

  if p_item_type = 'task' then
    select t.updated_at, t.project_id, t.id, p.area_id into v_updated, v_project, v_task, v_area
      from tasks t join projects p on p.id = t.project_id
     where t.id = p_item_id and t.user_id = v_user;
  elsif p_item_type = 'project' then
    select p.updated_at, p.id, null::uuid, p.area_id into v_updated, v_project, v_task, v_area
      from projects p where p.id = p_item_id and p.user_id = v_user;
  else
    raise exception 'p_item_type must be task or project, got %', p_item_type using errcode = '22023';
  end if;

  if v_updated is null then
    raise exception 'item not found' using errcode = 'P0002';
  end if;

  if v_updated < now() - make_interval(days => v_stale_days)
     and not exists (
       select 1 from xp_events
        where user_id = v_user and action_type = 'groom_stale'
          and coalesce(task_id, project_id) = p_item_id
          and created_at > now() - interval '1 day'
     ) then
    v_xp := award_xp(v_user, 'groom_stale', 15, v_area, v_project, v_task);
  end if;

  return json_build_object('xp_awarded', v_xp, 'stale', v_updated < now() - make_interval(days => v_stale_days));
end;
$$;

-- Active threads with their resume context, oldest activity first. security_invoker keeps RLS.
create view v_hanging_threads with (security_invoker = true) as
with latest_log as (
  select distinct on (coalesce(task_id, project_id))
         coalesce(task_id, project_id) as item_id,
         left_off, next_step, created_at as logged_at
    from progress_logs
   order by coalesce(task_id, project_id), created_at desc
)
select 'task' as item_type, t.id as item_id, t.user_id, t.title, t.status, t.updated_at,
       p.id as project_id, p.title as project_title, p.area_id, a.name as area_name, a.color as area_color,
       l.left_off, l.next_step, l.logged_at,
       coalesce(l.logged_at, t.updated_at) as last_activity_at
  from tasks t
  join projects p on p.id = t.project_id
  left join life_areas a on a.id = p.area_id
  left join latest_log l on l.item_id = t.id
 where t.status in ('in_progress', 'paused', 'blocked')
   and (t.snoozed_until is null or t.snoozed_until <= current_date)
union all
select 'project', p.id, p.user_id, p.title, p.status, p.updated_at,
       p.id, p.title, p.area_id, a.name, a.color,
       l.left_off, l.next_step, l.logged_at,
       coalesce(l.logged_at, p.updated_at)
  from projects p
  left join life_areas a on a.id = p.area_id
  left join latest_log l on l.item_id = p.id
 where p.status in ('in_progress', 'paused', 'blocked')
   and (p.snoozed_until is null or p.snoozed_until <= current_date);

create view v_area_stats with (security_invoker = true) as
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
  ) tk on tk.area_id = a.id;

grant execute on function rpc_pick_focus(date, jsonb) to authenticated;
grant execute on function rpc_snooze(text, uuid, date) to authenticated;
grant execute on function rpc_groom_stale(text, uuid) to authenticated;
grant select on v_hanging_threads, v_area_stats to authenticated;
