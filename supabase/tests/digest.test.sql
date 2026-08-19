-- NT-01 · The digest picks the right people at the right local hour.
begin;
create extension if not exists pgtap with schema extensions;
set search_path to public, extensions;

select plan(7);

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

select * from finish();
rollback;
