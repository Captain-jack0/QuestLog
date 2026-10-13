-- Issue #78 (sharing 6/6, parent #26) · Realtime: stream row changes to the members who may read them.
--
-- Additive only: a table joins the supabase_realtime publication, nothing else changes. Re-runnable —
-- a table that is already published is skipped instead of failing the migration.
--
-- Who receives what is decided by RLS: Realtime checks each INSERT/UPDATE row against the
-- subscriber's own select policies (#73), so a stranger gets nothing and a member gets no note
-- written before they joined (progress_logs_select_member).
--
-- Known limit: DELETE events are not filtered by RLS. Every subscriber to a table gets every delete,
-- carrying only the primary key — never the row's other columns. For tasks, projects and
-- progress_logs that is a bare uuid. For project_members / area_members the primary key IS the
-- relation: the old record (project_id | area_id, user_id) tells every subscriber, member or not,
-- that this user was a member of this project/area until now. If that ever matters:
-- realtime.broadcast_changes + RLS on realtime.messages.
do $$
declare
  t text;
begin
  foreach t in array array['tasks', 'projects', 'progress_logs', 'project_members', 'area_members'] loop
    if not exists (select 1 from pg_publication_tables
                    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;
