-- Issue #75 (sharing 3/6, parent #26) · Invites and membership management.
--
-- #73 made project_members / area_members read-only to the app; the RPCs below are the only place
-- a membership row is born, changes role or dies. Additions only — no existing row is touched.
--
-- Errors: 28000 no claims · 42501 not allowed (also for a target that does not exist, so ids
-- cannot be probed) · 22023 bad argument, or an invite that is expired / revoked / used ·
-- P0002 no such invite token or member · 54000 daily email-invite limit.
--
-- Defaults [CEO may change]: a link invite is viewer-only and lives 7 days; an email invite lives
-- 7 days and is single-use; at most 20 email invites per inviter per rolling 24 hours.

create extension if not exists citext with schema extensions;

create table invites (
  id uuid primary key default gen_random_uuid(),
  token_hash bytea not null unique,           -- sha256 of the token; the token itself is never stored
  target_type text not null check (target_type in ('project', 'area')),
  project_id uuid null references projects on delete cascade,
  area_id uuid null references life_areas on delete cascade,
  role member_role not null,
  email extensions.citext null,               -- null => link invite
  created_by uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz null,
  accepted_at timestamptz null,
  check (case target_type
           when 'project' then project_id is not null and area_id is null
           else area_id is not null and project_id is null
         end)
);
create index invites_created_by_idx on invites (created_by, created_at);

-- The projects an area invite also shares (sharing an area does not share its projects, #26).
create table invite_projects (
  invite_id uuid not null references invites on delete cascade,
  project_id uuid not null references projects on delete cascade,
  primary key (invite_id, project_id)
);

alter table invites enable row level security;
alter table invite_projects enable row level security;
revoke all on invites, invite_projects from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------
-- Internal helpers (not granted to anyone). Unlike project_role() they answer for any user:
-- accept re-checks that the inviter is still an admin.
-- ---------------------------------------------------------------------------------------
create function sharing_owner(p_target_type text, p_target_id uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select case p_target_type
    when 'project' then (select user_id from projects where id = p_target_id)
    when 'area' then (select user_id from life_areas where id = p_target_id)
  end;
$$;

create function sharing_is_admin(p_target_type text, p_target_id uuid, p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  -- `is not distinct from`, not `=`: an unknown target has a null owner, and a null here would
  -- turn `if not sharing_is_admin(...)` into `if null` — which does not raise.
  select p_user is not null and (
    sharing_owner(p_target_type, p_target_id) is not distinct from p_user
    or case p_target_type
         when 'project' then exists (select 1 from project_members
                                      where project_id = p_target_id and user_id = p_user and role = 'admin')
         when 'area' then exists (select 1 from area_members
                                   where area_id = p_target_id and user_id = p_user and role = 'admin')
         else false
       end);
$$;

revoke execute on function sharing_owner(text, uuid) from public, anon, authenticated;
revoke execute on function sharing_is_admin(text, uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------
-- rpc_create_invite → {invite_id, token, email}. The token is returned here and nowhere else.
-- ---------------------------------------------------------------------------------------
create function rpc_create_invite(
  p_target_type text,
  p_target_id uuid,
  p_role member_role default 'viewer',
  p_email text default null,
  p_project_ids uuid[] default null
) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_email text := lower(trim(p_email));
  v_token text;
  v_id uuid;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_target_type is null or p_target_type not in ('project', 'area') then
    raise exception 'p_target_type must be project or area' using errcode = '22023';
  end if;
  if p_role is null then
    raise exception 'p_role is required' using errcode = '22023';
  end if;
  if v_email is not null and (length(v_email) > 254 or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+$') then
    raise exception 'invalid email' using errcode = '22023';
  end if;
  -- A leaked link makes everyone who holds it a member for its lifetime: viewer only.
  if v_email is null and p_role <> 'viewer' then
    raise exception 'a link invite can only grant viewer' using errcode = '22023';
  end if;
  if p_target_type = 'project' and coalesce(cardinality(p_project_ids), 0) > 0 then
    raise exception 'p_project_ids is only for area invites' using errcode = '22023';
  end if;

  if not sharing_is_admin(p_target_type, p_target_id, v_user) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  -- Every selected project lies in this area and the caller administers each one.
  if p_target_type = 'area' and exists (
       select 1 from unnest(p_project_ids) pid
        where not exists (select 1 from projects p
                           where p.id = pid and p.area_id = p_target_id
                             and sharing_is_admin('project', p.id, v_user))) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  if v_email is not null then
    -- Serialise one inviter's calls so two parallel requests cannot both pass the count.
    perform pg_advisory_xact_lock(hashtextextended(v_user::text, 75));
    if (select count(*) from invites
         where created_by = v_user and email is not null
           and created_at > now() - interval '1 day') >= 20 then
      raise exception 'daily email invite limit reached' using errcode = '54000';
    end if;
  end if;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');

  insert into invites (token_hash, target_type, project_id, area_id, role, email, created_by, expires_at)
  values (extensions.digest(v_token, 'sha256'), p_target_type,
          case when p_target_type = 'project' then p_target_id end,
          case when p_target_type = 'area' then p_target_id end,
          p_role, v_email, v_user, now() + interval '7 days')
  returning id into v_id;

  insert into invite_projects (invite_id, project_id)
  select distinct v_id, pid from unnest(p_project_ids) pid;

  return json_build_object('invite_id', v_id, 'token', v_token, 'email', v_email);
end;
$$;

-- ---------------------------------------------------------------------------------------
-- rpc_accept_invite → {target_type, target_id, role}.
-- ---------------------------------------------------------------------------------------
create function rpc_accept_invite(p_token text) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_inv invites%rowtype;
  v_target uuid;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  -- for update: two accepts of one single-use invite run one after the other.
  select * into v_inv from invites
   where token_hash = extensions.digest(coalesce(p_token, ''), 'sha256')
   for update;
  if not found then
    raise exception 'invite not found' using errcode = 'P0002';
  end if;
  v_target := coalesce(v_inv.project_id, v_inv.area_id);

  if v_inv.revoked_at is not null then
    raise exception 'invite revoked' using errcode = '22023';
  end if;
  if v_inv.expires_at <= now() then
    raise exception 'invite expired' using errcode = '22023';
  end if;
  if v_inv.email is not null then
    if v_inv.accepted_at is not null then
      raise exception 'invite already used' using errcode = '22023';
    end if;
    if lower(auth.jwt() ->> 'email') is distinct from lower(v_inv.email::text) then
      raise exception 'this invite was sent to another email address' using errcode = '42501';
    end if;
    -- The JWT's email is only proof of the mailbox once the address is confirmed.
    if not exists (select 1 from auth.users u where u.id = v_user and u.email_confirmed_at is not null) then
      raise exception 'confirm your email address first' using errcode = '42501';
    end if;
  end if;
  -- An inviter who has since lost admin takes their open invites with them.
  if not sharing_is_admin(v_inv.target_type, v_target, v_inv.created_by) then
    raise exception 'invite revoked' using errcode = '22023';
  end if;

  -- The owner is never a membership row: accepting their own invite changes nothing.
  if sharing_owner(v_inv.target_type, v_target) = v_user then
    return json_build_object('target_type', v_inv.target_type, 'target_id', v_target, 'role', 'admin');
  end if;

  if v_inv.target_type = 'project' then
    insert into project_members (project_id, user_id, role, invited_by)
    values (v_target, v_user, v_inv.role, v_inv.created_by)
    on conflict do nothing;
  else
    insert into area_members (area_id, user_id, role, invited_by)
    values (v_target, v_user, v_inv.role, v_inv.created_by)
    on conflict do nothing;
    -- Selected projects still in the area and still administered by the inviter. They belong to
    -- the area owner (#66), who returned above, so no owner row can be written here.
    insert into project_members (project_id, user_id, role, invited_by)
    select p.id, v_user, v_inv.role, v_inv.created_by
      from invite_projects ip join projects p on p.id = ip.project_id
     where ip.invite_id = v_inv.id and p.area_id = v_target
       and sharing_is_admin('project', p.id, v_inv.created_by)
    on conflict do nothing;
  end if;

  if v_inv.email is not null then
    update invites set accepted_at = now() where id = v_inv.id;
  end if;

  -- The role the caller actually holds: an existing membership keeps its own (on conflict above).
  return json_build_object('target_type', v_inv.target_type, 'target_id', v_target, 'role',
    case v_inv.target_type
      when 'project' then (select role from project_members where project_id = v_target and user_id = v_user)
      else (select role from area_members where area_id = v_target and user_id = v_user)
    end);
end;
$$;

-- ---------------------------------------------------------------------------------------
-- rpc_list_invites — a target admin's view of its open invites, so a link can be found and
-- revoked. Never the token hash. Not an admin (or no such target) => 42501.
-- ---------------------------------------------------------------------------------------
create function rpc_list_invites(p_target_type text, p_target_id uuid)
returns table (id uuid, kind text, role member_role, email text, created_by uuid,
               created_at timestamptz, expires_at timestamptz, revoked_at timestamptz,
               accepted_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if not sharing_is_admin(p_target_type, p_target_id, auth.uid()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return query
  select i.id, case when i.email is null then 'link' else 'email' end, i.role, i.email::text,
         i.created_by, i.created_at, i.expires_at, i.revoked_at, i.accepted_at
    from invites i
   where i.target_type = p_target_type
     and coalesce(i.project_id, i.area_id) = p_target_id
     and i.revoked_at is null and i.expires_at > now()
     and not (i.email is not null and i.accepted_at is not null)
   order by i.created_at desc, i.id;
end;
$$;

-- ---------------------------------------------------------------------------------------
-- rpc_revoke_invite — its creator or an admin of its target.
-- ---------------------------------------------------------------------------------------
create function rpc_revoke_invite(p_invite_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  update invites set revoked_at = coalesce(revoked_at, now())
   where id = p_invite_id
     and (created_by = v_user
          or sharing_is_admin(target_type, coalesce(project_id, area_id), v_user));
  if not found then
    raise exception 'not allowed' using errcode = '42501';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------------------
-- rpc_set_member_role — admin only; the owner is not a member and cannot be changed.
-- ---------------------------------------------------------------------------------------
create function rpc_set_member_role(p_target_type text, p_target_id uuid, p_user uuid, p_role member_role)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_target_type is null or p_target_type not in ('project', 'area') or p_role is null then
    raise exception 'p_target_type must be project or area, p_role is required' using errcode = '22023';
  end if;
  if not sharing_is_admin(p_target_type, p_target_id, v_user)
     or sharing_owner(p_target_type, p_target_id) = p_user then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  if p_target_type = 'project' then
    update project_members set role = p_role where project_id = p_target_id and user_id = p_user;
  else
    update area_members set role = p_role where area_id = p_target_id and user_id = p_user;
  end if;
  if not found then
    raise exception 'member not found' using errcode = 'P0002';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------------------
-- rpc_remove_member — an admin, or the member themself (leaving). Never the owner.
-- Leaving an area keeps its project memberships: each was granted on its own.
-- ---------------------------------------------------------------------------------------
create function rpc_remove_member(p_target_type text, p_target_id uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_target_type is null or p_target_type not in ('project', 'area') then
    raise exception 'p_target_type must be project or area' using errcode = '22023';
  end if;
  if not (p_user = v_user or sharing_is_admin(p_target_type, p_target_id, v_user))
     or sharing_owner(p_target_type, p_target_id) = p_user then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  if p_target_type = 'project' then
    delete from project_members where project_id = p_target_id and user_id = p_user;
  else
    delete from area_members where area_id = p_target_id and user_id = p_user;
  end if;
  if not found then
    raise exception 'member not found' using errcode = 'P0002';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------------------
-- rpc_list_members — owner first, then members. Empty unless the caller can see the target.
-- display_name comes from profiles; no email.
-- ---------------------------------------------------------------------------------------
create function rpc_list_members(p_target_type text, p_target_id uuid)
returns table (user_id uuid, display_name text, role member_role, joined_at timestamptz, is_owner boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  -- `target` is empty without access, and every row below is joined to it.
  return query
  with target as (
    select p.user_id as owner_id, p.created_at from projects p
     where p_target_type = 'project' and p.id = p_target_id and project_role(p.id) is not null
    union all
    select a.user_id, a.created_at from life_areas a
     where p_target_type = 'area' and a.id = p_target_id and area_role(a.id) is not null
  ), people as (
    select t.owner_id as uid, 'admin'::member_role as r, t.created_at as since, true as owner
      from target t
    union all
    select m.user_id, m.role, m.joined_at, false
      from project_members m, target t
     where p_target_type = 'project' and m.project_id = p_target_id
    union all
    select m.user_id, m.role, m.joined_at, false
      from area_members m, target t
     where p_target_type = 'area' and m.area_id = p_target_id
  )
  select x.uid, pr.display_name, x.r, x.since, x.owner
    from people x left join profiles pr on pr.id = x.uid
   order by x.owner desc, x.since, x.uid;
end;
$$;

revoke execute on function rpc_create_invite(text, uuid, member_role, text, uuid[]) from public, anon;
revoke execute on function rpc_accept_invite(text) from public, anon;
revoke execute on function rpc_revoke_invite(uuid) from public, anon;
revoke execute on function rpc_set_member_role(text, uuid, uuid, member_role) from public, anon;
revoke execute on function rpc_remove_member(text, uuid, uuid) from public, anon;
revoke execute on function rpc_list_members(text, uuid) from public, anon;
revoke execute on function rpc_list_invites(text, uuid) from public, anon;
grant execute on function rpc_list_invites(text, uuid) to authenticated;
grant execute on function rpc_create_invite(text, uuid, member_role, text, uuid[]) to authenticated;
grant execute on function rpc_accept_invite(text) to authenticated;
grant execute on function rpc_revoke_invite(uuid) to authenticated;
grant execute on function rpc_set_member_role(text, uuid, uuid, member_role) to authenticated;
grant execute on function rpc_remove_member(text, uuid, uuid) to authenticated;
grant execute on function rpc_list_members(text, uuid) to authenticated;
