-- Issue #73 (sharing 1/6, parent #26) · Membership tables, role helpers, role-aware RLS.
--
-- Dark launch: no path in this slice creates a membership row (invites arrive in #75), so for
-- every existing user the helpers below answer "owner => admin" or null, and every policy reads
-- exactly as before. Additions and same-meaning policy swaps only — no row is updated or deleted.
--
-- The owner is never a row: `projects.user_id` / `life_areas.user_id` is the implicit admin, so
-- there is nothing to backfill. Sharing an area does not share its projects (CEO decision on
-- #26): `project_role` reads project_members only.
--
-- Recursion: every policy that asks about membership goes through a `security definer`
-- helper, which reads projects / life_areas / *_members as their owner, past RLS. No policy
-- reads a table whose policy reads back, so `select * from project_members` cannot hit 42P17.
--
-- #66 (20261008130000_rls_parent_ownership.sql) is kept in role-aware form: "every parent this
-- row references belongs to the caller" becomes "the caller may edit every parent this row
-- references" (`project_role(...) >= 'editor'`; the owner is admin). The one place a policy
-- cannot express it — `projects_update_admin` also passes the owner, without the area check of
-- `projects_all_own` — is closed by the guard trigger at the bottom.

create type member_role as enum ('viewer', 'editor', 'admin');  -- order matters: compared with >=

create table project_members (
  project_id uuid not null references projects on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role member_role not null,
  joined_at timestamptz not null default clock_timestamp(),
  invited_by uuid null,
  primary key (project_id, user_id)
);
create index project_members_user_idx on project_members (user_id);

create table area_members (
  area_id uuid not null references life_areas on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role member_role not null,
  joined_at timestamptz not null default clock_timestamp(),
  invited_by uuid null,
  primary key (area_id, user_id)
);
create index area_members_user_idx on area_members (user_id);

alter table project_members enable row level security;
alter table area_members enable row level security;

-- ---------------------------------------------------------------------------------------
-- Helpers. No user parameter: they only ever answer for auth.uid(), so a caller cannot ask
-- about someone else. No claims => auth.uid() is null => null.
-- ---------------------------------------------------------------------------------------
create function project_role(p_project uuid) returns member_role
language sql stable security definer set search_path = public as $$
  select case
    when exists (select 1 from projects p where p.id = p_project and p.user_id = auth.uid())
      then 'admin'::member_role
    else (select m.role from project_members m
           where m.project_id = p_project and m.user_id = auth.uid())
  end;
$$;

create function area_role(p_area uuid) returns member_role
language sql stable security definer set search_path = public as $$
  select case
    when exists (select 1 from life_areas a where a.id = p_area and a.user_id = auth.uid())
      then 'admin'::member_role
    else (select m.role from area_members m
           where m.area_id = p_area and m.user_id = auth.uid())
  end;
$$;

-- From when a caller may read a project's progress notes: the owner always, a member from the
-- moment they joined.
create function project_visible_since(p_project uuid) returns timestamptz
language sql stable security definer set search_path = public as $$
  select case
    when exists (select 1 from projects p where p.id = p_project and p.user_id = auth.uid())
      then '-infinity'::timestamptz
    else (select m.joined_at from project_members m
           where m.project_id = p_project and m.user_id = auth.uid())
  end;
$$;

revoke execute on function project_role(uuid) from public, anon;
revoke execute on function area_role(uuid) from public, anon;
revoke execute on function project_visible_since(uuid) from public, anon;
grant execute on function project_role(uuid) to authenticated;
grant execute on function area_role(uuid) to authenticated;
grant execute on function project_visible_since(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------
-- Policies. Permissive policies OR together; the existing *_own policies stay where kept.
-- ---------------------------------------------------------------------------------------
create policy projects_select_member on projects for select to authenticated
  using (project_role(id) is not null);
create policy projects_update_admin on projects for update to authenticated
  using (project_role(id) = 'admin') with check (project_role(id) = 'admin');

create policy life_areas_select_member on life_areas for select to authenticated
  using (area_role(id) is not null);
create policy life_areas_update_admin on life_areas for update to authenticated
  using (area_role(id) = 'admin') with check (area_role(id) = 'admin');

-- tasks_all_own would let a removed member keep seeing the tasks they created, so it goes.
-- Drop + create in one migration = one transaction, no window without a policy.
drop policy tasks_all_own on tasks;
create policy tasks_select_member on tasks for select to authenticated
  using (project_role(project_id) is not null);
create policy tasks_insert_editor on tasks for insert to authenticated
  with check (user_id = auth.uid() and project_role(project_id) >= 'editor');
-- with check on the new project_id: a task cannot be moved under a project the caller cannot edit (#66).
create policy tasks_update_editor on tasks for update to authenticated
  using (project_role(project_id) >= 'editor') with check (project_role(project_id) >= 'editor');
create policy tasks_delete_editor on tasks for delete to authenticated
  using (project_role(project_id) >= 'editor');

-- Still append-only: insert + select, no update/delete. The task references keep #66's check,
-- role-aware: the caller must be able to edit the task's project.
drop policy progress_logs_insert_own on progress_logs;
create policy progress_logs_insert_own on progress_logs for insert to authenticated
  with check (
    user_id = auth.uid()
    and project_role(project_id) >= 'editor'
    and (task_id is null
         or exists (select 1 from tasks t where t.id = progress_logs.task_id
                       and project_role(t.project_id) >= 'editor'))
    and (next_step_task_id is null
         or exists (select 1 from tasks t where t.id = progress_logs.next_step_task_id
                       and project_role(t.project_id) >= 'editor'))
  );
create policy progress_logs_select_member on progress_logs for select to authenticated
  using (created_at >= project_visible_since(project_id));

create policy project_members_select on project_members for select to authenticated
  using (user_id = auth.uid() or project_role(project_id) is not null);
create policy area_members_select on area_members for select to authenticated
  using (user_id = auth.uid() or area_role(area_id) is not null);

-- Read-only to the app: every membership write goes through #75's RPCs. Revoking from
-- authenticated too, in case the platform's legacy auto-expose grants it anything.
revoke all on project_members, area_members from public, anon, authenticated;
grant select on project_members, area_members to authenticated;

-- ---------------------------------------------------------------------------------------
-- Owner columns. user_id never changes; a project changes area only by its owner, and only into
-- the owner's own area — the #66 area check, which projects_update_admin would otherwise let
-- the owner bypass. 42501 like an RLS refusal.
--
-- The area check is skipped when there are no claims (auth.uid() is null: postgres,
-- service_role, auth's user deletion). That context bypasses RLS anyway, and deleting an area
-- sets projects.area_id to null through the foreign key — an UPDATE this trigger sees.
-- ---------------------------------------------------------------------------------------
create function guard_owner_columns() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.user_id is distinct from old.user_id then
    raise exception '%.user_id cannot change', tg_table_name using errcode = '42501';
  end if;
  -- Nested, not `and`: NEW has no area_id on the other tables.
  if tg_table_name = 'projects' then
    if new.area_id is distinct from old.area_id and auth.uid() is not null
       and (old.user_id <> auth.uid()
            or (new.area_id is not null
                and not exists (select 1 from life_areas a
                                 where a.id = new.area_id and a.user_id = auth.uid()))) then
      raise exception 'only the project owner can move it, and only into their own area'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger projects_guard_owner_columns before update on projects
  for each row execute function guard_owner_columns();
create trigger life_areas_guard_owner_columns before update on life_areas
  for each row execute function guard_owner_columns();
create trigger tasks_guard_owner_columns before update on tasks
  for each row execute function guard_owner_columns();
