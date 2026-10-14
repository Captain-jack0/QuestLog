-- Issue #60 · A project can be deleted — and the delete can be undone.
--
-- CEO decisions on the issue: the delete is reversible; tasks, focus/time entries, progress notes,
-- XP history, earned XP and badges all stay (a delete takes back nothing earned); only the owner
-- deletes a shared project, a member leaves it instead (rpc_remove_member, #75, already lets a
-- member remove themself and refuses the owner — reused as is).
--
-- Soft delete: `projects.deleted_at`. Nothing is removed, so the undo is one UPDATE back to null.
-- No trash screen and no hard delete yet (YAGNI).
--
-- Where "deleted" is hidden — at the root every reader already goes through:
--   * project_role() / project_visible_since() answer null for a deleted project. Every member
--     policy (projects, tasks, progress_logs, project_members, rpc_list_members) and every
--     role-aware RPC (status, focus pick, timers, groom) asks one of them, so a deleted project's
--     tasks and notes vanish for the owner and the members alike, and nothing can be written
--     under it.
--   * projects_all_own lets the owner read their rows without asking project_role(), so a
--     restrictive select policy hides the deleted row itself. Restrictive = ANDed with every
--     permissive policy, present and future. progress_logs gets the same for the same reason
--     (progress_logs_select_own reads past project_visible_since()).
--   * The security_invoker views (v_hanging_threads, v_area_stats, v_running_timers) read as the
--     caller and follow from the two points above.
--   * digest_payload runs as security definer, past RLS: it gets the filter written out below.
-- Not hidden on purpose: xp_events, user_badges, streaks and daily_focus_seconds — earned history,
-- not project data. Totals do not drop.
--
-- Writes to deleted_at go through the two RPCs only: projects_update_admin would otherwise let an
-- admin member set it with a plain UPDATE. The guard tells the RPCs apart by current_user — inside
-- a security definer function it is the function's owner, never `authenticated`.

alter table projects add column deleted_at timestamptz null;

-- ---------------------------------------------------------------------------------------
-- Helpers — base: 20261009120000_sharing_membership_rls.sql. A deleted project has no row here,
-- so the answer is null. `create or replace` keeps the grants.
-- ---------------------------------------------------------------------------------------
create or replace function project_role(p_project uuid) returns member_role
language sql stable security definer set search_path = public as $$
  select case
    when p.user_id = auth.uid() then 'admin'::member_role
    else (select m.role from project_members m
           where m.project_id = p.id and m.user_id = auth.uid())
  end
    from projects p
   where p.id = p_project and p.deleted_at is null;
$$;

create or replace function project_visible_since(p_project uuid) returns timestamptz
language sql stable security definer set search_path = public as $$
  select case
    when p.user_id = auth.uid() then '-infinity'::timestamptz
    else (select m.joined_at from project_members m
           where m.project_id = p.id and m.user_id = auth.uid())
  end
    from projects p
   where p.id = p_project and p.deleted_at is null;
$$;

create policy projects_hide_deleted on projects as restrictive for select to authenticated
  using (deleted_at is null);

-- progress_logs_select_own (rls.sql) still shows a writer their own notes without asking
-- project_visible_since(), so those need their own restrictive policy. Security definer: as the
-- caller, a deleted project is a row they cannot see, so it could not be told apart from a
-- project they never had. Narrow on purpose — what a removed member sees is not this issue's call.
create function project_is_deleted(p_project uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from projects where id = p_project and deleted_at is not null);
$$;
revoke execute on function project_is_deleted(uuid) from public, anon;
grant execute on function project_is_deleted(uuid) to authenticated;

create policy progress_logs_hide_deleted on progress_logs as restrictive for select to authenticated
  using (not project_is_deleted(project_id));

create function guard_project_deleted_at() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.deleted_at is distinct from old.deleted_at and current_user = 'authenticated' then
    raise exception 'use rpc_delete_project / rpc_restore_project' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger projects_guard_deleted_at before update of deleted_at on projects
  for each row execute function guard_project_deleted_at();

-- ---------------------------------------------------------------------------------------
-- rpc_delete_project — owner only. Idempotent: a second call keeps the first timestamp.
--
-- Timers running on the project — anyone's — are stopped and paid like a stop (the work was done;
-- a delete takes back nothing earned). Left running they would sit invisible, holding one of the
-- three slots until the 12-hour sweep. The per-user timer locks are taken first, in user order,
-- the same lock-then-row order rpc_stop_timer uses.
--
-- Delete and undo are not touches (questlog.skip_touch, 20261007120000): an undone project goes
-- back to where it stood in the "least recently touched" lists.
-- ---------------------------------------------------------------------------------------
create function rpc_delete_project(p_project_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_entry time_entries%rowtype;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if not exists (select 1 from projects where id = p_project_id and user_id = v_user) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(u::text, 45))
     from (select distinct user_id as u from time_entries
            where project_id = p_project_id and ended_at is null order by 1) s;
  for v_entry in
    select * from time_entries where project_id = p_project_id and ended_at is null
     order by user_id, started_at
       for update
  loop
    perform finish_time_entry(v_entry.user_id, v_entry,
                              timer_cutoff(v_entry.started_at, v_entry.last_seen_at));
  end loop;

  perform set_config('questlog.skip_touch', 'on', true);
  update projects set deleted_at = coalesce(deleted_at, now()) where id = p_project_id;
  perform set_config('questlog.skip_touch', '', true);
end;
$$;

-- ---------------------------------------------------------------------------------------
-- rpc_restore_project — owner only; the undo. Restoring a live project is a no-op.
-- ---------------------------------------------------------------------------------------
create function rpc_restore_project(p_project_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_found boolean;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  perform set_config('questlog.skip_touch', 'on', true);
  update projects set deleted_at = null where id = p_project_id and user_id = auth.uid();
  get diagnostics v_found = row_count;
  perform set_config('questlog.skip_touch', '', true);
  if not v_found then
    raise exception 'not allowed' using errcode = '42501';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------------------
-- sharing_is_admin — base: 20261011140000_sharing_invites.sql. Nobody administers a deleted
-- project: every invite / membership write that asks this (rpc_create_invite, rpc_accept_invite —
-- which re-checks the inviter —, rpc_set_member_role, rpc_list_invites, an area invite's
-- per-project check) refuses it until the owner restores it. Verbatim except the #60 line.
-- A member can still leave a deleted project: rpc_remove_member lets p_user = caller through
-- without asking this.
-- ---------------------------------------------------------------------------------------
create or replace function sharing_is_admin(p_target_type text, p_target_id uuid, p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  -- `is not distinct from`, not `=`: an unknown target has a null owner, and a null here would
  -- turn `if not sharing_is_admin(...)` into `if null` — which does not raise.
  select p_user is not null
    and not (p_target_type = 'project' and project_is_deleted(p_target_id)) -- #60
    and (
    sharing_owner(p_target_type, p_target_id) is not distinct from p_user
    or case p_target_type
         when 'project' then exists (select 1 from project_members
                                      where project_id = p_target_id and user_id = p_user and role = 'admin')
         when 'area' then exists (select 1 from area_members
                                   where area_id = p_target_id and user_id = p_user and role = 'admin')
         else false
       end);
$$;

revoke execute on function rpc_delete_project(uuid) from public, anon;
revoke execute on function rpc_restore_project(uuid) from public, anon;
grant execute on function rpc_delete_project(uuid) to authenticated;
grant execute on function rpc_restore_project(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------
-- digest_payload — base: 20261011120000_hanging_threads_tasks_digest_status.sql. Verbatim except
-- the three `deleted_at is null` lines marked #60: this runs past RLS, so the policies above do
-- not reach it.
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
                        and x.deleted_at is null -- #60
                        and (x.user_id = p_user
                             or exists (select 1 from project_members m
                                         where m.project_id = x.id and m.user_id = p_user)))
        left join projects pr on pr.id = f.project_id
         and pr.deleted_at is null -- #60
         and (pr.user_id = p_user
              or exists (select 1 from project_members m
                          where m.project_id = pr.id and m.user_id = p_user))
       where f.user_id = p_user
         and f.date = (now() at time zone coalesce((select timezone from profiles where id = p_user), 'UTC'))::date
         and (t.id is not null or pr.id is not null)
    ), '[]'::json),
    'threads', coalesce((
      select json_agg(json_build_object(
                        'title', h.title,
                        'project_title', h.project_title,
                        'area_name', h.area_name,
                        'next_step', h.next_step,
                        'last_activity_at', h.last_activity_at,
                        'status', h.status,
                        'display_status', h.display_status
                      ) order by h.last_activity_at)
        from (
          select h.*,
                 row_number() over (partition by h.display_status = 'in_progress'
                                    order by h.last_activity_at) as rank_in_heading
            from v_hanging_threads h
           where exists (select 1 from projects x where x.id = h.project_id and x.user_id = p_user
                           and x.deleted_at is null) -- #60
        ) h
       where h.rank_in_heading <= 5
    ), '[]'::json)
  );
$$;
