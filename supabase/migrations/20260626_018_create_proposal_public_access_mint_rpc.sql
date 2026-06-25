-- R18C3B — Public proposal access token mint RPC (REVIEW ONLY — DO NOT APPLY WITHOUT EXPLICIT APPROVAL).
--
-- Inserts hash-only token row bound to sent/signed proposal_version_id.
-- Accepts p_token_hash and p_token_prefix only — never raw token.
-- Returns narrow ID envelope — no token_hash, no raw token, no lifecycle mutation.
--
-- NOT APPLIED: staged for manual review on configured Supabase project after explicit approval.
-- Requires 20260626_014 (+ 015) applied first.
-- No public route, Send/PDF/Sign/Payment, proposal status/events mutation, or sent version mutation.

-- ---------------------------------------------------------------------------
-- Mint RPC — mint_proposal_public_access_token_v1
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
  v_version record;
  v_proposal record;
  v_inserted record;
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
  if v_email_hash is not null then
    if length(v_email_hash) <> 64 or v_email_hash !~ '^[0-9a-f]+$' then
      return jsonb_build_object('ok', false, 'code', 'invalid_recipient_hash');
    end if;
  end if;

  v_phone_hash := nullif(trim(coalesce(p_recipient_phone_hash, '')), '');
  if v_phone_hash is not null then
    if length(v_phone_hash) <> 64 or v_phone_hash !~ '^[0-9a-f]+$' then
      return jsonb_build_object('ok', false, 'code', 'invalid_recipient_hash');
    end if;
  end if;

  v_metadata := coalesce(p_metadata_json, '{}'::jsonb);
  if jsonb_typeof(v_metadata) <> 'object' then
    return jsonb_build_object('ok', false, 'code', 'invalid_metadata');
  end if;

  if public.proposal_forbidden_token_json_keys(v_metadata) then
    return jsonb_build_object('ok', false, 'code', 'forbidden_metadata_keys');
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
    or v_version.proposal_id is distinct from p_proposal_id then
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
  'R18C3B — Mint hash-only public access token bound to sent/signed proposal_version_id. '
  'service_role execute only. Never accepts or returns raw token or token_hash. '
  'Does not mutate proposals.status, proposal_events, or sent proposal versions.';

-- ---------------------------------------------------------------------------
-- Initial revokes (final service_role-only grant in 019)
-- ---------------------------------------------------------------------------

revoke all on function public.mint_proposal_public_access_token_v1(
  text, text, uuid, uuid, uuid, timestamptz, text, text, jsonb, uuid, text
) from public;

revoke all on function public.mint_proposal_public_access_token_v1(
  text, text, uuid, uuid, uuid, timestamptz, text, text, jsonb, uuid, text
) from anon;

revoke all on function public.mint_proposal_public_access_token_v1(
  text, text, uuid, uuid, uuid, timestamptz, text, text, jsonb, uuid, text
) from authenticated;
