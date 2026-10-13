-- Issue #75 · Sharing 3/6: invites and membership management RPCs.
-- Cast: owner O (area W, projects P1-P3 in W, P4 outside it), admin A (P1, P2, W), editor E (P1, W), viewer V (P1, W),
-- stranger S (owns P9), and newcomers N, L, Q, R. Everyone's email is <lowercase letter>@example.com.
begin;
create extension if not exists pgtap with schema extensions;
set search_path to public, extensions;

select plan(140);

create function who(p text) returns uuid language sql immutable as $$
  select ('75000000-0000-0000-0000-00000000000'
          || array_position(array['O', 'A', 'E', 'V', 'S', 'N', 'L', 'Q', 'R'], p))::uuid;
$$;
create function obj(p text) returns uuid language sql immutable as $$
  select case p
    when 'W'  then 'a7500000-0000-0000-0000-000000000001'
    when 'P1' then 'b7500000-0000-0000-0000-000000000001'
    when 'P2' then 'b7500000-0000-0000-0000-000000000002'
    when 'P3' then 'b7500000-0000-0000-0000-000000000003'
    when 'P4' then 'b7500000-0000-0000-0000-000000000004'
    when 'P9' then 'b7500000-0000-0000-0000-000000000009'
    when 'T1' then 'c7500000-0000-0000-0000-000000000001'
  end::uuid;
$$;

create function login(p text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', who(p)::text, 'role', 'authenticated',
                      'email', lower(p) || '@example.com')::text, true);
  execute 'set local role authenticated';
end;
$$;
create function noauth() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role": "authenticated"}', true);
  execute 'set local role authenticated';
end;
$$;

-- Read past RLS, so an assertion measures the data and not the caller's view of it.
create function prole(p_project text, p_user text) returns member_role
language sql security definer set search_path = public as $$
  select role from project_members where project_id = obj(p_project) and user_id = who(p_user);
$$;
create function arole(p_area text, p_user text) returns member_role
language sql security definer set search_path = public as $$
  select role from area_members where area_id = obj(p_area) and user_id = who(p_user);
$$;
create function tok(p_name text) returns text language sql stable as $$
  select current_setting('t.' || p_name);
$$;
create function keep(p_name text, p_invite json) returns boolean language plpgsql as $$
begin
  perform set_config('t.' || p_name, p_invite ->> 'token', true);
  perform set_config('t.' || p_name || '_id', p_invite ->> 'invite_id', true);
  return p_invite ->> 'token' is not null;
end;
$$;

-- ---- seed (as postgres, past RLS; nothing here is under test) ---------------------------
insert into auth.users (id, email, email_confirmed_at)
select who(p), lower(p) || '@example.com', now()
  from unnest(array['O', 'A', 'E', 'V', 'S', 'N', 'L', 'Q', 'R']) p;
insert into life_areas (id, user_id, name) values (obj('W'), who('O'), 'Work');
insert into projects (id, user_id, area_id, title) values
  (obj('P1'), who('O'), obj('W'), 'One'),
  (obj('P2'), who('O'), obj('W'), 'Two'),
  (obj('P3'), who('O'), obj('W'), 'Three'),
  (obj('P4'), who('O'), null, 'Outside the area'),
  (obj('P9'), who('S'), null, 'Stranger''s');
insert into tasks (id, user_id, project_id, title) values (obj('T1'), who('O'), obj('P1'), 'Task');
insert into project_members (project_id, user_id, role) values
  (obj('P1'), who('A'), 'admin'), (obj('P1'), who('E'), 'editor'), (obj('P1'), who('V'), 'viewer'),
  (obj('P2'), who('A'), 'admin');
insert into area_members (area_id, user_id, role) values
  (obj('W'), who('A'), 'admin'), (obj('W'), who('E'), 'editor'), (obj('W'), who('V'), 'viewer');

-- ---- no claims => 28000, every RPC -------------------------------------------------------
select noauth();
select throws_ok($$select rpc_create_invite('project', obj('P1'))$$, '28000', 'not authenticated',
                 'no claims: create');
select throws_ok($$select rpc_accept_invite('x')$$, '28000', 'not authenticated', 'no claims: accept');
select throws_ok($$select rpc_revoke_invite(gen_random_uuid())$$, '28000', 'not authenticated',
                 'no claims: revoke');
select throws_ok($$select rpc_set_member_role('project', obj('P1'), who('V'), 'editor')$$, '28000',
                 'not authenticated', 'no claims: set role');
select throws_ok($$select rpc_remove_member('project', obj('P1'), who('V'))$$, '28000',
                 'not authenticated', 'no claims: remove');
select throws_ok($$select * from rpc_list_members('project', obj('P1'))$$, '28000',
                 'not authenticated', 'no claims: list');
select throws_ok($$select * from rpc_list_invites('project', obj('P1'))$$, '28000',
                 'not authenticated', 'no claims: list invites');
reset role;
select is((select bool_or(has_function_privilege('anon', f, 'execute'))
             from unnest(array['rpc_create_invite(text, uuid, member_role, text, uuid[])',
                               'rpc_accept_invite(text)', 'rpc_revoke_invite(uuid)',
                               'rpc_set_member_role(text, uuid, uuid, member_role)',
                               'rpc_remove_member(text, uuid, uuid)', 'rpc_list_members(text, uuid)',
                               'rpc_list_invites(text, uuid)', 'sharing_owner(text, uuid)', 'sharing_is_admin(text, uuid, uuid)']) f),
          false, 'anon cannot execute any of them');
select is((select bool_or(has_function_privilege('authenticated', f, 'execute'))
             from unnest(array['sharing_owner(text, uuid)', 'sharing_is_admin(text, uuid, uuid)']) f),
          false, 'the any-user helpers are internal');

-- ---- create: who may ---------------------------------------------------------------------
select login('S');
select throws_ok($$select rpc_create_invite('project', obj('P1'))$$, '42501', 'not allowed',
                 'S cannot invite to P1');
select throws_ok($$select rpc_create_invite('project', gen_random_uuid(), 'viewer', 's@example.com')$$,
                 '42501', 'not allowed', 'nor to a project that does not exist');
select throws_ok($$select rpc_create_invite('area', gen_random_uuid())$$, '42501', 'not allowed',
                 'nor to an area that does not exist');
select login('V');
select throws_ok($$select rpc_create_invite('project', obj('P1'))$$, '42501', 'not allowed',
                 'V cannot invite to P1');
select login('E');
select throws_ok($$select rpc_create_invite('project', obj('P1'))$$, '42501', 'not allowed',
                 'E cannot invite to P1');
select throws_ok($$select rpc_create_invite('area', obj('W'))$$, '42501', 'not allowed',
                 'E cannot invite to W');
select login('A');
select ok(keep('a_link', rpc_create_invite('project', obj('P1'))), 'A can invite to P1 (link)');
select throws_ok($$select rpc_create_invite('area', obj('W'), 'viewer', null, array[obj('P3')])$$,
                 '42501', 'not allowed', 'A cannot share P3 with the area: not its admin');
select ok(keep('a_area', rpc_create_invite('area', obj('W'), 'viewer', null, array[obj('P2')])),
          'A can invite to W with P2');
select login('O');
select ok(keep('n_mail', rpc_create_invite('project', obj('P1'), 'editor', ' N@Example.com ')),
          'O can invite to P1 (email)');
select throws_ok($$select rpc_create_invite('area', obj('W'), 'viewer', null, array[obj('P4')])$$,
                 '42501', 'not allowed', 'O''s own project outside the area cannot ride an area invite');
select throws_ok($$select rpc_create_invite('area', obj('W'), 'viewer', null, array[obj('P9')])$$,
                 '42501', 'not allowed', 'nor someone else''s');
select throws_ok($$select rpc_create_invite('area', obj('W'), 'viewer', null, array[null::uuid])$$,
                 '42501', 'not allowed', 'nor a null project id');
select throws_ok($$select rpc_create_invite('project', obj('P1'), 'viewer', null, array[obj('P2')])$$,
                 '22023', 'p_project_ids is only for area invites', 'a project invite takes no project list');
select throws_ok($$select rpc_create_invite('project', obj('P1'), 'editor')$$,
                 '22023', 'a link invite can only grant viewer', 'a link invite is viewer-only');
select throws_ok($$select rpc_create_invite('project', obj('P1'), 'viewer', 'nope')$$,
                 '22023', 'invalid email', 'an email must look like one');
select throws_ok($$select rpc_create_invite('project', obj('P1'), 'viewer', repeat('a', 250) || '@x.io')$$,
                 '22023', 'invalid email', 'and fit in 254 characters');
select throws_ok($$select rpc_create_invite('task', obj('P1'))$$,
                 '22023', 'p_target_type must be project or area', 'only projects and areas');

-- ---- storage -----------------------------------------------------------------------------
select throws_ok('select count(*) from invites', '42501', null, 'authenticated cannot read invites');
select throws_ok('select count(*) from invite_projects', '42501', null,
                 'authenticated cannot read invite_projects');
reset role;
set local role anon;
select throws_ok('select count(*) from invites', '42501', null, 'anon cannot read invites');
select throws_ok('select count(*) from invite_projects', '42501', null, 'anon cannot read invite_projects');
reset role;
select set_config('request.jwt.claims', '', true);
select ok(exists (select 1 from invites
                   where id = tok('n_mail_id')::uuid
                     and token_hash = extensions.digest(tok('n_mail'), 'sha256')),
          'the table keeps the sha256 of the token');
select ok(not exists (select 1 from invites i where i::text like '%' || tok('n_mail') || '%'),
          'and not the token itself');
select is((select email::text from invites where id = tok('n_mail_id')::uuid), 'n@example.com',
          'the email is stored trimmed and lowercased');
select ok((select expires_at between now() + interval '7 days' - interval '1 minute'
                                 and now() + interval '7 days'
             from invites where id = tok('a_link_id')::uuid), 'an invite lives 7 days');
select is((select array_agg(project_id) from invite_projects where invite_id = tok('a_area_id')::uuid),
          array[obj('P2')], 'an area invite records its selected projects');

-- ---- accept: link invites are multi-use -------------------------------------------------
select login('L');
select is(rpc_accept_invite(tok('a_link'))::jsonb,
          jsonb_build_object('target_type', 'project', 'target_id', obj('P1'), 'role', 'viewer'),
          'L joins P1 through the link');
select is(prole('P1', 'L'), 'viewer', 'as viewer');
select login('R');
select lives_ok($$select rpc_accept_invite(tok('a_link'))$$, 'R uses the same link');
select is(prole('P1', 'R'), 'viewer', 'and joins too');
select lives_ok($$select rpc_accept_invite(tok('a_link'))$$, 'accepting twice is harmless');
select login('O');
select is(rpc_accept_invite(tok('a_link')) ->> 'role', 'admin', 'the owner accepting is a no-op');
select is(prole('P1', 'O'), null, 'and writes no owner row');

-- ---- accept: email invites --------------------------------------------------------------
select login('S');
select throws_ok($$select rpc_accept_invite(tok('n_mail'))$$, '42501',
                 'this invite was sent to another email address', 'S cannot take N''s invite');
select is(prole('P1', 'S'), null, 'and gets no membership');
reset role;
update auth.users set email_confirmed_at = null where id = who('N');
select login('N');
select throws_ok($$select rpc_accept_invite(tok('n_mail'))$$, '42501', 'confirm your email address first',
                 'an unconfirmed address cannot take an email invite');
select is(prole('P1', 'N'), null, 'and gets no membership');
reset role;
update auth.users set email_confirmed_at = now() where id = who('N');
select login('N');
select is(rpc_accept_invite(tok('n_mail')) ->> 'role', 'editor', 'N accepts (email matched case-blind)');
select is(prole('P1', 'N'), 'editor', 'and joins with the invite role');
select throws_ok($$select rpc_accept_invite(tok('n_mail'))$$, '22023', 'invite already used',
                 'an email invite is single-use');
select login('O');
select lives_ok($$select rpc_remove_member('project', obj('P1'), who('N'))$$, 'O removes N');
select login('N');
select throws_ok($$select rpc_accept_invite(tok('n_mail'))$$, '22023', 'invite already used',
                 'a used invite does not bring a removed member back');
select is(prole('P1', 'N'), null, 'N stays out');

-- on conflict do nothing: an existing membership keeps its role.
select login('O');
select ok(keep('v_mail', rpc_create_invite('project', obj('P1'), 'admin', 'v@example.com')),
          'O invites V, already a viewer, as admin');
select login('V');
select is(rpc_accept_invite(tok('v_mail')) ->> 'role', 'viewer', 'V accepts and is told the role held');
select is(prole('P1', 'V'), 'viewer', 'an accept never changes an existing role');

-- expired
select login('O');
select ok(keep('exp', rpc_create_invite('project', obj('P2'), 'editor', 'n@example.com')), 'O invites N to P2');
reset role;
update invites set expires_at = now() - interval '1 second' where id = tok('exp_id')::uuid;
select login('N');
select throws_ok($$select rpc_accept_invite(tok('exp'))$$, '22023', 'invite expired',
                 'an expired invite fails');
select is(prole('P2', 'N'), null, 'and grants nothing');

-- revoked: by its creator or a target admin, nobody else
select login('O');
select ok(keep('rev', rpc_create_invite('project', obj('P2'))), 'O makes a P2 link');
select login('V');
select throws_ok($$select rpc_revoke_invite(tok('rev_id')::uuid)$$, '42501', 'not allowed', 'V cannot revoke');
select login('E');
select throws_ok($$select rpc_revoke_invite(tok('rev_id')::uuid)$$, '42501', 'not allowed', 'E cannot revoke');
select login('S');
select throws_ok($$select rpc_revoke_invite(tok('rev_id')::uuid)$$, '42501', 'not allowed', 'S cannot revoke');
select login('A');
select lives_ok($$select rpc_revoke_invite(tok('rev_id')::uuid)$$, 'A, a P2 admin, revokes O''s invite');
select login('S');
select throws_ok($$select rpc_accept_invite(tok('rev'))$$, '22023', 'invite revoked', 'a revoked invite fails');
select is(prole('P2', 'S'), null, 'and grants nothing');
select throws_ok($$select rpc_accept_invite('not-a-token')$$, 'P0002', 'invite not found', 'unknown token');

-- ---- list invites: admins only, never the hash; a listed link can be revoked ---------------
select login('A');
select ok(exists (select 1 from rpc_list_invites('project', obj('P1'))
                   where id = tok('a_link_id')::uuid and kind = 'link' and role = 'viewer'),
          'A lists P1''s open link');
select ok(not exists (select 1 from rpc_list_invites('project', obj('P1')) r
                       where to_jsonb(r) ? 'token_hash' or to_jsonb(r)::text like '%' || tok('a_link') || '%'),
          'without the token or its hash');
select throws_ok($$select * from rpc_list_invites('project', gen_random_uuid())$$, '42501', 'not allowed',
                 'nor for a target that does not exist');
select login('E');
select throws_ok($$select * from rpc_list_invites('project', obj('P1'))$$, '42501', 'not allowed',
                 'E cannot list invites');
select login('V');
select throws_ok($$select * from rpc_list_invites('project', obj('P1'))$$, '42501', 'not allowed',
                 'V cannot list invites');
select login('S');
select throws_ok($$select * from rpc_list_invites('project', obj('P1'))$$, '42501', 'not allowed',
                 'S cannot list invites');

select login('O');
select ok(keep('p4', rpc_create_invite('project', obj('P4'))), 'O makes a P4 link');
select login('R');
select lives_ok($$select rpc_accept_invite(tok('p4'))$$, 'R joins P4 through it');
select login('O');
select lives_ok($$select rpc_revoke_invite((select id from rpc_list_invites('project', obj('P4'))
                                             where kind = 'link'))$$,
                'O revokes the link found in the list');
select is((select count(*)::int from rpc_list_invites('project', obj('P4'))), 0,
          'a revoked invite leaves the list');
select lives_ok($$select rpc_remove_member('project', obj('P4'), who('R'))$$, 'O removes R from P4');
select login('R');
select throws_ok($$select rpc_accept_invite(tok('p4'))$$, '22023', 'invite revoked',
                 'the removed member cannot come back through the revoked link');
select is(prole('P4', 'R'), null, 'R stays out of P4');

-- an inviter who loses admin takes the invite with them, but can still revoke it
select login('A');
select ok(keep('a2', rpc_create_invite('project', obj('P2'))), 'A makes a P2 link');
select login('O');
select lives_ok($$select rpc_set_member_role('project', obj('P2'), who('A'), 'editor')$$,
                'O demotes A on P2');
select is(prole('P2', 'A'), 'editor', 'A is an editor on P2 now');
select login('S');
select throws_ok($$select rpc_accept_invite(tok('a2'))$$, '22023', 'invite revoked',
                 'the demoted admin''s link no longer works');
select is(prole('P2', 'S'), null, 'and grants nothing');
select login('A');
select lives_ok($$select rpc_revoke_invite(tok('a2_id')::uuid)$$, 'its creator can still revoke it');

-- ---- area invites -----------------------------------------------------------------------
select login('O');
select ok(keep('q', rpc_create_invite('area', obj('W'), 'editor', 'q@example.com', array[obj('P2')])),
          'O invites Q to W with P2');
select login('Q');
select lives_ok($$select rpc_accept_invite(tok('q'))$$, 'Q accepts');
select is(arole('W', 'Q'), 'editor', 'Q joins the area with the invite role');
select is(prole('P2', 'Q'), 'editor', 'and the selected project with the invite role');
select is((select count(*)::int from projects where id = obj('P2')), 1, 'Q sees P2');
select is((select count(*)::int from projects where id in (obj('P1'), obj('P3'))), 0,
          'Q does not see the projects that were not selected');

-- a selected project that left the area by accept time stays out
select login('O');
select ok(keep('r_area', rpc_create_invite('area', obj('W'), 'viewer', null, array[obj('P3')])),
          'O makes a W link with P3');
reset role;
select set_config('request.jwt.claims', '', true);
update projects set area_id = null where id = obj('P3');
select login('R');
select lives_ok($$select rpc_accept_invite(tok('r_area'))$$, 'R accepts');
select is(arole('W', 'R'), 'viewer', 'R joins the area');
select is(prole('P3', 'R'), null, 'but not P3, which has left it');

-- a selected project whose inviter is no longer its admin stays out (A is P2 editor now)
select login('S');
select lives_ok($$select rpc_accept_invite(tok('a_area'))$$, 'S accepts A''s W invite');
select is(arole('W', 'S'), 'viewer', 'S joins the area');
select is(prole('P2', 'S'), null, 'but not P2, which A no longer administers');

-- ---- members: roles and removal ---------------------------------------------------------
select login('V');
select throws_ok($$select rpc_set_member_role('project', obj('P1'), who('E'), 'viewer')$$, '42501',
                 'not allowed', 'V cannot change E''s role');
select throws_ok($$select rpc_remove_member('project', obj('P1'), who('E'))$$, '42501',
                 'not allowed', 'V cannot remove E');
select login('E');
select throws_ok($$select rpc_set_member_role('project', obj('P1'), who('V'), 'admin')$$, '42501',
                 'not allowed', 'E cannot change V''s role');
select throws_ok($$select rpc_remove_member('project', obj('P1'), who('V'))$$, '42501',
                 'not allowed', 'E cannot remove V');
select login('S');
select throws_ok($$select rpc_set_member_role('project', obj('P1'), who('L'), 'admin')$$, '42501',
                 'not allowed', 'a stranger cannot change roles');
select throws_ok($$select rpc_remove_member('project', obj('P1'), who('L'))$$, '42501',
                 'not allowed', 'nor remove members');
select login('A');
select throws_ok($$select rpc_set_member_role('project', obj('P3'), who('R'), 'viewer')$$, '42501',
                 'not allowed', 'an area admin does not manage a project they do not administer');
select throws_ok($$select rpc_set_member_role('project', obj('P1'), who('O'), 'viewer')$$, '42501',
                 'not allowed', 'nobody changes the owner''s role');
select throws_ok($$select rpc_remove_member('project', obj('P1'), who('O'))$$, '42501',
                 'not allowed', 'an admin cannot remove the owner');
select throws_ok($$select rpc_remove_member('area', obj('W'), who('O'))$$, '42501',
                 'not allowed', 'nor the area owner');
select throws_ok($$select rpc_set_member_role('project', obj('P1'), who('S'), 'viewer')$$, 'P0002',
                 'member not found', 'a non-member has no role to change');
select lives_ok($$select rpc_set_member_role('project', obj('P1'), who('E'), 'viewer')$$,
                'A makes E a viewer');
select is(prole('P1', 'E'), 'viewer', 'E is a viewer');
select lives_ok($$select rpc_set_member_role('area', obj('W'), who('R'), 'editor')$$,
                'A makes R an area editor');
select is(arole('W', 'R'), 'editor', 'R is an area editor');
select login('O');
select throws_ok($$select rpc_remove_member('project', obj('P1'), who('O'))$$, '42501',
                 'not allowed', 'the owner cannot remove themself');
select login('V');
select lives_ok($$select rpc_remove_member('project', obj('P1'), who('V'))$$, 'V leaves P1');
select is(prole('P1', 'V'), null, 'V is gone');

-- a removed member loses sight at once
select login('E');
select is((select count(*)::int from projects where id = obj('P1')), 1, 'E sees P1');
select is((select count(*)::int from tasks where project_id = obj('P1')), 1, 'and its task');
select login('A');
select lives_ok($$select rpc_remove_member('project', obj('P1'), who('E'))$$, 'A removes E from P1');
select login('E');
select is((select count(*)::int from projects where id = obj('P1')), 0, 'E no longer sees P1');
select is((select count(*)::int from tasks where project_id = obj('P1')), 0, 'nor its task');

-- leaving an area keeps the project memberships
select login('Q');
select lives_ok($$select rpc_remove_member('area', obj('W'), who('Q'))$$, 'Q leaves W');
select is(arole('W', 'Q'), null, 'Q is out of the area');
select is(prole('P2', 'Q'), 'editor', 'but still in P2');
select is((select count(*)::int from projects where id = obj('P2')), 1, 'and still sees it');
select login('A');
select lives_ok($$select rpc_remove_member('area', obj('W'), who('S'))$$, 'A removes S from W');
select is(arole('W', 'S'), null, 'S is out of the area');

-- ---- list -------------------------------------------------------------------------------
select login('S');
select is((select count(*)::int from rpc_list_members('project', obj('P1'))), 0, 'a stranger lists nothing');
select is((select count(*)::int from rpc_list_members('area', obj('W'))), 0,
          'a former area member lists nothing');
select login('L');
select is((select array_agg(user_id order by user_id) from rpc_list_members('project', obj('P1'))),
          array[who('O'), who('A'), who('L'), who('R')], 'a viewer lists the owner and every member');
select is((select user_id from rpc_list_members('project', obj('P1')) where is_owner),
          who('O'), 'the owner is flagged');
select is((select role::text || '|' || display_name from rpc_list_members('project', obj('P1'))
            where user_id = who('L')), 'viewer|l', 'with role and profile display name');
select ok(not exists (select 1 from rpc_list_members('project', obj('P1')) r
                       where to_jsonb(r)::text like '%@%'), 'and no email');
select is((select count(*)::int from rpc_list_members('area', obj('W'))), 0, 'L is not in W');
select login('A');
select is((select array_agg(user_id order by user_id) from rpc_list_members('area', obj('W'))),
          array[who('O'), who('A'), who('E'), who('V'), who('R')], 'an area admin lists W');

-- ---- daily email-invite limit -----------------------------------------------------------
reset role;
insert into invites (token_hash, target_type, project_id, role, email, created_by, expires_at)
select extensions.digest(gen_random_uuid()::text, 'sha256'), 'project', obj('P1'), 'viewer',
       'filler' || g || '@example.com', who('O'), now() + interval '7 days'
  from generate_series(1, 19 - (select count(*)::int from invites
                                 where created_by = who('O') and email is not null)) g;
select login('O');
select ok(keep('cap20', rpc_create_invite('project', obj('P1'), 'viewer', 'x20@example.com')),
          'the 20th email invite of the day goes through');
select throws_ok($$select rpc_create_invite('project', obj('P1'), 'viewer', 'x21@example.com')$$,
                 '54000', 'daily email invite limit reached', 'the 21st does not');
select ok(keep('cap_link', rpc_create_invite('project', obj('P1'))), 'link invites are not capped');
reset role;
update invites set created_at = now() - interval '25 hours' where created_by = who('O');
select login('O');
select ok(keep('cap_next', rpc_create_invite('project', obj('P1'), 'viewer', 'x22@example.com')),
          'the window rolls over after a day');

select * from finish();
rollback;
