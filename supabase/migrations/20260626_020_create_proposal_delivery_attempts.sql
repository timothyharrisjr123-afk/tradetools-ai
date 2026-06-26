-- R18D3A — Proposal delivery attempt audit foundation (REVIEW ONLY — DO NOT APPLY WITHOUT EXPLICIT APPROVAL).
--
-- Durable record for contractor-initiated customer email delivery attempts.
-- Hash/redacted recipient only — no raw email, token, or token_hash.
-- No Send/Resend wiring, no proposals.status mutation, no proposal_events.sent.
--
-- NOT APPLIED: staged for manual review on configured Supabase project after explicit approval.
-- Requires 20260626_014 (+ 015) applied first (proposal_public_access_tokens).

-- ---------------------------------------------------------------------------
-- 1. public.proposal_delivery_attempts
-- ---------------------------------------------------------------------------

create table if not exists public.proposal_delivery_attempts (
  id uuid primary key default gen_random_uuid(),

  company_id uuid not null references public.companies(id) on delete cascade,
  proposal_id uuid not null,
  proposal_version_id uuid not null,
  proposal_public_access_token_id uuid null,

  channel text not null default 'email',
  provider text not null default 'resend',

  recipient_email_hash text not null,
  recipient_email_redacted text null,

  token_prefix text null,

  idempotency_key text not null,
  status text not null,

  subject_snapshot text not null,
  body_snapshot text not null,

  provider_message_id text null,
  error_code text null,
  error_message_safe text null,

  metadata_json jsonb not null default '{}'::jsonb,

  created_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  attempted_at timestamptz null,
  provider_accepted_at timestamptz null,
  failed_at timestamptz null,
  delivered_at timestamptz null,
  bounced_at timestamptz null,
  complained_at timestamptz null,

  constraint proposal_delivery_attempts_id_company_unique
    unique (id, company_id),

  constraint proposal_delivery_attempts_proposal_company_fkey
    foreign key (proposal_id, company_id)
    references public.proposals (id, company_id)
    on delete cascade,

  constraint proposal_delivery_attempts_version_company_fkey
    foreign key (proposal_version_id, company_id)
    references public.proposal_versions (id, company_id)
    on delete restrict,

  constraint proposal_delivery_attempts_token_company_fkey
    foreign key (proposal_public_access_token_id, company_id)
    references public.proposal_public_access_tokens (id, company_id)
    on delete set null,

  constraint proposal_delivery_attempts_channel_check
    check (channel in ('email')),

  constraint proposal_delivery_attempts_provider_check
    check (provider in ('resend')),

  constraint proposal_delivery_attempts_status_check
    check (status in (
      'prepared',
      'attempted',
      'provider_accepted',
      'failed',
      'delivered',
      'bounced',
      'complained'
    )),

  constraint proposal_delivery_attempts_recipient_hash_format_check
    check (length(recipient_email_hash) = 64 and recipient_email_hash ~ '^[0-9a-f]+$'),

  constraint proposal_delivery_attempts_token_prefix_length_check
    check (token_prefix is null or (length(token_prefix) >= 6 and length(token_prefix) <= 16)),

  constraint proposal_delivery_attempts_payload_object_check
    check (jsonb_typeof(metadata_json) = 'object')
);

create unique index if not exists idx_proposal_delivery_attempts_company_idempotency
  on public.proposal_delivery_attempts (company_id, idempotency_key);

create unique index if not exists idx_proposal_delivery_attempts_provider_message
  on public.proposal_delivery_attempts (provider, provider_message_id)
  where provider_message_id is not null;

create index if not exists idx_proposal_delivery_attempts_company_proposal_created
  on public.proposal_delivery_attempts (company_id, proposal_id, created_at desc);

create index if not exists idx_proposal_delivery_attempts_company_proposal_status
  on public.proposal_delivery_attempts (company_id, proposal_id, status);

create index if not exists idx_proposal_delivery_attempts_company_version
  on public.proposal_delivery_attempts (company_id, proposal_version_id);

create index if not exists idx_proposal_delivery_attempts_token_prefix
  on public.proposal_delivery_attempts (token_prefix)
  where token_prefix is not null;

comment on table public.proposal_delivery_attempts is
  'R18D3A — Audit trail for contractor-initiated customer email delivery attempts. '
  'Does not mutate proposals.status, proposal_events, or job board stage.';

comment on column public.proposal_delivery_attempts.recipient_email_hash is
  'SHA-256 hex of normalized recipient email. Raw email must never be stored.';

comment on column public.proposal_delivery_attempts.token_prefix is
  'Non-secret token prefix for support correlation. Never store raw token or token_hash.';

-- ---------------------------------------------------------------------------
-- 2. updated_at trigger
-- ---------------------------------------------------------------------------

drop trigger if exists proposal_delivery_attempts_set_updated_at
  on public.proposal_delivery_attempts;
create trigger proposal_delivery_attempts_set_updated_at
  before update on public.proposal_delivery_attempts
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. Forbidden metadata keys guard
-- ---------------------------------------------------------------------------

create or replace function public.proposal_delivery_attempt_forbidden_metadata_keys(p_json jsonb)
returns boolean
language sql
immutable
set search_path = public
as $$
  select
    coalesce(p_json ? 'raw_token', false)
    or coalesce(p_json ? 'rawToken', false)
    or coalesce(p_json ? 'token', false)
    or coalesce(p_json ? 'token_hash', false)
    or coalesce(p_json ? 'recipient_email', false)
    or coalesce(p_json ? 'raw_email', false)
    or coalesce(p_json ? 'email', false)
    or public.proposal_forbidden_token_json_keys(p_json);
$$;

-- ---------------------------------------------------------------------------
-- 4. Row guard — binding, immutability, status transitions
-- ---------------------------------------------------------------------------

create or replace function public.proposal_delivery_attempt_row_guard()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_version record;
  v_token record;
begin
  if public.proposal_delivery_attempt_forbidden_metadata_keys(new.metadata_json) then
    raise exception 'proposal_delivery_attempts.metadata_json must not contain secret or PII keys';
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
      'proposal_delivery_attempts must bind to sent/signed version (kind=%)',
      v_version.version_kind;
  end if;

  if new.proposal_public_access_token_id is not null then
    select
      ppt.company_id,
      ppt.proposal_id,
      ppt.proposal_version_id
    into v_token
    from public.proposal_public_access_tokens ppt
    where ppt.id = new.proposal_public_access_token_id;

    if not found then
      raise exception 'proposal_public_access_token_id % not found', new.proposal_public_access_token_id;
    end if;

    if v_token.company_id is distinct from new.company_id then
      raise exception 'proposal_public_access_token_id company_id mismatch';
    end if;

    if v_token.proposal_id is distinct from new.proposal_id then
      raise exception 'proposal_public_access_token_id proposal_id mismatch';
    end if;

    if v_token.proposal_version_id is distinct from new.proposal_version_id then
      raise exception 'proposal_public_access_token_id proposal_version_id mismatch';
    end if;
  end if;

  if tg_op = 'UPDATE' then
    if new.company_id is distinct from old.company_id
      or new.proposal_id is distinct from old.proposal_id
      or new.proposal_version_id is distinct from old.proposal_version_id
      or new.idempotency_key is distinct from old.idempotency_key
      or new.recipient_email_hash is distinct from old.recipient_email_hash
      or new.subject_snapshot is distinct from old.subject_snapshot
      or new.body_snapshot is distinct from old.body_snapshot
      or new.channel is distinct from old.channel
      or new.provider is distinct from old.provider
      or new.created_by is distinct from old.created_by
      or new.created_at is distinct from old.created_at
    then
      raise exception
        'proposal_delivery_attempts binding and snapshot fields are immutable after insert';
    end if;

    if new.status is distinct from old.status then
      if not (
        (old.status = 'prepared' and new.status = 'attempted')
        or (old.status = 'attempted' and new.status in ('provider_accepted', 'failed'))
        or (old.status = 'provider_accepted' and new.status in ('delivered', 'bounced', 'complained'))
      ) then
        raise exception
          'invalid proposal_delivery_attempts status transition from % to %',
          old.status,
          new.status;
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists proposal_delivery_attempts_row_guard
  on public.proposal_delivery_attempts;
create trigger proposal_delivery_attempts_row_guard
  before insert or update on public.proposal_delivery_attempts
  for each row
  execute function public.proposal_delivery_attempt_row_guard();

-- ---------------------------------------------------------------------------
-- 5. RLS — SELECT for company members only
-- ---------------------------------------------------------------------------

alter table public.proposal_delivery_attempts enable row level security;

drop policy if exists "proposal_delivery_attempts_select_company_scope"
  on public.proposal_delivery_attempts;
create policy "proposal_delivery_attempts_select_company_scope"
  on public.proposal_delivery_attempts
  for select
  to authenticated
  using (
    company_id in (
      select company_id
      from public.company_memberships
      where user_id = auth.uid()
    )
  );

-- Writes deferred to service_role server orchestrator (R18D3B+).
drop policy if exists "proposal_delivery_attempts_insert_company_scope"
  on public.proposal_delivery_attempts;
drop policy if exists "proposal_delivery_attempts_update_company_scope"
  on public.proposal_delivery_attempts;
drop policy if exists "proposal_delivery_attempts_delete_company_scope"
  on public.proposal_delivery_attempts;

-- ---------------------------------------------------------------------------
-- 6. Table grants — authenticated SELECT only
-- ---------------------------------------------------------------------------

revoke all on table public.proposal_delivery_attempts from public;
revoke all on table public.proposal_delivery_attempts from anon;
revoke all on table public.proposal_delivery_attempts from authenticated;

grant select on table public.proposal_delivery_attempts to authenticated;
