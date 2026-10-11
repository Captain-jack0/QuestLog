-- NT-01 · The digest picks the right people at the right local hour.
begin;
create extension if not exists pgtap with schema extensions;
set search_path to public, extensions;

select plan(13);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'istanbul@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'london@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'optedout@example.com');

update profiles set timezone = 'Europe/Istanbul', digest_time = '08:00'
 where id = '11111111-1111-1111-1111-111111111111';
update profiles set timezone = 'Europe/London', digest_time = '08:00'
 where id = '22222222-2222-2222-2222-222222222222';
update profiles set timezone = 'Europe/Istanbul', digest_time = '08:00', digest_enabled = false
 where id = '33333333-3333-3333-3333-333333333333';

-- Every assertion is scoped to these three, so rows left behind by local app use
-- (or by another test) cannot change the answer.
create view due_here as
  select 'a' as who, r.* from digest_recipients('2026-08-19 05:30:00+00'::timestamptz) r
   where r.user_id in ('11111111-1111-1111-1111-111111111111',
                       '22222222-2222-2222-2222-222222222222',
                       '33333333-3333-3333-3333-333333333333');

create view due_later as
  select r.* from digest_recipients('2026-08-19 07:30:00+00'::timestamptz) r
   where r.user_id in ('11111111-1111-1111-1111-111111111111',
                       '22222222-2222-2222-2222-222222222222',
                       '33333333-3333-3333-3333-333333333333');

create view due_midday as
  select r.* from digest_recipients('2026-08-19 12:00:00+00'::timestamptz) r
   where r.user_id in ('11111111-1111-1111-1111-111111111111',
                       '22222222-2222-2222-2222-222222222222',
                       '33333333-3333-3333-3333-333333333333');

-- 05:30 UTC on a summer day = 08:30 in Istanbul (+3), 06:30 in London (+1)
select is((select count(*)::int from due_here), 1,
          'only the timezone whose local hour matches is due');

select is((select user_id from due_here),
          '11111111-1111-1111-1111-111111111111'::uuid, 'and it is the Istanbul user');

select is((select email from due_here), 'istanbul@example.com',
          'the address comes from auth.users');

-- two hours later London hits 08:xx; Istanbul has moved on to 10:xx
select is((select user_id from due_later),
          '22222222-2222-2222-2222-222222222222'::uuid,
          'London is due two hours after Istanbul');

select is((select count(*)::int from due_midday), 0,
          'nobody is due outside their digest hour');

select ok(
  not exists (select 1 from due_here where user_id = '33333333-3333-3333-3333-333333333333')
    and not exists (select 1 from due_later where user_id = '33333333-3333-3333-3333-333333333333'),
  'a user who turned the digest off is never picked');

-- payload shape: a fresh account still renders, with empty lists rather than nulls
select is(
  (select (digest_payload('11111111-1111-1111-1111-111111111111') ->> 'threads')::text),
  '[]', 'no hanging threads yields an empty array, not null');

-- #44: threads are tasks only, carry their status, and the limit is five per heading
-- (in_progress = Active; paused + blocked = Paused & blocked), oldest first.
insert into auth.users (id, email) values
  ('44444444-4444-4444-4444-444444444444', 'busy@example.com');
insert into projects (id, user_id, title, status) values
  ('44440000-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444444',
   'A project in progress', 'in_progress');
-- 7 in progress, 4 paused and 3 blocked; task N is N days old, so lower N = newer.
insert into tasks (user_id, project_id, title, status, updated_at)
select '44444444-4444-4444-4444-444444444444', '44440000-0000-0000-0000-000000000001',
       s || '-' || n, s::item_status, now() - make_interval(days => n)
  from (select 'in_progress' as s, n from generate_series(1, 7) n
        union all select 'paused', n from generate_series(11, 14) n
        union all select 'blocked', n from generate_series(21, 23) n) seed;

create temp table busy as
  select e from json_array_elements(digest_payload('44444444-4444-4444-4444-444444444444') -> 'threads') e;

select is((select count(*)::int from busy where e ->> 'status' = 'in_progress'), 5,
          'five in-progress threads, not seven');
select is((select count(*)::int from busy where e ->> 'status' in ('paused', 'blocked')), 5,
          'and five more paused/blocked: the limit counts per heading');
select ok(not exists (select 1 from busy where e ->> 'status' is null),
          'every thread carries its status');
select is((select array_agg(e ->> 'title' order by e ->> 'title') from busy where e ->> 'status' = 'in_progress'),
          array['in_progress-3', 'in_progress-4', 'in_progress-5', 'in_progress-6', 'in_progress-7'],
          'the oldest five of a heading are the ones kept');
select is((select array_agg(e ->> 'title' order by e ->> 'title') from busy where e ->> 'status' <> 'in_progress'),
          array['blocked-21', 'blocked-22', 'blocked-23', 'paused-13', 'paused-14'],
          'paused and blocked share one heading and one limit');
select ok(not exists (select 1 from busy where e ->> 'title' = 'A project in progress'),
          'an in-progress project is not a thread: only tasks are');

select * from finish();
rollback;
