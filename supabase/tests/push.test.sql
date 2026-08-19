-- NT-02 · The nudge only goes to people who have not shown up yet today.
begin;
create extension if not exists pgtap with schema extensions;
set search_path to public, extensions;

select plan(6);

insert into auth.users (id, email) values
  ('55555555-5555-5555-5555-555555555555', 'quiet@example.com'),
  ('66666666-6666-6666-6666-666666666666', 'busy@example.com'),
  ('77777777-7777-7777-7777-777777777777', 'nosub@example.com');

update profiles set timezone = 'Europe/Istanbul', digest_time = '08:00', push_enabled = true
 where id in ('55555555-5555-5555-5555-555555555555',
              '66666666-6666-6666-6666-666666666666',
              '77777777-7777-7777-7777-777777777777');

insert into push_subscriptions (user_id, endpoint, keys) values
  ('55555555-5555-5555-5555-555555555555', 'https://push.example/quiet', '{"p256dh":"k","auth":"a"}'),
  ('66666666-6666-6666-6666-666666666666', 'https://push.example/busy', '{"p256dh":"k","auth":"a"}');

-- 15:30 UTC = 18:30 Istanbul = digest hour 08 + 10
create view due_now as
  select r.* from push_recipients('2026-08-19 15:30:00+00'::timestamptz) r
   where r.user_id in ('55555555-5555-5555-5555-555555555555',
                       '66666666-6666-6666-6666-666666666666',
                       '77777777-7777-7777-7777-777777777777');

select is((select count(*)::int from due_now), 2,
          'both subscribed users are due at digest_time + 10h');

select ok(
  not exists (select 1 from due_now where user_id = '77777777-7777-7777-7777-777777777777'),
  'a user without a subscription is never picked');

-- the busy one checks in
insert into xp_events (user_id, action_type, xp, created_at)
values ('66666666-6666-6666-6666-666666666666', 'daily_check_in', 10,
        '2026-08-19 09:00:00+00'::timestamptz);

select is((select count(*)::int from due_now), 1,
          'checking in today removes you from the nudge list');

select is((select user_id from due_now), '55555555-5555-5555-5555-555555555555'::uuid,
          'and the quiet one is still on it');

select is(
  (select count(*)::int from push_recipients('2026-08-19 09:30:00+00'::timestamptz) r
    where r.user_id = '55555555-5555-5555-5555-555555555555'),
  0, 'nothing is sent outside the reminder hour');

-- yesterday's activity must not count as today's check-in
insert into xp_events (user_id, action_type, xp, created_at)
values ('55555555-5555-5555-5555-555555555555', 'progress_update', 8,
        '2026-08-18 09:00:00+00'::timestamptz);

select is((select count(*)::int from due_now), 1,
          'yesterday does not excuse today');

select * from finish();
rollback;
