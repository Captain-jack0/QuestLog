-- Cron used to carry the service_role key in its command, which meant the most powerful
-- key in the project had to be pasted into the SQL editor to schedule a job — and from
-- there into files and screenshots. It now carries a dedicated trigger secret instead:
-- the worst a leak can do is fire a digest or a push.

create table app_config (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table app_config enable row level security;
-- No policy and no grant for anon/authenticated: this table is invisible to the app.
-- Only the service key (edge functions) and the database owner can read or write it.

drop function if exists schedule_digest(text, text);
drop function if exists schedule_push(text, text);

/** Shared body: schedule one hourly job that calls an edge function. */
create function schedule_function_hourly(p_job text, p_url text, p_minute int)
returns text
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_api_key text;
  v_cron_secret text;
begin
  select value into v_api_key from app_config where key = 'publishable_key';
  select value into v_cron_secret from app_config where key = 'cron_secret';

  if v_api_key is null or v_cron_secret is null then
    raise exception 'app_config is missing publishable_key or cron_secret'
      using hint = 'The edge-function deploy step fills these in.';
  end if;

  perform cron.unschedule(p_job) where exists (select 1 from cron.job where jobname = p_job);
  perform cron.schedule(
    p_job,
    format('%s * * * *', p_minute),
    format(
      $job$select net.http_post(
             url := %L,
             headers := jsonb_build_object(
               'Content-Type', 'application/json',
               'Authorization', %L,
               'X-Cron-Secret', %L
             ),
             body := '{}'::jsonb
           )$job$,
      p_url,
      'Bearer ' || v_api_key,
      v_cron_secret
    )
  );
  return p_job;
end;
$$;

/** Both take only a URL now — no secret ever passes through the SQL editor. */
create function schedule_digest(p_functions_url text) returns text
language sql security definer set search_path = public as $$
  select schedule_function_hourly(
    'questlog-digest-hourly', rtrim(p_functions_url, '/') || '/send-digest', 0);
$$;

create function schedule_push(p_functions_url text) returns text
language sql security definer set search_path = public as $$
  select schedule_function_hourly(
    'questlog-push-hourly', rtrim(p_functions_url, '/') || '/send-push', 5);
$$;

revoke execute on function schedule_function_hourly(text, text, int) from public, anon, authenticated;
revoke execute on function schedule_digest(text) from public, anon, authenticated;
revoke execute on function schedule_push(text) from public, anon, authenticated;
