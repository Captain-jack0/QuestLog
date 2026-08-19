-- NT-01 · Daily email digest: who is due, what goes in the email, and the hourly schedule.

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

/*
 * service_role is the trusted backend key used by edge functions and cron. It already
 * bypasses RLS, but our migrations own the grants, so without this it cannot touch a single
 * table (the unsubscribe endpoint hit exactly that wall). Default privileges cover the
 * tables later migrations add.
 */
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;

/**
 * Users whose local clock has just reached their digest hour. Runs hourly, so matching on
 * the hour is enough — the minute part of digest_time is deliberately ignored.
 */
create function digest_recipients(p_now timestamptz default now())
returns table (user_id uuid, email text, display_name text, timezone text)
language sql security definer set search_path = public, auth as $$
  select p.id, u.email::text, coalesce(p.display_name, 'Captain'), p.timezone
    from profiles p
    join auth.users u on u.id = p.id
   where p.digest_enabled
     and u.email is not null
     and extract(hour from (p_now at time zone p.timezone)) = extract(hour from p.digest_time);
$$;

/** Everything one digest email needs, in one round trip. */
create function digest_payload(p_user uuid)
returns json
language sql security definer set search_path = public as $$
  select json_build_object(
    'display_name', coalesce((select display_name from profiles where id = p_user), 'Captain'),
    'streak', coalesce((select json_build_object('current', current, 'best', best)
                          from streaks where user_id = p_user),
                       json_build_object('current', 0, 'best', 0)),
    'focus', coalesce((
      select json_agg(json_build_object('title', coalesce(t.title, pr.title), 'completed', f.completed)
             order by f.created_at)
        from focus_items f
        left join tasks t on t.id = f.task_id
        left join projects pr on pr.id = f.project_id
       where f.user_id = p_user
         and f.date = (now() at time zone coalesce((select timezone from profiles where id = p_user), 'UTC'))::date
    ), '[]'::json),
    'threads', coalesce((
      select json_agg(thread order by thread ->> 'last_activity_at')
        from (
          select json_build_object(
                   'title', h.title,
                   'project_title', h.project_title,
                   'area_name', h.area_name,
                   'next_step', h.next_step,
                   'last_activity_at', h.last_activity_at
                 ) as thread
            from v_hanging_threads h
           where h.user_id = p_user
           order by h.last_activity_at
           limit 5
        ) top_threads
    ), '[]'::json)
  );
$$;

revoke execute on function digest_recipients(timestamptz) from public, anon, authenticated;
revoke execute on function digest_payload(uuid) from public, anon, authenticated;
grant execute on function digest_recipients(timestamptz) to service_role;
grant execute on function digest_payload(uuid) to service_role;

/**
 * Schedules (or reschedules) the hourly digest run. Project URL and service key are not in
 * the repo, so this is called once by hand after `supabase link` — see README.
 */
create function schedule_digest(p_functions_url text, p_service_key text)
returns text
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_job text := 'questlog-digest-hourly';
begin
  perform cron.unschedule(v_job) where exists (select 1 from cron.job where jobname = v_job);
  perform cron.schedule(
    v_job,
    '0 * * * *',
    format(
      $job$select net.http_post(
             url := %L,
             headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', %L),
             body := '{"mode":"cron"}'::jsonb
           )$job$,
      rtrim(p_functions_url, '/') || '/send-digest',
      'Bearer ' || p_service_key
    )
  );
  return v_job;
end;
$$;

revoke execute on function schedule_digest(text, text) from public, anon, authenticated;
