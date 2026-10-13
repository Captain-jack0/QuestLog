-- Issue #67 · A restore puts `updated_at` back the way the backup had it.
--
-- scripts/restore.mjs upserts areas → projects → tasks. The touch triggers
-- (20261005120000_untouched_first_ordering.sql) stamp now() on every one of those writes and
-- carry it up the chain, so after a restore every area and project reads "touched a moment ago":
-- the untouched-first order and the stale signal are flattened. PostgREST cannot set
-- session_replication_role, so the triggers cannot be skipped from the script.
--
-- Fix: a second pass. After all rows are in, the script hands the backup's (id, updated_at)
-- pairs to this RPC per table, and it writes them back under the `questlog.skip_touch` flag from
-- 20261007120000_snooze_is_not_a_touch.sql, so touch_updated_at and the propagation triggers
-- stand down for that write. A pass at the end rather than routing every upsert through an RPC:
-- it also undoes touches from any later table in the restore order, and the upsert path stays
-- the plain PostgREST call it is today.
--
-- Safety: security definer, but executable by service_role only — the restore script runs with
-- the secret key. The table name is checked against a fixed list before it reaches format(%I).
-- The flag is transaction-local and lowered before return, as in rpc_snooze.

create function rpc_restore_updated_at(p_table text, p_rows jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_count int;
begin
  if p_table not in ('life_areas', 'projects', 'tasks') then
    raise exception 'p_table must be life_areas, projects or tasks, got %', p_table
      using errcode = '22023';
  end if;

  perform set_config('questlog.skip_touch', 'on', true);
  execute format(
    'update %I t set updated_at = r.updated_at
       from jsonb_to_recordset($1) as r(id uuid, updated_at timestamptz)
      where t.id = r.id and t.updated_at is distinct from r.updated_at',
    p_table) using p_rows;
  -- row_count reads the last SQL statement, so this must come before the set_config below.
  get diagnostics v_count = row_count;
  perform set_config('questlog.skip_touch', '', true);

  return v_count;
end;
$$;

revoke execute on function rpc_restore_updated_at(text, jsonb) from public, anon, authenticated;
grant execute on function rpc_restore_updated_at(text, jsonb) to service_role;
