-- #44 (CEO decisions on the issue): hanging threads are tasks, not projects; the digest lists
-- them under two headings (Active / Paused & blocked), five per heading.

-- Base: 20261009130000_sharing_role_aware_rpcs.sql:496-535, with the project leg of the union
-- removed. Filtered here rather than in each reader so Today and the digest cannot disagree.
-- Columns, order and types unchanged (`create or replace view` cannot drop any): item_type is
-- always 'task' now, cast so its type stays the text the union used to resolve to. The owner
-- filter and security_invoker (#74) are kept as they were.
--
-- display_status (added last — the only place `create or replace view` may add a column) is the
-- status Today and the digest group and label by: an in_progress task under a project the owner
-- paused or blocked on purpose reads as its project's status, so it sits with the parked work
-- instead of queueing as active. Blocked gets the same treatment as paused: both are the two
-- "set aside" states the parked heading already holds, and a blocked project stalls its tasks
-- just the same. `status` stays the task's real status — anything that writes still uses it.
create or replace view v_hanging_threads with (security_invoker = true) as
with latest_log as (
  select distinct on (coalesce(task_id, project_id))
         coalesce(task_id, project_id) as item_id,
         left_off, next_step, next_step_task_id, created_at as logged_at,
         user_id as logged_by
    from progress_logs
   order by coalesce(task_id, project_id), created_at desc
)
select 'task'::text as item_type, t.id as item_id, t.user_id, t.title, t.status, t.updated_at,
       p.id as project_id, p.title as project_title, p.area_id, a.name as area_name, a.color as area_color,
       l.left_off, l.next_step, l.logged_at,
       coalesce(l.logged_at, t.updated_at) as last_activity_at,
       l.next_step_task_id,
       nt.title as next_step_task_title,
       nt.status as next_step_task_status,
       nt.project_id as next_step_task_project_id,
       l.logged_by,
       case when t.status = 'in_progress' and p.status in ('paused', 'blocked') then p.status
            else t.status end as display_status
  from tasks t
  join projects p on p.id = t.project_id
  left join life_areas a on a.id = p.area_id
  left join latest_log l on l.item_id = t.id
  left join tasks nt on nt.id = l.next_step_task_id
 where t.status in ('in_progress', 'paused', 'blocked')
   and (t.snoozed_until is null or t.snoozed_until <= current_date)
   and (auth.uid() is null or p.user_id = auth.uid());

-- Base: 20261009130000_sharing_role_aware_rpcs.sql:581-623. Only the 'threads' key changes: each
-- thread carries its `status` (added key — older readers ignore it), and the limit is five
-- oldest per heading (in_progress / paused+blocked) instead of five overall. Owner filter (#74)
-- unchanged. #44 follow-up: each thread also carries display_status (see the view), and the
-- headings — so the per-heading limit — are split by it, the same split Today makes.
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
           where exists (select 1 from projects x where x.id = h.project_id and x.user_id = p_user)
        ) h
       where h.rank_in_heading <= 5
    ), '[]'::json)
  );
$$;

revoke execute on function digest_payload(uuid) from public, anon, authenticated;
grant execute on function digest_payload(uuid) to service_role;
grant select on v_hanging_threads to authenticated;
