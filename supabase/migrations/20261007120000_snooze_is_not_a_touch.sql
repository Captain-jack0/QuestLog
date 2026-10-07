-- Issue #42 follow-up (PR #62 review) · Snoozing is not a touch.
--
-- "Snooze" means "stop nagging me about this for a while" — the opposite of having worked on
-- it. Yet rpc_snooze is an UPDATE, so touch_updated_at stamped now() on the item and the
-- propagation triggers from 20261005120000_untouched_first_ordering.sql carried that up to the
-- project and the area, sending all three to the bottom of lists that exist to surface
-- neglected work. Editing, adding and status changes keep counting as touches; this file
-- carves out the one exception.
--
-- Mechanism: a transaction-local flag, `questlog.skip_touch`. rpc_snooze raises it before its
-- UPDATE and lowers it again before returning; the touch functions return early while it is
-- up. Considered and rejected:
--
--   * Diffing old/new in the triggers ("only snoozed_until changed" => no touch). Shorter, but
--     it rewrites the rule as "a no-op UPDATE is not a touch" for every writer, and that is
--     decoded at 3am, not read. The flag says what it means at the one call site that means it.
--   * `alter table ... disable trigger` inside the RPC. DDL, takes a lock, needs table owner —
--     no.
--
-- Scope and safety: `set_config(..., is_local => true)` lives for the current transaction only,
-- so nothing leaks between PostgREST calls (each RPC call is its own transaction). The reset
-- before `return` matters where one transaction holds many statements — pgTAP files are one
-- transaction — and on an exception the whole transaction, local settings included, is rolled
-- back anyway. rpc_snooze is security definer; the flag only switches off a timestamp stamp,
-- it grants nothing, and the ownership conditions in the touch functions are untouched.
--
-- `current_setting(name, true)` — second argument is missing_ok: a flag that was never set in
-- this session reads as NULL, and `NULL = 'on'` is not true, so every path that is not
-- rpc_snooze behaves exactly as before. touch_timed_item is left alone on purpose: a focus
-- session never runs under the flag.
--
-- `create or replace` keeps existing grants and trigger bindings; the grant at the bottom is
-- restated so the intent is readable here without opening focus_snooze_views.sql.

-- ---------------------------------------------------------------------------------------
-- 1. The touch functions learn to stand down
-- ---------------------------------------------------------------------------------------
-- BEFORE trigger: returning `new` unchanged lets the row through without the stamp.
create or replace function touch_updated_at() returns trigger
language plpgsql as $$
begin
  if current_setting('questlog.skip_touch', true) = 'on' then
    return new;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- AFTER triggers: the return value is ignored, `null` by convention.
create or replace function touch_parent_project() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_setting('questlog.skip_touch', true) = 'on' then
    return null;
  end if;
  update projects set updated_at = now()
   where id = new.project_id and user_id = new.user_id;
  return null;
end;
$$;

create or replace function touch_parent_area() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_setting('questlog.skip_touch', true) = 'on' then
    return null;
  end if;
  update life_areas set updated_at = now()
   where id = new.area_id and user_id = new.user_id;
  return null;
end;
$$;

-- ---------------------------------------------------------------------------------------
-- 2. rpc_snooze raises the flag
--
-- Same body as focus_snooze_views.sql:62-85 plus the two set_config calls.
-- ---------------------------------------------------------------------------------------
create or replace function rpc_snooze(p_item_type text, p_item_id uuid, p_until date) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_found boolean;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  perform set_config('questlog.skip_touch', 'on', true);
  if p_item_type = 'task' then
    update tasks set snoozed_until = p_until where id = p_item_id and user_id = v_user;
  elsif p_item_type = 'project' then
    update projects set snoozed_until = p_until where id = p_item_id and user_id = v_user;
  else
    raise exception 'p_item_type must be task or project, got %', p_item_type using errcode = '22023';
  end if;
  -- row_count reads the last SQL statement, so this must come before the set_config below.
  get diagnostics v_found = row_count;
  perform set_config('questlog.skip_touch', '', true);

  if not v_found then
    raise exception 'item not found' using errcode = 'P0002';
  end if;
  return json_build_object('snoozed_until', p_until);
end;
$$;

grant execute on function rpc_snooze(text, uuid, date) to authenticated;
