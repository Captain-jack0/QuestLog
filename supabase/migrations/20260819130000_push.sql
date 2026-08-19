-- NT-02 · Web push reminders

create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  endpoint text not null unique,
  keys jsonb not null,
  created_at timestamptz not null default now()
);

create index push_subscriptions_user_idx on push_subscriptions (user_id);

alter table push_subscriptions enable row level security;

create policy push_subscriptions_all_own on push_subscriptions for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, delete on push_subscriptions to authenticated;

/**
 * Who should be nudged this hour.
 *
 * The reminder lands p_offset_hours after the digest — a morning digest at 08:00 becomes an
 * evening nudge — and only for people who have not earned any XP yet today. Someone who has
 * already checked in gets nothing: the point is the missing check-in, not the notification.
 */
create function push_recipients(p_now timestamptz default now(), p_offset_hours int default 10)
returns table (user_id uuid, endpoint text, keys jsonb, display_name text, streak_current int)
language sql security definer set search_path = public as $$
  select p.id,
         s.endpoint,
         s.keys,
         coalesce(p.display_name, 'Captain'),
         coalesce(st.current, 0)
    from profiles p
    join push_subscriptions s on s.user_id = p.id
    left join streaks st on st.user_id = p.id
   where p.push_enabled
     and extract(hour from (p_now at time zone p.timezone))
         = mod(extract(hour from p.digest_time)::int + p_offset_hours, 24)
     and not exists (
       select 1 from xp_events x
        where x.user_id = p.id
          and (x.created_at at time zone p.timezone)::date = (p_now at time zone p.timezone)::date
     );
$$;

revoke execute on function push_recipients(timestamptz, int) from public, anon, authenticated;
grant execute on function push_recipients(timestamptz, int) to service_role;

/** Same idea as schedule_digest: project URL and key are supplied once, by hand. */
create function schedule_push(p_functions_url text, p_service_key text)
returns text
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_job text := 'questlog-push-hourly';
begin
  perform cron.unschedule(v_job) where exists (select 1 from cron.job where jobname = v_job);
  perform cron.schedule(
    v_job,
    '5 * * * *',  -- five past the hour, so it never races the digest job
    format(
      $job$select net.http_post(
             url := %L,
             headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', %L),
             body := '{}'::jsonb
           )$job$,
      rtrim(p_functions_url, '/') || '/send-push',
      'Bearer ' || p_service_key
    )
  );
  return v_job;
end;
$$;

revoke execute on function schedule_push(text, text) from public, anon, authenticated;
