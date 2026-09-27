-- Phase 13B-E — invitation lifecycle and join authority.
--
-- A pending invitation is not membership. Email delivery is not membership.
-- Opening a link is not membership. The only access change is
-- accept_company_invitation_v1 / accept_my_company_invitation_v1:
-- authenticated verified recipient, shared private.lock_user_membership,
-- one membership in the existing company, invitation accepted, audit,
-- in one transaction.
--
-- States stay pending | accepted | revoked. Expiry is derived from expires_at
-- (database now(), 7 days per generation). Delivery rows are not authority.
--
-- Other pending invitations are left unchanged when one is accepted. A later
-- accept returns membership_conflict and does not move or merge the account.
--
-- Revoke marks the row revoked and increments generation. The token hash is
-- kept so the link resolves to a revoked state. It cannot be accepted.
-- Resend replaces the hash, so the previous link no longer resolves.
--
-- Acceptance re-checks the issuer's current delegation tier, the issuer's
-- access_revision against access_revision_at_issue, and the pinned
-- role_profile_version against the current maximum. A mismatch returns
-- reauthorization_required and grants nothing. Resend by someone who still
-- has authority re-stamps that revision and the current profile version
-- without adding packages or jobs.
--
-- Preview may describe a link the caller holds. It never accepts.
-- Raw tokens are not stored, not written to company_access_events, and not
-- written to delivery rows.

-- ---------------------------------------------------------------------------
-- Invitation columns and delivery log
-- ---------------------------------------------------------------------------
alter table public.company_invitations
  add column role_profile_version integer not null default 1,
  add column proposal_fingerprint text,
  add column resend_idempotency_key text;

alter table public.company_invitations
  add constraint company_invitations_role_profile_fk
    foreign key (role, role_profile_version)
    references public.access_role_profiles (role_key, version),
  add constraint company_invitations_fingerprint_len_chk
    check (proposal_fingerprint is null or char_length(proposal_fingerprint) <= 2000),
  add constraint company_invitations_resend_key_len_chk
    check (resend_idempotency_key is null or char_length(resend_idempotency_key) <= 120);

create unique index company_invitations_token_hash_uidx
  on public.company_invitations (token_hash);

create unique index company_invitations_idempotency_uidx
  on public.company_invitations (company_id, idempotency_key)
  where idempotency_key is not null;

create table public.company_invitation_delivery_attempts (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.company_invitations (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  generation integer not null check (generation >= 1),
  kind text not null check (kind in ('issue', 'resend')),
  idempotency_key text not null check (char_length(idempotency_key) between 1 and 120),
  status text not null check (status in ('sent', 'failed')),
  error_class text check (error_class is null or char_length(error_class) <= 40),
  provider_message_id text check (
    provider_message_id is null or char_length(provider_message_id) <= 200
  ),
  recorded_at timestamptz not null default now(),
  constraint company_invitation_delivery_attempts_key_uidx unique (invitation_id, idempotency_key)
);

alter table public.company_invitation_delivery_attempts enable row level security;
revoke all on table public.company_invitation_delivery_attempts from public, anon, authenticated;

alter table public.company_access_events
  drop constraint company_access_events_event_type_check;

alter table public.company_access_events
  add constraint company_access_events_event_type_check
  check (event_type in (
    'member_access_changed',
    'member_disabled',
    'member_open_work_handoff',
    'job_access_granted',
    'job_access_revoked',
    'invitation_issued',
    'invitation_resent',
    'invitation_revoked',
    'invitation_accepted'
  ));

alter table public.job_access_grants
  drop constraint job_access_grants_source_check;

alter table public.job_access_grants
  add constraint job_access_grants_source_check
  check (source in (
    'manual',
    'task_assignment',
    'production_lead_assignment',
    'migration',
    'invitation'
  ));

-- ---------------------------------------------------------------------------
-- Helpers. Not granted to client roles.
-- ---------------------------------------------------------------------------
create or replace function private.invitation_token_hash_v1(p_hex text)
returns bytea
language plpgsql
immutable
set search_path = pg_catalog
as $$
begin
  if p_hex is null or p_hex !~ '^[0-9a-f]{64}$' then
    return null;
  end if;
  return decode(p_hex, 'hex');
end;
$$;

create or replace function private.invitation_fingerprint_v1(
  p_role text,
  p_packages text[],
  p_job_ids uuid[]
)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select coalesce(p_role, '') || '|' ||
    coalesce((select string_agg(k, ',' order by k) from unnest(coalesce(p_packages, '{}'::text[])) k), '') || '|' ||
    coalesce((select string_agg(j::text, ',' order by j::text) from unnest(coalesce(p_job_ids, '{}'::uuid[])) j), '');
$$;

-- Owner or Admin with team.manage in this company. Production Lead is not an
-- invitation issuer. Null means the user cannot issue, resend, or revoke.
create or replace function private.invitation_delegate_tier_v1(
  p_company_id uuid,
  p_user_id uuid
)
returns text
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_role text;
begin
  if p_company_id is null or p_user_id is null then
    return null;
  end if;

  if exists (
    select 1
    from public.companies c
    join public.company_memberships m
      on m.company_id = c.id
     and m.user_id = c.owner_user_id
    where c.id = p_company_id
      and c.owner_user_id = p_user_id
      and m.role = 'owner'
      and m.removed_at is null
  ) then
    return 'owner';
  end if;

  select m.role into v_role
  from public.company_memberships m
  where m.user_id = p_user_id
    and m.company_id = p_company_id
    and m.removed_at is null;

  if v_role = 'admin' and exists (
    select 1
    from private.evaluate_access_v1(p_user_id, 'team.manage', null, null) e
    where e.reason = 'allowed'
  ) then
    return 'admin';
  end if;

  return null;
end;
$$;

-- Validates a proposed invitation against a tier and a specific profile version.
-- Returns an error jsonb, or null when the proposal is allowed.
create or replace function private.invitation_validate_proposal_v1(
  p_company_id uuid,
  p_tier text,
  p_role text,
  p_packages text[],
  p_job_ids uuid[],
  p_profile_version integer
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_bad text[];
begin
  if p_tier is null or p_tier not in ('owner', 'admin') then
    return jsonb_build_object('ok', false, 'code', 'capability_denied');
  end if;
  if p_role is null or p_role not in ('admin', 'office_sales', 'production_lead', 'field_user') then
    return jsonb_build_object('ok', false, 'code', 'role_not_assignable');
  end if;
  if p_role = 'admin' and p_tier <> 'owner' then
    return jsonb_build_object('ok', false, 'code', 'owner_required');
  end if;
  if p_profile_version is null or not exists (
    select 1
    from public.access_role_profiles rp
    where rp.role_key = p_role and rp.version = p_profile_version
  ) then
    return jsonb_build_object('ok', false, 'code', 'role_not_assignable');
  end if;
  if cardinality(coalesce(p_packages, '{}'::text[])) > 20
     or cardinality(coalesce(p_job_ids, '{}'::uuid[])) > 100 then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;
  if p_role <> 'field_user' and cardinality(coalesce(p_job_ids, '{}'::uuid[])) > 0 then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  select coalesce(array_agg(k order by k), '{}'::text[]) into v_bad
  from unnest(coalesce(p_packages, '{}'::text[])) k
  left join public.access_packages p on p.package_key = k
  where p.package_key is null or p.status <> 'active';
  if cardinality(v_bad) > 0 then
    return jsonb_build_object('ok', false, 'code', 'package_unavailable', 'packages', to_jsonb(v_bad));
  end if;

  select coalesce(array_agg(k order by k), '{}'::text[]) into v_bad
  from unnest(coalesce(p_packages, '{}'::text[])) k
  join public.access_packages p on p.package_key = k
  where not (p_role = any (p.eligible_roles));
  if cardinality(v_bad) > 0 then
    return jsonb_build_object('ok', false, 'code', 'package_ineligible', 'packages', to_jsonb(v_bad));
  end if;

  select coalesce(array_agg(k order by k), '{}'::text[]) into v_bad
  from unnest(coalesce(p_packages, '{}'::text[])) k
  join public.access_packages p on p.package_key = k
  where not (p_tier = any (p.assignable_by));
  if cardinality(v_bad) > 0 then
    return jsonb_build_object('ok', false, 'code', 'package_not_delegable', 'packages', to_jsonb(v_bad));
  end if;

  if exists (
    select 1
    from unnest(coalesce(p_packages, '{}'::text[])) k
    join public.access_packages p on p.package_key = k
    join public.access_package_capabilities pc on pc.package_key = k
    join public.access_capability_dependencies d on d.capability_key = pc.capability_key
    where not exists (
      select 1
      from public.access_package_capabilities x
      where x.package_key = any (coalesce(p_packages, '{}'::text[]))
        and x.capability_key = d.requires_capability_key
    )
    and not exists (
      select 1
      from public.access_role_profile_capabilities rp
      where rp.role_key = p_role
        and rp.version = p_profile_version
        and rp.capability_key = d.requires_capability_key
        and rp.scope_kind in ('company', p.scope_kind)
    )
  ) then
    return jsonb_build_object('ok', false, 'code', 'dependency_incomplete');
  end if;

  if p_role = 'field_user' and exists (
    select 1
    from unnest(coalesce(p_job_ids, '{}'::uuid[])) j
    where not exists (
      select 1
      from public.jobs job
      where job.id = j
        and job.company_id = p_company_id
        and job.deleted_at is null
    )
  ) then
    return jsonb_build_object('ok', false, 'code', 'invalid_scope');
  end if;

  return null;
end;
$$;

create or replace function private.invitation_existing_result_v1(
  p_row public.company_invitations
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_label text;
begin
  select c.name into v_label from public.companies c where c.id = p_row.company_id;
  return jsonb_build_object(
    'ok', true,
    'outcome', 'existing',
    'send', false,
    'invitation_id', p_row.id,
    'generation', p_row.generation,
    'expires_at', p_row.expires_at,
    'status', p_row.status,
    'company_label', v_label,
    'role', p_row.role,
    'email_canonical', p_row.email_canonical,
    'packages', to_jsonb(p_row.packages)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Issue. Company comes from the actor's active membership, never from the client.
-- ---------------------------------------------------------------------------
create or replace function public.issue_company_invitation_v1(
  p_email text,
  p_role text,
  p_packages text[],
  p_job_ids uuid[],
  p_token_hash text,
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
  v_email text;
  v_actor_email text;
  v_packages text[];
  v_jobs uuid[];
  v_version integer;
  v_rev bigint;
  v_fp text;
  v_hash bytea;
  v_err jsonb;
  v_existing public.company_invitations%rowtype;
  v_id uuid;
  v_expires timestamptz;
  v_label text;
  v_target uuid;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;
  v_company := private.current_active_company_id();
  v_tier := private.invitation_delegate_tier_v1(v_company, v_uid);
  if v_tier is null then
    return jsonb_build_object('ok', false, 'code', 'capability_denied');
  end if;

  v_email := lower(btrim(coalesce(p_email, '')));
  if char_length(v_email) < 3
     or char_length(v_email) > 320
     or position('@' in v_email) < 2
     or v_email ~ '\s' then
    return jsonb_build_object('ok', false, 'code', 'invalid_email');
  end if;
  if p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9._:-]{8,120}$' then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;
  v_hash := private.invitation_token_hash_v1(p_token_hash);
  if v_hash is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  select coalesce(array_agg(distinct k order by k), '{}'::text[]) into v_packages
  from unnest(coalesce(p_packages, '{}'::text[])) k
  where k is not null and k <> '';
  select coalesce(array_agg(distinct j order by j), '{}'::uuid[]) into v_jobs
  from unnest(coalesce(p_job_ids, '{}'::uuid[])) j
  where j is not null;

  select max(rp.version) into v_version
  from public.access_role_profiles rp
  where rp.role_key = p_role;
  v_fp := private.invitation_fingerprint_v1(p_role, v_packages, v_jobs);

  select * into v_existing
  from public.company_invitations i
  where i.company_id = v_company
    and i.idempotency_key = p_idempotency_key;
  if found then
    if v_existing.proposal_fingerprint is not distinct from v_fp then
      return private.invitation_existing_result_v1(v_existing);
    end if;
    return jsonb_build_object('ok', false, 'code', 'idempotency_conflict');
  end if;

  select lower(btrim(u.email)) into v_actor_email
  from auth.users u
  where u.id = v_uid;
  if v_actor_email is not null and v_actor_email = v_email then
    return jsonb_build_object('ok', false, 'code', 'self_invite');
  end if;

  if exists (
    select 1
    from auth.users u
    join public.company_memberships m on m.user_id = u.id
    where lower(btrim(u.email)) = v_email
  ) then
    return jsonb_build_object('ok', false, 'code', 'recipient_membership_exists');
  end if;

  select * into v_existing
  from public.company_invitations i
  where i.company_id = v_company
    and i.email_canonical = v_email
    and i.status = 'pending';
  if found then
    return jsonb_build_object(
      'ok', false,
      'code', 'invitation_pending',
      'invitation_id', v_existing.id
    );
  end if;

  v_err := private.invitation_validate_proposal_v1(
    v_company, v_tier, p_role, v_packages, v_jobs, v_version
  );
  if v_err is not null then
    return v_err;
  end if;

  select m.access_revision into v_rev
  from public.company_memberships m
  where m.user_id = v_uid
    and m.company_id = v_company
    and m.removed_at is null;

  insert into public.company_invitations (
    company_id, email_canonical, role, packages, job_ids, status, expires_at,
    generation, token_hash, issued_by, authority_source, access_revision_at_issue,
    idempotency_key, role_profile_version, proposal_fingerprint
  ) values (
    v_company, v_email, p_role, v_packages, v_jobs, 'pending', now() + interval '7 days',
    1, v_hash, v_uid, private.tier_authority_source_v1(v_tier), v_rev,
    p_idempotency_key, v_version, v_fp
  )
  returning id, expires_at into v_id, v_expires;

  select u.id into v_target
  from auth.users u
  where lower(btrim(u.email)) = v_email
  limit 1;

  perform private.record_access_event_v1(
    v_company, v_target, 'invitation_issued', private.tier_authority_source_v1(v_tier),
    null, null, 1, null,
    jsonb_build_object(
      'invitation_id', v_id,
      'email_canonical', v_email,
      'role', p_role,
      'role_profile_version', v_version,
      'packages', to_jsonb(v_packages),
      'job_ids', to_jsonb(v_jobs),
      'generation', 1
    ),
    p_idempotency_key, 'issue'
  );

  select c.name into v_label from public.companies c where c.id = v_company;
  return jsonb_build_object(
    'ok', true,
    'outcome', 'created',
    'send', true,
    'invitation_id', v_id,
    'generation', 1,
    'expires_at', v_expires,
    'company_label', v_label,
    'role', p_role,
    'email_canonical', v_email,
    'packages', to_jsonb(v_packages)
  );
exception
  when unique_violation then
    select * into v_existing
    from public.company_invitations i
    where i.company_id = v_company
      and i.idempotency_key = p_idempotency_key;
    if found and v_existing.proposal_fingerprint is not distinct from v_fp then
      return private.invitation_existing_result_v1(v_existing);
    end if;
    if found then
      return jsonb_build_object('ok', false, 'code', 'idempotency_conflict');
    end if;
    return jsonb_build_object('ok', false, 'code', 'invitation_pending');
end;
$$;

-- ---------------------------------------------------------------------------
-- Resend. Same invitation. New hash and expiry. Previous link stops resolving.
-- One idempotency key rotates at most once.
-- ---------------------------------------------------------------------------
create or replace function public.resend_company_invitation_v1(
  p_invitation_id uuid,
  p_token_hash text,
  p_expected_generation integer,
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
  v_inv public.company_invitations%rowtype;
  v_hash bytea;
  v_version integer;
  v_rev bigint;
  v_err jsonb;
  v_label text;
  v_expires timestamptz;
  v_target uuid;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;
  v_company := private.current_active_company_id();
  v_tier := private.invitation_delegate_tier_v1(v_company, v_uid);
  if v_tier is null then
    return jsonb_build_object('ok', false, 'code', 'capability_denied');
  end if;
  if p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9._:-]{8,120}$' then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  select * into v_inv
  from public.company_invitations i
  where i.id = p_invitation_id
    and i.company_id = v_company
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v_inv.status = 'revoked' then
    return jsonb_build_object('ok', false, 'code', 'revoked');
  end if;
  if v_inv.status = 'accepted' then
    return jsonb_build_object('ok', false, 'code', 'already_accepted');
  end if;

  if v_inv.resend_idempotency_key is not distinct from p_idempotency_key then
    select c.name into v_label from public.companies c where c.id = v_company;
    return jsonb_build_object(
      'ok', true,
      'outcome', 'existing',
      'send', false,
      'changed', false,
      'invitation_id', v_inv.id,
      'generation', v_inv.generation,
      'expires_at', v_inv.expires_at,
      'company_label', v_label,
      'role', v_inv.role,
      'email_canonical', v_inv.email_canonical,
      'packages', to_jsonb(v_inv.packages)
    );
  end if;

  if p_expected_generation is distinct from v_inv.generation then
    return jsonb_build_object(
      'ok', false,
      'code', 'stale_generation',
      'generation', v_inv.generation
    );
  end if;

  v_hash := private.invitation_token_hash_v1(p_token_hash);
  if v_hash is null or v_hash = v_inv.token_hash then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  select max(rp.version) into v_version
  from public.access_role_profiles rp
  where rp.role_key = v_inv.role;
  v_err := private.invitation_validate_proposal_v1(
    v_company, v_tier, v_inv.role, v_inv.packages, v_inv.job_ids, v_version
  );
  if v_err is not null then
    return jsonb_build_object('ok', false, 'code', 'reauthorization_required');
  end if;

  select m.access_revision into v_rev
  from public.company_memberships m
  where m.user_id = v_uid
    and m.company_id = v_company
    and m.removed_at is null;

  update public.company_invitations
  set generation = v_inv.generation + 1,
      token_hash = v_hash,
      expires_at = now() + interval '7 days',
      role_profile_version = v_version,
      issued_by = v_uid,
      authority_source = private.tier_authority_source_v1(v_tier),
      access_revision_at_issue = v_rev,
      resend_idempotency_key = p_idempotency_key
  where id = v_inv.id
  returning expires_at into v_expires;

  select u.id into v_target
  from auth.users u
  where lower(btrim(u.email)) = v_inv.email_canonical
  limit 1;

  perform private.record_access_event_v1(
    v_company, v_target, 'invitation_resent', private.tier_authority_source_v1(v_tier),
    null, v_inv.generation, v_inv.generation + 1, null,
    jsonb_build_object(
      'invitation_id', v_inv.id,
      'email_canonical', v_inv.email_canonical,
      'role', v_inv.role,
      'role_profile_version', v_version,
      'packages', to_jsonb(v_inv.packages),
      'job_ids', to_jsonb(v_inv.job_ids),
      'generation', v_inv.generation + 1
    ),
    p_idempotency_key, 'resend'
  );

  select c.name into v_label from public.companies c where c.id = v_company;
  return jsonb_build_object(
    'ok', true,
    'outcome', 'resent',
    'send', true,
    'changed', true,
    'invitation_id', v_inv.id,
    'generation', v_inv.generation + 1,
      'expires_at', v_expires,
      'company_label', v_label,
      'role', v_inv.role,
      'email_canonical', v_inv.email_canonical,
      'packages', to_jsonb(v_inv.packages)
    );
end;
$$;

-- ---------------------------------------------------------------------------
-- Revoke. Pending only. Does not touch memberships. Idempotent.
-- ---------------------------------------------------------------------------
create or replace function public.revoke_company_invitation_v1(p_invitation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_company uuid;
  v_tier text;
  v_inv public.company_invitations%rowtype;
  v_target uuid;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;
  v_company := private.current_active_company_id();
  v_tier := private.invitation_delegate_tier_v1(v_company, v_uid);
  if v_tier is null then
    return jsonb_build_object('ok', false, 'code', 'capability_denied');
  end if;

  select * into v_inv
  from public.company_invitations i
  where i.id = p_invitation_id
    and i.company_id = v_company
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v_inv.status = 'revoked' then
    return jsonb_build_object('ok', true, 'outcome', 'already_revoked', 'changed', false, 'invitation_id', v_inv.id);
  end if;
  if v_inv.status = 'accepted' then
    return jsonb_build_object('ok', false, 'code', 'already_accepted');
  end if;

  update public.company_invitations
  set status = 'revoked',
      revoked_at = now(),
      revoked_by = v_uid,
      generation = v_inv.generation + 1
  where id = v_inv.id;

  select u.id into v_target
  from auth.users u
  where lower(btrim(u.email)) = v_inv.email_canonical
  limit 1;

  perform private.record_access_event_v1(
    v_company, v_target, 'invitation_revoked', private.tier_authority_source_v1(v_tier),
    null, v_inv.generation, v_inv.generation + 1,
    jsonb_build_object('status', 'pending', 'generation', v_inv.generation),
    jsonb_build_object(
      'invitation_id', v_inv.id,
      'email_canonical', v_inv.email_canonical,
      'role', v_inv.role,
      'role_profile_version', v_inv.role_profile_version,
      'packages', to_jsonb(v_inv.packages),
      'generation', v_inv.generation + 1,
      'status', 'revoked'
    ),
    v_inv.id::text, 'revoke'
  );

  return jsonb_build_object('ok', true, 'outcome', 'revoked', 'changed', true, 'invitation_id', v_inv.id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Accept. Shared membership lock, then the invitation row.
-- Replay returns the membership as it is now and does not grant again.
-- ---------------------------------------------------------------------------
create or replace function private.accept_company_invitation_core_v1(
  p_invitation_id uuid,
  p_token_path boolean,
  p_token_hash bytea,
  p_request_id text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_confirmed timestamptz;
  v_canonical text;
  v_inv public.company_invitations%rowtype;
  v_member public.company_memberships%rowtype;
  v_tier text;
  v_rev bigint;
  v_max integer;
  v_err jsonb;
  v_label text;
  v_rows integer;
  v_request text;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;
  if p_request_id is not null and (
    char_length(p_request_id) > 120 or p_request_id !~ '^[A-Za-z0-9._:-]+$'
  ) then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  select u.email, u.email_confirmed_at into v_email, v_confirmed
  from auth.users u
  where u.id = v_uid;
  v_canonical := lower(btrim(coalesce(v_email, '')));

  perform private.lock_user_membership(v_uid);

  if p_invitation_id is null then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  select * into v_inv
  from public.company_invitations i
  where i.id = p_invitation_id
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  -- Resend replaces the hash. Re-check under the row lock so an old link
  -- cannot accept the new generation.
  if p_token_path and v_inv.token_hash is distinct from p_token_hash then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  if v_inv.status = 'accepted' and v_inv.accepted_by_user_id = v_uid then
    select * into v_member
    from public.company_memberships m
    where m.user_id = v_uid;
    if not found then
      return jsonb_build_object('ok', false, 'code', 'authorization_unavailable');
    end if;
    select c.name into v_label from public.companies c where c.id = v_member.company_id;
    if v_member.removed_at is not null then
      return jsonb_build_object(
        'ok', true,
        'outcome', 'accepted_disabled',
        'company_label', v_label
      );
    end if;
    return jsonb_build_object(
      'ok', true,
      'outcome', 'already_accepted',
      'company_label', v_label,
      'role', v_member.role,
      'company_id', v_member.company_id
    );
  end if;

  if v_confirmed is null then
    if not p_token_path and v_canonical <> v_inv.email_canonical then
      return jsonb_build_object('ok', false, 'code', 'not_found');
    end if;
    return jsonb_build_object('ok', false, 'code', 'unverified_email');
  end if;

  if v_canonical <> v_inv.email_canonical then
    if p_token_path then
      return jsonb_build_object('ok', false, 'code', 'email_mismatch');
    end if;
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  if v_inv.status = 'accepted' then
    if p_token_path then
      return jsonb_build_object('ok', false, 'code', 'already_accepted');
    end if;
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v_inv.status = 'revoked' then
    return jsonb_build_object('ok', false, 'code', 'revoked');
  end if;
  if v_inv.expires_at <= now() then
    return jsonb_build_object('ok', false, 'code', 'expired');
  end if;

  select * into v_member
  from public.company_memberships m
  where m.user_id = v_uid
  for update;
  if found then
    if v_member.removed_at is not null or v_member.company_id <> v_inv.company_id then
      return jsonb_build_object('ok', false, 'code', 'membership_conflict');
    end if;
    select c.name into v_label from public.companies c where c.id = v_member.company_id;
    return jsonb_build_object(
      'ok', true,
      'outcome', 'already_member',
      'company_label', v_label,
      'role', v_member.role,
      'company_id', v_member.company_id
    );
  end if;

  v_tier := private.invitation_delegate_tier_v1(v_inv.company_id, v_inv.issued_by);
  if v_tier is null then
    return jsonb_build_object('ok', false, 'code', 'reauthorization_required');
  end if;

  select m.access_revision into v_rev
  from public.company_memberships m
  where m.user_id = v_inv.issued_by
    and m.company_id = v_inv.company_id
    and m.removed_at is null;
  if v_rev is distinct from v_inv.access_revision_at_issue then
    return jsonb_build_object('ok', false, 'code', 'reauthorization_required');
  end if;

  select max(rp.version) into v_max
  from public.access_role_profiles rp
  where rp.role_key = v_inv.role;
  if v_max is distinct from v_inv.role_profile_version then
    return jsonb_build_object('ok', false, 'code', 'reauthorization_required');
  end if;

  v_err := private.invitation_validate_proposal_v1(
    v_inv.company_id, v_tier, v_inv.role, v_inv.packages, v_inv.job_ids, v_inv.role_profile_version
  );
  if v_err is not null then
    return jsonb_build_object('ok', false, 'code', 'reauthorization_required');
  end if;

  insert into public.company_memberships (user_id, company_id, role, role_profile_version)
  values (v_uid, v_inv.company_id, v_inv.role, v_inv.role_profile_version);

  insert into public.company_member_access_rules (
    company_id, user_id, effect, package_key, scope_kind, authority_source, created_by, access_revision
  )
  select v_inv.company_id, v_uid, 'grant', p.package_key, p.scope_kind,
         v_inv.authority_source, v_inv.issued_by, 1
  from public.access_packages p
  where p.package_key = any (v_inv.packages);

  insert into public.job_access_grants (company_id, job_id, user_id, granted_by, source)
  select v_inv.company_id, j, v_uid, v_inv.issued_by, 'invitation'
  from unnest(v_inv.job_ids) j;

  update public.company_invitations
  set status = 'accepted',
      accepted_by_user_id = v_uid,
      accepted_at = now()
  where id = v_inv.id
    and status = 'pending'
    and generation = v_inv.generation;
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'invitation_accept_lost_generation' using errcode = '40001';
  end if;

  v_request := coalesce(p_request_id, v_inv.id::text);
  perform private.record_access_event_v1(
    v_inv.company_id, v_uid, 'invitation_accepted', v_inv.authority_source,
    null, v_inv.generation, v_inv.generation, null,
    jsonb_build_object(
      'invitation_id', v_inv.id,
      'email_canonical', v_inv.email_canonical,
      'role', v_inv.role,
      'role_profile_version', v_inv.role_profile_version,
      'packages', to_jsonb(v_inv.packages),
      'job_ids', to_jsonb(v_inv.job_ids),
      'generation', v_inv.generation
    ),
    v_request, 'accept'
  );

  select c.name into v_label from public.companies c where c.id = v_inv.company_id;
  return jsonb_build_object(
    'ok', true,
    'outcome', 'accepted',
    'company_label', v_label,
    'role', v_inv.role,
    'company_id', v_inv.company_id,
    'invitation_id', v_inv.id
  );
end;
$$;

create or replace function public.accept_company_invitation_v1(
  p_token_hash text,
  p_request_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_hash bytea;
  v_id uuid;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;
  v_hash := private.invitation_token_hash_v1(p_token_hash);
  if v_hash is null then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  select i.id into v_id
  from public.company_invitations i
  where i.token_hash = v_hash;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  return private.accept_company_invitation_core_v1(v_id, true, v_hash, p_request_id);
end;
$$;

create or replace function public.accept_my_company_invitation_v1(
  p_invitation_id uuid,
  p_request_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;
  return private.accept_company_invitation_core_v1(p_invitation_id, false, null, p_request_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Preview. Never writes. Token possession reveals the safe invitation context.
-- An invitation id reveals that context only to the verified recipient.
-- ---------------------------------------------------------------------------
create or replace function private.invitation_preview_v1(
  p_invitation_id uuid,
  p_token_path boolean
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_inv public.company_invitations%rowtype;
  v_email text;
  v_confirmed timestamptz;
  v_canonical text;
  v_state text;
  v_match boolean := false;
  v_self boolean := false;
  v_reveal boolean := false;
  v_label text;
  v_inviter text;
begin
  if p_invitation_id is null then
    return jsonb_build_object('ok', true, 'state', 'not_found');
  end if;

  select * into v_inv
  from public.company_invitations i
  where i.id = p_invitation_id;
  if not found then
    return jsonb_build_object('ok', true, 'state', 'not_found');
  end if;

  if v_uid is not null then
    select u.email, u.email_confirmed_at into v_email, v_confirmed
    from auth.users u
    where u.id = v_uid;
    v_canonical := lower(btrim(coalesce(v_email, '')));
    v_match := v_confirmed is not null and v_canonical = v_inv.email_canonical;
    v_self := v_inv.status = 'accepted' and v_inv.accepted_by_user_id = v_uid;
  end if;

  if not p_token_path and not v_match and not v_self then
    return jsonb_build_object('ok', true, 'state', 'not_found');
  end if;

  v_state := case
    when v_inv.status = 'revoked' then 'revoked'
    when v_inv.status = 'accepted' then 'accepted'
    when v_inv.expires_at <= now() then 'expired'
    else 'pending'
  end;

  v_reveal := p_token_path or v_match or v_self;
  if v_state = 'accepted' and not v_self then
    v_reveal := false;
  end if;

  if v_reveal then
    select c.name into v_label from public.companies c where c.id = v_inv.company_id;
    select nullif(btrim(p.full_name), '') into v_inviter
    from public.profiles p
    where p.id = v_inv.issued_by;
  end if;

  return jsonb_build_object(
    'ok', true,
    'state', v_state,
    'company_label', case when v_reveal then v_label else null end,
    'role', case when v_reveal then v_inv.role else null end,
    'expires_at', case when v_reveal then v_inv.expires_at else null end,
    'inviter_display_name', case when v_reveal then v_inviter else null end,
    'recipient_email', case when v_reveal and v_state <> 'accepted' then v_inv.email_canonical else null end,
    'has_additional_access', v_reveal and cardinality(v_inv.packages) > 0,
    'package_keys', case
      when v_match and v_state = 'pending' then to_jsonb(v_inv.packages)
      else '[]'::jsonb
    end,
    'accepted_by_self', v_self
  );
end;
$$;

create or replace function public.preview_company_invitation_v1(p_token_hash text)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_hash bytea;
  v_id uuid;
begin
  v_hash := private.invitation_token_hash_v1(p_token_hash);
  if v_hash is null then
    return jsonb_build_object('ok', true, 'state', 'not_found');
  end if;
  select i.id into v_id
  from public.company_invitations i
  where i.token_hash = v_hash;
  if not found then
    return jsonb_build_object('ok', true, 'state', 'not_found');
  end if;
  return private.invitation_preview_v1(v_id, true);
end;
$$;

create or replace function public.preview_my_company_invitation_v1(p_invitation_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', true, 'state', 'not_found');
  end if;
  return private.invitation_preview_v1(p_invitation_id, false);
end;
$$;

-- ---------------------------------------------------------------------------
-- Delivery record. After the invitation transaction commits. Not authority.
-- ---------------------------------------------------------------------------
create or replace function public.record_company_invitation_delivery_v1(
  p_invitation_id uuid,
  p_generation integer,
  p_kind text,
  p_idempotency_key text,
  p_status text,
  p_error_class text,
  p_provider_message_id text
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
  v_inv public.company_invitations%rowtype;
  v_existing_status text;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;
  v_company := private.current_active_company_id();
  v_tier := private.invitation_delegate_tier_v1(v_company, v_uid);
  if v_tier is null then
    return jsonb_build_object('ok', false, 'code', 'capability_denied');
  end if;
  if p_kind is null or p_kind not in ('issue', 'resend')
     or p_status is null or p_status not in ('sent', 'failed')
     or p_generation is null or p_generation < 1
     or p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9._:-]{8,120}$' then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;
  if p_status = 'sent' and p_error_class is not null then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;
  if p_status = 'failed' and (p_error_class is null or p_error_class !~ '^[a-z_]{1,40}$') then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;
  if p_provider_message_id is not null and (
    char_length(p_provider_message_id) > 200 or p_provider_message_id ~ '[[:cntrl:]]'
  ) then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  select * into v_inv
  from public.company_invitations i
  where i.id = p_invitation_id
    and i.company_id = v_company;
  if not found or p_generation > v_inv.generation then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  select d.status into v_existing_status
  from public.company_invitation_delivery_attempts d
  where d.invitation_id = p_invitation_id
    and d.idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object('ok', true, 'outcome', 'existing', 'status', v_existing_status);
  end if;

  insert into public.company_invitation_delivery_attempts (
    invitation_id, company_id, generation, kind, idempotency_key, status, error_class, provider_message_id
  ) values (
    p_invitation_id, v_company, p_generation, p_kind, p_idempotency_key, p_status,
    case when p_status = 'failed' then p_error_class else null end,
    case when p_status = 'sent' then p_provider_message_id else null end
  );

  return jsonb_build_object('ok', true, 'outcome', 'recorded', 'status', p_status);
exception
  when unique_violation then
    select d.status into v_existing_status
    from public.company_invitation_delivery_attempts d
    where d.invitation_id = p_invitation_id
      and d.idempotency_key = p_idempotency_key;
    return jsonb_build_object('ok', true, 'outcome', 'existing', 'status', v_existing_status);
end;
$$;

revoke all on function private.invitation_token_hash_v1(text) from public, anon, authenticated;
revoke all on function private.invitation_fingerprint_v1(text, text[], uuid[]) from public, anon, authenticated;
revoke all on function private.invitation_delegate_tier_v1(uuid, uuid) from public, anon, authenticated;
revoke all on function private.invitation_validate_proposal_v1(uuid, text, text, text[], uuid[], integer) from public, anon, authenticated;
revoke all on function private.invitation_existing_result_v1(public.company_invitations) from public, anon, authenticated;
revoke all on function private.accept_company_invitation_core_v1(uuid, boolean, bytea, text) from public, anon, authenticated;
revoke all on function private.invitation_preview_v1(uuid, boolean) from public, anon, authenticated;

revoke all on function public.issue_company_invitation_v1(text, text, text[], uuid[], text, text) from public, anon, authenticated;
revoke all on function public.resend_company_invitation_v1(uuid, text, integer, text) from public, anon, authenticated;
revoke all on function public.revoke_company_invitation_v1(uuid) from public, anon, authenticated;
revoke all on function public.accept_company_invitation_v1(text, text) from public, anon, authenticated;
revoke all on function public.accept_my_company_invitation_v1(uuid, text) from public, anon, authenticated;
revoke all on function public.preview_company_invitation_v1(text) from public, anon, authenticated;
revoke all on function public.preview_my_company_invitation_v1(uuid) from public, anon, authenticated;
revoke all on function public.record_company_invitation_delivery_v1(uuid, integer, text, text, text, text, text) from public, anon, authenticated;

grant execute on function public.issue_company_invitation_v1(text, text, text[], uuid[], text, text) to authenticated, service_role;
grant execute on function public.resend_company_invitation_v1(uuid, text, integer, text) to authenticated, service_role;
grant execute on function public.revoke_company_invitation_v1(uuid) to authenticated, service_role;
grant execute on function public.accept_company_invitation_v1(text, text) to authenticated, service_role;
grant execute on function public.accept_my_company_invitation_v1(uuid, text) to authenticated, service_role;
grant execute on function public.preview_company_invitation_v1(text) to anon, authenticated, service_role;
grant execute on function public.preview_my_company_invitation_v1(uuid) to authenticated, service_role;
grant execute on function public.record_company_invitation_delivery_v1(uuid, integer, text, text, text, text, text) to authenticated, service_role;

comment on function public.issue_company_invitation_v1(text, text, text[], uuid[], text, text) is
  'Issues one pending invitation for the actor''s active company. Does not create membership and does not send email. Same idempotency key and payload returns the original row without rotating.';

comment on function public.resend_company_invitation_v1(uuid, text, integer, text) is
  'Rotates the invitation token once per idempotency key. Preserves role, packages, and job ids. Re-stamps issuer revision and the current profile version after revalidation.';

comment on function public.revoke_company_invitation_v1(uuid) is
  'Revokes a pending invitation. Idempotent. Does not change memberships. Keeps the token hash so the link can show revoked.';

comment on function public.accept_company_invitation_v1(text, text) is
  'Authenticated verified acceptance by token hash. Calls private.lock_user_membership before reading or writing membership. Does not accept on read.';

comment on function public.preview_company_invitation_v1(text) is
  'Safe invitation context for a token hash. Never writes and never accepts.';
