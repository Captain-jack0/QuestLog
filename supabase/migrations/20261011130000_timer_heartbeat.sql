-- Issue #48 · A timer nobody is watching stops where they left it.
--
-- Closing the tab, signing out or losing the network left the entry open, and the next Stop —
-- a day later — paid the whole gap as focus. The client now stops its clocks on sign-out; for
-- everything else — closed tab, crash, dead phone, lost network — the server keeps its own net:
-- the open app beats every 60 s (rpc_timer_heartbeat sets `last_seen_at`), and an entry whose
-- last beat is more than 5 minutes old counts as ended at that beat, not at now(). No session
-- runs past 12 hours whatever the beats say.
--
-- Nothing ends an entry on its own: the views hide an expired one at once, and the next call to
-- any timer RPC (start, stop or heartbeat) closes it at its cutoff and pays it like a stop.
--
-- `last_seen_at` null — every entry opened before this, and every entry an old client opens —
-- means "never beaten": no 5-minute rule, only the 12-hour cap, so a client that predates this
-- file keeps working while the migration runs ahead of the merge (CLAUDE.md, "Migration önce,
-- merge sonra"). rpc_start_timer leaves it null for the same reason unless the caller passes
-- `p_beats => true`, which the new client does: its entries start seen. Counting null as
-- `started_at` instead would cut every old-client session to nothing after five minutes.
--
-- Bases: rpc_start_timer — 20261009130000_sharing_role_aware_rpcs.sql (#74); rpc_stop_timer and
-- v_running_timers — 20261008120000_parallel_timers.sql (#45). Bodies verbatim except the lines
-- marked `#48`. rpc_start_timer gains a defaulted argument, so the old signature is dropped (a
-- three-argument call would otherwise match both) and its grant restated; rpc_stop_timer keeps
-- its signature.

alter table time_entries add column last_seen_at timestamptz;

/**
 * When an open entry ends if nobody stops it: its last beat once that is over 5 minutes old,
 * never later than 12 hours after it started, otherwise now(). An entry is expired when this is
 * earlier than now().
 */
create function timer_cutoff(p_started_at timestamptz, p_last_seen_at timestamptz)
returns timestamptz
language sql stable set search_path = public as $$
  select least(
    case when p_last_seen_at < now() - interval '5 minutes' then p_last_seen_at else now() end,
    p_started_at + interval '12 hours');
$$;

/**
 * Ends one open entry at `p_end` and pays its focus — the body rpc_stop_timer had, lifted out so
 * the expired-entry sweep pays by the same rules. The caller holds the per-user lock and has
 * already checked that the entry is `p_user`'s.
 *
 * XP is 10 per completed 25 minutes (docs/01 §8), capped at 60 XP a day across every entry so a
 * forgotten timer — or three — cannot mint a level. Sessions under a minute are discarded rather
 * than logged — they are mis-taps, not work.
 */
create function finish_time_entry(p_user uuid, p_entry time_entries, p_end timestamptz)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_seconds int;
  v_area uuid;
  v_tz text;
  v_earned_today int;
  v_blocks int;
  v_xp int := 0;
begin
  v_seconds := greatest(extract(epoch from (p_end - p_entry.started_at))::int, 0);

  if v_seconds < 60 then
    delete from time_entries where id = p_entry.id;
    return jsonb_build_object('id', p_entry.id, 'stopped', true, 'seconds', v_seconds,
                              'xp_awarded', 0, 'discarded', true);
  end if;

  update time_entries set ended_at = p_end, seconds = v_seconds where id = p_entry.id;

  select coalesce(timezone, 'UTC') into v_tz from profiles where id = p_user;
  v_tz := coalesce(v_tz, 'UTC');

  select coalesce(sum(xp), 0) into v_earned_today
    from xp_events
   where user_id = p_user
     and action_type = 'focus_time'
     and (created_at at time zone v_tz)::date = (now() at time zone v_tz)::date;

  v_blocks := v_seconds / 1500; -- completed 25-minute blocks
  v_xp := least(v_blocks * 10, greatest(60 - v_earned_today, 0));

  if v_xp > 0 then
    select area_id into v_area from projects where id = p_entry.project_id;
    perform award_xp(p_user, 'focus_time', v_xp, v_area, p_entry.project_id, p_entry.task_id);
  end if;

  return jsonb_build_object(
    'id', p_entry.id,
    'stopped', true,
    'seconds', v_seconds,
    'xp_awarded', v_xp,
    'daily_cap_reached', v_blocks * 10 > v_xp
  );
end;
$$;

/** Ends every expired open entry of `p_user` at its cutoff. Returns one finish result each. */
create function stop_expired_timers(p_user uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_entry time_entries%rowtype;
  v_cutoff timestamptz;
  v_done jsonb := '[]'::jsonb;
begin
  for v_entry in
    select * from time_entries
     where user_id = p_user and ended_at is null
       and timer_cutoff(started_at, last_seen_at) < now()
     order by started_at
       for update
  loop
    v_cutoff := timer_cutoff(v_entry.started_at, v_entry.last_seen_at);
    v_done := v_done || finish_time_entry(p_user, v_entry, v_cutoff);
  end loop;
  return v_done;
end;
$$;

-- Internal: both take a user id, so nobody but the RPCs below may call them.
revoke execute on function finish_time_entry(uuid, time_entries, timestamptz) from public, anon, authenticated;
revoke execute on function stop_expired_timers(uuid) from public, anon, authenticated;

/**
 * The open app's pulse. Closes whatever expired since the last beat — reported back as
 * `auto_stopped`, so the app can say so — then marks the caller's remaining clocks as seen.
 * Only the caller's own entries: `user_id = v_user`, as everywhere past RLS.
 */
create function rpc_timer_heartbeat()
returns json
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_stopped jsonb;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 45));

  v_stopped := stop_expired_timers(v_user);

  update time_entries set last_seen_at = now()
   where user_id = v_user and ended_at is null;

  return json_build_object('auto_stopped', v_stopped);
end;
$$;

grant execute on function rpc_timer_heartbeat() to authenticated;

-- ---------------------------------------------------------------------------------------
-- rpc_start_timer — base: 20261009130000_sharing_role_aware_rpcs.sql (#74)
-- ---------------------------------------------------------------------------------------
drop function rpc_start_timer(text, uuid, text);

create function rpc_start_timer(p_item_type text, p_item_id uuid, p_mode text default 'timer',
                                p_beats boolean default false)
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

  -- #48: an expired clock is already gone from the user's screen; it must not hold the item or
  -- a slot of three either.
  perform stop_expired_timers(v_user);

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

  -- #48: a client that beats starts its entry seen; an old one leaves it null (header).
  insert into time_entries (user_id, project_id, task_id, mode, last_seen_at)
  values (v_user, v_project, v_task, p_mode, case when p_beats then now() end)
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
-- rpc_stop_timer — base: 20261008120000_parallel_timers.sql (#45). `p_entry_id` names the
-- entry; without it the newest running one is stopped.
-- ---------------------------------------------------------------------------------------
create or replace function rpc_stop_timer(p_entry_id uuid default null)
returns json
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_entry time_entries%rowtype;
  v_swept jsonb;
  v_hit jsonb;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 45));

  -- #48: expired entries end at their cutoff, not now(). If the one named was among them,
  -- that is this stop's answer.
  v_swept := stop_expired_timers(v_user);
  select value into v_hit from jsonb_array_elements(v_swept) where value ->> 'id' = p_entry_id::text;
  if v_hit is not null then
    return v_hit::json;
  end if;

  -- `user_id = v_user` is the only lock here: this runs as the owner, past RLS.
  select * into v_entry from time_entries
   where user_id = v_user and ended_at is null
     and (p_entry_id is null or id = p_entry_id)
   order by started_at desc limit 1
     for update;

  if not found then
    return json_build_object('stopped', false, 'seconds', 0, 'xp_awarded', 0);
  end if;

  -- #48: what is left after the sweep is live, so its cutoff is now().
  return finish_time_entry(v_user, v_entry, now())::json;
end;
$$;

-- ---------------------------------------------------------------------------------------
-- v_running_timers — base: 20261008120000_parallel_timers.sql (#45). Same columns in the same
-- order; `security_invoker` restated because `create or replace view` drops options it is not
-- given. v_running_timer reads this view, so it loses expired entries with it.
-- ---------------------------------------------------------------------------------------
create or replace view v_running_timers with (security_invoker = true) as
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
 where e.ended_at is null
   and timer_cutoff(e.started_at, e.last_seen_at) >= now(); -- #48

grant execute on function rpc_start_timer(text, uuid, text, boolean) to authenticated;
grant execute on function rpc_stop_timer(uuid) to authenticated;
grant select on v_running_timers, v_running_timer to authenticated;
