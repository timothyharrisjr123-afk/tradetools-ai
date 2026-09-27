-- Phase 13B-D — access resolver, creator admission, bootstrap v2.
--
-- Authentication is no longer company admission. Protected entry resolves a state;
-- only an explicit create-business call (bootstrap v2) may create a company, and only
-- for a user holding a live creator admission. Pending invitations are visible to the
-- resolver and block silent creation. Invitation issue/accept stays Phase E.
--
-- Shared lock (frozen key, blueprint §10.5). private.lock_user_membership(uid) takes
-- hashtextextended('fielddive.bootstrap_current_user_company_v1:' || uid, 0).
-- Phase E accept_company_invitation_v1 must call this function before it reads or
-- inserts a membership, so create and join cannot race into two memberships.
--
-- Precedence (a membership occupies the one-per-user slot, so it outranks invitations
-- and admission; a disabled member is not creator-eligible and cannot join elsewhere):
--   read failure is not a state (the caller maps it to authorization_unavailable)
--   active valid membership -> active
--   removed membership      -> disabled
--   invalid role/profile    -> invalid_role
--   verified-email pending  -> pending_invitation
--   live creator admission  -> creator_eligible
--   otherwise               -> no_access

-- ---------------------------------------------------------------------------
-- Shared per-user serialization
-- ---------------------------------------------------------------------------
create or replace function private.lock_user_membership(p_user_id uuid)
returns void
language plpgsql
set search_path = pg_catalog
as $$
begin
  if p_user_id is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(
    hashtextextended('fielddive.bootstrap_current_user_company_v1:' || p_user_id::text, 0)
  );
end;
$$;

comment on function private.lock_user_membership(uuid) is
  'Canonical per-user membership lock. Key text is frozen (0A bootstrap v1). Bootstrap v2 and Phase E invitation acceptance must both call this before reading or writing company_memberships for the user.';

revoke all on function private.lock_user_membership(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Creator admissions (controlled access). Not inferred from missing membership.
-- ---------------------------------------------------------------------------
create table public.company_creator_admissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null check (status in ('issued', 'consumed', 'revoked')),
  issued_at timestamptz not null default now(),
  expires_at timestamptz,
  consumed_at timestamptz,
  resulting_company_id uuid references public.companies (id) on delete set null,
  source text not null check (source in ('support', 'migration', 'system')),
  issued_by uuid references auth.users (id) on delete set null,
  reason text check (reason is null or char_length(reason) <= 500),
  request_id text check (request_id is null or char_length(request_id) <= 120),
  constraint company_creator_admissions_window_chk
    check (expires_at is null or expires_at > issued_at),
  constraint company_creator_admissions_consumed_chk
    check (
      (status = 'consumed' and consumed_at is not null and resulting_company_id is not null)
      or (status <> 'consumed' and consumed_at is null and resulting_company_id is null)
    )
);

create unique index company_creator_admissions_one_live_uidx
  on public.company_creator_admissions (user_id)
  where status = 'issued';

alter table public.company_creator_admissions enable row level security;
revoke all on table public.company_creator_admissions from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Invitation read model (Phase E owns issue/accept/resend/revoke).
-- The resolver reads pending rows; nothing here grants a membership.
-- ---------------------------------------------------------------------------
create table public.company_invitations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  email_canonical text not null check (
    email_canonical = lower(btrim(email_canonical))
    and char_length(email_canonical) between 3 and 320
    and position('@' in email_canonical) > 1
  ),
  role text not null check (role in ('admin', 'office_sales', 'production_lead', 'field_user')),
  packages text[] not null default '{}',
  job_ids uuid[] not null default '{}',
  status text not null check (status in ('pending', 'accepted', 'revoked')),
  expires_at timestamptz not null,
  generation integer not null default 1 check (generation >= 1),
  token_hash bytea not null,
  issued_by uuid references auth.users (id) on delete set null,
  issued_at timestamptz not null default now(),
  authority_source text not null check (
    authority_source in ('owner', 'admin_ceiling', 'production_ceiling', 'migration_preserve', 'system')
  ),
  access_revision_at_issue bigint,
  accepted_by_user_id uuid references auth.users (id) on delete set null,
  accepted_at timestamptz,
  revoked_by uuid references auth.users (id) on delete set null,
  revoked_at timestamptz,
  idempotency_key text check (idempotency_key is null or char_length(idempotency_key) <= 120),
  constraint company_invitations_window_chk check (expires_at > issued_at),
  constraint company_invitations_accepted_chk
    check ((status = 'accepted') = (accepted_at is not null)),
  constraint company_invitations_revoked_chk
    check ((status = 'revoked') = (revoked_at is not null))
);

create unique index company_invitations_one_pending_uidx
  on public.company_invitations (company_id, email_canonical)
  where status = 'pending';

create index company_invitations_email_pending_idx
  on public.company_invitations (email_canonical)
  where status = 'pending';

alter table public.company_invitations enable row level security;
revoke all on table public.company_invitations from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Resolver. auth.uid() only. No arguments. One state.
-- ---------------------------------------------------------------------------
create or replace function public.resolve_current_user_access_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_member public.company_memberships%rowtype;
  v_email text;
  v_confirmed timestamptz;
  v_canonical text;
  v_company_label text;
  v_invites jsonb;
  v_creator boolean;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;

  select * into v_member
  from public.company_memberships m
  where m.user_id = v_uid;

  if found then
    select c.name into v_company_label
    from public.companies c
    where c.id = v_member.company_id;

    if v_member.removed_at is not null then
      return jsonb_build_object(
        'ok', true, 'state', 'disabled',
        'company_label', v_company_label
      );
    end if;

    if not private.role_is_valid_v1(v_member.role)
       or not exists (
         select 1 from public.access_role_profiles p
         where p.role_key = v_member.role and p.version = v_member.role_profile_version
       ) then
      return jsonb_build_object(
        'ok', true, 'state', 'invalid_role',
        'company_label', v_company_label
      );
    end if;

    return jsonb_build_object(
      'ok', true, 'state', 'active',
      'company_id', v_member.company_id,
      'company_label', v_company_label,
      'role', v_member.role
    );
  end if;

  select u.email, u.email_confirmed_at into v_email, v_confirmed
  from auth.users u
  where u.id = v_uid;
  v_canonical := lower(btrim(coalesce(v_email, '')));

  if v_confirmed is not null and v_canonical <> '' then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', i.id,
      'company_label', c.name,
      'role', i.role,
      'expires_at', i.expires_at
    ) order by i.expires_at, i.id), '[]'::jsonb)
    into v_invites
    from public.company_invitations i
    join public.companies c on c.id = i.company_id
    where i.status = 'pending'
      and i.expires_at > now()
      and i.email_canonical = v_canonical;
  else
    v_invites := '[]'::jsonb;
  end if;

  v_creator := exists (
    select 1 from public.company_creator_admissions a
    where a.user_id = v_uid
      and a.status = 'issued'
      and (a.expires_at is null or a.expires_at > now())
  );

  if jsonb_array_length(v_invites) > 0 then
    return jsonb_build_object(
      'ok', true, 'state', 'pending_invitation',
      'invitations', v_invites,
      'creator_eligible', v_creator
    );
  end if;

  if v_creator then
    return jsonb_build_object('ok', true, 'state', 'creator_eligible');
  end if;

  return jsonb_build_object('ok', true, 'state', 'no_access');
end;
$$;

revoke all on function public.resolve_current_user_access_v1() from public, anon, authenticated;
grant execute on function public.resolve_current_user_access_v1() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Bootstrap v2. Explicit create intent. Admission consumed in the same transaction.
-- ---------------------------------------------------------------------------
create or replace function public.bootstrap_current_user_company_v2(
  p_intent text,
  p_company_name text default null,
  p_acknowledge_pending_invitations boolean default false
)
returns table (company_id uuid, status text)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_member public.company_memberships%rowtype;
  v_email text;
  v_confirmed timestamptz;
  v_canonical text;
  v_pending bigint := 0;
  v_admission_id uuid;
  v_name text;
  v_company_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if p_intent is distinct from 'create_business' then
    return query select null::uuid, 'invalid_intent'::text;
    return;
  end if;

  v_name := nullif(btrim(coalesce(p_company_name, '')), '');
  if v_name is null then
    v_name := 'My Company';
  elsif char_length(v_name) > 80 then
    return query select null::uuid, 'invalid_payload'::text;
    return;
  end if;

  perform private.lock_user_membership(v_uid);

  select * into v_member
  from public.company_memberships m
  where m.user_id = v_uid
  for update;

  if found then
    if v_member.removed_at is not null then
      return query select null::uuid, 'removed'::text;
      return;
    end if;
    if not private.role_is_valid_v1(v_member.role) then
      return query select null::uuid, 'invalid_role'::text;
      return;
    end if;
    return query select v_member.company_id, 'existing'::text;
    return;
  end if;

  select u.email, u.email_confirmed_at into v_email, v_confirmed
  from auth.users u
  where u.id = v_uid;
  v_canonical := lower(btrim(coalesce(v_email, '')));
  if v_confirmed is not null and v_canonical <> '' then
    select count(*) into v_pending
    from public.company_invitations i
    where i.status = 'pending'
      and i.expires_at > now()
      and i.email_canonical = v_canonical;
  end if;
  if v_pending > 0 and coalesce(p_acknowledge_pending_invitations, false) is not true then
    return query select null::uuid, 'pending_invitation'::text;
    return;
  end if;

  select a.id into v_admission_id
  from public.company_creator_admissions a
  where a.user_id = v_uid
    and a.status = 'issued'
    and (a.expires_at is null or a.expires_at > now())
  for update;
  if v_admission_id is null then
    return query select null::uuid, 'admission_required'::text;
    return;
  end if;

  insert into public.companies (name, owner_user_id)
  values (v_name, v_uid)
  returning id into v_company_id;

  insert into public.company_memberships (user_id, company_id, role)
  values (v_uid, v_company_id, 'owner');

  update public.company_creator_admissions
  set status = 'consumed',
      consumed_at = now(),
      resulting_company_id = v_company_id
  where id = v_admission_id;

  return query select v_company_id, 'created'::text;
end;
$$;

comment on function public.bootstrap_current_user_company_v2(text, text, boolean) is
  'Explicit create-business. Requires auth.uid(), intent create_business, the shared per-user lock, no membership, no unacknowledged pending invitation for the verified email, and a live creator admission consumed in the same transaction. Role is owner. Replay of an existing membership returns existing and does not consume another admission.';

revoke all on function public.bootstrap_current_user_company_v2(text, text, boolean) from public, anon, authenticated;
grant execute on function public.bootstrap_current_user_company_v2(text, text, boolean) to authenticated, service_role;

-- v1 no longer admits anyone. Callers moved to the resolver and to v2.
create or replace function public.bootstrap_current_user_company_v1()
returns table (company_id uuid, status text)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  raise exception 'bootstrap_v1_retired' using errcode = '42501';
end;
$$;

revoke all on function public.bootstrap_current_user_company_v1() from public, anon, authenticated;
