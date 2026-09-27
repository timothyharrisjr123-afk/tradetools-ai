-- Phase 13B-C — access mutations, Field job access, assignment coupling, Field brief.
--
-- Use vs delegate (blueprint §9). private.delegation_tier_v1():
--   owner            custody Owner: every role below Owner, every ACTIVE package,
--                    every restriction, Field job access.
--   admin            Admin holding team.manage (ordinary ceiling): Sales /
--                    Production Lead / Field targets only; packages whose
--                    assignable_by includes admin; never self, Owner, or Admin
--                    targets; never a target holding an Owner-only package; never
--                    lifts an Owner-set restriction.
--   production_lead  Production Lead holding jobs.assign: Field job access only.
-- Every mutation: actor from auth.uid(), target locked FOR UPDATE, optional/required
-- expected access_revision (stale -> stale_revision), revision bump, and one
-- company_access_events row in the same transaction.
--
-- set_member_access_v1 replaces set_company_member_role_v1. Packages are validated
-- (ACTIVE, eligible for the resulting role, delegable by the actor, dependency
-- complete); a grant and a restriction on the same authority is rejected
-- (grant_restriction_conflict), never silently cleared. A role change that would
-- make held packages ineligible requires an explicit package list
-- (packages_incompatible) — packages are never dropped implicitly.

-- ---------------------------------------------------------------------------
-- Internal helpers
-- ---------------------------------------------------------------------------
create or replace function private.member_access_snapshot_v1(p_company_id uuid, p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select jsonb_build_object(
    'role', m.role,
    'role_profile_version', m.role_profile_version,
    'disabled', m.removed_at is not null,
    'packages', (
      select coalesce(jsonb_agg(distinct r.package_key order by r.package_key), '[]'::jsonb)
      from public.company_member_access_rules r
      where r.company_id = p_company_id and r.user_id = p_user_id and r.effect = 'grant'
        and private.access_rule_is_live_v1(r.revoked_at, r.valid_from, r.valid_until)
    ),
    'restrictions', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'package', r.package_key, 'capability', r.capability_key,
        'scope', r.scope_kind, 'job_id', r.scope_job_id
      ) order by r.package_key nulls last, r.capability_key nulls last, r.scope_job_id nulls first), '[]'::jsonb)
      from public.company_member_access_rules r
      where r.company_id = p_company_id and r.user_id = p_user_id and r.effect = 'restrict'
        and private.access_rule_is_live_v1(r.revoked_at, r.valid_from, r.valid_until)
    )
  )
  from public.company_memberships m
  where m.company_id = p_company_id and m.user_id = p_user_id;
$$;

create or replace function private.member_holds_owner_only_package_v1(p_company_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.company_member_access_rules r
    join public.access_packages p on p.package_key = r.package_key
    where r.company_id = p_company_id and r.user_id = p_user_id and r.effect = 'grant'
      and private.access_rule_is_live_v1(r.revoked_at, r.valid_from, r.valid_until)
      and not ('admin' = any (p.assignable_by))
  );
$$;

create or replace function private.tier_authority_source_v1(p_tier text)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select case p_tier
    when 'owner' then 'owner'
    when 'admin' then 'admin_ceiling'
    when 'production_lead' then 'production_ceiling'
    else 'system'
  end;
$$;

create or replace function private.record_access_event_v1(
  p_company_id uuid,
  p_target_user_id uuid,
  p_event_type text,
  p_authority_source text,
  p_job_id uuid,
  p_revision_before bigint,
  p_revision_after bigint,
  p_before jsonb,
  p_after jsonb,
  p_request_id text,
  p_reason text
)
returns void
language sql
security definer
set search_path = pg_catalog, public
as $$
  insert into public.company_access_events (
    company_id, actor_user_id, target_user_id, event_type, authority_source, job_id,
    access_revision_before, access_revision_after, before_state, after_state, request_id, reason
  ) values (
    p_company_id, auth.uid(), p_target_user_id, p_event_type, p_authority_source, p_job_id,
    p_revision_before, p_revision_after, p_before, p_after, p_request_id, p_reason
  );
$$;

-- ---------------------------------------------------------------------------
-- set_member_access_v1
-- ---------------------------------------------------------------------------
create or replace function public.set_member_access_v1(
  p_target_user_id uuid,
  p_role text,
  p_expected_revision bigint,
  p_packages text[] default null,
  p_restrictions jsonb default null,
  p_request_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_company_id uuid;
  v_tier text;
  v_authority text;
  v_target public.company_memberships%rowtype;
  v_before jsonb;
  v_after jsonb;
  v_current_packages text[];
  v_desired_packages text[];
  v_added text[];
  v_removed text[];
  v_bad text[];
  v_current_restr jsonb;
  v_desired_restr jsonb := '[]'::jsonb;
  v_elem jsonb;
  v_pkg text;
  v_cap text;
  v_scope text;
  v_job uuid;
  v_changed boolean := false;
  v_new_revision bigint;
  v_rows integer;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;
  v_company_id := private.current_active_company_id();
  if v_company_id is null then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;
  v_tier := private.delegation_tier_v1();
  if v_tier is null or v_tier not in ('owner', 'admin') then
    return jsonb_build_object('ok', false, 'code', 'capability_denied');
  end if;
  v_authority := private.tier_authority_source_v1(v_tier);

  if p_target_user_id is null or p_expected_revision is null or p_role is null
     or p_role not in ('admin', 'office_sales', 'production_lead', 'field_user')
     or (p_request_id is not null and char_length(p_request_id) > 120)
     or (p_packages is not null and exists (select 1 from unnest(p_packages) k where k is null))
     or (p_restrictions is not null and jsonb_typeof(p_restrictions) <> 'array') then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;
  if p_target_user_id = v_uid then
    return jsonb_build_object('ok', false, 'code', 'cannot_change_own_access');
  end if;

  select * into v_target
  from public.company_memberships m
  where m.company_id = v_company_id and m.user_id = p_target_user_id
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
  if v_target.access_revision <> p_expected_revision then
    return jsonb_build_object('ok', false, 'code', 'stale_revision', 'access_revision', v_target.access_revision);
  end if;
  if v_tier = 'admin' and (
    v_target.role = 'admin' or p_role = 'admin'
    or private.member_holds_owner_only_package_v1(v_company_id, p_target_user_id)
  ) then
    return jsonb_build_object('ok', false, 'code', 'owner_required');
  end if;

  v_before := private.member_access_snapshot_v1(v_company_id, p_target_user_id);

  select coalesce(array_agg(distinct r.package_key order by r.package_key), '{}'::text[])
  into v_current_packages
  from public.company_member_access_rules r
  where r.company_id = v_company_id and r.user_id = p_target_user_id and r.effect = 'grant'
    and private.access_rule_is_live_v1(r.revoked_at, r.valid_from, r.valid_until);

  if p_packages is null then
    v_desired_packages := v_current_packages;
  else
    select coalesce(array_agg(distinct k order by k), '{}'::text[]) into v_desired_packages from unnest(p_packages) k;
  end if;

  select coalesce(array_agg(k order by k), '{}'::text[]) into v_bad
  from unnest(v_desired_packages) k
  left join public.access_packages p on p.package_key = k
  where p.package_key is null or p.status <> 'active';
  if cardinality(v_bad) > 0 then
    return jsonb_build_object('ok', false, 'code', 'package_unavailable', 'packages', to_jsonb(v_bad));
  end if;

  select coalesce(array_agg(k order by k), '{}'::text[]) into v_bad
  from unnest(v_desired_packages) k
  join public.access_packages p on p.package_key = k
  where not (p_role = any (p.eligible_roles));
  if cardinality(v_bad) > 0 then
    return jsonb_build_object(
      'ok', false,
      'code', case when p_packages is null then 'packages_incompatible' else 'package_ineligible' end,
      'packages', to_jsonb(v_bad)
    );
  end if;

  select coalesce(array_agg(k order by k), '{}'::text[]) into v_added
  from unnest(v_desired_packages) k where not (k = any (v_current_packages));
  select coalesce(array_agg(k order by k), '{}'::text[]) into v_removed
  from unnest(v_current_packages) k where not (k = any (v_desired_packages));

  select coalesce(array_agg(k order by k), '{}'::text[]) into v_bad
  from unnest(v_added || v_removed) k
  left join public.access_packages p on p.package_key = k
  where p.package_key is null or not (v_tier = any (p.assignable_by));
  if cardinality(v_bad) > 0 then
    return jsonb_build_object('ok', false, 'code', 'package_not_delegable', 'packages', to_jsonb(v_bad));
  end if;

  v_current_restr := v_before -> 'restrictions';
  if p_restrictions is null then
    v_desired_restr := v_current_restr;
  else
    for v_elem in select value from jsonb_array_elements(p_restrictions) loop
      if jsonb_typeof(v_elem) <> 'object' then
        return jsonb_build_object('ok', false, 'code', 'invalid_payload');
      end if;
      v_pkg := nullif(v_elem ->> 'package', '');
      v_cap := nullif(v_elem ->> 'capability', '');
      v_scope := coalesce(nullif(v_elem ->> 'scope', ''), 'company');
      begin
        v_job := nullif(v_elem ->> 'job_id', '')::uuid;
      exception when others then
        return jsonb_build_object('ok', false, 'code', 'invalid_payload');
      end;
      if (v_pkg is null) = (v_cap is null)
         or v_scope not in ('company', 'job')
         or ((v_scope = 'job') <> (v_job is not null)) then
        return jsonb_build_object('ok', false, 'code', 'invalid_payload');
      end if;
      if v_pkg is not null and not exists (
        select 1 from public.access_packages p where p.package_key = v_pkg and p.status = 'active'
      ) then
        return jsonb_build_object('ok', false, 'code', 'restriction_unsupported');
      end if;
      if v_cap is not null and not exists (
        select 1 from public.access_capabilities c where c.capability_key = v_cap and c.status = 'active'
      ) then
        return jsonb_build_object('ok', false, 'code', 'restriction_unsupported');
      end if;
      if v_job is not null and not exists (
        select 1 from public.jobs j where j.id = v_job and j.company_id = v_company_id
      ) then
        return jsonb_build_object('ok', false, 'code', 'not_found');
      end if;
      v_elem := jsonb_build_object('package', v_pkg, 'capability', v_cap, 'scope', v_scope, 'job_id', v_job);
      if not (v_desired_restr @> jsonb_build_array(v_elem)) then
        v_desired_restr := v_desired_restr || jsonb_build_array(v_elem);
      end if;
    end loop;
  end if;

  -- Admin never lifts an Owner-set restriction.
  if v_tier = 'admin' and exists (
    select 1
    from public.company_member_access_rules r
    where r.company_id = v_company_id and r.user_id = p_target_user_id and r.effect = 'restrict'
      and r.authority_source = 'owner'
      and private.access_rule_is_live_v1(r.revoked_at, r.valid_from, r.valid_until)
      and not (v_desired_restr @> jsonb_build_array(jsonb_build_object(
        'package', r.package_key, 'capability', r.capability_key, 'scope', r.scope_kind, 'job_id', r.scope_job_id
      )))
  ) then
    return jsonb_build_object('ok', false, 'code', 'owner_required');
  end if;

  -- A grant and a restriction on the same authority is a conflict, never resolved silently.
  if exists (
    select 1
    from jsonb_array_elements(v_desired_restr) x
    where (x ->> 'package') = any (v_desired_packages)
       or exists (
         select 1 from public.access_package_capabilities pc
         where pc.package_key = any (v_desired_packages)
           and pc.capability_key = x ->> 'capability'
           and x ->> 'scope' = 'company'
       )
  ) then
    return jsonb_build_object('ok', false, 'code', 'grant_restriction_conflict');
  end if;

  -- Dependency completeness of granted packages under the resulting role.
  if exists (
    select 1
    from unnest(v_desired_packages) k
    join public.access_packages p on p.package_key = k
    join public.access_package_capabilities pc on pc.package_key = k
    join public.access_capability_dependencies d on d.capability_key = pc.capability_key
    where not exists (
        select 1 from public.access_package_capabilities x
        where x.package_key = any (v_desired_packages) and x.capability_key = d.requires_capability_key
      )
      and not exists (
        select 1 from public.access_role_profile_capabilities rp
        where rp.role_key = p_role
          and rp.version = (select max(v.version) from public.access_role_profiles v where v.role_key = p_role)
          and rp.capability_key = d.requires_capability_key
          and rp.scope_kind in ('company', p.scope_kind)
      )
  ) then
    return jsonb_build_object('ok', false, 'code', 'dependency_incomplete');
  end if;

  v_new_revision := v_target.access_revision + 1;

  if p_role <> v_target.role then
    update public.company_memberships
    set role = p_role,
        role_profile_version = (select max(v.version) from public.access_role_profiles v where v.role_key = p_role)
    where id = v_target.id;
    v_changed := true;
  end if;

  update public.company_member_access_rules r
  set revoked_at = now(), revoked_by = v_uid
  where r.company_id = v_company_id and r.user_id = p_target_user_id and r.effect = 'grant'
    and r.revoked_at is null and r.package_key = any (v_removed);
  get diagnostics v_rows = row_count;
  v_changed := v_changed or v_rows > 0;

  insert into public.company_member_access_rules (
    company_id, user_id, effect, package_key, scope_kind, authority_source, created_by, access_revision
  )
  select v_company_id, p_target_user_id, 'grant', p.package_key, p.scope_kind, v_authority, v_uid, v_new_revision
  from public.access_packages p
  where p.package_key = any (v_added);
  get diagnostics v_rows = row_count;
  v_changed := v_changed or v_rows > 0;

  update public.company_member_access_rules r
  set revoked_at = now(), revoked_by = v_uid
  where r.company_id = v_company_id and r.user_id = p_target_user_id and r.effect = 'restrict'
    and r.revoked_at is null
    and not (v_desired_restr @> jsonb_build_array(jsonb_build_object(
      'package', r.package_key, 'capability', r.capability_key, 'scope', r.scope_kind, 'job_id', r.scope_job_id
    )));
  get diagnostics v_rows = row_count;
  v_changed := v_changed or v_rows > 0;

  insert into public.company_member_access_rules (
    company_id, user_id, effect, package_key, capability_key, scope_kind, scope_job_id,
    authority_source, created_by, access_revision
  )
  select v_company_id, p_target_user_id, 'restrict',
         x ->> 'package', x ->> 'capability', x ->> 'scope', (x ->> 'job_id')::uuid,
         v_authority, v_uid, v_new_revision
  from jsonb_array_elements(v_desired_restr) x
  where not (v_current_restr @> jsonb_build_array(x));
  get diagnostics v_rows = row_count;
  v_changed := v_changed or v_rows > 0;

  if not v_changed then
    return jsonb_build_object(
      'ok', true, 'changed', false, 'user_id', p_target_user_id,
      'role', v_target.role, 'access_revision', v_target.access_revision
    );
  end if;

  update public.company_memberships set access_revision = v_new_revision where id = v_target.id;
  v_after := private.member_access_snapshot_v1(v_company_id, p_target_user_id);
  perform private.record_access_event_v1(
    v_company_id, p_target_user_id, 'member_access_changed', v_authority, null,
    v_target.access_revision, v_new_revision, v_before, v_after, p_request_id, null
  );

  return jsonb_build_object(
    'ok', true, 'changed', true, 'user_id', p_target_user_id,
    'role', p_role, 'access_revision', v_new_revision
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Field job access
-- ---------------------------------------------------------------------------
create or replace function private.change_job_access_v1(
  p_grant boolean,
  p_target_user_id uuid,
  p_job_id uuid,
  p_expected_revision bigint,
  p_request_id text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_company_id uuid;
  v_tier text;
  v_target public.company_memberships%rowtype;
  v_grant_id uuid;
  v_new_revision bigint;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;
  v_company_id := private.current_active_company_id();
  if v_company_id is null then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;
  v_tier := private.delegation_tier_v1();
  if v_tier is null or not private.member_can_v1('jobs.assign') then
    return jsonb_build_object('ok', false, 'code', 'capability_denied');
  end if;
  if p_target_user_id is null or p_job_id is null
     or (p_request_id is not null and char_length(p_request_id) > 120) then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;
  if p_target_user_id = v_uid then
    return jsonb_build_object('ok', false, 'code', 'cannot_change_own_access');
  end if;
  if not exists (select 1 from public.jobs j where j.id = p_job_id and j.company_id = v_company_id) then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  select * into v_target
  from public.company_memberships m
  where m.company_id = v_company_id and m.user_id = p_target_user_id
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v_target.removed_at is not null then
    return jsonb_build_object('ok', false, 'code', 'member_disabled');
  end if;
  if v_target.role <> 'field_user' then
    return jsonb_build_object('ok', false, 'code', 'target_ineligible');
  end if;
  if p_expected_revision is not null and v_target.access_revision <> p_expected_revision then
    return jsonb_build_object('ok', false, 'code', 'stale_revision', 'access_revision', v_target.access_revision);
  end if;

  select g.id into v_grant_id
  from public.job_access_grants g
  where g.job_id = p_job_id and g.user_id = p_target_user_id and g.revoked_at is null
  for update;

  if p_grant and v_grant_id is not null then
    return jsonb_build_object('ok', true, 'changed', false, 'access_revision', v_target.access_revision);
  end if;
  if not p_grant and v_grant_id is null then
    return jsonb_build_object('ok', true, 'changed', false, 'access_revision', v_target.access_revision);
  end if;

  if p_grant then
    insert into public.job_access_grants (company_id, job_id, user_id, granted_by, source)
    values (v_company_id, p_job_id, p_target_user_id, v_uid, 'manual');
  else
    update public.job_access_grants set revoked_at = now(), revoked_by = v_uid where id = v_grant_id;
  end if;

  v_new_revision := v_target.access_revision + 1;
  update public.company_memberships set access_revision = v_new_revision where id = v_target.id;
  perform private.record_access_event_v1(
    v_company_id, p_target_user_id,
    case when p_grant then 'job_access_granted' else 'job_access_revoked' end,
    private.tier_authority_source_v1(v_tier), p_job_id,
    v_target.access_revision, v_new_revision, null, null, p_request_id, 'manual'
  );
  return jsonb_build_object('ok', true, 'changed', true, 'access_revision', v_new_revision);
end;
$$;

create or replace function public.grant_job_access_v1(
  p_target_user_id uuid,
  p_job_id uuid,
  p_expected_revision bigint default null,
  p_request_id text default null
)
returns jsonb
language sql
security definer
set search_path = pg_catalog, public
as $$
  select private.change_job_access_v1(true, p_target_user_id, p_job_id, p_expected_revision, p_request_id);
$$;

create or replace function public.revoke_job_access_v1(
  p_target_user_id uuid,
  p_job_id uuid,
  p_expected_revision bigint default null,
  p_request_id text default null
)
returns jsonb
language sql
security definer
set search_path = pg_catalog, public
as $$
  select private.change_job_access_v1(false, p_target_user_id, p_job_id, p_expected_revision, p_request_id);
$$;

-- Assignment coupling (TIMOTHY DECISION Q1b): assigning an active Field member as
-- task assignee or production lead on a job they cannot access records an explicit
-- grant in the same transaction — only when the actor may delegate job access
-- (company-scope jobs.assign) or the write has no end-user actor. Unassigning never
-- revokes. Otherwise the assignment stands without access (never implicit access).
create or replace function private.job_assignment_access_coupling_trg_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_job_id uuid;
  v_source text;
  v_member public.company_memberships%rowtype;
  v_new_revision bigint;
begin
  if new.assigned_to is null then
    return null;
  end if;
  if tg_op = 'UPDATE' and new.assigned_to is not distinct from old.assigned_to then
    return null;
  end if;
  if tg_table_name = 'jobs' then
    v_job_id := new.id;
    v_source := 'production_lead_assignment';
  else
    v_job_id := new.job_id;
    v_source := 'task_assignment';
  end if;

  select * into v_member
  from public.company_memberships m
  where m.company_id = new.company_id and m.user_id = new.assigned_to and m.removed_at is null
  for update;
  if not found or v_member.role <> 'field_user' then
    return null;
  end if;
  if exists (
    select 1 from public.job_access_grants g
    where g.job_id = v_job_id and g.user_id = new.assigned_to and g.revoked_at is null
  ) then
    return null;
  end if;
  if auth.uid() is not null and not private.member_can_v1('jobs.assign') then
    return null;
  end if;

  insert into public.job_access_grants (company_id, job_id, user_id, granted_by, source)
  values (new.company_id, v_job_id, new.assigned_to, auth.uid(), v_source);
  v_new_revision := v_member.access_revision + 1;
  update public.company_memberships set access_revision = v_new_revision where id = v_member.id;
  perform private.record_access_event_v1(
    new.company_id, new.assigned_to, 'job_access_granted', 'system', v_job_id,
    v_member.access_revision, v_new_revision, null, null, null, v_source
  );
  return null;
end;
$$;

create trigger job_tasks_assignment_access_coupling
  after insert or update of assigned_to on public.job_tasks
  for each row execute function private.job_assignment_access_coupling_trg_v1();

create trigger jobs_assignment_access_coupling
  after insert or update of assigned_to on public.jobs
  for each row execute function private.job_assignment_access_coupling_trg_v1();

-- ---------------------------------------------------------------------------
-- Team RPCs (team.manage, delegation ceiling, revision, audit)
-- ---------------------------------------------------------------------------
drop function if exists public.set_company_member_role_v1(uuid, text);
drop function if exists public.disable_company_member_v1(uuid);
drop function if exists public.handoff_member_open_work_v1(uuid, uuid);
drop function if exists public.list_company_access_admin_v1();

create or replace function public.list_company_access_admin_v1()
returns table (
  user_id uuid,
  display_name text,
  email text,
  role text,
  removed_at timestamptz,
  created_at timestamptz,
  open_job_lead_count integer,
  open_task_assignee_count integer,
  access_revision bigint,
  package_keys text[],
  restriction_count integer,
  granted_job_count integer
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
  if v_company_id is null or not private.member_can_v1('team.manage') then
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
           select count(*)::integer from public.jobs j
           where j.company_id = v_company_id and j.assigned_to = m.user_id
             and private.job_is_open_work_v1(j.stage, j.status, j.archived, j.deleted_at)
         ),
         (
           select count(*)::integer from public.job_tasks t
           where t.company_id = v_company_id and t.assigned_to = m.user_id
             and t.status = 'open' and t.deleted_at is null
         ),
         m.access_revision,
         (
           select coalesce(array_agg(distinct r.package_key order by r.package_key), '{}'::text[])
           from public.company_member_access_rules r
           where r.company_id = v_company_id and r.user_id = m.user_id and r.effect = 'grant'
             and private.access_rule_is_live_v1(r.revoked_at, r.valid_from, r.valid_until)
         ),
         (
           select count(*)::integer from public.company_member_access_rules r
           where r.company_id = v_company_id and r.user_id = m.user_id and r.effect = 'restrict'
             and private.access_rule_is_live_v1(r.revoked_at, r.valid_from, r.valid_until)
         ),
         (
           select count(*)::integer from public.job_access_grants g
           where g.company_id = v_company_id and g.user_id = m.user_id and g.revoked_at is null
         )
  from public.company_memberships m
  left join public.profiles p on p.id = m.user_id
  where m.company_id = v_company_id
  order by m.created_at, m.user_id;
end;
$$;

create or replace function public.disable_company_member_v1(
  p_target_user_id uuid,
  p_expected_revision bigint default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_company_id uuid;
  v_tier text;
  v_target public.company_memberships%rowtype;
  v_now timestamptz := now();
  v_new_revision bigint;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;
  v_company_id := private.current_active_company_id();
  if v_company_id is null then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;
  v_tier := private.delegation_tier_v1();
  if v_tier is null or v_tier not in ('owner', 'admin') then
    return jsonb_build_object('ok', false, 'code', 'capability_denied');
  end if;
  if p_target_user_id is null or (p_reason is not null and char_length(p_reason) > 500) then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;
  if p_target_user_id = v_uid then
    return jsonb_build_object('ok', false, 'code', 'cannot_remove_self');
  end if;

  select * into v_target
  from public.company_memberships m
  where m.company_id = v_company_id and m.user_id = p_target_user_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v_target.role = 'owner' then
    return jsonb_build_object('ok', false, 'code', 'cannot_remove_owner');
  end if;
  if v_target.removed_at is not null then
    return jsonb_build_object(
      'ok', true, 'already_disabled', true, 'user_id', p_target_user_id,
      'removed_at', v_target.removed_at, 'access_revision', v_target.access_revision
    );
  end if;
  if p_expected_revision is not null and v_target.access_revision <> p_expected_revision then
    return jsonb_build_object('ok', false, 'code', 'stale_revision', 'access_revision', v_target.access_revision);
  end if;
  if v_tier = 'admin' and (
    v_target.role = 'admin' or private.member_holds_owner_only_package_v1(v_company_id, p_target_user_id)
  ) then
    return jsonb_build_object('ok', false, 'code', 'owner_required');
  end if;

  v_new_revision := v_target.access_revision + 1;
  update public.company_memberships
  set removed_at = v_now,
      disabled_by = v_uid,
      disabled_reason = nullif(btrim(p_reason), ''),
      access_revision = v_new_revision
  where id = v_target.id;

  perform private.record_access_event_v1(
    v_company_id, p_target_user_id, 'member_disabled', private.tier_authority_source_v1(v_tier), null,
    v_target.access_revision, v_new_revision,
    jsonb_build_object('disabled', false), jsonb_build_object('disabled', true),
    null, nullif(btrim(p_reason), '')
  );

  return jsonb_build_object(
    'ok', true,
    'already_disabled', false,
    'user_id', p_target_user_id,
    'removed_at', v_now,
    'access_revision', v_new_revision,
    'open_work', jsonb_build_object(
      'job_leads', (
        select count(*) from public.jobs j
        where j.company_id = v_company_id and j.assigned_to = p_target_user_id
          and private.job_is_open_work_v1(j.stage, j.status, j.archived, j.deleted_at)
      ),
      'open_tasks', (
        select count(*) from public.job_tasks t
        where t.company_id = v_company_id and t.assigned_to = p_target_user_id
          and t.status = 'open' and t.deleted_at is null
      ),
      'field_job_access', (
        select count(*) from public.job_access_grants g
        where g.company_id = v_company_id and g.user_id = p_target_user_id and g.revoked_at is null
      )
    )
  );
end;
$$;

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
  v_tier text;
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
  v_tier := private.delegation_tier_v1();
  if v_tier is null or v_tier not in ('owner', 'admin') then
    return jsonb_build_object('ok', false, 'code', 'capability_denied');
  end if;
  if p_target_user_id is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  select * into v_target
  from public.company_memberships m
  where m.company_id = v_company_id and m.user_id = p_target_user_id;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v_target.removed_at is null then
    return jsonb_build_object('ok', false, 'code', 'member_active');
  end if;
  if v_tier = 'admin' and v_target.role = 'admin' then
    return jsonb_build_object('ok', false, 'code', 'owner_required');
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

  if v_jobs > 0 or v_tasks > 0 then
    perform private.record_access_event_v1(
      v_company_id, p_target_user_id, 'member_open_work_handoff', private.tier_authority_source_v1(v_tier), null,
      v_target.access_revision, v_target.access_revision, null,
      jsonb_build_object('reassigned_to', p_reassign_to_user_id, 'job_leads', v_jobs, 'tasks', v_tasks),
      null, null
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'user_id', p_target_user_id,
    'reassigned_to', p_reassign_to_user_id,
    'cleared_job_leads', v_jobs,
    'cleared_task_assignees', v_tasks
  );
end;
$$;

-- Directory: names and role labels for members who work across jobs (company-scope
-- jobs.read) or lead work on granted jobs (job-scope tasks.manage). Everyone else
-- (plain Field) sees only their own row; the Field brief carries the labels it needs.
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
    and (
      m.user_id = auth.uid()
      or private.member_can_v1('jobs.read')
      or cardinality(private.member_job_ids_v1('tasks.manage')) > 0
    )
  order by m.created_at, m.user_id;
$$;

-- ---------------------------------------------------------------------------
-- Field brief (operational projection; no prices, totals, terms, costs, payments,
-- or other jobs)
-- ---------------------------------------------------------------------------
create or replace function public.get_job_field_brief_v1(p_job_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_company_id uuid := private.current_active_company_id();
  v_job public.jobs%rowtype;
begin
  if auth.uid() is null or v_company_id is null then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;
  if p_job_id is null or not private.member_can_v1('jobs.read', p_job_id) then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  select * into v_job from public.jobs j where j.id = p_job_id and j.company_id = v_company_id;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  return jsonb_build_object(
    'ok', true,
    'job', jsonb_build_object(
      'id', v_job.id,
      'job_name', v_job.job_name,
      'stage', v_job.stage,
      'status', v_job.status,
      'customer_name', v_job.customer_name,
      'customer_phone', v_job.customer_phone,
      'customer_email', v_job.customer_email,
      'address_line1', v_job.address_line1,
      'address_line2', v_job.address_line2,
      'address_city', v_job.address_city,
      'address_state', v_job.address_state,
      'address_zip', v_job.address_zip,
      'address_formatted', v_job.address_formatted,
      'crew_label', v_job.crew_label,
      'production_lead_user_id', v_job.assigned_to
    ),
    'approved_scope_label', (
      select coalesce(a.customer_chosen_option_label, a.accepted_option_label)
      from public.proposal_acceptances a
      where a.company_id = v_company_id and a.job_id = v_job.id
      order by a.accepted_at desc, a.created_at desc, a.id desc
      limit 1
    ),
    'has_accepted_agreement', exists (
      select 1 from public.proposal_acceptances a
      where a.company_id = v_company_id and a.job_id = v_job.id
    ),
    'scope_changes', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'status', sc.status,
        'reason', sc.reason,
        'lines', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'description', l.description,
            'change_kind', l.change_kind
          ) order by l.sort_order, l.created_at), '[]'::jsonb)
          from public.job_scope_change_lines l
          where l.company_id = v_company_id and l.scope_change_id = sc.id
        )
      ) order by sc.created_at), '[]'::jsonb)
      from public.job_scope_changes sc
      where sc.company_id = v_company_id and sc.job_id = v_job.id
        and sc.deleted_at is null and sc.status in ('proposed', 'authorized')
    ),
    'people', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'user_id', m.user_id,
        'display_name', nullif(btrim(p.full_name), '')
      ) order by m.user_id), '[]'::jsonb)
      from public.company_memberships m
      left join public.profiles p on p.id = m.user_id
      where m.company_id = v_company_id
        and m.removed_at is null
        and (
          m.user_id = v_job.assigned_to
          or m.user_id in (
            select t.assigned_to from public.job_tasks t
            where t.company_id = v_company_id and t.job_id = v_job.id and t.deleted_at is null
          )
        )
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Legacy capability helpers are retired (no remaining references).
-- ---------------------------------------------------------------------------
do $$
declare
  v_refs integer;
begin
  select count(*) into v_refs
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'private')
    and p.proname not in ('role_has_capability_v1', 'current_member_has_capability_v1')
    and (p.prosrc like '%role_has_capability_v1%' or p.prosrc like '%current_member_has_capability_v1%');
  if v_refs > 0 then
    raise exception 'legacy capability helper still referenced by % function(s)', v_refs;
  end if;
  select count(*) into v_refs
  from pg_policies
  where coalesce(qual, '') || coalesce(with_check, '') like '%role_has_capability_v1%'
     or coalesce(qual, '') || coalesce(with_check, '') like '%current_member_has_capability_v1%';
  if v_refs > 0 then
    raise exception 'legacy capability helper still referenced by % policy(ies)', v_refs;
  end if;
end;
$$;

drop function private.current_member_has_capability_v1(text);
drop function private.role_has_capability_v1(text, text);

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke all on function private.member_access_snapshot_v1(uuid, uuid) from public;
revoke all on function private.member_holds_owner_only_package_v1(uuid, uuid) from public;
revoke all on function private.tier_authority_source_v1(text) from public;
revoke all on function private.record_access_event_v1(uuid, uuid, text, text, uuid, bigint, bigint, jsonb, jsonb, text, text) from public;
revoke all on function private.change_job_access_v1(boolean, uuid, uuid, bigint, text) from public;
revoke all on function private.job_assignment_access_coupling_trg_v1() from public;
grant execute on function private.member_access_snapshot_v1(uuid, uuid) to service_role;
grant execute on function private.member_holds_owner_only_package_v1(uuid, uuid) to service_role;
grant execute on function private.tier_authority_source_v1(text) to service_role;

revoke all on function public.set_member_access_v1(uuid, text, bigint, text[], jsonb, text) from public, anon, authenticated;
revoke all on function public.grant_job_access_v1(uuid, uuid, bigint, text) from public, anon, authenticated;
revoke all on function public.revoke_job_access_v1(uuid, uuid, bigint, text) from public, anon, authenticated;
revoke all on function public.list_company_access_admin_v1() from public, anon, authenticated;
revoke all on function public.disable_company_member_v1(uuid, bigint, text) from public, anon, authenticated;
revoke all on function public.handoff_member_open_work_v1(uuid, uuid) from public, anon, authenticated;
revoke all on function public.list_company_directory_v1() from public, anon, authenticated;
revoke all on function public.get_job_field_brief_v1(uuid) from public, anon, authenticated;

grant execute on function public.set_member_access_v1(uuid, text, bigint, text[], jsonb, text) to authenticated, service_role;
grant execute on function public.grant_job_access_v1(uuid, uuid, bigint, text) to authenticated, service_role;
grant execute on function public.revoke_job_access_v1(uuid, uuid, bigint, text) to authenticated, service_role;
grant execute on function public.list_company_access_admin_v1() to authenticated, service_role;
grant execute on function public.disable_company_member_v1(uuid, bigint, text) to authenticated, service_role;
grant execute on function public.handoff_member_open_work_v1(uuid, uuid) to authenticated, service_role;
grant execute on function public.list_company_directory_v1() to authenticated, service_role;
grant execute on function public.get_job_field_brief_v1(uuid) to authenticated, service_role;
