-- Issue #69 Step 2: Verify sort_order column has been dropped from life_areas and tasks
begin;
create extension if not exists pgtap with schema extensions;
set search_path to public, extensions;

select plan(4);

-- Test 1: life_areas should NOT have sort_order column
select hasnt_column('life_areas', 'sort_order',
  'life_areas table should not have sort_order column');

-- Test 2: tasks should NOT have sort_order column
select hasnt_column('tasks', 'sort_order',
  'tasks table should not have sort_order column');

-- Test 3: life_areas_user_idx should exist on user_id only
select has_index('life_areas', 'life_areas_user_idx',
  'life_areas should have user_id index');

-- Test 4: tasks_project_idx should exist on project_id only
select has_index('tasks', 'tasks_project_idx',
  'tasks should have project_id index');

select * from finish();
rollback;
