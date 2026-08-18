-- BE-01 · Core schema (docs/02 §5)

create type item_status as enum ('idea', 'planned', 'in_progress', 'paused', 'blocked', 'done', 'dropped');
create type priority as enum ('low', 'med', 'high');
create type difficulty as enum ('S', 'M', 'L');
create type log_source as enum ('user', 'ai');

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  timezone text not null default 'UTC',
  digest_time time not null default '08:00',
  digest_enabled boolean not null default true,
  push_enabled boolean not null default false,
  stale_days int not null default 14 check (stale_days between 1 and 365),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table life_areas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null check (length(trim(name)) > 0),
  color text not null default '#5B5BD6',
  icon text,
  sort_order int not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  area_id uuid references life_areas on delete set null,
  title text not null check (length(trim(title)) > 0),
  description text,
  status item_status not null default 'idea',
  priority priority not null default 'med',
  target_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  project_id uuid not null references projects on delete cascade,
  title text not null check (length(trim(title)) > 0),
  status item_status not null default 'idea',
  difficulty difficulty not null default 'M',
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

-- Append-only: the honest history is a feature (docs/02 §5). No update/delete policy in BE-02.
create table progress_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  project_id uuid not null references projects on delete cascade,
  task_id uuid references tasks on delete cascade,
  left_off text,
  next_step text,
  note text,
  source log_source not null default 'user',
  -- clock_timestamp, not now(): two logs written in one transaction must still order.
  created_at timestamptz not null default clock_timestamp()
);

create table focus_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  date date not null default current_date,
  task_id uuid references tasks on delete cascade,
  project_id uuid references projects on delete cascade,
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  -- exactly one of task_id / project_id
  constraint focus_items_one_target check (num_nonnulls(task_id, project_id) = 1)
);

create index life_areas_user_idx on life_areas (user_id, sort_order);
create index projects_user_updated_idx on projects (user_id, updated_at desc);
create index projects_area_idx on projects (area_id);
create index tasks_user_updated_idx on tasks (user_id, updated_at desc);
create index tasks_project_idx on tasks (project_id, sort_order);
create index progress_logs_user_created_idx on progress_logs (user_id, created_at desc);
create index progress_logs_project_created_idx on progress_logs (project_id, created_at desc);
create index progress_logs_task_created_idx on progress_logs (task_id, created_at desc);
create index focus_items_user_date_idx on focus_items (user_id, date);

-- updated_at touch
create function touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger projects_touch_updated_at before update on projects
  for each row execute function touch_updated_at();
create trigger tasks_touch_updated_at before update on tasks
  for each row execute function touch_updated_at();
create trigger profiles_touch_updated_at before update on profiles
  for each row execute function touch_updated_at();

-- every new auth user gets a profile row
create function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();
