-- Issue #45 · Up to three timers run side by side.
--
-- Until now starting a timer stopped the one already running (time_tracking.sql:58) and a
-- partial unique index allowed one open entry per user (time_tracking.sql:21-22). Both go. What
-- stays unique is the item: one open entry per task, and one open project-level entry per
-- project — a project's own clock and a clock on one of its tasks may run together.
--
-- ponytail: deleting a task nulls `task_id` on its entries (history_survives_task_delete.sql),
-- so a task timer still running when its task is deleted becomes a project-level entry; if that
-- project already has its own clock open the delete fails on the index below. Nothing in the UI
-- deletes a task today (same file, :32); stop the task's timers in that delete path when it
-- arrives.
--
-- Backward compatible on purpose: the migration goes live before the front end that uses it
-- (CLAUDE.md, "Migration önce, merge sonra"). The old client reads `v_running_timer` with
-- `maybeSingle()` and calls `rpc_stop_timer()` with no argument, so the old view keeps its eleven
-- columns in order and now answers with the newest open entry only, and the argument-less stop
-- still stops that same newest one.

drop index time_entries_one_running_per_user;

create unique index time_entries_one_running_per_task on time_entries (user_id, task_id)
  where ended_at is null and task_id is not null;

create unique index time_entries_one_running_per_project on time_entries (user_id, project_id)
  where ended_at is null and task_id is null;

/**
 * Starts a timer on a task or project, alongside whatever is already running. A second clock on
 * the same item and a fourth clock overall are refused with a message the UI can show as is.
 */
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

  -- One user's starts and stops take turns, so two quick taps cannot both pass the count below,
  -- and two stops cannot both read the day's XP before either has paid it.
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

-- A new signature, so the old one has to go: left in place, `rpc_stop_timer()` would match both
-- it and the defaulted one below and fail as ambiguous.
drop function rpc_stop_timer();

/**
 * Stops one running timer and pays for its focus. `p_entry_id` names it; without it the newest
 * running entry is stopped, which is what the argument-less call always did.
 *
 * XP is 10 per completed 25 minutes (docs/01 §8), capped at 60 XP a day across every entry so a
 * forgotten timer — or three — cannot mint a level. Sessions under a minute are discarded rather
 * than logged — they are mis-taps, not work.
 */
create function rpc_stop_timer(p_entry_id uuid default null)
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

  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 45));

  -- `user_id = v_user` is the only lock here: this runs as the owner, past RLS.
  select * into v_entry from time_entries
   where user_id = v_user and ended_at is null
     and (p_entry_id is null or id = p_entry_id)
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

grant execute on function rpc_stop_timer(uuid) to authenticated;

-- Every running timer, with the titles and project totals the UI needs — the body
-- 20261005130000_running_timer_project_totals.sql gave v_running_timer, unchanged. The
-- `security_invoker` and `d.user_id = e.user_id` reasoning there holds here word for word.
create view v_running_timers with (security_invoker = true) as
select e.id,
       e.user_id,
       e.started_at,
       e.mode,
       e.project_id,
       e.task_id,
       p.title as project_title,
       t.title as task_title,
       a.color as area_color,
       banked.seconds_today as project_seconds_today,
       banked.seconds_total as project_seconds_total
  from time_entries e
  join projects p on p.id = e.project_id
  left join tasks t on t.id = e.task_id
  left join life_areas a on a.id = p.area_id
  left join profiles pr on pr.id = e.user_id
 cross join lateral (
    select coalesce(sum(d.seconds) filter (
             where (d.started_at at time zone coalesce(pr.timezone, 'UTC'))::date
                 = (now() at time zone coalesce(pr.timezone, 'UTC'))::date), 0)::int as seconds_today,
           coalesce(sum(d.seconds), 0)::int as seconds_total
      from time_entries d
     where d.project_id = e.project_id
       and d.user_id = e.user_id
       and d.ended_at is not null
  ) banked
 where e.ended_at is null;

grant select on v_running_timers to authenticated;

-- The old view, same eleven columns in the same order, now the newest running entry per user —
-- the row the argument-less rpc_stop_timer() stops. `security_invoker` restated: `create or
-- replace view` drops options it is not given (running_timer_project_totals.sql:8-12).
create or replace view v_running_timer with (security_invoker = true) as
select distinct on (r.user_id) r.*
  from v_running_timers r
 order by r.user_id, r.started_at desc;

grant select on v_running_timer to authenticated;
