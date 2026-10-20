-- Drop sort_order column from life_areas and tasks
-- This is Step 2 of issue #69.
-- PREREQUISITE: Step 1 PR (#124) merged and deployed to Vercel,
-- so no client writes to sort_order anymore.
-- This migration is NOT backwards-compatible with old clients.

-- Drop indexes first
drop index if exists life_areas_user_idx;
drop index if exists tasks_project_idx;

-- Drop columns
alter table life_areas drop column if exists sort_order;
alter table tasks drop column if exists sort_order;

-- Recreate indexes without sort_order
-- life_areas index (for user-based filtering)
create index life_areas_user_idx on life_areas (user_id);

-- tasks index (for project-based filtering)
create index tasks_project_idx on tasks (project_id);
