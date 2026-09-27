-- Phase 13B-B — Team directory projections and member write RPCs.
--
-- profiles and company_memberships SELECT stay self-only. Team reads go through two
-- projections (blueprint §14.4):
--   list_company_directory_v1()     any active member; user id, display name, role.
--                                   No emails, status, audit, or work counts.
--   list_company_access_admin_v1()  member_admin (interim: Owner) only; adds email,
--                                   disabled state, and open-work counts.
-- Team writes are DB-authorized RPCs with the actor derived from auth.uid():
--   set_company_member_role_v1      canonical assignable roles only; never `owner`;
--                                   never the Owner row; no self-change; Admin grants
--                                   and revocations require custody.
--   disable_company_member_v1       revocation only; commits independently of handoff.
--   handoff_member_open_work_v1     moves ONLY currently open work of a disabled member.
-- There is no reactivation RPC: no current product surface re-enables a member.

create or replace function private.job_is_open_work_v1(
  p_stage text,
  p_status text,
  p_archived boolean,
  p_deleted_at timestamptz
)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select p_deleted_at is null
    and coalesce(p_archived, false) = false
    and coalesce(p_stage, '') not in ('complete', 'archived')
    and coalesce(p_status, '') not in ('lost', 'closed', 'archived');
$$;

revoke all on function private.job_is_open_work_v1(text, text, boolean, timestamptz) from public;
grant execute on function private.job_is_open_work_v1(text, text, boolean, timestamptz) to authenticated, service_role;

create or replace function private.actor_holds_custody_v1(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.companies c
    join public.company_memberships m
      on m.company_id = c.id
     and m.user_id = c.owner_user_id
    where c.id = p_company_id
      and c.owner_user_id = auth.uid()
      and m.role = 'owner'
      and m.removed_at is null
  );
$$;

revoke all on function private.actor_holds_custody_v1(uuid) from public;
grant execute on function private.actor_holds_custody_v1(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Directory (any active member)
-- ---------------------------------------------------------------------------
create or replace function public.list_company_directory_v1()
returns table (user_id uuid, display_name text, role text)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select m.user_id,
         nullif(btrim(p.full_name), '') as display_name,
         m.role
  from public.company_memberships m
  left join public.profiles p on p.id = m.user_id
  where m.company_id = private.current_active_company_id()
    and m.removed_at is null
  order by m.created_at, m.user_id;
$$;

-- ---------------------------------------------------------------------------
-- Access-admin projection (member_admin; interim Owner only)
-- ---------------------------------------------------------------------------
create or replace function public.list_company_access_admin_v1()
returns table (
  user_id uuid,
  display_name text,
  email text,
  role text,
  removed_at timestamptz,
  created_at timestamptz,
  open_job_lead_count integer,
  open_task_assignee_count integer
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_company_id uuid := private.current_active_company_id();
begin
  if auth.uid() is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  if v_company_id is null or not private.current_member_has_capability_v1('member_admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
  select m.user_id,
         nullif(btrim(p.full_name), ''),
         nullif(btrim(p.email), ''),
         m.role,
         m.removed_at,
         m.created_at,
         (
           select count(*)::integer
           from public.jobs j
           where j.company_id = v_company_id
             and j.assigned_to = m.user_id
             and private.job_is_open_work_v1(j.stage, j.status, j.archived, j.deleted_at)
         ),
         (
           select count(*)::integer
           from public.job_tasks t
           where t.company_id = v_company_id
             and t.assigned_to = m.user_id
             and t.status = 'open'
             and t.deleted_at is null
         )
  from public.company_memberships m
  left join public.profiles p on p.id = m.user_id
  where m.company_id = v_company_id
  order by m.created_at, m.user_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Role change
-- ---------------------------------------------------------------------------
create or replace function public.set_company_member_role_v1(
  p_target_user_id uuid,
  p_role text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_company_id uuid;
  v_target public.company_memberships%rowtype;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;
  v_company_id := private.current_active_company_id();
  if v_company_id is null then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;
  if not private.current_member_has_capability_v1('member_admin') then
    return jsonb_build_object('ok', false, 'code', 'capability_denied');
  end if;
  if p_target_user_id is null
     or p_role is null
     or p_role not in ('admin', 'office_sales', 'production_lead', 'field_user') then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;
  if p_target_user_id = v_uid then
    return jsonb_build_object('ok', false, 'code', 'cannot_change_own_role');
  end if;

  select * into v_target
  from public.company_memberships m
  where m.company_id = v_company_id
    and m.user_id = p_target_user_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v_target.removed_at is not null then
    return jsonb_build_object('ok', false, 'code', 'member_disabled');
  end if;
  if v_target.role = 'owner' then
    return jsonb_build_object('ok', false, 'code', 'owner_role_protected');
  end if;
  if (v_target.role = 'admin' or p_role = 'admin')
     and not private.actor_holds_custody_v1(v_company_id) then
    return jsonb_build_object('ok', false, 'code', 'owner_required');
  end if;

  if v_target.role = p_role then
    return jsonb_build_object('ok', true, 'changed', false, 'user_id', p_target_user_id, 'role', p_role);
  end if;

  update public.company_memberships
  set role = p_role
  where id = v_target.id;

  return jsonb_build_object('ok', true, 'changed', true, 'user_id', p_target_user_id, 'role', p_role);
end;
$$;

-- ---------------------------------------------------------------------------
-- Disable (revocation only; handoff is separate)
-- ---------------------------------------------------------------------------
create or replace function public.disable_company_member_v1(p_target_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_company_id uuid;
  v_target public.company_memberships%rowtype;
  v_now timestamptz := now();
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;
  v_company_id := private.current_active_company_id();
  if v_company_id is null then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;
  if not private.current_member_has_capability_v1('member_admin') then
    return jsonb_build_object('ok', false, 'code', 'capability_denied');
  end if;
  if p_target_user_id is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;
  if p_target_user_id = v_uid then
    return jsonb_build_object('ok', false, 'code', 'cannot_remove_self');
  end if;

  select * into v_target
  from public.company_memberships m
  where m.company_id = v_company_id
    and m.user_id = p_target_user_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v_target.role = 'owner' then
    return jsonb_build_object('ok', false, 'code', 'cannot_remove_owner');
  end if;
  if v_target.removed_at is not null then
    return jsonb_build_object(
      'ok', true,
      'already_disabled', true,
      'user_id', p_target_user_id,
      'removed_at', v_target.removed_at
    );
  end if;
  if v_target.role = 'admin' and not private.actor_holds_custody_v1(v_company_id) then
    return jsonb_build_object('ok', false, 'code', 'owner_required');
  end if;

  update public.company_memberships
  set removed_at = v_now
  where id = v_target.id;

  return jsonb_build_object(
    'ok', true,
    'already_disabled', false,
    'user_id', p_target_user_id,
    'removed_at', v_now
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Handoff of currently open work (disabled members only)
-- ---------------------------------------------------------------------------
create or replace function public.handoff_member_open_work_v1(
  p_target_user_id uuid,
  p_reassign_to_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_company_id uuid;
  v_target public.company_memberships%rowtype;
  v_jobs integer := 0;
  v_tasks integer := 0;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;
  v_company_id := private.current_active_company_id();
  if v_company_id is null then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;
  if not private.current_member_has_capability_v1('member_admin') then
    return jsonb_build_object('ok', false, 'code', 'capability_denied');
  end if;
  if p_target_user_id is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  select * into v_target
  from public.company_memberships m
  where m.company_id = v_company_id
    and m.user_id = p_target_user_id;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v_target.removed_at is null then
    return jsonb_build_object('ok', false, 'code', 'member_active');
  end if;

  if p_reassign_to_user_id is not null then
    if p_reassign_to_user_id = p_target_user_id
       or not exists (
         select 1
         from public.company_memberships r
         where r.company_id = v_company_id
           and r.user_id = p_reassign_to_user_id
           and r.removed_at is null
           and private.role_is_valid_v1(r.role)
       ) then
      return jsonb_build_object('ok', false, 'code', 'invalid_reassign');
    end if;
  end if;

  update public.jobs j
  set assigned_to = p_reassign_to_user_id
  where j.company_id = v_company_id
    and j.assigned_to = p_target_user_id
    and private.job_is_open_work_v1(j.stage, j.status, j.archived, j.deleted_at);
  get diagnostics v_jobs = row_count;

  update public.job_tasks t
  set assigned_to = p_reassign_to_user_id
  where t.company_id = v_company_id
    and t.assigned_to = p_target_user_id
    and t.status = 'open'
    and t.deleted_at is null;
  get diagnostics v_tasks = row_count;

  return jsonb_build_object(
    'ok', true,
    'user_id', p_target_user_id,
    'reassigned_to', p_reassign_to_user_id,
    'cleared_job_leads', v_jobs,
    'cleared_task_assignees', v_tasks
  );
end;
$$;

revoke all on function public.list_company_directory_v1() from public, anon, authenticated;
revoke all on function public.list_company_access_admin_v1() from public, anon, authenticated;
revoke all on function public.set_company_member_role_v1(uuid, text) from public, anon, authenticated;
revoke all on function public.disable_company_member_v1(uuid) from public, anon, authenticated;
revoke all on function public.handoff_member_open_work_v1(uuid, uuid) from public, anon, authenticated;

grant execute on function public.list_company_directory_v1() to authenticated, service_role;
grant execute on function public.list_company_access_admin_v1() to authenticated, service_role;
grant execute on function public.set_company_member_role_v1(uuid, text) to authenticated, service_role;
grant execute on function public.disable_company_member_v1(uuid) to authenticated, service_role;
grant execute on function public.handoff_member_open_work_v1(uuid, uuid) to authenticated, service_role;
