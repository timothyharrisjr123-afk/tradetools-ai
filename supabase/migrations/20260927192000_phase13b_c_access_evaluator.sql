-- Phase 13B-C — the single access evaluator.
--
-- private.evaluate_access_v1 is the only implementation of effective-access
-- semantics. RLS (private.member_can_v1 / private.member_job_ids_v1), RPCs, server
-- routes (public.check_my_access_v1) and client capability projections
-- (public.get_member_effective_access_v1) all call it; TypeScript never evaluates.
--
-- Precedence (first failing step decides the reason):
--   1. membership   not_member | membership_disabled | invalid_role
--   2. capability   capability_missing when unknown or RESERVED (fail closed; Owner
--                   is not a wildcard)
--   3. resource     scope_missing when the job/task is not in the member's company.
--                   Nonexistent and cross-tenant resources are indistinguishable.
--   4. restriction  restricted — an active restrict rule on the capability or on a
--                   package containing it (company/granted_jobs scope, or job scope
--                   for that job). Restriction always wins over profile and grants.
--   5. allow source profile entry or active grant rule (package active, member role
--                   eligible) at: company | granted_jobs (active job_access_grants
--                   row for the job) | job (rule scope_job_id) | own_task (task
--                   assigned to the actor on a granted job). Otherwise
--                   scope_missing if held at some scope, else capability_missing.
--   6. dependencies dependency_missing when any prerequisite is not itself allowed
--                   at the same resource (restrictions on prerequisites propagate).
--   7. assurance    no capability requires step-up yet (Phase F).
-- Validity windows are evaluated against database time (now()).
-- different_company is never returned for resources (it would leak existence).

create or replace function private.access_rule_is_live_v1(
  p_revoked_at timestamptz,
  p_valid_from timestamptz,
  p_valid_until timestamptz
)
returns boolean
language sql
stable
set search_path = pg_catalog
as $$
  select p_revoked_at is null
    and p_valid_from <= now()
    and (p_valid_until is null or p_valid_until > now());
$$;

create or replace function private.evaluate_access_core_v1(
  p_user_id uuid,
  p_company_id uuid,
  p_role text,
  p_profile_version integer,
  p_capability text,
  p_job_id uuid,
  p_task_id uuid,
  p_task_assignee uuid,
  p_depth integer
)
returns text
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_cap public.access_capabilities%rowtype;
  v_job_granted boolean := false;
  v_held_somewhere boolean := false;
  v_allowed boolean := false;
  v_dep text;
begin
  if p_depth > 16 then
    return 'authorization_unavailable';
  end if;

  select * into v_cap from public.access_capabilities c where c.capability_key = p_capability;
  if not found or v_cap.status <> 'active' then
    return 'capability_missing';
  end if;

  if p_job_id is not null then
    select exists (
      select 1 from public.job_access_grants g
      where g.job_id = p_job_id and g.user_id = p_user_id
        and g.company_id = p_company_id and g.revoked_at is null
    ) into v_job_granted;
  end if;

  if exists (
    select 1
    from public.company_member_access_rules r
    left join public.access_package_capabilities pc on pc.package_key = r.package_key
    where r.company_id = p_company_id
      and r.user_id = p_user_id
      and r.effect = 'restrict'
      and private.access_rule_is_live_v1(r.revoked_at, r.valid_from, r.valid_until)
      and (r.capability_key = p_capability or pc.capability_key = p_capability)
      and (r.scope_kind in ('company', 'granted_jobs')
           or (r.scope_kind = 'job' and r.scope_job_id = p_job_id))
  ) then
    return 'restricted';
  end if;

  with sources (scope_kind, scope_job_id) as (
    select pc.scope_kind, null::uuid
    from public.access_role_profile_capabilities pc
    where pc.role_key = p_role and pc.version = p_profile_version
      and pc.capability_key = p_capability
    union all
    select r.scope_kind, r.scope_job_id
    from public.company_member_access_rules r
    join public.access_packages p on p.package_key = r.package_key
    join public.access_package_capabilities pk on pk.package_key = p.package_key
    where r.company_id = p_company_id
      and r.user_id = p_user_id
      and r.effect = 'grant'
      and private.access_rule_is_live_v1(r.revoked_at, r.valid_from, r.valid_until)
      and p.status = 'active'
      and p_role = any (p.eligible_roles)
      and pk.capability_key = p_capability
  )
  select
    count(*) > 0,
    coalesce(bool_or(
      (s.scope_kind = 'company')
      or (s.scope_kind = 'granted_jobs' and v_job_granted)
      or (s.scope_kind = 'job' and p_job_id is not null and s.scope_job_id = p_job_id)
      or (s.scope_kind = 'own_task' and p_task_id is not null and v_job_granted
          and p_task_assignee = p_user_id)
    ), false)
  into v_held_somewhere, v_allowed
  from sources s
  where s.scope_kind = any (v_cap.scope_kinds);

  if not v_allowed then
    return case when v_held_somewhere then 'scope_missing' else 'capability_missing' end;
  end if;

  for v_dep in
    select d.requires_capability_key
    from public.access_capability_dependencies d
    where d.capability_key = p_capability
    order by d.requires_capability_key
  loop
    if private.evaluate_access_core_v1(
      p_user_id, p_company_id, p_role, p_profile_version,
      v_dep, p_job_id, p_task_id, p_task_assignee, p_depth + 1
    ) <> 'allowed' then
      return 'dependency_missing';
    end if;
  end loop;

  return 'allowed';
end;
$$;

-- Full evaluation for one user. Returns (reason, company_id, role); reason
-- 'allowed' means granted. company_id/role are null unless the membership is active.
create or replace function private.evaluate_access_v1(
  p_user_id uuid,
  p_capability text,
  p_job_id uuid default null,
  p_task_id uuid default null
)
returns table (reason text, company_id uuid, role text)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_member public.company_memberships%rowtype;
  v_job_id uuid := p_job_id;
  v_task_job uuid;
  v_task_assignee uuid;
begin
  if p_user_id is null then
    return query select 'not_member'::text, null::uuid, null::text;
    return;
  end if;

  select * into v_member
  from public.company_memberships m
  where m.user_id = p_user_id
  order by (m.removed_at is null) desc, m.created_at
  limit 1;

  if not found then
    return query select 'not_member'::text, null::uuid, null::text;
    return;
  end if;
  if v_member.removed_at is not null then
    return query select 'membership_disabled'::text, null::uuid, null::text;
    return;
  end if;
  if not private.role_is_valid_v1(v_member.role) then
    return query select 'invalid_role'::text, null::uuid, null::text;
    return;
  end if;

  if p_task_id is not null then
    select t.job_id, t.assigned_to into v_task_job, v_task_assignee
    from public.job_tasks t
    where t.id = p_task_id and t.company_id = v_member.company_id and t.deleted_at is null;
    if not found or (v_job_id is not null and v_job_id <> v_task_job) then
      return query select 'scope_missing'::text, v_member.company_id, v_member.role;
      return;
    end if;
    v_job_id := v_task_job;
  end if;

  if v_job_id is not null and not exists (
    select 1 from public.jobs j where j.id = v_job_id and j.company_id = v_member.company_id
  ) then
    return query select 'scope_missing'::text, v_member.company_id, v_member.role;
    return;
  end if;

  return query select
    private.evaluate_access_core_v1(
      v_member.user_id, v_member.company_id, v_member.role, v_member.role_profile_version,
      p_capability, v_job_id, p_task_id, v_task_assignee, 0
    ),
    v_member.company_id,
    v_member.role;
end;
$$;

-- RLS/RPC helper for the current actor.
create or replace function private.member_can_v1(
  p_capability text,
  p_job_id uuid default null,
  p_task_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select coalesce((
    select e.reason = 'allowed'
    from private.evaluate_access_v1(auth.uid(), p_capability, p_job_id, p_task_id) e
  ), false);
$$;

-- Jobs where the current actor holds p_capability only through job-level scope
-- (granted_jobs / job rules). Company-scope holders are covered by
-- member_can_v1(p_capability) in the same policy.
create or replace function private.member_job_ids_v1(p_capability text)
returns uuid[]
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  with actor as (
    select m.user_id, m.company_id
    from public.company_memberships m
    where m.user_id = auth.uid() and m.removed_at is null and private.role_is_valid_v1(m.role)
    limit 1
  ),
  candidates as (
    select g.job_id
    from public.job_access_grants g join actor a on a.user_id = g.user_id and a.company_id = g.company_id
    where g.revoked_at is null
    union
    select r.scope_job_id
    from public.company_member_access_rules r join actor a on a.user_id = r.user_id and a.company_id = r.company_id
    where r.effect = 'grant' and r.scope_kind = 'job'
      and private.access_rule_is_live_v1(r.revoked_at, r.valid_from, r.valid_until)
  )
  select coalesce(array_agg(c.job_id order by c.job_id), '{}'::uuid[])
  from candidates c
  where private.member_can_v1(p_capability, c.job_id);
$$;

-- Delegation tier of the current actor (blueprint §9): custody Owner; Admin
-- ordinary ceiling (team.manage); Production Lead ceiling (Field job access and
-- lead_assigned_work only). Use-authority never implies delegation.
create or replace function private.delegation_tier_v1()
returns text
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_company_id uuid := private.current_active_company_id();
  v_role text;
begin
  if v_company_id is null then
    return null;
  end if;
  if private.actor_holds_custody_v1(v_company_id) then
    return 'owner';
  end if;
  select m.role into v_role
  from public.company_memberships m
  where m.user_id = auth.uid() and m.company_id = v_company_id and m.removed_at is null;
  if v_role = 'admin' and private.member_can_v1('team.manage') then
    return 'admin';
  end if;
  if v_role = 'production_lead' and private.member_can_v1('jobs.assign') then
    return 'production_lead';
  end if;
  return null;
end;
$$;

-- Route/server authorization for the current actor.
create or replace function public.check_my_access_v1(
  p_capability text,
  p_job_id uuid default null,
  p_task_id uuid default null
)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select jsonb_build_object(
    'allowed', e.reason = 'allowed',
    'reason', e.reason,
    'company_id', e.company_id,
    'role', e.role
  )
  from private.evaluate_access_v1(auth.uid(), p_capability, p_job_id, p_task_id) e;
$$;

-- Effective-access projection. Self for any active member; another member of the
-- same company only with team.manage. Capability keys only — never registry
-- internals, rule ids, or policy names.
create or replace function public.get_member_effective_access_v1(
  p_user_id uuid default null,
  p_job_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_company_id uuid := private.current_active_company_id();
  v_target_id uuid := coalesce(p_user_id, auth.uid());
  v_target public.company_memberships%rowtype;
  v_company_caps text[];
  v_job_caps text[];
begin
  if v_actor is null or v_company_id is null then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;
  if v_target_id <> v_actor and not private.member_can_v1('team.manage') then
    return jsonb_build_object('ok', false, 'code', 'capability_denied');
  end if;

  select * into v_target
  from public.company_memberships m
  where m.user_id = v_target_id and m.company_id = v_company_id;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  if p_job_id is not null and not exists (
    select 1 from public.jobs j where j.id = p_job_id and j.company_id = v_company_id
  ) then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  select coalesce(array_agg(c.capability_key order by c.capability_key), '{}'::text[])
  into v_company_caps
  from public.access_capabilities c
  cross join lateral private.evaluate_access_v1(v_target_id, c.capability_key, null, null) e
  where c.status = 'active' and e.reason = 'allowed';

  if p_job_id is not null then
    select coalesce(array_agg(c.capability_key order by c.capability_key), '{}'::text[])
    into v_job_caps
    from public.access_capabilities c
    cross join lateral private.evaluate_access_v1(v_target_id, c.capability_key, p_job_id, null) e
    where c.status = 'active' and e.reason = 'allowed';
  end if;

  return jsonb_build_object(
    'ok', true,
    'user_id', v_target.user_id,
    'role', v_target.role,
    'role_profile_version', v_target.role_profile_version,
    'access_revision', v_target.access_revision,
    'disabled', v_target.removed_at is not null,
    'company_capabilities', to_jsonb(v_company_caps),
    'job_id', p_job_id,
    'job_capabilities', coalesce(to_jsonb(v_job_caps), 'null'::jsonb),
    'granted_job_count', (
      select count(*) from public.job_access_grants g
      where g.company_id = v_company_id and g.user_id = v_target_id and g.revoked_at is null
    ),
    'packages', (
      select coalesce(jsonb_agg(distinct r.package_key), '[]'::jsonb)
      from public.company_member_access_rules r
      where r.company_id = v_company_id and r.user_id = v_target_id and r.effect = 'grant'
        and private.access_rule_is_live_v1(r.revoked_at, r.valid_from, r.valid_until)
    ),
    'restrictions', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'package', r.package_key, 'capability', r.capability_key,
        'scope', r.scope_kind, 'job_id', r.scope_job_id
      ) order by r.created_at), '[]'::jsonb)
      from public.company_member_access_rules r
      where r.company_id = v_company_id and r.user_id = v_target_id and r.effect = 'restrict'
        and private.access_rule_is_live_v1(r.revoked_at, r.valid_from, r.valid_until)
    )
  );
end;
$$;

revoke all on function private.access_rule_is_live_v1(timestamptz, timestamptz, timestamptz) from public;
revoke all on function private.evaluate_access_core_v1(uuid, uuid, text, integer, text, uuid, uuid, uuid, integer) from public;
revoke all on function private.evaluate_access_v1(uuid, text, uuid, uuid) from public;
revoke all on function private.member_can_v1(text, uuid, uuid) from public;
revoke all on function private.member_job_ids_v1(text) from public;
revoke all on function private.delegation_tier_v1() from public;
revoke all on function public.check_my_access_v1(text, uuid, uuid) from public, anon, authenticated;
revoke all on function public.get_member_effective_access_v1(uuid, uuid) from public, anon, authenticated;

grant execute on function private.access_rule_is_live_v1(timestamptz, timestamptz, timestamptz) to service_role;
grant execute on function private.evaluate_access_v1(uuid, text, uuid, uuid) to service_role;
grant execute on function private.member_can_v1(text, uuid, uuid) to authenticated, service_role;
grant execute on function private.member_job_ids_v1(text) to authenticated, service_role;
grant execute on function private.delegation_tier_v1() to service_role;
grant execute on function public.check_my_access_v1(text, uuid, uuid) to authenticated, service_role;
grant execute on function public.get_member_effective_access_v1(uuid, uuid) to authenticated, service_role;
