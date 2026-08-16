-- Stage C4 — durable token categories + transactional email-send supersession.
--
-- REVIEW ONLY — DO NOT APPLY WITHOUT EXPLICIT APPROVAL.
--
-- Scope:
--   1. Add nullable token_category to proposal_public_access_tokens.
--   2. Backfill only the three exact known metadata_json.source values.
--   3. Make token_category immutable after the backfill.
--   4. Add a category/status lookup index.
--   5. Add a service-role-only transactional email-send mint + supersede RPC.
--   6. Keep the generic mint RPC backward compatible during Phase A rollout:
--      known QA/send-prep sources are categorized ordinary inserts; the existing
--      email-send source routes through the transactional C4 RPC; unknown sources
--      remain permitted with token_category null.
--
-- Explicitly unchanged:
--   - proposal_versions rows and version_kind
--   - proposals.status and jobs.stage
--   - persist_proposal_send_freeze_v1 and latest_sent_version_id ownership
--   - public resolve behavior (superseded remains a customer-safe no-content state)
--   - RLS and table grants
--
-- Legacy cutover limitation:
--   A 2026-08-15 read-only live audit found four active contractor_email_send
--   tokens for one proposal across four historical sent versions; none belonged
--   to the current latest_sent_version_id. This migration does not manufacture a
--   current token, delete/revoke those rows, or fabricate superseded_by_token_id.
--   The first successful combined email-send mint for the authoritative latest
--   sent version supersedes all active older-version email-send tokens atomically.
--
-- Same-version resend:
--   Multiple active contractor_email_send tokens may coexist when they bind to
--   the same immutable latest sent version. Supersession means stale VERSION
--   access, not merely older token issuance.
--
-- Rollback:
--   Before C4 is used, restore the prior generic mint/row guard, drop the combined
--   RPC, index, CHECK, and column. After C4 has superseded rows, do not reactivate
--   historical tokens automatically; prefer a forward fix and preserve valid
--   superseded access truth.

begin;

-- ---------------------------------------------------------------------------
-- 1. Durable category column + constrained current vocabulary
-- ---------------------------------------------------------------------------

alter table public.proposal_public_access_tokens
  add column if not exists token_category text null;

alter table public.proposal_public_access_tokens
  drop constraint if exists proposal_public_access_tokens_token_category_check;

alter table public.proposal_public_access_tokens
  add constraint proposal_public_access_tokens_token_category_check
  check (
    token_category is null
    or token_category in (
      'contractor_preview_qa',
      'contractor_send_prep',
      'contractor_email_send'
    )
  )
  not valid;

alter table public.proposal_public_access_tokens
  validate constraint proposal_public_access_tokens_token_category_check;

comment on column public.proposal_public_access_tokens.token_category is
  'Stage C4 durable access category. Current values: contractor_preview_qa, '
  'contractor_send_prep, contractor_email_send. Null is legacy compatibility '
  'for historical rows whose metadata source cannot be classified safely.';

-- ---------------------------------------------------------------------------
-- 2. Exact known-source backfill (unknown/missing sources intentionally stay null)
-- ---------------------------------------------------------------------------

update public.proposal_public_access_tokens
set token_category = metadata_json->>'source'
where token_category is null
  and metadata_json->>'source' in (
    'contractor_preview_qa',
    'contractor_send_prep',
    'contractor_email_send'
  );

-- ---------------------------------------------------------------------------
-- 3. Preserve binding immutability and add token_category immutability
--    (installed after the backfill so migration-owned classification is allowed)
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
      or new.token_category is distinct from old.token_category
      or new.created_by is distinct from old.created_by
      or new.created_at is distinct from old.created_at
      or new.expires_at is distinct from old.expires_at
    then
      raise exception
        'proposal_public_access_tokens binding, category, and expiry fields are immutable after insert';
    end if;
  end if;

  return new;
end;
$$;

create index if not exists idx_proposal_public_access_tokens_category_status
  on public.proposal_public_access_tokens (
    company_id,
    proposal_id,
    token_category,
    status
  );

-- ---------------------------------------------------------------------------
-- 4. Transactional email-send mint + older-version supersession
-- ---------------------------------------------------------------------------

create or replace function public.mint_and_supersede_proposal_public_access_token_v1(
  p_token_hash text,
  p_token_prefix text,
  p_company_id uuid,
  p_proposal_id uuid,
  p_proposal_version_id uuid,
  p_expires_at timestamptz,
  p_recipient_email_hash text default null,
  p_recipient_phone_hash text default null,
  p_metadata_json jsonb default '{}'::jsonb,
  p_created_by uuid default null,
  p_purpose text default 'customer_view'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
  v_prefix text;
  v_email_hash text;
  v_phone_hash text;
  v_metadata jsonb;
  v_proposal record;
  v_version record;
  v_inserted record;
  v_superseded_count integer := 0;
begin
  v_hash := trim(coalesce(p_token_hash, ''));
  if length(v_hash) <> 64 or v_hash !~ '^[0-9a-f]+$' then
    return jsonb_build_object('ok', false, 'code', 'invalid_hash');
  end if;

  v_prefix := trim(coalesce(p_token_prefix, ''));
  if length(v_prefix) < 6 or length(v_prefix) > 16 then
    return jsonb_build_object('ok', false, 'code', 'invalid_prefix');
  end if;

  if p_company_id is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_company_id');
  end if;

  if p_proposal_id is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_proposal_id');
  end if;

  if p_proposal_version_id is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_proposal_version_id');
  end if;

  if p_expires_at is null or p_expires_at <= now() then
    return jsonb_build_object('ok', false, 'code', 'invalid_expires_at');
  end if;

  if coalesce(trim(p_purpose), '') <> 'customer_view' then
    return jsonb_build_object('ok', false, 'code', 'invalid_purpose');
  end if;

  v_email_hash := nullif(trim(coalesce(p_recipient_email_hash, '')), '');
  if v_email_hash is not null
    and (length(v_email_hash) <> 64 or v_email_hash !~ '^[0-9a-f]+$')
  then
    return jsonb_build_object('ok', false, 'code', 'invalid_recipient_hash');
  end if;

  v_phone_hash := nullif(trim(coalesce(p_recipient_phone_hash, '')), '');
  if v_phone_hash is not null
    and (length(v_phone_hash) <> 64 or v_phone_hash !~ '^[0-9a-f]+$')
  then
    return jsonb_build_object('ok', false, 'code', 'invalid_recipient_hash');
  end if;

  v_metadata := coalesce(p_metadata_json, '{}'::jsonb);
  if jsonb_typeof(v_metadata) <> 'object' then
    return jsonb_build_object('ok', false, 'code', 'invalid_metadata');
  end if;

  if public.proposal_forbidden_token_json_keys(v_metadata) then
    return jsonb_build_object('ok', false, 'code', 'forbidden_metadata_keys');
  end if;

  -- C4 owns the durable email-send category and canonical provenance source.
  -- A contradictory caller-supplied known source cannot survive persistence.
  v_metadata := jsonb_set(
    v_metadata,
    '{source}',
    to_jsonb('contractor_email_send'::text),
    true
  );

  -- This is the shared serialization point with persist_proposal_send_freeze_v1.
  -- It makes the latest sent pointer check authoritative after lock acquisition.
  select
    p.id,
    p.company_id,
    p.latest_sent_version_id
  into v_proposal
  from public.proposals p
  where p.id = p_proposal_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'proposal_not_found');
  end if;

  if v_proposal.company_id is distinct from p_company_id then
    return jsonb_build_object('ok', false, 'code', 'binding_mismatch');
  end if;

  if v_proposal.latest_sent_version_id is null then
    return jsonb_build_object('ok', false, 'code', 'latest_sent_version_missing');
  end if;

  if v_proposal.latest_sent_version_id is distinct from p_proposal_version_id then
    return jsonb_build_object('ok', false, 'code', 'not_latest_sent_version');
  end if;

  select
    pv.id,
    pv.company_id,
    pv.proposal_id,
    pv.version_kind,
    pv.frozen_at
  into v_version
  from public.proposal_versions pv
  where pv.id = p_proposal_version_id;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'version_not_found');
  end if;

  if v_version.company_id is distinct from p_company_id
    or v_version.proposal_id is distinct from p_proposal_id
  then
    return jsonb_build_object('ok', false, 'code', 'binding_mismatch');
  end if;

  if v_version.version_kind <> 'sent' then
    return jsonb_build_object('ok', false, 'code', 'invalid_version_kind');
  end if;

  if v_version.frozen_at is null then
    return jsonb_build_object('ok', false, 'code', 'sent_version_not_frozen');
  end if;

  begin
    insert into public.proposal_public_access_tokens (
      company_id,
      proposal_id,
      proposal_version_id,
      token_hash,
      token_prefix,
      purpose,
      token_category,
      status,
      expires_at,
      recipient_email_hash,
      recipient_phone_hash,
      created_by,
      metadata_json
    ) values (
      p_company_id,
      p_proposal_id,
      p_proposal_version_id,
      v_hash,
      v_prefix,
      'customer_view',
      'contractor_email_send',
      'active',
      p_expires_at,
      v_email_hash,
      v_phone_hash,
      p_created_by,
      v_metadata
    )
    returning
      id,
      company_id,
      proposal_id,
      proposal_version_id,
      token_prefix,
      status,
      expires_at,
      created_at
    into v_inserted;
  exception
    when unique_violation then
      return jsonb_build_object('ok', false, 'code', 'duplicate_token_hash');
  end;

  update public.proposal_public_access_tokens
  set
    status = 'superseded',
    superseded_by_token_id = v_inserted.id
  where company_id = p_company_id
    and proposal_id = p_proposal_id
    and token_category = 'contractor_email_send'
    and status = 'active'
    and proposal_version_id <> p_proposal_version_id;

  get diagnostics v_superseded_count = row_count;

  return jsonb_build_object(
    'ok', true,
    'token_id', v_inserted.id,
    'company_id', v_inserted.company_id,
    'proposal_id', v_inserted.proposal_id,
    'proposal_version_id', v_inserted.proposal_version_id,
    'token_prefix', v_inserted.token_prefix,
    'status', v_inserted.status,
    'expires_at', v_inserted.expires_at,
    'created_at', v_inserted.created_at,
    'superseded_count', v_superseded_count
  );
end;
$$;

comment on function public.mint_and_supersede_proposal_public_access_token_v1(
  text, text, uuid, uuid, uuid, timestamptz, text, text, jsonb, uuid, text
) is
  'Stage C4 — Transactionally mint an email-send customer token for the current '
  'latest immutable sent version and supersede active email-send tokens bound to '
  'older versions only. Same-version tokens remain active. service_role only; '
  'never accepts or returns a raw token or returns token_hash.';

-- ---------------------------------------------------------------------------
-- 5. Phase-A generic mint compatibility
-- ---------------------------------------------------------------------------

create or replace function public.mint_proposal_public_access_token_v1(
  p_token_hash text,
  p_token_prefix text,
  p_company_id uuid,
  p_proposal_id uuid,
  p_proposal_version_id uuid,
  p_expires_at timestamptz,
  p_recipient_email_hash text default null,
  p_recipient_phone_hash text default null,
  p_metadata_json jsonb default '{}'::jsonb,
  p_created_by uuid default null,
  p_purpose text default 'customer_view'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
  v_prefix text;
  v_email_hash text;
  v_phone_hash text;
  v_metadata jsonb;
  v_source text;
  v_category text;
  v_version record;
  v_proposal record;
  v_inserted record;
begin
  v_metadata := coalesce(p_metadata_json, '{}'::jsonb);
  if jsonb_typeof(v_metadata) <> 'object' then
    return jsonb_build_object('ok', false, 'code', 'invalid_metadata');
  end if;

  if public.proposal_forbidden_token_json_keys(v_metadata) then
    return jsonb_build_object('ok', false, 'code', 'forbidden_metadata_keys');
  end if;

  v_source := nullif(trim(v_metadata->>'source'), '');

  -- Zero-downtime Phase A compatibility: currently deployed email-send callers
  -- still call the generic RPC. Route them into C4 transactionally until the app
  -- switches to the dedicated wrapper and a later 038 hardening migration rejects
  -- contractor_email_send through this generic entry point.
  if v_source = 'contractor_email_send' then
    return public.mint_and_supersede_proposal_public_access_token_v1(
      p_token_hash,
      p_token_prefix,
      p_company_id,
      p_proposal_id,
      p_proposal_version_id,
      p_expires_at,
      p_recipient_email_hash,
      p_recipient_phone_hash,
      v_metadata,
      p_created_by,
      p_purpose
    );
  end if;

  v_category := case v_source
    when 'contractor_preview_qa' then 'contractor_preview_qa'
    when 'contractor_send_prep' then 'contractor_send_prep'
    else null
  end;

  v_hash := trim(coalesce(p_token_hash, ''));
  if length(v_hash) <> 64 or v_hash !~ '^[0-9a-f]+$' then
    return jsonb_build_object('ok', false, 'code', 'invalid_hash');
  end if;

  v_prefix := trim(coalesce(p_token_prefix, ''));
  if length(v_prefix) < 6 or length(v_prefix) > 16 then
    return jsonb_build_object('ok', false, 'code', 'invalid_prefix');
  end if;

  if p_company_id is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_company_id');
  end if;

  if p_proposal_id is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_proposal_id');
  end if;

  if p_proposal_version_id is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_proposal_version_id');
  end if;

  if p_expires_at is null or p_expires_at <= now() then
    return jsonb_build_object('ok', false, 'code', 'invalid_expires_at');
  end if;

  if coalesce(trim(p_purpose), '') <> 'customer_view' then
    return jsonb_build_object('ok', false, 'code', 'invalid_purpose');
  end if;

  v_email_hash := nullif(trim(coalesce(p_recipient_email_hash, '')), '');
  if v_email_hash is not null
    and (length(v_email_hash) <> 64 or v_email_hash !~ '^[0-9a-f]+$')
  then
    return jsonb_build_object('ok', false, 'code', 'invalid_recipient_hash');
  end if;

  v_phone_hash := nullif(trim(coalesce(p_recipient_phone_hash, '')), '');
  if v_phone_hash is not null
    and (length(v_phone_hash) <> 64 or v_phone_hash !~ '^[0-9a-f]+$')
  then
    return jsonb_build_object('ok', false, 'code', 'invalid_recipient_hash');
  end if;

  select
    p.id,
    p.company_id
  into v_proposal
  from public.proposals p
  where p.id = p_proposal_id;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'proposal_not_found');
  end if;

  if v_proposal.company_id is distinct from p_company_id then
    return jsonb_build_object('ok', false, 'code', 'binding_mismatch');
  end if;

  select
    pv.id,
    pv.company_id,
    pv.proposal_id,
    pv.version_kind
  into v_version
  from public.proposal_versions pv
  where pv.id = p_proposal_version_id;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'version_not_found');
  end if;

  if v_version.version_kind not in ('sent', 'signed') then
    return jsonb_build_object('ok', false, 'code', 'invalid_version_kind');
  end if;

  if v_version.company_id is distinct from p_company_id
    or v_version.proposal_id is distinct from p_proposal_id
  then
    return jsonb_build_object('ok', false, 'code', 'binding_mismatch');
  end if;

  begin
    insert into public.proposal_public_access_tokens (
      company_id,
      proposal_id,
      proposal_version_id,
      token_hash,
      token_prefix,
      purpose,
      token_category,
      status,
      expires_at,
      recipient_email_hash,
      recipient_phone_hash,
      created_by,
      metadata_json
    ) values (
      p_company_id,
      p_proposal_id,
      p_proposal_version_id,
      v_hash,
      v_prefix,
      'customer_view',
      v_category,
      'active',
      p_expires_at,
      v_email_hash,
      v_phone_hash,
      p_created_by,
      v_metadata
    )
    returning
      id,
      company_id,
      proposal_id,
      proposal_version_id,
      token_prefix,
      status,
      expires_at,
      created_at
    into v_inserted;
  exception
    when unique_violation then
      return jsonb_build_object('ok', false, 'code', 'duplicate_token_hash');
  end;

  return jsonb_build_object(
    'ok', true,
    'token_id', v_inserted.id,
    'company_id', v_inserted.company_id,
    'proposal_id', v_inserted.proposal_id,
    'proposal_version_id', v_inserted.proposal_version_id,
    'token_prefix', v_inserted.token_prefix,
    'status', v_inserted.status,
    'expires_at', v_inserted.expires_at,
    'created_at', v_inserted.created_at
  );
end;
$$;

comment on function public.mint_proposal_public_access_token_v1(
  text, text, uuid, uuid, uuid, timestamptz, text, text, jsonb, uuid, text
) is
  'Stage C4 Phase A compatibility mint. Known QA/send-prep sources receive a '
  'durable token_category; email-send source routes to transactional C4 mint + '
  'older-version supersession; unknown legacy sources remain category null. '
  'service_role only; never accepts or returns a raw token or returns token_hash.';

-- ---------------------------------------------------------------------------
-- 6. SECURITY DEFINER permission hardening
-- ---------------------------------------------------------------------------

revoke all on function public.mint_and_supersede_proposal_public_access_token_v1(
  text, text, uuid, uuid, uuid, timestamptz, text, text, jsonb, uuid, text
) from public;

revoke all on function public.mint_and_supersede_proposal_public_access_token_v1(
  text, text, uuid, uuid, uuid, timestamptz, text, text, jsonb, uuid, text
) from anon;

revoke all on function public.mint_and_supersede_proposal_public_access_token_v1(
  text, text, uuid, uuid, uuid, timestamptz, text, text, jsonb, uuid, text
) from authenticated;

grant execute on function public.mint_and_supersede_proposal_public_access_token_v1(
  text, text, uuid, uuid, uuid, timestamptz, text, text, jsonb, uuid, text
) to service_role;

-- Reassert the existing generic mint permission contract after replacing its body.
revoke all on function public.mint_proposal_public_access_token_v1(
  text, text, uuid, uuid, uuid, timestamptz, text, text, jsonb, uuid, text
) from public;

revoke all on function public.mint_proposal_public_access_token_v1(
  text, text, uuid, uuid, uuid, timestamptz, text, text, jsonb, uuid, text
) from anon;

revoke all on function public.mint_proposal_public_access_token_v1(
  text, text, uuid, uuid, uuid, timestamptz, text, text, jsonb, uuid, text
) from authenticated;

grant execute on function public.mint_proposal_public_access_token_v1(
  text, text, uuid, uuid, uuid, timestamptz, text, text, jsonb, uuid, text
) to service_role;

commit;
