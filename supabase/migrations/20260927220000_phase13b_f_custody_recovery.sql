-- Phase 13B-F — revocation recovery, custody transfer, assurance boundary.
--
-- Disable stays first and is not gated on step-up: a missing strong session must
-- not keep a member effective. Live membership remains the authorization boundary.
-- This migration does not sign sessions out and does not treat sign-out as authority.
--
-- Reactivation is explicit. It clears removed_at only inside this RPC, revokes
-- every live package grant and job grant, then applies only the access named in
-- the call. Old invitations are not a reactivation path.
--
-- Ownership moves in one transaction: demote the current Owner, promote the
-- target, then move companies.owner_user_id. The owner unique index is immediate,
-- so the demotion happens before the promotion. Deferred owner checks see one
-- Owner at commit. There is no pending two-party transfer: a half-finished
-- acknowledgement would be a second custody race, and the target is already an
-- active member. The transferring Owner names the former Owner's role.
--
-- Assurance is aal2 plus a 15-minute iat window, read from the JWT. It is required
-- for ownership transfer, Admin promotion, and granting or removing an
-- owner-only sensitive package (including issuing that invitation). Ordinary
-- capability use is not gated: there is no MFA enrollment in this app, and
-- blocking payments, proposals, or field work would fake a step-up by breaking
-- work. payments.configure and payments.refund stay use-time capabilities until
-- enrollment exists.
--
-- Unavailable-owner recovery is recover_company_custody_v1, executable by
-- service_role only. It requires a reason. It is not granted to anon or
-- authenticated. There is no Admin auto-promotion.

-- ---------------------------------------------------------------------------
-- Audit vocabulary
-- ---------------------------------------------------------------------------
alter table public.company_access_events
  drop constraint company_access_events_event_type_check;

alter table public.company_access_events
  add constraint company_access_events_event_type_check
  check (event_type in (
    'member_access_changed',
    'member_disabled',
    'member_open_work_handoff',
    'member_reactivated',
    'job_access_granted',
    'job_access_revoked',
    'invitation_issued',
    'invitation_resent',
    'invitation_revoked',
    'invitation_accepted',
    'ownership_transferred',
    'support_custody_recovered'
  ));

create table public.company_custody_operations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  operation text not null check (operation in (
    'ownership_transfer', 'support_custody_recovery', 'member_reactivation'
  )),
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 120),
  request_fingerprint text not null check (char_length(request_fingerprint) between 1 and 2000),
  result jsonb not null,
  created_at timestamptz not null default now(),
  constraint company_custody_operations_key_uidx unique (company_id, operation, idempotency_key)
);

alter table public.company_custody_operations enable row level security;
revoke all on table public.company_custody_operations from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Assurance and custody helpers. Not granted to client roles.
-- ---------------------------------------------------------------------------
create or replace function private.assurance_satisfied_v1()
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  v_claims jsonb := coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
  v_aal text := v_claims ->> 'aal';
  v_iat numeric;
begin
  if v_aal is distinct from 'aal2' then
    return false;
  end if;
  begin
    v_iat := nullif(v_claims ->> 'iat', '')::numeric;
  exception when others then
    return false;
  end;
  if v_iat is null then
    return false;
  end if;
  return to_timestamp(v_iat) >= (now() - interval '15 minutes');
end;
$$;

create or replace function private.sensitive_delegation_v1(
  p_new_role text,
  p_prior_role text,
  p_packages text[]
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select (p_new_role = 'admin' and p_prior_role is distinct from 'admin')
    or exists (
      select 1
      from unnest(coalesce(p_packages, '{}'::text[])) k
      join public.access_packages p on p.package_key = k
      where p.strong_auth_required
         or (p.sensitive and not ('admin' = any (p.assignable_by)))
    );
$$;

create or replace function private.lock_company_custody_v1(p_company_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('fielddive.company_custody_v1:' || p_company_id::text, 0));
end;
$$;

create or replace function private.custody_fingerprint_v1(p_to uuid, p_former_role text)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select p_to::text || '|' || p_former_role;
$$;

-- Demote, promote, move the pointer. Caller holds the company custody lock.
create or replace function private.apply_custody_transfer_v1(
  p_company_id uuid,
  p_from_user_id uuid,
  p_to_user_id uuid,
  p_former_role text,
  p_authority_source text,
  p_event_type text,
  p_request_id text,
  p_reason text,
  p_from_expected_revision bigint,
  p_to_expected_revision bigint
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_from public.company_memberships%rowtype;
  v_to public.company_memberships%rowtype;
  v_from_version integer;
  v_to_version integer;
  v_from_revision bigint;
  v_to_revision bigint;
  v_rows integer;
begin
  if p_former_role not in ('admin', 'office_sales', 'production_lead', 'field_user') then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;
  if p_from_user_id = p_to_user_id then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  if p_from_user_id < p_to_user_id then
    select * into v_from from public.company_memberships
     where company_id = p_company_id and user_id = p_from_user_id for update;
    select * into v_to from public.company_memberships
     where company_id = p_company_id and user_id = p_to_user_id for update;
  else
    select * into v_to from public.company_memberships
     where company_id = p_company_id and user_id = p_to_user_id for update;
    select * into v_from from public.company_memberships
     where company_id = p_company_id and user_id = p_from_user_id for update;
  end if;

  if v_from.user_id is null or v_to.user_id is null then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v_from.role is distinct from 'owner' or v_from.removed_at is not null then
    return jsonb_build_object('ok', false, 'code', 'custody_required');
  end if;
  if v_to.removed_at is not null or not private.role_is_valid_v1(v_to.role) or v_to.role = 'owner' then
    return jsonb_build_object('ok', false, 'code', 'transfer_target_ineligible');
  end if;
  if p_from_expected_revision is not null and v_from.access_revision <> p_from_expected_revision then
    return jsonb_build_object('ok', false, 'code', 'stale_revision', 'access_revision', v_from.access_revision);
  end if;
  if p_to_expected_revision is not null and v_to.access_revision <> p_to_expected_revision then
    return jsonb_build_object('ok', false, 'code', 'stale_revision', 'access_revision', v_to.access_revision);
  end if;

  select max(version) into v_from_version from public.access_role_profiles where role_key = p_former_role;
  select max(version) into v_to_version from public.access_role_profiles where role_key = 'owner';
  if v_from_version is null or v_to_version is null then
    return jsonb_build_object('ok', false, 'code', 'role_not_assignable');
  end if;

  v_from_revision := v_from.access_revision + 1;
  v_to_revision := v_to.access_revision + 1;

  update public.company_memberships
  set role = p_former_role,
      role_profile_version = v_from_version,
      access_revision = v_from_revision
  where id = v_from.id;

  update public.company_member_access_rules r
  set revoked_at = now(), revoked_by = auth.uid()
  where r.company_id = p_company_id
    and r.user_id = p_from_user_id
    and r.effect = 'grant'
    and r.revoked_at is null
    and exists (
      select 1 from public.access_packages p
      where p.package_key = r.package_key
        and (
          p.strong_auth_required
          or (p.sensitive and not ('admin' = any (p.assignable_by)))
          or not (p_former_role = any (p.eligible_roles))
          or p.status <> 'active'
        )
    );

  update public.company_memberships
  set role = 'owner',
      role_profile_version = v_to_version,
      access_revision = v_to_revision
  where id = v_to.id;

  update public.companies
  set owner_user_id = p_to_user_id
  where id = p_company_id and owner_user_id = p_from_user_id;
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'custody_pointer_mismatch' using errcode = '40001';
  end if;

  perform private.record_access_event_v1(
    p_company_id, p_to_user_id, p_event_type, p_authority_source, null,
    v_from.access_revision, v_to_revision,
    jsonb_build_object(
      'from_user_id', p_from_user_id,
      'from_role', 'owner',
      'to_user_id', p_to_user_id,
      'to_role', v_to.role
    ),
    jsonb_build_object(
      'from_user_id', p_from_user_id,
      'from_role', p_former_role,
      'to_user_id', p_to_user_id,
      'to_role', 'owner',
      'from_revision', v_from_revision,
      'to_revision', v_to_revision
    ),
    p_request_id, p_reason
  );

  return jsonb_build_object(
    'ok', true,
    'outcome', 'transferred',
    'former_role', p_former_role,
    'from_revision', v_from_revision,
    'to_revision', v_to_revision
  );
end;
$$;

revoke all on function private.assurance_satisfied_v1() from public, anon, authenticated;
revoke all on function private.sensitive_delegation_v1(text, text, text[]) from public, anon, authenticated;
revoke all on function private.lock_company_custody_v1(uuid) from public, anon, authenticated;
revoke all on function private.custody_fingerprint_v1(uuid, text) from public, anon, authenticated;
revoke all on function private.apply_custody_transfer_v1(uuid, uuid, uuid, text, text, text, text, text, bigint, bigint) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Gate sensitive delegation inside the existing mutators.
-- ---------------------------------------------------------------------------
do $$
declare
  v_src text;
  v_new text;
  v_mark text := 'v_new_revision := v_target.access_revision + 1;';
  v_inject text := $inject$
  if private.sensitive_delegation_v1(p_role, v_target.role, v_added || v_removed)
     and not private.assurance_satisfied_v1() then
    return jsonb_build_object('ok', false, 'code', 'assurance_required');
  end if;

  v_new_revision := v_target.access_revision + 1;$inject$;
begin
  v_src := pg_get_functiondef('public.set_member_access_v1(uuid,text,bigint,text[],jsonb,text)'::regprocedure);
  v_new := replace(v_src, v_mark, v_inject);
  if v_new = v_src then
    raise exception 'set_member_access assurance injection point missing';
  end if;
  execute v_new;
end;
$$;

do $$
declare
  v_src text;
  v_new text;
  v_mark text := $m$
  if v_err is not null then
    return v_err;
  end if;$m$;
  v_inject text := $inject$
  if v_err is not null then
    return v_err;
  end if;
  if private.sensitive_delegation_v1(p_role, null, v_packages)
     and not private.assurance_satisfied_v1() then
    return jsonb_build_object('ok', false, 'code', 'assurance_required');
  end if;$inject$;
begin
  v_src := pg_get_functiondef('public.issue_company_invitation_v1(text,text,text[],uuid[],text,text)'::regprocedure);
  v_new := replace(v_src, v_mark, v_inject);
  if v_new = v_src then
    raise exception 'issue_company_invitation assurance injection point missing';
  end if;
  execute v_new;
end;
$$;

revoke all on function public.set_member_access_v1(uuid, text, bigint, text[], jsonb, text) from public, anon, authenticated;
grant execute on function public.set_member_access_v1(uuid, text, bigint, text[], jsonb, text) to authenticated, service_role;
revoke all on function public.issue_company_invitation_v1(text, text, text[], uuid[], text, text) from public, anon, authenticated;
grant execute on function public.issue_company_invitation_v1(text, text, text[], uuid[], text, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Handoff: same open-work scope, plus revision, lock, and request replay.
-- ---------------------------------------------------------------------------
drop function public.handoff_member_open_work_v1(uuid, uuid);

create or replace function public.handoff_member_open_work_v1(
  p_target_user_id uuid,
  p_reassign_to_user_id uuid default null,
  p_expected_revision bigint default null,
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
  v_target public.company_memberships%rowtype;
  v_prev jsonb;
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
  if p_target_user_id is null
     or (p_request_id is not null and p_request_id !~ '^[A-Za-z0-9._:-]{8,120}$') then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  if p_request_id is not null then
    select e.after_state into v_prev
    from public.company_access_events e
    where e.company_id = v_company_id
      and e.target_user_id = p_target_user_id
      and e.event_type = 'member_open_work_handoff'
      and e.request_id = p_request_id
    order by e.occurred_at desc
    limit 1;
    if found then
      if (v_prev ->> 'reassigned_to') is distinct from p_reassign_to_user_id::text then
        return jsonb_build_object('ok', false, 'code', 'idempotency_conflict');
      end if;
      return jsonb_build_object(
        'ok', true,
        'replay', true,
        'user_id', p_target_user_id,
        'reassigned_to', p_reassign_to_user_id,
        'cleared_job_leads', coalesce((v_prev ->> 'job_leads')::integer, 0),
        'cleared_task_assignees', coalesce((v_prev ->> 'tasks')::integer, 0)
      );
    end if;
  end if;

  select * into v_target
  from public.company_memberships m
  where m.company_id = v_company_id and m.user_id = p_target_user_id
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v_target.removed_at is null then
    return jsonb_build_object('ok', false, 'code', 'member_active');
  end if;
  if v_tier = 'admin' and v_target.role = 'admin' then
    return jsonb_build_object('ok', false, 'code', 'owner_required');
  end if;
  if p_expected_revision is not null and v_target.access_revision <> p_expected_revision then
    return jsonb_build_object('ok', false, 'code', 'stale_revision', 'access_revision', v_target.access_revision);
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
         for update
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

  if v_jobs > 0 or v_tasks > 0 or p_request_id is not null then
    perform private.record_access_event_v1(
      v_company_id, p_target_user_id, 'member_open_work_handoff', private.tier_authority_source_v1(v_tier), null,
      v_target.access_revision, v_target.access_revision, null,
      jsonb_build_object(
        'reassigned_to', p_reassign_to_user_id,
        'job_leads', v_jobs,
        'tasks', v_tasks
      ),
      p_request_id, null
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'replay', false,
    'user_id', p_target_user_id,
    'reassigned_to', p_reassign_to_user_id,
    'cleared_job_leads', v_jobs,
    'cleared_task_assignees', v_tasks
  );
end;
$$;

revoke all on function public.handoff_member_open_work_v1(uuid, uuid, bigint, text) from public, anon, authenticated;
grant execute on function public.handoff_member_open_work_v1(uuid, uuid, bigint, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Reactivation. Does not restore prior grants.
-- ---------------------------------------------------------------------------
create or replace function public.reactivate_company_member_v1(
  p_target_user_id uuid,
  p_role text,
  p_packages text[],
  p_job_ids uuid[],
  p_expected_revision bigint,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_company uuid;
  v_tier text;
  v_target public.company_memberships%rowtype;
  v_packages text[];
  v_jobs uuid[];
  v_version integer;
  v_fp text;
  v_op public.company_custody_operations%rowtype;
  v_bad text[];
  v_revision bigint;
  v_result jsonb;
  v_authority text;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;
  v_company := private.current_active_company_id();
  if v_company is null then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;
  v_tier := private.delegation_tier_v1();
  if v_tier is null or v_tier not in ('owner', 'admin') then
    return jsonb_build_object('ok', false, 'code', 'capability_denied');
  end if;
  if p_target_user_id is null or p_expected_revision is null
     or p_role not in ('admin', 'office_sales', 'production_lead', 'field_user')
     or p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9._:-]{8,120}$' then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;
  if p_target_user_id = v_uid then
    return jsonb_build_object('ok', false, 'code', 'cannot_change_own_access');
  end if;

  select coalesce(array_agg(distinct k order by k), '{}'::text[]) into v_packages
  from unnest(coalesce(p_packages, '{}'::text[])) k
  where k is not null and k <> '';
  select coalesce(array_agg(distinct j order by j), '{}'::uuid[]) into v_jobs
  from unnest(coalesce(p_job_ids, '{}'::uuid[])) j
  where j is not null;
  if cardinality(v_jobs) > 0 and p_role <> 'field_user' then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  v_fp := p_role || '|' || array_to_string(v_packages, ',') || '|' || array_to_string(v_jobs, ',');
  perform private.lock_user_membership(p_target_user_id);

  select * into v_op
  from public.company_custody_operations o
  where o.company_id = v_company
    and o.operation = 'member_reactivation'
    and o.idempotency_key = p_idempotency_key;
  if found then
    if v_op.request_fingerprint is distinct from v_fp then
      return jsonb_build_object('ok', false, 'code', 'idempotency_conflict');
    end if;
    return v_op.result || jsonb_build_object('replay', true);
  end if;

  select * into v_target
  from public.company_memberships m
  where m.company_id = v_company and m.user_id = p_target_user_id
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v_target.removed_at is null then
    return jsonb_build_object('ok', false, 'code', 'member_active');
  end if;
  if v_target.role = 'owner' or p_role = 'owner' then
    return jsonb_build_object('ok', false, 'code', 'owner_role_protected');
  end if;
  if v_target.access_revision <> p_expected_revision then
    return jsonb_build_object('ok', false, 'code', 'stale_revision', 'access_revision', v_target.access_revision);
  end if;
  if v_tier = 'admin' and (v_target.role = 'admin' or p_role = 'admin') then
    return jsonb_build_object('ok', false, 'code', 'owner_required');
  end if;

  select coalesce(array_agg(k order by k), '{}'::text[]) into v_bad
  from unnest(v_packages) k
  left join public.access_packages p on p.package_key = k
  where p.package_key is null or p.status <> 'active';
  if cardinality(v_bad) > 0 then
    return jsonb_build_object('ok', false, 'code', 'package_unavailable');
  end if;
  select coalesce(array_agg(k order by k), '{}'::text[]) into v_bad
  from unnest(v_packages) k
  join public.access_packages p on p.package_key = k
  where not (p_role = any (p.eligible_roles));
  if cardinality(v_bad) > 0 then
    return jsonb_build_object('ok', false, 'code', 'package_ineligible');
  end if;
  if v_tier = 'admin' and exists (
    select 1 from unnest(v_packages) k
    join public.access_packages p on p.package_key = k
    where not ('admin' = any (p.assignable_by))
  ) then
    return jsonb_build_object('ok', false, 'code', 'owner_required');
  end if;
  if private.sensitive_delegation_v1(p_role, null, v_packages)
     and not private.assurance_satisfied_v1() then
    return jsonb_build_object('ok', false, 'code', 'assurance_required');
  end if;

  select max(version) into v_version from public.access_role_profiles where role_key = p_role;
  if v_version is null then
    return jsonb_build_object('ok', false, 'code', 'role_not_assignable');
  end if;
  if cardinality(v_jobs) > 0 and exists (
    select 1 from unnest(v_jobs) j
    where not exists (
      select 1 from public.jobs x
      where x.id = j and x.company_id = v_company and x.deleted_at is null
    )
  ) then
    return jsonb_build_object('ok', false, 'code', 'invalid_scope');
  end if;

  v_authority := private.tier_authority_source_v1(v_tier);
  v_revision := v_target.access_revision + 1;

  update public.company_member_access_rules
  set revoked_at = now(), revoked_by = v_uid
  where company_id = v_company and user_id = p_target_user_id and effect = 'grant' and revoked_at is null;

  update public.job_access_grants
  set revoked_at = now(), revoked_by = v_uid
  where company_id = v_company and user_id = p_target_user_id and revoked_at is null;

  update public.company_memberships
  set removed_at = null,
      disabled_by = null,
      role = p_role,
      role_profile_version = v_version,
      access_revision = v_revision
  where id = v_target.id;

  insert into public.company_member_access_rules (
    company_id, user_id, effect, package_key, scope_kind, authority_source, created_by, access_revision
  )
  select v_company, p_target_user_id, 'grant', p.package_key, p.scope_kind, v_authority, v_uid, v_revision
  from public.access_packages p
  where p.package_key = any (v_packages);

  insert into public.job_access_grants (company_id, job_id, user_id, granted_by, source)
  select v_company, j, p_target_user_id, v_uid, 'manual'
  from unnest(v_jobs) j;

  v_result := jsonb_build_object(
    'ok', true,
    'outcome', 'reactivated',
    'replay', false,
    'role', p_role,
    'access_revision', v_revision,
    'packages', to_jsonb(v_packages)
  );
  perform private.record_access_event_v1(
    v_company, p_target_user_id, 'member_reactivated', v_authority, null,
    v_target.access_revision, v_revision,
    jsonb_build_object('disabled', true, 'role', v_target.role),
    jsonb_build_object('disabled', false, 'role', p_role, 'packages', to_jsonb(v_packages)),
    p_idempotency_key, null
  );
  insert into public.company_custody_operations (company_id, operation, idempotency_key, request_fingerprint, result)
  values (v_company, 'member_reactivation', p_idempotency_key, v_fp, v_result);
  return v_result;
end;
$$;

revoke all on function public.reactivate_company_member_v1(uuid, text, text[], uuid[], bigint, text) from public, anon, authenticated;
grant execute on function public.reactivate_company_member_v1(uuid, text, text[], uuid[], bigint, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Ownership transfer. Current custody Owner only. One transaction.
-- ---------------------------------------------------------------------------
create or replace function public.transfer_company_ownership_v1(
  p_target_user_id uuid,
  p_former_role text,
  p_owner_expected_revision bigint,
  p_target_expected_revision bigint,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_company uuid;
  v_fp text;
  v_op public.company_custody_operations%rowtype;
  v_result jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;
  v_company := private.current_active_company_id();
  if v_company is null then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;
  if p_target_user_id is null
     or p_former_role not in ('admin', 'office_sales', 'production_lead', 'field_user')
     or p_owner_expected_revision is null
     or p_target_expected_revision is null
     or p_idempotency_key is null
     or p_idempotency_key !~ '^[A-Za-z0-9._:-]{8,120}$' then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;
  v_fp := private.custody_fingerprint_v1(p_target_user_id, p_former_role);
  perform private.lock_company_custody_v1(v_company);

  select * into v_op
  from public.company_custody_operations o
  where o.company_id = v_company
    and o.operation = 'ownership_transfer'
    and o.idempotency_key = p_idempotency_key
  for update;
  if found then
    if v_op.request_fingerprint is distinct from v_fp then
      return jsonb_build_object('ok', false, 'code', 'idempotency_conflict');
    end if;
    return v_op.result || jsonb_build_object('replay', true);
  end if;
  if not private.assurance_satisfied_v1() then
    return jsonb_build_object('ok', false, 'code', 'assurance_required');
  end if;
  if not exists (
    select 1 from public.companies c
    where c.id = v_company and c.owner_user_id = v_uid
  ) then
    return jsonb_build_object('ok', false, 'code', 'custody_required');
  end if;

  v_result := private.apply_custody_transfer_v1(
    v_company, v_uid, p_target_user_id, p_former_role, 'owner', 'ownership_transferred',
    p_idempotency_key, null, p_owner_expected_revision, p_target_expected_revision
  );
  if coalesce((v_result ->> 'ok')::boolean, false) then
    insert into public.company_custody_operations (company_id, operation, idempotency_key, request_fingerprint, result)
    values (v_company, 'ownership_transfer', p_idempotency_key, v_fp, v_result);
  end if;
  return v_result;
end;
$$;

revoke all on function public.transfer_company_ownership_v1(uuid, text, bigint, bigint, text) from public, anon, authenticated;
grant execute on function public.transfer_company_ownership_v1(uuid, text, bigint, bigint, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Support custody recovery. service_role only. Reason required. No client grant.
-- ---------------------------------------------------------------------------
create or replace function public.recover_company_custody_v1(
  p_company_id uuid,
  p_new_owner_user_id uuid,
  p_former_role text,
  p_reason text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_raw text := nullif(current_setting('request.jwt.claims', true), '');
  v_role text := '';
  v_from uuid;
  v_fp text;
  v_op public.company_custody_operations%rowtype;
  v_result jsonb;
  v_reason text := nullif(btrim(p_reason), '');
begin
  if v_raw is not null then
    begin
      v_role := coalesce(v_raw::jsonb ->> 'role', '');
    exception when others then
      v_role := '';
    end;
  end if;
  if v_role is distinct from 'service_role' then
    raise exception 'support_custody_forbidden' using errcode = '42501';
  end if;
  if p_company_id is null or p_new_owner_user_id is null
     or p_former_role not in ('admin', 'office_sales', 'production_lead', 'field_user')
     or v_reason is null or char_length(v_reason) < 8 or char_length(v_reason) > 500
     or p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9._:-]{8,120}$' then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  perform private.lock_company_custody_v1(p_company_id);
  select c.owner_user_id into v_from from public.companies c where c.id = p_company_id for update;
  if v_from is null then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  v_fp := private.custody_fingerprint_v1(p_new_owner_user_id, p_former_role);
  select * into v_op
  from public.company_custody_operations o
  where o.company_id = p_company_id
    and o.operation = 'support_custody_recovery'
    and o.idempotency_key = p_idempotency_key
  for update;
  if found then
    if v_op.request_fingerprint is distinct from v_fp then
      return jsonb_build_object('ok', false, 'code', 'idempotency_conflict');
    end if;
    return v_op.result || jsonb_build_object('replay', true);
  end if;

  v_result := private.apply_custody_transfer_v1(
    p_company_id, v_from, p_new_owner_user_id, p_former_role, 'system', 'support_custody_recovered',
    p_idempotency_key, v_reason, null, null
  );
  if coalesce((v_result ->> 'ok')::boolean, false) then
    v_result := v_result || jsonb_build_object('outcome', 'recovered');
    insert into public.company_custody_operations (company_id, operation, idempotency_key, request_fingerprint, result)
    values (p_company_id, 'support_custody_recovery', p_idempotency_key, v_fp, v_result);
  end if;
  return v_result;
end;
$$;

revoke all on function public.recover_company_custody_v1(uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.recover_company_custody_v1(uuid, uuid, text, text, text) to service_role;
