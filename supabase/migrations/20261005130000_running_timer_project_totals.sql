-- Issue #46 · The running timer also reports what its project has already banked.
--
-- A task's clock counts on its project too — the entry has carried `project_id` since day one
-- (time_tracking.sql:6) — but nothing told the UI how much was already there, so TimerBar could
-- only show the session. Two columns are added for it: the project's finished seconds, all of
-- them and the part that started today. The running entry itself is left out; the client adds
-- the live session from `started_at`, the same way it has always derived the clock.
--
-- `with (security_invoker = true)` is restated on purpose. `create or replace view` does not
-- keep the old options, it replaces them with the ones written here — leave it out and the view
-- runs as its owner, past RLS, and every signed-in user reads every running timer. In production
-- `anon` holds a SELECT grant as well (scripts/verify-deploy.mjs:107-116), so RLS is the only
-- lock on these rows. timer.test.sql asserts both the option and the behaviour.
--
-- The first nine columns keep their order, names and types: `create or replace view` only
-- allows appending, and a client still doing `select *` against the old shape keeps working.
--
-- "Today" is the user's local day, bucketed by `started_at` — the definition
-- daily_focus_seconds already uses (time_tracking.sql:167-179).
--
-- `d.user_id = e.user_id` repeats what RLS already enforces for `authenticated`. It is there
-- for the readers RLS does not cover (service_role, the table owner): a total must never fold
-- in another account's seconds, whoever is asking.
create or replace view v_running_timer with (security_invoker = true) as
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

-- Replacing a view keeps its grants; restated so this file reads complete on its own.
grant select on v_running_timer to authenticated;
