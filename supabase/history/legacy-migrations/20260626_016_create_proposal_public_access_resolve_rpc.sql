-- R18C2B — Public proposal access token resolve + view record RPCs (REVIEW ONLY — DO NOT APPLY WITHOUT EXPLICIT APPROVAL).
--
-- Shared validator + resolve (read-only) + record view (activity append + last_viewed_at).
-- Returns ID bindings only — no graph rows, no token_hash, no lifecycle mutation.
--
-- NOT APPLIED: staged for manual review on configured Supabase project after explicit approval.
-- Requires 20260626_014_create_proposal_public_access_tables.sql (+ 015 grant hardening) applied first.
-- No public route, token minting, app wrappers, Send/PDF/Sign/Payment, or lifecycle enablement.
-- Public /p/[token] route (R18C4+) will call via Next.js server-side service_role only.

-- ---------------------------------------------------------------------------
-- 1. Shared validator — proposal_assert_public_access_token_active_v1
-- ---------------------------------------------------------------------------

create or replace function public.proposal_assert_public_access_token_active_v1(p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
  v_token record;
  v_version record;
begin
  v_hash := trim(coalesce(p_token_hash, ''));

  if length(v_hash) <> 64 or v_hash !~ '^[0-9a-f]+$' then
    return jsonb_build_object('ok', false, 'code', 'invalid_hash');
  end if;

  select
    t.id,
    t.company_id,
    t.proposal_id,
    t.proposal_version_id,
    t.purpose,
    t.status,
    t.expires_at
  into v_token
  from public.proposal_public_access_tokens t
  where t.token_hash = v_hash;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  if v_token.status = 'revoked' then
    return jsonb_build_object('ok', false, 'code', 'revoked');
  end if;

  if v_token.status = 'superseded' then
    return jsonb_build_object('ok', false, 'code', 'superseded');
  end if;

  if v_token.expires_at < now() then
    return jsonb_build_object('ok', false, 'code', 'expired');
  end if;

  select
    pv.company_id,
    pv.proposal_id,
    pv.version_kind
  into v_version
  from public.proposal_versions pv
  where pv.id = v_token.proposal_version_id;

  if not found or v_version.version_kind not in ('sent', 'signed') then
    return jsonb_build_object('ok', false, 'code', 'invalid_version');
  end if;

  if v_version.company_id is distinct from v_token.company_id
    or v_version.proposal_id is distinct from v_token.proposal_id then
    return jsonb_build_object('ok', false, 'code', 'invalid_binding');
  end if;

  return jsonb_build_object(
    'ok', true,
    'token_id', v_token.id,
    'company_id', v_token.company_id,
    'proposal_id', v_token.proposal_id,
    'proposal_version_id', v_token.proposal_version_id,
    'purpose', v_token.purpose,
    'status', v_token.status,
    'expires_at', v_token.expires_at
  );
end;
$$;

comment on function public.proposal_assert_public_access_token_active_v1(text) is
  'R18C2B internal — validates public access token hash and returns safe ID binding envelope only. '
  'Not for direct client execution. Never returns graph rows or token_hash.';

-- ---------------------------------------------------------------------------
-- 2. Resolve RPC — read-only / idempotent
-- ---------------------------------------------------------------------------

create or replace function public.resolve_proposal_public_access_token_v1(p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.proposal_assert_public_access_token_active_v1(p_token_hash);
end;
$$;

comment on function public.resolve_proposal_public_access_token_v1(text) is
  'R18C2B — Resolve hash-only public access token to company/proposal/version/token IDs. '
  'Read-only; no activity insert, last_viewed_at update, proposal status, or proposal_events.';

-- ---------------------------------------------------------------------------
-- 3. Record view RPC — activity append + last_viewed_at only
-- ---------------------------------------------------------------------------

create or replace function public.record_proposal_customer_view_v1(
  p_token_hash text,
  p_ip_hash text default null,
  p_user_agent text default null,
  p_referrer_host text default null,
  p_payload_json jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assert jsonb;
  v_token_id uuid;
  v_company_id uuid;
  v_proposal_id uuid;
  v_proposal_version_id uuid;
  v_event_type text;
  v_ip_hash text;
  v_referrer_host text;
  v_user_agent text;
  v_payload jsonb;
begin
  v_assert := public.proposal_assert_public_access_token_active_v1(p_token_hash);

  if coalesce((v_assert->>'ok')::boolean, false) is not true then
    return v_assert;
  end if;

  v_token_id := (v_assert->>'token_id')::uuid;
  v_company_id := (v_assert->>'company_id')::uuid;
  v_proposal_id := (v_assert->>'proposal_id')::uuid;
  v_proposal_version_id := (v_assert->>'proposal_version_id')::uuid;

  v_ip_hash := nullif(trim(coalesce(p_ip_hash, '')), '');
  if v_ip_hash is not null then
    if length(v_ip_hash) <> 64 or v_ip_hash !~ '^[0-9a-f]+$' then
      return jsonb_build_object('ok', false, 'code', 'invalid_ip_hash');
    end if;
  end if;

  v_referrer_host := nullif(trim(coalesce(p_referrer_host, '')), '');
  if v_referrer_host is not null then
    if length(v_referrer_host) = 0
      or v_referrer_host ~ '[?#]'
      or v_referrer_host ~ '^https?://' then
      return jsonb_build_object('ok', false, 'code', 'invalid_referrer_host');
    end if;
  end if;

  v_payload := coalesce(p_payload_json, '{}'::jsonb);
  if jsonb_typeof(v_payload) <> 'object' then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  if public.proposal_forbidden_token_json_keys(v_payload) then
    return jsonb_build_object('ok', false, 'code', 'forbidden_payload_keys');
  end if;

  v_user_agent := left(nullif(trim(coalesce(p_user_agent, '')), ''), 512);

  if exists (
    select 1
    from public.proposal_customer_activity a
    where a.token_id = v_token_id
      and a.event_type = 'first_view'
  ) then
    v_event_type := 'view';
  else
    v_event_type := 'first_view';
  end if;

  insert into public.proposal_customer_activity (
    company_id,
    proposal_id,
    proposal_version_id,
    token_id,
    event_type,
    ip_hash,
    user_agent,
    referrer_host,
    payload_json
  ) values (
    v_company_id,
    v_proposal_id,
    v_proposal_version_id,
    v_token_id,
    v_event_type,
    v_ip_hash,
    v_user_agent,
    v_referrer_host,
    v_payload
  );

  update public.proposal_public_access_tokens
  set last_viewed_at = now()
  where id = v_token_id;

  return jsonb_build_object(
    'ok', true,
    'event_type', v_event_type,
    'token_id', v_token_id,
    'proposal_id', v_proposal_id,
    'proposal_version_id', v_proposal_version_id
  );
end;
$$;

comment on function public.record_proposal_customer_view_v1(text, text, text, text, jsonb) is
  'R18C2B — Record customer view activity for a valid public access token. '
  'Appends proposal_customer_activity and updates last_viewed_at only. '
  'Does not mutate proposals.status or proposal_events. No raw token/IP/full referrer URL.';

-- ---------------------------------------------------------------------------
-- 4. Initial revokes (final service_role-only grants in 017)
-- ---------------------------------------------------------------------------

revoke all on function public.proposal_assert_public_access_token_active_v1(text) from public;
revoke all on function public.proposal_assert_public_access_token_active_v1(text) from anon;
revoke all on function public.proposal_assert_public_access_token_active_v1(text) from authenticated;

revoke all on function public.resolve_proposal_public_access_token_v1(text) from public;
revoke all on function public.resolve_proposal_public_access_token_v1(text) from anon;
revoke all on function public.resolve_proposal_public_access_token_v1(text) from authenticated;

revoke all on function public.record_proposal_customer_view_v1(text, text, text, text, jsonb) from public;
revoke all on function public.record_proposal_customer_view_v1(text, text, text, text, jsonb) from anon;
revoke all on function public.record_proposal_customer_view_v1(text, text, text, text, jsonb) from authenticated;
