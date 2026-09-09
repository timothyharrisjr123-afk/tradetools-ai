-- R18C2A — Public proposal access tokens + customer activity tables (REVIEW ONLY — DO NOT APPLY WITHOUT EXPLICIT APPROVAL).
--
-- Hash-only customer access pointers bound to immutable sent/signed proposal_version_id.
-- Append-only customer view/activity log. No raw token storage. No public resolve RPC in this migration.
--
-- NOT APPLIED: staged for manual review on configured Supabase project after explicit approval.
-- No public route, token minting, Send/PDF/Sign/Payment, lifecycle status mutation, or legacy KV reuse.
-- R18C2B will add resolve/record RPCs. R18C3+ will add app-side mint wrappers and /p/[token] route.

-- ---------------------------------------------------------------------------
-- 1. public.proposal_public_access_tokens
-- ---------------------------------------------------------------------------

create table if not exists public.proposal_public_access_tokens (
  id uuid primary key default gen_random_uuid(),

  company_id uuid not null references public.companies(id) on delete cascade,
  proposal_id uuid not null,
  proposal_version_id uuid not null,

  token_hash text not null,
  token_prefix text not null,

  purpose text not null default 'customer_view',
  status text not null default 'active',

  expires_at timestamptz not null,
  revoked_at timestamptz null,
  revoked_reason text null,

  superseded_by_token_id uuid null,

  recipient_email_hash text null,
  recipient_phone_hash text null,

  created_by uuid null,
  created_at timestamptz not null default now(),
  last_viewed_at timestamptz null,

  metadata_json jsonb not null default '{}'::jsonb,

  constraint proposal_public_access_tokens_id_company_unique
    unique (id, company_id),

  constraint proposal_public_access_tokens_proposal_company_fkey
    foreign key (proposal_id, company_id)
    references public.proposals (id, company_id)
    on delete cascade,

  constraint proposal_public_access_tokens_version_company_fkey
    foreign key (proposal_version_id, company_id)
    references public.proposal_versions (id, company_id)
    on delete restrict,

  constraint proposal_public_access_tokens_superseded_by_company_fkey
    foreign key (superseded_by_token_id, company_id)
    references public.proposal_public_access_tokens (id, company_id)
    on delete set null,

  constraint proposal_public_access_tokens_purpose_check check (
    purpose in ('customer_view')
  ),

  constraint proposal_public_access_tokens_status_check check (
    status in ('active', 'revoked', 'superseded')
  ),

  constraint proposal_public_access_tokens_token_hash_format_check check (
    length(trim(token_hash)) = 64
    and token_hash ~ '^[0-9a-f]+$'
  ),

  constraint proposal_public_access_tokens_token_prefix_check check (
    length(trim(token_prefix)) between 6 and 16
  ),

  constraint proposal_public_access_tokens_expires_at_future_at_create check (
    expires_at > created_at
  ),

  constraint proposal_public_access_tokens_revoked_consistency_check check (
    (status = 'revoked' and revoked_at is not null)
    or (status <> 'revoked' and revoked_at is null)
  ),

  constraint proposal_public_access_tokens_superseded_consistency_check check (
    (
      status = 'superseded'
      and superseded_by_token_id is not null
    )
    or (
      status <> 'superseded'
      and superseded_by_token_id is null
    )
  ),

  constraint proposal_public_access_tokens_metadata_object_check check (
    jsonb_typeof(metadata_json) = 'object'
  ),

  constraint proposal_public_access_tokens_recipient_hash_format_check check (
    (
      recipient_email_hash is null
      or (
        length(recipient_email_hash) = 64
        and recipient_email_hash ~ '^[0-9a-f]+$'
      )
    )
    and (
      recipient_phone_hash is null
      or (
        length(recipient_phone_hash) = 64
        and recipient_phone_hash ~ '^[0-9a-f]+$'
      )
    )
  )
);

-- Global unique: /p/[token] resolve has no company_id in the URL path.
create unique index if not exists idx_proposal_public_access_tokens_token_hash
  on public.proposal_public_access_tokens (token_hash);

create index if not exists idx_proposal_public_access_tokens_company_proposal
  on public.proposal_public_access_tokens (company_id, proposal_id);

create index if not exists idx_proposal_public_access_tokens_company_version
  on public.proposal_public_access_tokens (company_id, proposal_version_id);

create index if not exists idx_proposal_public_access_tokens_company_status_expires
  on public.proposal_public_access_tokens (company_id, status, expires_at);

create index if not exists idx_proposal_public_access_tokens_prefix
  on public.proposal_public_access_tokens (token_prefix);

comment on table public.proposal_public_access_tokens is
  'R18C2A — Hash-only public customer access tokens bound to immutable sent/signed proposal_version_id. '
  'Raw token must never be stored. No anon table access; public resolve is server-side RPC only (R18C2B+).';

comment on column public.proposal_public_access_tokens.token_hash is
  'SHA-256 hex digest of high-entropy public token. Global lookup key. Never store raw token.';

comment on column public.proposal_public_access_tokens.token_prefix is
  'Non-secret prefix of raw token for support/log correlation (e.g. first 8 chars). Not sufficient for auth.';

comment on column public.proposal_public_access_tokens.proposal_version_id is
  'Immutable customer snapshot. Must be proposal_versions.version_kind sent or signed at insert time.';

comment on column public.proposal_public_access_tokens.superseded_by_token_id is
  'Revision chain pointer when status=superseded: replacement token for a newer sent version.';

-- ---------------------------------------------------------------------------
-- 2. public.proposal_customer_activity
-- ---------------------------------------------------------------------------

create table if not exists public.proposal_customer_activity (
  id uuid primary key default gen_random_uuid(),

  company_id uuid not null references public.companies(id) on delete cascade,
  proposal_id uuid not null,
  proposal_version_id uuid not null,
  token_id uuid not null,

  event_type text not null,
  occurred_at timestamptz not null default now(),

  ip_hash text null,
  user_agent text null,
  referrer_host text null,

  payload_json jsonb not null default '{}'::jsonb,

  constraint proposal_customer_activity_id_company_unique
    unique (id, company_id),

  constraint proposal_customer_activity_proposal_company_fkey
    foreign key (proposal_id, company_id)
    references public.proposals (id, company_id)
    on delete cascade,

  constraint proposal_customer_activity_version_company_fkey
    foreign key (proposal_version_id, company_id)
    references public.proposal_versions (id, company_id)
    on delete restrict,

  constraint proposal_customer_activity_token_company_fkey
    foreign key (token_id, company_id)
    references public.proposal_public_access_tokens (id, company_id)
    on delete cascade,

  constraint proposal_customer_activity_event_type_check check (
    event_type in ('first_view', 'view')
  ),

  constraint proposal_customer_activity_ip_hash_format_check check (
    ip_hash is null
    or (
      length(ip_hash) = 64
      and ip_hash ~ '^[0-9a-f]+$'
    )
  ),

  constraint proposal_customer_activity_referrer_host_check check (
    referrer_host is null
    or (
      length(trim(referrer_host)) > 0
      and referrer_host !~ '[?#]'
      and referrer_host !~ '^https?://'
    )
  ),

  constraint proposal_customer_activity_payload_object_check check (
    jsonb_typeof(payload_json) = 'object'
  )
);

create index if not exists idx_proposal_customer_activity_token_occurred
  on public.proposal_customer_activity (token_id, occurred_at desc);

create index if not exists idx_proposal_customer_activity_company_proposal_occurred
  on public.proposal_customer_activity (company_id, proposal_id, occurred_at desc);

create index if not exists idx_proposal_customer_activity_company_version_occurred
  on public.proposal_customer_activity (company_id, proposal_version_id, occurred_at desc);

comment on table public.proposal_customer_activity is
  'R18C2A — Append-only customer proposal view/activity log. No raw token or raw IP. '
  'Does not mutate proposals.status or proposal_events (lifecycle deferred R18E+).';

comment on column public.proposal_customer_activity.ip_hash is
  'SHA-256(server_salt || client_ip) or equivalent; raw IP must never be stored.';

comment on column public.proposal_customer_activity.referrer_host is
  'Parsed referrer hostname only; no path, query params, or full URL.';

-- ---------------------------------------------------------------------------
-- 3. Trigger guards — forbidden secret keys in jsonb payloads
-- ---------------------------------------------------------------------------

create or replace function public.proposal_forbidden_token_json_keys(p_json jsonb)
returns boolean
language sql
immutable
set search_path = public
as $$
  select
    coalesce(p_json ? 'raw_token', false)
    or coalesce(p_json ? 'token', false)
    or coalesce(p_json ? 'public_token', false)
    or coalesce(p_json ? 'token_secret', false);
$$;

-- ---------------------------------------------------------------------------
-- 4. Trigger guard — proposal_public_access_tokens row binding + immutability
-- ---------------------------------------------------------------------------

create or replace function public.proposal_public_access_token_row_guard()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_version record;
  v_superseder record;
begin
  if public.proposal_forbidden_token_json_keys(new.metadata_json) then
    raise exception 'proposal_public_access_tokens.metadata_json must not contain raw token keys';
  end if;

  select
    pv.company_id,
    pv.proposal_id,
    pv.version_kind
  into v_version
  from public.proposal_versions pv
  where pv.id = new.proposal_version_id;

  if not found then
    raise exception 'proposal_version_id % not found', new.proposal_version_id;
  end if;

  if v_version.company_id is distinct from new.company_id then
    raise exception 'proposal_version_id company_id mismatch';
  end if;

  if v_version.proposal_id is distinct from new.proposal_id then
    raise exception 'proposal_version_id proposal_id mismatch';
  end if;

  if v_version.version_kind not in ('sent', 'signed') then
    raise exception
      'proposal_public_access_tokens must bind to sent/signed version (kind=%)',
      v_version.version_kind;
  end if;

  if new.superseded_by_token_id is not null then
    if new.superseded_by_token_id = new.id then
      raise exception 'superseded_by_token_id must not reference the same token row';
    end if;

    select
      ppt.company_id,
      ppt.proposal_id
    into v_superseder
    from public.proposal_public_access_tokens ppt
    where ppt.id = new.superseded_by_token_id;

    if not found then
      raise exception 'superseded_by_token_id % not found', new.superseded_by_token_id;
    end if;

    if v_superseder.company_id is distinct from new.company_id then
      raise exception 'superseded_by_token_id company_id mismatch';
    end if;

    if v_superseder.proposal_id is distinct from new.proposal_id then
      raise exception 'superseded_by_token_id proposal_id mismatch';
    end if;
  end if;

  if tg_op = 'UPDATE' then
    if new.company_id is distinct from old.company_id
      or new.proposal_id is distinct from old.proposal_id
      or new.proposal_version_id is distinct from old.proposal_version_id
      or new.token_hash is distinct from old.token_hash
      or new.token_prefix is distinct from old.token_prefix
      or new.purpose is distinct from old.purpose
      or new.created_by is distinct from old.created_by
      or new.created_at is distinct from old.created_at
      or new.expires_at is distinct from old.expires_at
    then
      raise exception
        'proposal_public_access_tokens binding and expiry fields are immutable after insert';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists proposal_public_access_tokens_row_guard
  on public.proposal_public_access_tokens;
create trigger proposal_public_access_tokens_row_guard
  before insert or update on public.proposal_public_access_tokens
  for each row
  execute function public.proposal_public_access_token_row_guard();

-- ---------------------------------------------------------------------------
-- 5. Trigger guard — proposal_customer_activity append-only + token binding
-- ---------------------------------------------------------------------------

create or replace function public.proposal_customer_activity_row_guard()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_token record;
begin
  if tg_op <> 'INSERT' then
    raise exception 'proposal_customer_activity is append-only';
  end if;

  if public.proposal_forbidden_token_json_keys(new.payload_json) then
    raise exception 'proposal_customer_activity.payload_json must not contain raw token keys';
  end if;

  select
    ppt.company_id,
    ppt.proposal_id,
    ppt.proposal_version_id
  into v_token
  from public.proposal_public_access_tokens ppt
  where ppt.id = new.token_id;

  if not found then
    raise exception 'token_id % not found', new.token_id;
  end if;

  if v_token.company_id is distinct from new.company_id then
    raise exception 'token_id company_id mismatch';
  end if;

  if v_token.proposal_id is distinct from new.proposal_id then
    raise exception 'token_id proposal_id mismatch';
  end if;

  if v_token.proposal_version_id is distinct from new.proposal_version_id then
    raise exception 'token_id proposal_version_id mismatch';
  end if;

  return new;
end;
$$;

drop trigger if exists proposal_customer_activity_row_guard
  on public.proposal_customer_activity;
create trigger proposal_customer_activity_row_guard
  before insert or update or delete on public.proposal_customer_activity
  for each row
  execute function public.proposal_customer_activity_row_guard();

-- ---------------------------------------------------------------------------
-- 6. RLS — proposal_public_access_tokens (SELECT for company members only)
-- ---------------------------------------------------------------------------

alter table public.proposal_public_access_tokens enable row level security;

drop policy if exists "proposal_public_access_tokens_select_company_scope"
  on public.proposal_public_access_tokens;
create policy "proposal_public_access_tokens_select_company_scope"
  on public.proposal_public_access_tokens
  for select
  using (
    company_id in (
      select company_id
      from public.company_memberships
      where user_id = auth.uid()
    )
  );

-- Mint/revoke/supersede writes deferred to R18C2B/R18C3 SECURITY DEFINER RPCs (service_role).
drop policy if exists "proposal_public_access_tokens_insert_company_scope"
  on public.proposal_public_access_tokens;
drop policy if exists "proposal_public_access_tokens_update_company_scope"
  on public.proposal_public_access_tokens;
drop policy if exists "proposal_public_access_tokens_delete_company_scope"
  on public.proposal_public_access_tokens;

-- ---------------------------------------------------------------------------
-- 7. RLS — proposal_customer_activity (SELECT for company members only)
-- ---------------------------------------------------------------------------

alter table public.proposal_customer_activity enable row level security;

drop policy if exists "proposal_customer_activity_select_company_scope"
  on public.proposal_customer_activity;
create policy "proposal_customer_activity_select_company_scope"
  on public.proposal_customer_activity
  for select
  using (
    company_id in (
      select company_id
      from public.company_memberships
      where user_id = auth.uid()
    )
  );

-- Append-only: no authenticated INSERT/UPDATE/DELETE; R18C2B record RPC uses service_role.
drop policy if exists "proposal_customer_activity_insert_company_scope"
  on public.proposal_customer_activity;
drop policy if exists "proposal_customer_activity_update_company_scope"
  on public.proposal_customer_activity;
drop policy if exists "proposal_customer_activity_delete_company_scope"
  on public.proposal_customer_activity;

-- ---------------------------------------------------------------------------
-- 8. Table grants — no anon access; authenticated SELECT only
-- ---------------------------------------------------------------------------

revoke all on table public.proposal_public_access_tokens from anon;
revoke all on table public.proposal_customer_activity from anon;

grant select on table public.proposal_public_access_tokens to authenticated;
grant select on table public.proposal_customer_activity to authenticated;
