-- #78 · The shared tables stream over Realtime. Who gets which row is RLS's job (sharing_rls.test.sql);
-- e2e/realtime.spec.ts checks it end to end.
begin;
create extension if not exists pgtap with schema extensions;
set search_path to public, extensions;

select plan(1);

select set_eq(
  $$select tablename::text from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public'
       and tablename in ('tasks', 'projects', 'progress_logs', 'project_members', 'area_members')$$,
  array['tasks', 'projects', 'progress_logs', 'project_members', 'area_members'],
  'tasks, projects, progress_logs and both member tables are in supabase_realtime'
);

select * from finish();
rollback;
