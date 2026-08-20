-- TM-01 · Time tracking: one running timer per user, XP for focused minutes.

create table time_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  project_id uuid not null references projects on delete cascade,
  task_id uuid references tasks on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  seconds int,
  /* pomodoro runs are marked so the report can tell them from open-ended work */
  mode text not null default 'timer' check (mode in ('timer', 'pomodoro')),
  created_at timestamptz not null default clock_timestamp()
);

create index time_entries_user_started_idx on time_entries (user_id, started_at desc);
create index time_entries_project_idx on time_entries (project_id);

-- Only one timer can run at a time: a partial unique index says so in the database, not
-- in a race-prone check in the client.
create unique index time_entries_one_running_per_user on time_entries (user_id)
  where ended_at is null;

alter table time_entries enable row level security;

create policy time_entries_select_own on time_entries for select to authenticated
  using (auth.uid() = user_id);

grant select on time_entries to authenticated;

/**
 * Starts a timer on a task or project. Any timer already running is stopped first, so the
 * user can never end up with two clocks and no idea which one counts.
 */
create function rpc_start_timer(p_item_type text, p_item_id uuid, p_mode text default 'timer')
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

  if p_item_type = 'task' then
    select t.project_id, t.id into v_project, v_task
      from tasks t where t.id = p_item_id and t.user_id = v_user;
  elsif p_item_type = 'project' then
    select p.id, null::uuid into v_project, v_task
      from projects p where p.id = p_item_id and p.user_id = v_user;
  else
    raise exception 'p_item_type must be task or project, got %', p_item_type using errcode = '22023';
  end if;

  if v_project is null then
    raise exception 'item not found' using errcode = 'P0002';
  end if;

  perform rpc_stop_timer();

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

/**
 * Stops the running timer and pays for the focus.
 *
 * XP is 10 per completed 25 minutes (docs/01 §8), capped at 60 XP a day so a forgotten
 * timer cannot mint a level. Sessions under a minute are discarded rather than logged —
 * they are mis-taps, not work.
 */
create function rpc_stop_timer()
returns json
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_entry time_entries%rowtype;
  v_seconds int;
  v_area uuid;
  v_tz text;
  v_earned_today int;
  v_blocks int;
  v_xp int := 0;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select * into v_entry from time_entries
   where user_id = v_user and ended_at is null
   order by started_at desc limit 1
     for update;

  if not found then
    return json_build_object('stopped', false, 'seconds', 0, 'xp_awarded', 0);
  end if;

  v_seconds := greatest(extract(epoch from (now() - v_entry.started_at))::int, 0);

  if v_seconds < 60 then
    delete from time_entries where id = v_entry.id;
    return json_build_object('stopped', true, 'seconds', v_seconds, 'xp_awarded', 0, 'discarded', true);
  end if;

  update time_entries set ended_at = now(), seconds = v_seconds where id = v_entry.id;

  select coalesce(timezone, 'UTC') into v_tz from profiles where id = v_user;
  v_tz := coalesce(v_tz, 'UTC');

  select coalesce(sum(xp), 0) into v_earned_today
    from xp_events
   where user_id = v_user
     and action_type = 'focus_time'
     and (created_at at time zone v_tz)::date = (now() at time zone v_tz)::date;

  v_blocks := v_seconds / 1500; -- completed 25-minute blocks
  v_xp := least(v_blocks * 10, greatest(60 - v_earned_today, 0));

  if v_xp > 0 then
    select area_id into v_area from projects where id = v_entry.project_id;
    perform award_xp(v_user, 'focus_time', v_xp, v_area, v_entry.project_id, v_entry.task_id);
  end if;

  return json_build_object(
    'stopped', true,
    'seconds', v_seconds,
    'xp_awarded', v_xp,
    'daily_cap_reached', v_blocks * 10 > v_xp
  );
end;
$$;

/** The timer that is running right now, with the titles the UI needs to name it. */
create view v_running_timer with (security_invoker = true) as
select e.id,
       e.user_id,
       e.started_at,
       e.mode,
       e.project_id,
       e.task_id,
       p.title as project_title,
       t.title as task_title,
       a.color as area_color
  from time_entries e
  join projects p on p.id = e.project_id
  left join tasks t on t.id = e.task_id
  left join life_areas a on a.id = p.area_id
 where e.ended_at is null;

/** Seconds per day for the last p_days days — the Progress chart reads this. */
create function daily_focus_seconds(p_days int default 56)
returns table (day date, seconds int)
language sql stable security definer set search_path = public as $$
  select (e.started_at at time zone coalesce(p.timezone, 'UTC'))::date as day,
         sum(coalesce(e.seconds, 0))::int
    from time_entries e
    join profiles p on p.id = e.user_id
   where e.user_id = auth.uid()
     and e.ended_at is not null
     and e.started_at > now() - make_interval(days => p_days)
   group by 1
   order by 1;
$$;

grant execute on function rpc_start_timer(text, uuid, text) to authenticated;
grant execute on function rpc_stop_timer() to authenticated;
grant execute on function daily_focus_seconds(int) to authenticated;
grant select on v_running_timer to authenticated;
