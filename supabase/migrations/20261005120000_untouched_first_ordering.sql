-- Issue #42 · Areas, projects and tasks list "least recently touched first".
--
-- The lists order by `updated_at` ascending, so this migration makes `updated_at` mean "the last
-- time anything happened here" on all three levels:
--
--   1. `life_areas` gets the column and the touch trigger `projects` and `tasks` have had since
--      core_schema.sql:103-106.
--   2. A change travels up: a task write touches its project, a project write touches its area.
--   3. A finished focus session touches the item it was clocked against. rpc_stop_timer
--      (time_tracking.sql:121) writes `time_entries` only, so until now an hour of work on a task
--      left the task looking as untouched as before.
--
-- Additive only: one new column with a default (and its backfill), three functions, four
-- triggers. Nothing is dropped, `sort_order` stays where it is, and the client already deployed
-- neither reads nor writes the new column — so this is safe to apply before the frontend that
-- needs it.

-- ---------------------------------------------------------------------------------------
-- 1. life_areas.updated_at
-- ---------------------------------------------------------------------------------------
alter table life_areas add column updated_at timestamptz not null default now();

-- Before the trigger below exists, on purpose: with it in place this UPDATE would be stamped
-- now() like any other. Without the backfill every area would read "touched just now" and the
-- first list after the migration would be in no meaningful order at all.
update life_areas set updated_at = created_at;

create trigger life_areas_touch_updated_at before update on life_areas
  for each row execute function touch_updated_at();

-- ---------------------------------------------------------------------------------------
-- 2. A change travels up: task -> project -> area
--
-- Every UPDATE below also demands `user_id = new.user_id`, and that condition — not RLS — is
-- what keeps a touch inside one account. A user can point a task of their own at somebody
-- else's project: the foreign key allows it, because RI checks run past RLS, and the tasks
-- policy only looks at the task's own `user_id` (rls.sql:18-19). RLS on the parent would stop a
-- direct write from reaching up, but not one made inside a security definer RPC
-- (rpc_update_status, rpc_snooze, rpc_stop_timer): those run as the function owner, the triggers
-- inherit that identity, and the table owner is not subject to RLS at all. Without the condition,
-- snoozing such a planted task would stamp now() on the victim's project and area.
--
-- The functions are not `security definer` themselves, so a direct write is filtered by the
-- parent's policy as well (rls.sql:14-17) — a second lock, not the one that matters.
--
-- No loop is possible: every statement here writes one level *up*, life_areas has no trigger
-- that writes anything else, and nothing writes back down. The chain is two hops at most.
--
-- The parent's own `touch_updated_at` would stamp now() whatever is assigned; setting the column
-- explicitly is what makes the UPDATE a real one, and keeps the intent readable.
-- ---------------------------------------------------------------------------------------
create function touch_parent_project() returns trigger
language plpgsql set search_path = public as $$
begin
  update projects set updated_at = now()
   where id = new.project_id and user_id = new.user_id;
  return null;
end;
$$;

-- AFTER, not BEFORE: a write that RLS or a constraint rejects never gets as far as touching
-- anything. The project UPDATE fires projects_touch_area below, which is how a task change
-- reaches the area.
create trigger tasks_touch_project after insert or update on tasks
  for each row execute function touch_parent_project();

create function touch_parent_area() returns trigger
language plpgsql set search_path = public as $$
begin
  update life_areas set updated_at = now()
   where id = new.area_id and user_id = new.user_id;
  return null;
end;
$$;

-- `area_id` is nullable (core_schema.sql:34) and goes null when an area is deleted; a project
-- without an area has nothing to touch.
create trigger projects_touch_area after insert or update on projects
  for each row when (new.area_id is not null) execute function touch_parent_area();

-- ---------------------------------------------------------------------------------------
-- 3. A finished focus session counts as a touch
--
-- A trigger on `time_entries` rather than a new rpc_stop_timer: the function would have to be
-- restated in full to gain one statement, and a trigger also covers any path that ends an entry
-- later. The entry carries exactly one target — a task, or the project alone when `task_id` is
-- null (rpc_start_timer, time_tracking.sql:51-56) — and touching the task reaches its project
-- through the chain above.
--
-- Only the null -> not null transition of `ended_at` fires it. The other UPDATE this table sees
-- is the `on delete set null` that detaches an entry from a deleted task
-- (20260902130000_history_survives_task_delete.sql), and without the WHEN that would read as a
-- focus session on the project. Sessions under a minute are deleted, not ended
-- (time_tracking.sql:116-119), so a mis-tap does not reorder anything either.
-- ---------------------------------------------------------------------------------------
create function touch_timed_item() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.task_id is not null then
    update tasks set updated_at = now()
     where id = new.task_id and user_id = new.user_id;
  else
    update projects set updated_at = now()
     where id = new.project_id and user_id = new.user_id;
  end if;
  return null;
end;
$$;

create trigger time_entries_touch_item after update on time_entries
  for each row when (old.ended_at is null and new.ended_at is not null)
  execute function touch_timed_item();
