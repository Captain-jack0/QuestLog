-- Issue #66 · A row may only point at parents its writer owns.
--
-- The write policies checked the row's own `user_id` and nothing else (rls.sql:14-27). Foreign
-- keys are checked past RLS, so a user holding someone else's project UUID could hang a task of
-- their own under it, or attach a project of their own to someone else's area. The parent's
-- owner never sees the row (their select policy filters on their own `user_id`), but the link is
-- there, and every trigger that walks up from a child has had to guard against it (the
-- `user_id = new.user_id` conditions in 20261007120000_snooze_is_not_a_touch.sql) — and so would
-- any sharing feature built on these links (#26).
--
-- Each write policy now also asks: does every parent this row references belong to the caller?
-- `using` is unchanged — what a user may read, update or delete stays "their own rows". Only
-- `with check` grows, which covers both insert and update, so a task cannot be *moved* under a
-- stranger's project either.
--
-- Not touched:
-- - time_entries: authenticated holds `select` only (time_tracking.sql:26-29); every write goes
--   through security definer RPCs, which do their own ownership lookups. No write policy exists
--   to tighten.
-- - security definer RPCs and triggers: RLS does not apply to them; their own `user_id`
--   conditions stay.
--
-- Backward compatible: policies only, no data is changed or deleted. Rows that already violate
-- the new checks stay readable to their writer; only a later write to such a row must fix its
-- parent first — and writes to such a row's children fail too, because the touch triggers
-- (touch_parent_project / touch_parent_area) run as the caller and update it. Drop + create rather than `alter policy`, so each policy reads whole in one place;
-- a migration runs in one transaction, so there is no window without a policy.
--
-- The subqueries read projects/tasks/life_areas as the caller, so their own select policies apply
-- too; a parent the caller cannot see is a parent that fails the check. No policy below reads a
-- table whose policy reads back, so there is no recursion. Outer columns are qualified with the
-- table name so a same-named column on the parent can never capture them.
--
-- The `user_id = auth.uid()` inside each `exists` is a second lock today (the parent's select
-- policy already hides strangers' rows) and no test can tell it apart. Once sharing (#73) widens
-- the select policies it becomes the only lock — #73 must test writing under a shared parent.

drop policy projects_all_own on projects;
create policy projects_all_own on projects for all to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (area_id is null
         or exists (select 1 from life_areas a where a.id = projects.area_id and a.user_id = auth.uid()))
  );

drop policy tasks_all_own on tasks;
create policy tasks_all_own on tasks for all to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (select 1 from projects p where p.id = tasks.project_id and p.user_id = auth.uid())
  );

-- focus_items carries exactly one of task_id / project_id (core_schema.sql:80-81).
drop policy focus_items_all_own on focus_items;
create policy focus_items_all_own on focus_items for all to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (task_id is null
         or exists (select 1 from tasks t where t.id = focus_items.task_id and t.user_id = auth.uid()))
    and (project_id is null
         or exists (select 1 from projects p where p.id = focus_items.project_id and p.user_id = auth.uid()))
  );

-- progress_logs stays append-only: insert + select, no update/delete (rls.sql:22-27).
-- next_step_task_id (20260902120000_next_step_task.sql) is a task reference like any other.
drop policy progress_logs_insert_own on progress_logs;
create policy progress_logs_insert_own on progress_logs for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (select 1 from projects p where p.id = progress_logs.project_id and p.user_id = auth.uid())
    and (task_id is null
         or exists (select 1 from tasks t where t.id = progress_logs.task_id and t.user_id = auth.uid()))
    and (next_step_task_id is null
         or exists (select 1 from tasks t where t.id = progress_logs.next_step_task_id and t.user_id = auth.uid()))
  );
