-- BE-02 · Row Level Security: owner-only on everything, anon blocked everywhere.

alter table profiles enable row level security;
alter table life_areas enable row level security;
alter table projects enable row level security;
alter table tasks enable row level security;
alter table progress_logs enable row level security;
alter table focus_items enable row level security;

-- profiles: read + update own row only (insert comes from the signup trigger)
create policy profiles_select_own on profiles for select to authenticated using (auth.uid() = id);
create policy profiles_update_own on profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

create policy life_areas_all_own on life_areas for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy projects_all_own on projects for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy tasks_all_own on tasks for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy focus_items_all_own on focus_items for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- progress_logs: append-only — insert + select only, deliberately no update/delete policy.
create policy progress_logs_insert_own on progress_logs for insert to authenticated
  with check (auth.uid() = user_id);
create policy progress_logs_select_own on progress_logs for select to authenticated
  using (auth.uid() = user_id);

-- Table grants are the second lock: RLS only filters rows a role is already allowed to touch.
-- anon gets nothing at all — every screen is behind auth.
grant select, update on profiles to authenticated;
grant select, insert, update, delete on life_areas, projects, tasks, focus_items to authenticated;
grant select, insert on progress_logs to authenticated;
