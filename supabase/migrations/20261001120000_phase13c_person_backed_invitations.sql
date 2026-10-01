-- Phase 13C identity coherence, slice 1: Person-backed FieldDive invitations.
--
-- A Person is the operational human; a login is optional. Every new invitation names
-- the Person it gives FieldDive access to:
--   * existing Person: issue_company_invitation_v2(p_person_id => ...)
--   * new human: issue_company_invitation_v2(p_person_name => ...) creates the Person
--     and the invitation in one transaction.
-- Acceptance verifies the invitation email as before, then links the accepting login to
-- THAT Person in the same transaction. If the Person cannot be linked safely, the
-- acceptance returns an error before anything is written, or raises and rolls back.
--
-- The Person association always comes from the explicit person_id. Nothing here links
-- by name, phone, or email ownership. person_id stays nullable only for invitations
-- issued before this migration; those keep their previous acceptance behaviour.
--
-- company_people.linked_user_id may go from NULL to a user only when an accepted
-- invitation for that Person and that user exists, the user is an active member, and the
-- Person is not archived. Re-pointing a link stays forbidden. No merge here.

-- ---------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------
alter table public.company_invitations
  add column person_id uuid;

alter table public.company_invitations
  add constraint company_invitations_person_fk
    foreign key (person_id, company_id) references public.company_people (id, company_id);

create unique index company_invitations_one_pending_person_uidx
  on public.company_invitations (person_id)
  where status = 'pending' and person_id is not null;

create index company_invitations_person_idx
  on public.company_invitations (company_id, person_id)
  where person_id is not null;

comment on column public.company_invitations.person_id is
  'The Person this invitation gives FieldDive access to. Required for every invitation issued by issue_company_invitation_v2; null only on invitations issued before Person-backed invitations.';

-- ---------------------------------------------------------------------------
-- Login link mutability
-- ---------------------------------------------------------------------------
create or replace function private.company_people_tenant_trg_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'UPDATE' then
    if new.company_id is distinct from old.company_id then
      raise exception 'company_people: company is immutable' using errcode = '23514';
    end if;
    if new.linked_user_id is distinct from old.linked_user_id and new.linked_user_id is not null then
      if old.linked_user_id is not null then
        raise exception 'company_people: login link is immutable' using errcode = '23514';
      end if;
      if new.archived_at is not null then
        raise exception 'company_people: an archived person cannot be linked' using errcode = '23514';
      end if;
      if not exists (
        select 1 from public.company_invitations i
        where i.person_id = new.id
          and i.company_id = new.company_id
          and i.status = 'accepted'
          and i.accepted_by_user_id = new.linked_user_id
      ) then
        raise exception 'company_people: linking a login requires an accepted invitation for this person'
          using errcode = '23514';
      end if;
    end if;
  end if;
  if new.linked_user_id is not null
     and (tg_op = 'INSERT' or new.linked_user_id is distinct from old.linked_user_id)
     and not exists (
       select 1 from public.company_memberships m
       where m.user_id = new.linked_user_id
         and m.company_id = new.company_id
         and m.removed_at is null
     ) then
    raise exception 'company_people: linked login is not an active member of this company' using errcode = '23514';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Issue v2. Company comes from the actor's active membership. Exactly one of
-- p_person_id (existing Person) or p_person_name (new Person) is required.
-- ---------------------------------------------------------------------------
create or replace function public.issue_company_invitation_v2(
  p_email text,
  p_role text,
  p_packages text[],
  p_job_ids uuid[],
  p_token_hash text,
  p_idempotency_key text,
  p_person_id uuid default null,
  p_person_name text default null
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
  v_name text := nullif(btrim(coalesce(p_person_name, '')), '');
  v_packages text[];
  v_jobs uuid[];
  v_version integer;
  v_rev bigint;
  v_fp text;
  v_hash bytea;
  v_err jsonb;
  v_existing public.company_invitations%rowtype;
  v_person public.company_people%rowtype;
  v_person_id uuid;
  v_person_created boolean := false;
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
  if (p_person_id is null) = (v_name is null) then
    return jsonb_build_object('ok', false, 'code', 'person_required');
  end if;
  if v_name is not null and (char_length(v_name) > 80 or lower(v_name) = 'team member') then
    return jsonb_build_object('ok', false, 'code', 'invalid_person_name');
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
  v_fp := private.invitation_fingerprint_v1(p_role, v_packages, v_jobs)
    || '|email:' || v_email
    || case when p_person_id is not null then '|person:' || p_person_id::text else '|new_person:' || v_name end;

  select * into v_existing
  from public.company_invitations i
  where i.company_id = v_company
    and i.idempotency_key = p_idempotency_key;
  if found then
    if v_existing.proposal_fingerprint is not distinct from v_fp then
      return private.invitation_existing_result_v1(v_existing)
        || jsonb_build_object('person_id', v_existing.person_id);
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

  if p_person_id is not null then
    select * into v_person
    from public.company_people p
    where p.id = p_person_id
      and p.company_id = v_company
    for update;
    if not found then
      return jsonb_build_object('ok', false, 'code', 'person_not_found');
    end if;
    if v_person.archived_at is not null then
      return jsonb_build_object('ok', false, 'code', 'person_unavailable');
    end if;
    if v_person.linked_user_id is not null then
      return jsonb_build_object('ok', false, 'code', 'person_already_linked');
    end if;
    select * into v_existing
    from public.company_invitations i
    where i.person_id = v_person.id
      and i.status = 'pending';
    if found then
      return jsonb_build_object(
        'ok', false,
        'code', 'invitation_pending',
        'invitation_id', v_existing.id
      );
    end if;
  end if;

  v_err := private.invitation_validate_proposal_v1(
    v_company, v_tier, p_role, v_packages, v_jobs, v_version
  );
  if v_err is not null then
    return v_err;
  end if;
  if private.sensitive_delegation_v1(p_role, null, v_packages)
     and not private.assurance_satisfied_v1() then
    return jsonb_build_object('ok', false, 'code', 'assurance_required');
  end if;

  select m.access_revision into v_rev
  from public.company_memberships m
  where m.user_id = v_uid
    and m.company_id = v_company
    and m.removed_at is null;

  if p_person_id is not null then
    v_person_id := v_person.id;
  else
    insert into public.company_people (company_id, display_name, created_by)
    values (v_company, v_name, v_uid)
    returning id into v_person_id;
    v_person_created := true;
  end if;

  insert into public.company_invitations (
    company_id, email_canonical, role, packages, job_ids, status, expires_at,
    generation, token_hash, issued_by, authority_source, access_revision_at_issue,
    idempotency_key, role_profile_version, proposal_fingerprint, person_id
  ) values (
    v_company, v_email, p_role, v_packages, v_jobs, 'pending', now() + interval '7 days',
    1, v_hash, v_uid, private.tier_authority_source_v1(v_tier), v_rev,
    p_idempotency_key, v_version, v_fp, v_person_id
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
      'generation', 1,
      'person_id', v_person_id,
      'person_created', v_person_created
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
    'packages', to_jsonb(v_packages),
    'person_id', v_person_id,
    'person_created', v_person_created
  );
exception
  when unique_violation then
    select * into v_existing
    from public.company_invitations i
    where i.company_id = v_company
      and i.idempotency_key = p_idempotency_key;
    if found and v_existing.proposal_fingerprint is not distinct from v_fp then
      return private.invitation_existing_result_v1(v_existing)
        || jsonb_build_object('person_id', v_existing.person_id);
    end if;
    if found then
      return jsonb_build_object('ok', false, 'code', 'idempotency_conflict');
    end if;
    return jsonb_build_object('ok', false, 'code', 'invitation_pending');
end;
$$;

-- ---------------------------------------------------------------------------
-- Accept. Same checks as before; a Person-backed invitation also links THAT Person
-- to the accepting user in the same transaction, or grants nothing.
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
  v_person public.company_people%rowtype;
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
    -- Replay is a no-op only while the invited Person is still this user's Person.
    if v_inv.person_id is not null and not exists (
      select 1 from public.company_people p
      where p.id = v_inv.person_id
        and p.company_id = v_inv.company_id
        and p.linked_user_id = v_uid
    ) then
      return jsonb_build_object('ok', false, 'code', 'person_conflict');
    end if;
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
      'company_id', v_member.company_id,
      'person_id', v_inv.person_id
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
    -- An existing member cannot take over a different Person through an invitation.
    if v_inv.person_id is not null and not exists (
      select 1 from public.company_people p
      where p.id = v_inv.person_id
        and p.company_id = v_inv.company_id
        and p.linked_user_id = v_uid
    ) then
      return jsonb_build_object('ok', false, 'code', 'person_conflict');
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

  -- Person checks run before any write, so a Person that cannot be linked grants nothing.
  if v_inv.person_id is not null then
    select * into v_person
    from public.company_people p
    where p.id = v_inv.person_id
      and p.company_id = v_inv.company_id
    for update;
    if not found or v_person.archived_at is not null then
      return jsonb_build_object('ok', false, 'code', 'person_unavailable');
    end if;
    if v_person.linked_user_id is not null and v_person.linked_user_id <> v_uid then
      return jsonb_build_object('ok', false, 'code', 'person_already_linked');
    end if;
    if exists (
      select 1 from public.company_people p
      where p.company_id = v_inv.company_id
        and p.linked_user_id = v_uid
        and p.id <> v_person.id
    ) then
      return jsonb_build_object('ok', false, 'code', 'person_conflict');
    end if;
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

  -- The accepted invitation row above is the proof company_people_tenant_trg_v1 requires.
  if v_inv.person_id is not null and v_person.linked_user_id is null then
    update public.company_people
    set linked_user_id = v_uid, updated_at = now(), row_version = row_version + 1
    where id = v_person.id
      and company_id = v_inv.company_id
      and linked_user_id is null;
    get diagnostics v_rows = row_count;
    if v_rows <> 1 then
      raise exception 'invitation_accept_person_link_lost' using errcode = '40001';
    end if;
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
      'generation', v_inv.generation,
      'person_id', v_inv.person_id
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
    'invitation_id', v_inv.id,
    'person_id', v_inv.person_id
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Archive: a pending invitation must be revoked explicitly first.
-- ---------------------------------------------------------------------------
create or replace function public.archive_company_person_v1(
  p_person_id uuid,
  p_expected_row_version bigint
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_company_id uuid;
  v_person public.company_people%rowtype;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;
  v_company_id := private.crew_manager_company_v1();
  if v_company_id is null then
    return jsonb_build_object('ok', false, 'code', 'capability_denied');
  end if;
  if p_person_id is null or p_expected_row_version is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  select * into v_person from public.company_people p
  where p.id = p_person_id and p.company_id = v_company_id
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v_person.archived_at is not null then
    return jsonb_build_object('ok', true, 'changed', false);
  end if;
  if v_person.row_version <> p_expected_row_version then
    return jsonb_build_object('ok', false, 'code', 'stale_revision', 'row_version', v_person.row_version);
  end if;
  if v_person.linked_user_id is not null and exists (
    select 1 from public.company_memberships m
    where m.user_id = v_person.linked_user_id and m.company_id = v_company_id and m.removed_at is null
  ) then
    return jsonb_build_object('ok', false, 'code', 'linked_login_active');
  end if;
  -- An active assignment cannot keep an archived Person as its current Assignment Lead.
  -- The user changes or clears the Lead, or ends the assignment, first. History is never rewritten.
  if exists (
    select 1 from public.job_crew_assignments a
    where a.company_id = v_company_id and a.assignment_lead_person_id = p_person_id and a.ended_at is null
  ) then
    return jsonb_build_object('ok', false, 'code', 'person_active_assignment_lead');
  end if;
  if exists (
    select 1 from public.company_invitations i
    where i.company_id = v_company_id and i.person_id = p_person_id and i.status = 'pending'
  ) then
    return jsonb_build_object('ok', false, 'code', 'invitation_pending');
  end if;

  update public.crew_members
  set removed_at = now(), removed_by = auth.uid()
  where company_id = v_company_id and person_id = p_person_id and removed_at is null;

  update public.crews
  set usual_lead_person_id = null, updated_at = now(), row_version = row_version + 1
  where company_id = v_company_id and usual_lead_person_id = p_person_id and archived_at is null;

  update public.company_people
  set archived_at = now(), archived_by = auth.uid(), updated_at = now(), row_version = row_version + 1
  where id = p_person_id;

  return jsonb_build_object('ok', true, 'changed', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Operational Person for an existing login without one (legacy members). Uses the
-- login's profile name; never stores a placeholder and never matches by name.
-- ---------------------------------------------------------------------------
create or replace function public.ensure_member_person_v1(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_company_id uuid;
  v_person public.company_people%rowtype;
  v_name text;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;
  v_company_id := private.crew_manager_company_v1();
  if v_company_id is null then
    return jsonb_build_object('ok', false, 'code', 'capability_denied');
  end if;
  if p_user_id is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  select nullif(btrim(pr.full_name), '') into v_name
  from public.company_memberships m
  left join public.profiles pr on pr.id = m.user_id
  where m.user_id = p_user_id and m.company_id = v_company_id and m.removed_at is null;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  select * into v_person from public.company_people p
  where p.company_id = v_company_id and p.linked_user_id = p_user_id
  for update;
  if found then
    if v_person.archived_at is not null then
      update public.company_people
      set archived_at = null, archived_by = null, updated_at = now(), row_version = row_version + 1
      where id = v_person.id;
      return jsonb_build_object('ok', true, 'changed', true, 'person_id', v_person.id);
    end if;
    return jsonb_build_object('ok', true, 'changed', false, 'person_id', v_person.id);
  end if;

  if v_name is null or lower(v_name) = 'team member' then
    return jsonb_build_object('ok', false, 'code', 'person_name_required');
  end if;

  insert into public.company_people (company_id, display_name, linked_user_id, created_by)
  values (v_company_id, left(v_name, 80), p_user_id, auth.uid())
  on conflict (company_id, linked_user_id) where linked_user_id is not null do nothing
  returning id into v_person.id;
  if v_person.id is null then
    select p.id into v_person.id from public.company_people p
    where p.company_id = v_company_id and p.linked_user_id = p_user_id;
    return jsonb_build_object('ok', true, 'changed', false, 'person_id', v_person.id);
  end if;
  return jsonb_build_object('ok', true, 'changed', true, 'person_id', v_person.id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Privileges. v1 issue is no longer an app path: new invitations must name a Person.
-- ---------------------------------------------------------------------------
revoke all on function private.company_people_tenant_trg_v1() from public;

revoke all on function public.issue_company_invitation_v1(text, text, text[], uuid[], text, text) from public, anon, authenticated;
grant execute on function public.issue_company_invitation_v1(text, text, text[], uuid[], text, text) to service_role;

revoke all on function public.issue_company_invitation_v2(text, text, text[], uuid[], text, text, uuid, text) from public, anon, authenticated;
grant execute on function public.issue_company_invitation_v2(text, text, text[], uuid[], text, text, uuid, text) to authenticated, service_role;

revoke all on function private.accept_company_invitation_core_v1(uuid, boolean, bytea, text) from public, anon, authenticated;

revoke all on function public.archive_company_person_v1(uuid, bigint) from public, anon, authenticated;
grant execute on function public.archive_company_person_v1(uuid, bigint) to authenticated, service_role;

revoke all on function public.ensure_member_person_v1(uuid) from public, anon, authenticated;
grant execute on function public.ensure_member_person_v1(uuid) to authenticated, service_role;

comment on function public.issue_company_invitation_v2(text, text, text[], uuid[], text, text, uuid, text) is
  'Issues a Person-backed FieldDive invitation. Exactly one of p_person_id (existing, unlinked, active Person in the caller''s company) or p_person_name (creates the Person in the same transaction). Same delegation, assurance, expiry, and audit rules as v1.';
