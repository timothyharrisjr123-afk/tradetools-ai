-- FieldDive canonical pre-recovery baseline
-- Architecture: hybrid-canonical-baseline
-- Source: tmp/fielddive-db-audit/production-schema-pre-recovery.sql
-- Source SHA-256: B435863DC562C374E02315F3EB5C9A700BED63538850E90F6FA3FF57AA3EFE2A
-- Purpose: recreate application-facing production schema immediately BEFORE Stripe recovery
-- Excludes: row data, auth users, PII, secrets, migration ledger ops, Stripe recovery fields
-- DO NOT apply this baseline to production as a forward migration against live data without separate authorization
-- Local equivalence proof applies this migration only (not 20260909130935 recovery) via:
--   npx supabase db reset --local --version 20260909130000 --yes --no-seed

-- Ensure extension host schemas exist on clean local Supabase before extensions.
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE SCHEMA IF NOT EXISTS vault;

-- Local Supabase globals otherwise GRANT ALL on new public tables/functions to anon/authenticated
-- at CREATE time. Suspend those defaults for this baseline so the explicit production dump ACLs win.
-- The production dump restores ALTER DEFAULT PRIVILEGES at the end.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated, service_role;



SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."acknowledge_proposal_acceptance_attention_v1"("p_payload" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_company_id uuid;
  v_job_id uuid;
  v_acceptance_id uuid;
  v_member boolean := false;
  v_acceptance public.proposal_acceptances%rowtype;
  v_attention public.job_attention_items%rowtype;
  v_job public.jobs%rowtype;
  v_canonical text;
  v_now timestamptz := now();
  v_before_stage text;
  v_before_entered timestamptz;
  v_before_status text;
  v_before_confirmed timestamptz;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;

  begin
    v_company_id := nullif(p_payload->>'company_id', '')::uuid;
    v_job_id := nullif(p_payload->>'job_id', '')::uuid;
    v_acceptance_id := nullif(p_payload->>'acceptance_id', '')::uuid;
  exception when others then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end;

  if v_company_id is null or v_job_id is null or v_acceptance_id is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  select exists (
    select 1 from public.company_memberships cm
    where cm.company_id = v_company_id
      and cm.user_id = v_uid
  ) into v_member;

  if not v_member then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('proposal_acceptance_ack:' || v_acceptance_id::text, 0)
  );

  select a.*
  into v_acceptance
  from public.proposal_acceptances a
  where a.id = v_acceptance_id
    and a.company_id = v_company_id
    and a.job_id = v_job_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  select j.*
  into v_job
  from public.jobs j
  where j.id = v_job_id
    and j.company_id = v_company_id
    and j.deleted_at is null
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  v_before_stage := v_job.stage;
  v_before_entered := v_job.stage_entered_at;
  v_before_status := v_job.status;
  v_before_confirmed := v_acceptance.confirmed_at;

  v_canonical := public.canonical_job_stage_from_row(
    v_job.stage,
    v_job.status,
    coalesce(v_job.archived, false),
    v_job.active_proposal_id,
    v_job.latest_proposal_id
  );

  select ai.*
  into v_attention
  from public.job_attention_items ai
  where ai.company_id = v_company_id
    and ai.source_type = 'proposal_acceptances'
    and ai.source_id = v_acceptance.id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  if v_attention.job_id is distinct from v_job_id
    or v_attention.proposal_id is distinct from v_acceptance.proposal_id
  then
    return jsonb_build_object('ok', false, 'code', 'invalid_binding');
  end if;

  if v_attention.status = 'resolved' then
    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'acceptance_id', v_acceptance.id,
      'attention_id', v_attention.id,
      'resolution_reason', v_attention.resolution_reason,
      'confirmed_at', v_acceptance.confirmed_at,
      'job_stage', v_canonical,
      'stage_entered_at', v_job.stage_entered_at,
      'status_unchanged', v_job.status
    );
  end if;

  if v_job.status in ('lost', 'closed') then
    return jsonb_build_object('ok', false, 'code', 'disposition_blocks_approval');
  end if;

  if v_acceptance.confirmed_at is not null then
    return jsonb_build_object('ok', false, 'code', 'already_confirmed');
  end if;

  if v_canonical = 'proposal' then
    return jsonb_build_object('ok', false, 'code', 'approve_job_required');
  end if;

  if v_canonical not in ('approved', 'scheduled', 'production', 'complete') then
    return jsonb_build_object('ok', false, 'code', 'acknowledge_not_available');
  end if;

  update public.job_attention_items
  set
    status = 'resolved',
    resolved_at = v_now,
    resolved_by = v_uid,
    resolution_reason = 'later_acceptance_acknowledged'
  where id = v_attention.id
    and company_id = v_company_id
    and status in ('open', 'acknowledged')
  returning * into v_attention;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  if exists (
    select 1
    from public.proposal_acceptances a
    where a.id = v_acceptance.id
      and a.company_id = v_company_id
      and a.confirmed_at is distinct from v_before_confirmed
  ) or exists (
    select 1
    from public.jobs j
    where j.id = v_job_id
      and j.company_id = v_company_id
      and (
        j.stage is distinct from v_before_stage
        or j.stage_entered_at is distinct from v_before_entered
        or j.status is distinct from v_before_status
      )
  ) then
    raise exception 'acknowledge must not mutate acceptance confirmation or job stage';
  end if;

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'acceptance_id', v_acceptance.id,
    'attention_id', v_attention.id,
    'resolution_reason', 'later_acceptance_acknowledged',
    'resolved_at', v_attention.resolved_at,
    'resolved_by', v_attention.resolved_by,
    'confirmed_at', v_acceptance.confirmed_at,
    'job_stage', v_canonical,
    'stage_entered_at', v_job.stage_entered_at,
    'status_unchanged', v_job.status
  );
end;
$$;


ALTER FUNCTION "public"."acknowledge_proposal_acceptance_attention_v1"("p_payload" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."acknowledge_proposal_acceptance_attention_v1"("p_payload" "jsonb") IS 'R3C Acknowledge later historical acceptance after Job has progressed beyond Proposal (Approved, Scheduled, Production, or Complete). Resolves Attention only. Does not set confirmed_at, does not change jobs.stage, stage_entered_at, or disposition. Not a substitute for Approve job while Proposal. Lost/closed still blocked.';



CREATE OR REPLACE FUNCTION "public"."bind_job_payment_checkout_session_v1"("p_payload" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_company_id uuid;
  v_request_id uuid;
  v_session_id text;
  v_generation integer;
  v_expires timestamptz;
  v_account_id text;
  v_request public.job_payment_requests%rowtype;
begin
  begin
    v_company_id := nullif(p_payload->>'company_id', '')::uuid;
    v_request_id := nullif(p_payload->>'payment_request_id', '')::uuid;
    v_session_id := nullif(trim(p_payload->>'provider_checkout_session_id'), '');
    v_generation := coalesce(nullif(p_payload->>'checkout_generation', '')::integer, 0);
    v_expires := nullif(p_payload->>'expires_at', '')::timestamptz;
    v_account_id := nullif(trim(p_payload->>'provider_account_id'), '');
  exception when others then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end;

  if v_company_id is null or v_request_id is null or v_session_id is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  select r.*
  into v_request
  from public.job_payment_requests r
  where r.id = v_request_id
    and r.company_id = v_company_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  if v_request.status = 'paid' then
    return jsonb_build_object('ok', false, 'code', 'already_paid');
  end if;

  if v_request.status in ('cancelled', 'expired') then
    return jsonb_build_object('ok', false, 'code', 'not_payable');
  end if;

  if v_account_id is not null
    and v_account_id is distinct from v_request.provider_account_id
  then
    return jsonb_build_object('ok', false, 'code', 'account_mismatch');
  end if;

  if v_request.provider_checkout_session_id is not null
    and v_request.provider_checkout_session_id = v_session_id
  then
    return jsonb_build_object(
      'ok', true,
      'id', v_request.id,
      'provider_checkout_session_id', v_request.provider_checkout_session_id,
      'checkout_generation', v_request.checkout_generation,
      'idempotent_replay', true
    );
  end if;

  if v_request.provider_checkout_session_id is not null
    and v_generation < v_request.checkout_generation
  then
    return jsonb_build_object(
      'ok', true,
      'id', v_request.id,
      'provider_checkout_session_id', v_request.provider_checkout_session_id,
      'checkout_generation', v_request.checkout_generation,
      'idempotent_replay', true
    );
  end if;

  update public.job_payment_requests
  set
    provider_checkout_session_id = v_session_id,
    checkout_generation = greatest(checkout_generation, v_generation),
    expires_at = coalesce(v_expires, expires_at)
  where id = v_request.id
  returning * into v_request;

  return jsonb_build_object(
    'ok', true,
    'id', v_request.id,
    'provider_checkout_session_id', v_request.provider_checkout_session_id,
    'checkout_generation', v_request.checkout_generation,
    'idempotent_replay', false
  );
end;
$$;


ALTER FUNCTION "public"."bind_job_payment_checkout_session_v1"("p_payload" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cancel_job_payment_request_v1"("p_payload" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_company_id uuid;
  v_request_id uuid;
  v_request public.job_payment_requests%rowtype;
  v_before_stage text;
  v_before_entered timestamptz;
  v_after_stage text;
  v_after_entered timestamptz;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;

  begin
    v_company_id := nullif(p_payload->>'company_id', '')::uuid;
    v_request_id := nullif(p_payload->>'payment_request_id', '')::uuid;
  exception when others then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end;

  if v_company_id is null or v_request_id is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  if not exists (
    select 1 from public.company_memberships cm
    where cm.company_id = v_company_id and cm.user_id = v_uid
  ) then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;

  select r.*
  into v_request
  from public.job_payment_requests r
  where r.id = v_request_id
    and r.company_id = v_company_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  select s.job_stage, s.stage_entered_at
  into v_before_stage, v_before_entered
  from public.job_payment_snapshot_stage_v1(v_company_id, v_request.job_id) s;

  if v_request.status = 'paid' then
    return jsonb_build_object('ok', false, 'code', 'already_paid');
  end if;

  if v_request.status = 'processing' then
    return jsonb_build_object('ok', false, 'code', 'processing_not_cancellable');
  end if;

  if v_request.status in ('cancelled', 'expired') then
    return jsonb_build_object(
      'ok', true,
      'id', v_request.id,
      'status', v_request.status,
      'idempotent_replay', true,
      'job_stage_unchanged', true
    );
  end if;

  if v_request.status not in ('open', 'failed') then
    return jsonb_build_object('ok', false, 'code', 'invalid_status');
  end if;

  update public.job_payment_requests
  set
    status = 'cancelled',
    cancelled_at = now()
  where id = v_request.id
  returning * into v_request;

  select s.job_stage, s.stage_entered_at
  into v_after_stage, v_after_entered
  from public.job_payment_snapshot_stage_v1(v_company_id, v_request.job_id) s;

  if v_after_stage is distinct from v_before_stage
    or v_after_entered is distinct from v_before_entered
  then
    raise exception 'job payment cancel must not change job stage';
  end if;

  return jsonb_build_object(
    'ok', true,
    'id', v_request.id,
    'status', v_request.status,
    'cancelled_at', v_request.cancelled_at,
    'idempotent_replay', false,
    'job_stage', v_after_stage,
    'job_stage_unchanged', true
  );
end;
$$;


ALTER FUNCTION "public"."cancel_job_payment_request_v1"("p_payload" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."cancel_job_payment_request_v1"("p_payload" "jsonb") IS 'Contractor cancel. open → cancelled. failed may be cancelled for cleanup. processing is not cancellable (processing_not_cancellable). paid is immutable. cancelled/expired are idempotent. NEVER writes jobs.stage.';



CREATE OR REPLACE FUNCTION "public"."canonical_job_stage_from_row"("p_stage" "text", "p_status" "text", "p_archived" boolean, "p_active_proposal_id" "uuid", "p_latest_proposal_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
declare
  v_stage text := lower(coalesce(p_stage, ''));
  v_status text := lower(coalesce(p_status, ''));
begin
  -- Legacy archived stage: explicit resolution, never automatic Complete.
  if v_stage = 'archived' then
    if v_status = 'lost' then
      return 'proposal';
    end if;
    if v_status = 'won' then
      return 'approved';
    end if;
    if p_active_proposal_id is not null or p_latest_proposal_id is not null then
      return 'proposal';
    end if;
    return 'intake';
  end if;

  -- status=won + already later canonical stage → stage wins.
  if v_status = 'won' then
    if v_stage in ('approved', 'scheduled', 'production', 'complete') then
      return v_stage;
    end if;
    if v_stage in ('intake', 'measurement', 'estimating', 'proposal') then
      return 'approved';
    end if;
  end if;

  if v_stage in ('measurement', 'estimating') then
    return 'intake';
  end if;

  if v_stage in ('intake', 'proposal', 'approved', 'scheduled', 'production', 'complete') then
    return v_stage;
  end if;

  return 'intake';
end;
$$;


ALTER FUNCTION "public"."canonical_job_stage_from_row"("p_stage" "text", "p_status" "text", "p_archived" boolean, "p_active_proposal_id" "uuid", "p_latest_proposal_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."change_job_disposition_v1"("p_payload" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_company_id uuid;
  v_job_id uuid;
  v_to text;
  v_reason text;
  v_job public.jobs%rowtype;
  v_member boolean := false;
  v_now timestamptz := now();
  v_activity_id uuid;
  v_event_type text := 'disposition_changed';
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;

  begin
    v_company_id := nullif(p_payload->>'company_id', '')::uuid;
    v_job_id := nullif(p_payload->>'job_id', '')::uuid;
  exception when others then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end;

  v_to := lower(nullif(p_payload->>'to_status', ''));
  v_reason := nullif(p_payload->>'reason', '');

  if v_company_id is null or v_job_id is null or v_to is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  if v_to in ('won', 'archived') then
    return jsonb_build_object('ok', false, 'code', 'illegal_disposition_target');
  end if;

  if v_to not in ('active', 'on_hold', 'lost', 'closed') then
    return jsonb_build_object('ok', false, 'code', 'illegal_disposition_target');
  end if;

  select exists (
    select 1 from public.company_memberships cm
    where cm.company_id = v_company_id
      and cm.user_id = v_uid
  ) into v_member;

  if not v_member then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;

  select j.*
  into v_job
  from public.jobs j
  where j.id = v_job_id
    and j.company_id = v_company_id
    and j.deleted_at is null
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  if v_job.status = v_to then
    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'job_id', v_job.id,
      'from_status', v_job.status,
      'to_status', v_to,
      'stage_unchanged', v_job.stage,
      'stage_entered_at_unchanged', v_job.stage_entered_at
    );
  end if;

  perform set_config('job_lifecycle.allow_status_write', '1', true);

  update public.jobs
  set
    status = v_to,
    last_activity_at = v_now
  where id = v_job.id
    and company_id = v_company_id;

  if v_to = 'on_hold' then
    v_event_type := 'disposition_changed';
  elsif v_to = 'lost' then
    v_event_type := 'disposition_changed';
  elsif v_to = 'closed' then
    v_event_type := 'disposition_changed';
  elsif v_to = 'active' then
    v_event_type := 'disposition_changed';
  end if;

  v_activity_id := public.job_lifecycle_insert_activity(
    v_company_id,
    v_job_id,
    v_event_type,
    v_uid,
    jsonb_build_object(
      'from_status', v_job.status,
      'to_status', v_to,
      'reason', v_reason,
      'stage_unchanged', v_job.stage,
      'reopened', (v_to = 'active' and v_job.status is distinct from 'active')
    ),
    v_now
  );

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'job_id', v_job_id,
    'from_status', v_job.status,
    'to_status', v_to,
    'stage_unchanged', v_job.stage,
    'stage_entered_at_unchanged', v_job.stage_entered_at,
    'activity_id', v_activity_id
  );
end;
$$;


ALTER FUNCTION "public"."change_job_disposition_v1"("p_payload" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."change_job_disposition_v1"("p_payload" "jsonb") IS 'Sole application writer of operational jobs.status (active/on_hold/lost/closed). Preserves jobs.stage and stage_entered_at. won/archived are not legal targets.';



CREATE OR REPLACE FUNCTION "public"."classify_proposal_acceptance_guard_v1"("p_company_id" "uuid", "p_job_id" "uuid", "p_proposal_id" "uuid", "p_proposal_version_id" "uuid", "p_proposal_option_id" "uuid", "p_acceptance_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_job public.jobs%rowtype;
  v_proposal public.proposals%rowtype;
  v_version public.proposal_versions%rowtype;
  v_frozen record;
  v_canonical text;
  v_dirty boolean := false;
  v_conflict boolean := false;
begin
  select j.*
  into v_job
  from public.jobs j
  where j.id = p_job_id
    and j.company_id = p_company_id
    and j.deleted_at is null;

  if not found then
    return jsonb_build_object('ok', false, 'result', 'invalid', 'reason', 'job_mismatch');
  end if;

  select p.*
  into v_proposal
  from public.proposals p
  where p.id = p_proposal_id
    and p.company_id = p_company_id
    and p.job_id = p_job_id;

  if not found then
    return jsonb_build_object('ok', false, 'result', 'invalid', 'reason', 'job_mismatch');
  end if;

  select pv.*
  into v_version
  from public.proposal_versions pv
  where pv.id = p_proposal_version_id
    and pv.company_id = p_company_id
    and pv.proposal_id = p_proposal_id;

  if not found then
    return jsonb_build_object('ok', false, 'result', 'invalid', 'reason', 'invalid_binding');
  end if;

  if v_version.version_kind not in ('sent', 'signed') or v_version.frozen_at is null then
    return jsonb_build_object('ok', false, 'result', 'invalid', 'reason', 'version_not_frozen');
  end if;

  select *
  into v_frozen
  from public.proposal_acceptance_frozen_selected_option_v1(
    p_company_id,
    p_proposal_version_id
  );

  if v_frozen.option_id is null then
    return jsonb_build_object('ok', false, 'result', 'invalid', 'reason', 'option_not_on_version');
  end if;

  if v_frozen.option_id is distinct from p_proposal_option_id then
    return jsonb_build_object('ok', false, 'result', 'invalid', 'reason', 'option_not_selected_frozen');
  end if;

  v_canonical := public.canonical_job_stage_from_row(
    v_job.stage,
    v_job.status,
    coalesce(v_job.archived, false),
    v_job.active_proposal_id,
    v_job.latest_proposal_id
  );

  v_dirty := v_proposal.draft_content_changed_at > v_version.frozen_at;

  select exists (
    select 1
    from public.proposal_acceptances a
    where a.company_id = p_company_id
      and a.proposal_id = p_proposal_id
      and (p_acceptance_id is null or a.id <> p_acceptance_id)
      and (
        a.proposal_version_id is distinct from p_proposal_version_id
        or a.proposal_option_id is distinct from p_proposal_option_id
      )
  )
  into v_conflict;

  if v_job.status = 'lost' then
    return jsonb_build_object(
      'ok', true,
      'result', 'valid_review_required',
      'reason', 'lost'
    );
  end if;

  if v_job.status = 'closed' then
    return jsonb_build_object(
      'ok', true,
      'result', 'valid_review_required',
      'reason', 'closed'
    );
  end if;

  if v_canonical in ('approved', 'scheduled', 'production', 'complete') then
    return jsonb_build_object(
      'ok', true,
      'result', 'valid_review_required',
      'reason', 'job_already_approved'
    );
  end if;

  if v_job.status = 'on_hold' then
    return jsonb_build_object(
      'ok', true,
      'result', 'valid_review_required',
      'reason', 'on_hold'
    );
  end if;

  if v_canonical is distinct from 'proposal' then
    return jsonb_build_object(
      'ok', true,
      'result', 'valid_review_required',
      'reason', 'job_not_in_proposal'
    );
  end if;

  if v_proposal.latest_sent_version_id is distinct from p_proposal_version_id then
    return jsonb_build_object(
      'ok', true,
      'result', 'valid_review_required',
      'reason', 'older_sent_version'
    );
  end if;

  if v_dirty then
    return jsonb_build_object(
      'ok', true,
      'result', 'valid_review_required',
      'reason', 'dirty_revision'
    );
  end if;

  if v_job.active_proposal_id is distinct from p_proposal_id then
    return jsonb_build_object(
      'ok', true,
      'result', 'valid_review_required',
      'reason', 'proposal_lineage_conflict'
    );
  end if;

  if v_conflict then
    return jsonb_build_object(
      'ok', true,
      'result', 'valid_review_required',
      'reason', 'conflicting_acceptance'
    );
  end if;

  if v_job.status is distinct from 'active' then
    return jsonb_build_object(
      'ok', true,
      'result', 'valid_review_required',
      'reason', 'on_hold'
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'result', 'valid_clean',
    'reason', null
  );
end;
$$;


ALTER FUNCTION "public"."classify_proposal_acceptance_guard_v1"("p_company_id" "uuid", "p_job_id" "uuid", "p_proposal_id" "uuid", "p_proposal_version_id" "uuid", "p_proposal_option_id" "uuid", "p_acceptance_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."classify_proposal_acceptance_guard_v1"("p_company_id" "uuid", "p_job_id" "uuid", "p_proposal_id" "uuid", "p_proposal_version_id" "uuid", "p_proposal_option_id" "uuid", "p_acceptance_id" "uuid") IS 'R3C shared acceptance guard. valid_clean = latest frozen sent version, clean draft, active Proposal-stage job, matching frozen selected package, unambiguous. Dirty revision uses proposals.draft_content_changed_at > sent.frozen_at. valid_review_required = valid historical/contextual acceptance needing contractor context, including later acceptance after Approved/Scheduled/Production/Complete (reason job_already_approved). Neither result moves Job stage. Invalid is not recorded. Lost/closed are classified before later-stage so disposition remains visible.';



CREATE OR REPLACE FUNCTION "public"."collect_job_payment_v1"("p_payload" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_company_id uuid;
  v_job_id uuid;
  v_amount_mode text;
  v_percentage_bps integer;
  v_amount integer;
  v_kind text;
  v_job public.jobs%rowtype;
  v_acceptance public.proposal_acceptances%rowtype;
  v_account public.company_payment_accounts%rowtype;
  v_existing public.job_payment_requests%rowtype;
  v_request public.job_payment_requests%rowtype;
  v_before_stage text;
  v_before_entered timestamptz;
  v_after_stage text;
  v_after_entered timestamptz;
  v_collectible integer;
  v_contract_option_id uuid;
  v_contract_total integer;
  v_matched_signature uuid;
  v_attention_id uuid;
  v_option_label text;
  v_payload_has_bps boolean;
  v_payload_has_cents boolean;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;

  begin
    v_company_id := nullif(p_payload->>'company_id', '')::uuid;
    v_job_id := nullif(p_payload->>'job_id', '')::uuid;
    v_amount_mode := nullif(trim(p_payload->>'amount_mode'), '');
    v_payload_has_bps := (p_payload ? 'percentage_bps')
      and nullif(trim(p_payload->>'percentage_bps'), '') is not null;
    v_payload_has_cents := (p_payload ? 'amount_cents')
      and nullif(trim(p_payload->>'amount_cents'), '') is not null;
    if v_payload_has_bps then
      v_percentage_bps := (p_payload->>'percentage_bps')::integer;
    else
      v_percentage_bps := null;
    end if;
    if v_payload_has_cents then
      v_amount := (p_payload->>'amount_cents')::integer;
    else
      v_amount := null;
    end if;
  exception when others then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end;

  if v_company_id is null or v_job_id is null or v_amount_mode is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  if v_amount_mode not in ('remaining', 'percentage', 'fixed') then
    return jsonb_build_object('ok', false, 'code', 'invalid_amount_mode');
  end if;

  if p_payload ? 'kind' and nullif(trim(p_payload->>'kind'), '') is not null then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  if v_amount_mode = 'remaining' then
    if v_payload_has_bps or v_payload_has_cents then
      return jsonb_build_object('ok', false, 'code', 'invalid_payload');
    end if;
    v_percentage_bps := null;
    v_amount := null;
  elsif v_amount_mode = 'percentage' then
    if v_payload_has_cents then
      return jsonb_build_object('ok', false, 'code', 'invalid_payload');
    end if;
    if v_percentage_bps is null
      or v_percentage_bps < 1
      or v_percentage_bps > 10000
    then
      return jsonb_build_object('ok', false, 'code', 'invalid_percentage');
    end if;
    v_amount := null;
  elsif v_amount_mode = 'fixed' then
    if v_payload_has_bps then
      return jsonb_build_object('ok', false, 'code', 'invalid_payload');
    end if;
    v_percentage_bps := null;
    if v_amount is null then
      return jsonb_build_object('ok', false, 'code', 'invalid_amount');
    end if;
  end if;

  if not exists (
    select 1 from public.company_memberships cm
    where cm.company_id = v_company_id and cm.user_id = v_uid
  ) then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('job_payment_request:' || v_company_id::text || ':' || v_job_id::text, 0)
  );

  select j.*
  into v_job
  from public.jobs j
  where j.id = v_job_id
    and j.company_id = v_company_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  select s.job_stage, s.stage_entered_at
  into v_before_stage, v_before_entered
  from public.job_payment_snapshot_stage_v1(v_company_id, v_job_id) s;

  if coalesce(v_job.archived, false)
    or coalesce(v_job.status, 'active') <> 'active'
  then
    return jsonb_build_object('ok', false, 'code', 'job_not_active');
  end if;

  select a.*
  into v_acceptance
  from public.proposal_acceptances a
  where a.company_id = v_company_id
    and a.job_id = v_job_id
  order by a.accepted_at desc
  limit 1
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'no_acceptance');
  end if;

  select c.option_id, c.option_label
  into v_contract_option_id, v_option_label
  from public.proposal_acceptance_contract_option_v1(v_company_id, v_acceptance.id) c;

  v_contract_total := public.proposal_acceptance_contract_total_cents_v1(
    v_company_id,
    v_acceptance.id
  );

  if v_contract_option_id is null then
    v_contract_option_id := v_acceptance.proposal_option_id;
    v_option_label := v_acceptance.accepted_option_label;
  end if;

  v_option_label := left(trim(coalesce(v_option_label, v_acceptance.accepted_option_label)), 120);
  v_collectible := public.job_payment_collectible_cents_v1(v_company_id, v_job_id);

  select a.*
  into v_account
  from public.company_payment_accounts a
  where a.company_id = v_company_id
    and a.provider = 'stripe'
  for update;

  if not found or not v_account.charges_enabled then
    v_attention_id := public.job_payment_open_not_connected_attention_v1(
      v_company_id,
      v_job_id,
      v_acceptance.proposal_id,
      v_acceptance.proposal_version_id
    );
    return jsonb_build_object(
      'ok', false,
      'code', 'not_connected',
      'attention_id', v_attention_id
    );
  end if;

  if v_amount_mode = 'remaining' then
    v_amount := v_collectible;
  elsif v_amount_mode = 'percentage' then
    if v_contract_total is null or v_contract_total < 0 then
      return jsonb_build_object('ok', false, 'code', 'invalid_amount');
    end if;
    v_amount := ((v_contract_total::bigint * v_percentage_bps::bigint) / 10000)::integer;
  end if;

  if v_amount is null or v_amount < 100 then
    if v_amount_mode = 'remaining' then
      return jsonb_build_object('ok', false, 'code', 'nothing_due');
    end if;
    return jsonb_build_object('ok', false, 'code', 'invalid_amount');
  end if;

  if v_collectible is null or v_collectible < 100 then
    return jsonb_build_object('ok', false, 'code', 'nothing_due');
  end if;

  if v_amount > v_collectible then
    return jsonb_build_object('ok', false, 'code', 'amount_exceeds_collectible');
  end if;

  if v_before_stage is distinct from 'complete' then
    v_kind := 'progress';
  elsif v_amount = v_collectible then
    v_kind := 'balance';
  else
    v_kind := 'progress';
  end if;

  if v_kind = 'deposit' then
    return jsonb_build_object('ok', false, 'code', 'deposit_not_generic');
  end if;

  select r.*
  into v_existing
  from public.job_payment_requests r
  where r.company_id = v_company_id
    and r.job_id = v_job_id
    and r.status in ('open', 'processing')
  limit 1;

  if found then
    if v_existing.kind is not distinct from v_kind
      and v_existing.amount_cents is not distinct from v_amount
    then
      select s.job_stage, s.stage_entered_at
      into v_after_stage, v_after_entered
      from public.job_payment_snapshot_stage_v1(v_company_id, v_job_id) s;

      if v_after_stage is distinct from v_before_stage
        or v_after_entered is distinct from v_before_entered
      then
        raise exception 'job payment request must not change job stage';
      end if;

      return jsonb_build_object(
        'ok', true,
        'id', v_existing.id,
        'company_id', v_existing.company_id,
        'job_id', v_existing.job_id,
        'kind', v_existing.kind,
        'status', v_existing.status,
        'amount_cents', v_existing.amount_cents,
        'currency', v_existing.currency,
        'amount_mode', v_existing.amount_mode,
        'percentage_bps', v_existing.percentage_bps,
        'proposal_id', v_existing.proposal_id,
        'proposal_version_id', v_existing.proposal_version_id,
        'proposal_signature_id', v_existing.proposal_signature_id,
        'accepted_total_cents_snapshot', v_existing.accepted_total_cents_snapshot,
        'option_label_snapshot', v_existing.option_label_snapshot,
        'requested_at', v_existing.requested_at,
        'idempotent_replay', true,
        'job_stage', v_after_stage,
        'stage_entered_at', v_after_entered,
        'job_stage_unchanged', true
      );
    end if;

    return jsonb_build_object('ok', false, 'code', 'conflicting_request');
  end if;

  select s.id
  into v_matched_signature
  from public.proposal_signatures s
  where s.company_id = v_company_id
    and s.proposal_acceptance_id = v_acceptance.id
    and s.job_id = v_job_id
    and s.proposal_id = v_acceptance.proposal_id
    and s.proposal_version_id = v_acceptance.proposal_version_id
    and s.proposal_option_id = v_acceptance.proposal_option_id
    and s.signer_slot = 'customer_primary'
  limit 1;

  begin
    insert into public.job_payment_requests (
      company_id,
      job_id,
      proposal_id,
      proposal_version_id,
      proposal_option_id,
      proposal_acceptance_id,
      proposal_signature_id,
      amount_cents,
      currency,
      kind,
      amount_mode,
      percentage_bps,
      accepted_total_cents_snapshot,
      option_label_snapshot,
      provider,
      provider_account_id,
      status,
      created_by_user_id
    )
    values (
      v_company_id,
      v_job_id,
      v_acceptance.proposal_id,
      v_acceptance.proposal_version_id,
      v_contract_option_id,
      v_acceptance.id,
      v_matched_signature,
      v_amount,
      'usd',
      v_kind,
      v_amount_mode,
      v_percentage_bps,
      v_contract_total,
      v_option_label,
      'stripe',
      v_account.provider_account_id,
      'open',
      v_uid
    )
    returning * into v_request;
  exception
    when unique_violation then
      return jsonb_build_object('ok', false, 'code', 'conflicting_request');
  end;

  select s.job_stage, s.stage_entered_at
  into v_after_stage, v_after_entered
  from public.job_payment_snapshot_stage_v1(v_company_id, v_job_id) s;

  if v_after_stage is distinct from v_before_stage
    or v_after_entered is distinct from v_before_entered
  then
    raise exception 'job payment request must not change job stage';
  end if;

  return jsonb_build_object(
    'ok', true,
    'id', v_request.id,
    'company_id', v_request.company_id,
    'job_id', v_request.job_id,
    'proposal_id', v_request.proposal_id,
    'proposal_version_id', v_request.proposal_version_id,
    'proposal_option_id', v_request.proposal_option_id,
    'proposal_acceptance_id', v_request.proposal_acceptance_id,
    'proposal_signature_id', v_request.proposal_signature_id,
    'kind', v_request.kind,
    'status', v_request.status,
    'amount_cents', v_request.amount_cents,
    'currency', v_request.currency,
    'amount_mode', v_request.amount_mode,
    'percentage_bps', v_request.percentage_bps,
    'accepted_total_cents_snapshot', v_request.accepted_total_cents_snapshot,
    'option_label_snapshot', v_request.option_label_snapshot,
    'provider_account_id', v_request.provider_account_id,
    'requested_at', v_request.requested_at,
    'idempotent_replay', false,
    'job_stage', v_after_stage,
    'stage_entered_at', v_after_entered,
    'job_stage_unchanged', true
  );
end;
$$;


ALTER FUNCTION "public"."collect_job_payment_v1"("p_payload" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."collect_job_payment_v1"("p_payload" "jsonb") IS 'Contractor Collect writer. Caller supplies amount_mode (remaining|percentage|fixed); server derives amount and kind (progress|balance). Never deposit. Percentage is floor(original contract * bps / 10000), not remaining and not cumulative. Over collectible is amount_exceeds_collectible (no clamp). Complete + exact collectible → balance; otherwise progress. One open|processing per job. NEVER writes jobs.stage.';



CREATE OR REPLACE FUNCTION "public"."companies_timezone_guard"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  if new.timezone is not null then
    new.timezone := trim(new.timezone);
    if new.timezone = '' then
      new.timezone := null;
    elsif not public.job_schedule_is_iana_timezone(new.timezone) then
      raise exception 'companies.timezone must be a valid IANA timezone'
        using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."companies_timezone_guard"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."company_payment_accounts_row_guard"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  if tg_op = 'DELETE' then
    raise exception 'company_payment_accounts rows cannot be deleted';
  end if;
  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id
      or new.company_id is distinct from old.company_id
      or new.provider is distinct from old.provider
      or new.provider_account_id is distinct from old.provider_account_id
      or new.created_at is distinct from old.created_at
    then
      raise exception 'company_payment_accounts identity is immutable';
    end if;
    new.updated_at := now();
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."company_payment_accounts_row_guard"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."company_payment_settings_row_guard"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  if tg_op = 'DELETE' then
    raise exception 'company_payment_settings rows cannot be deleted';
  end if;
  if tg_op = 'UPDATE' then
    if new.company_id is distinct from old.company_id
      or new.created_at is distinct from old.created_at
    then
      raise exception 'company_payment_settings company_id is immutable';
    end if;
    new.updated_at := now();
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."company_payment_settings_row_guard"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."complete_job_work_v1"("p_payload" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_company_id uuid;
  v_job_id uuid;
  v_job public.jobs%rowtype;
  v_schedule public.job_schedules%rowtype;
  v_from text;
  v_planned_count integer := 0;
  v_now timestamptz := transaction_timestamp();
  v_activity_id uuid;
  v_stage_activity_id uuid;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;

  begin
    v_company_id := nullif(p_payload->>'company_id', '')::uuid;
    v_job_id := nullif(p_payload->>'job_id', '')::uuid;
  exception when others then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end;

  if v_company_id is null or v_job_id is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  if not exists (
    select 1
    from public.company_memberships cm
    where cm.company_id = v_company_id
      and cm.user_id = v_uid
  ) then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;

  select j.*
  into v_job
  from public.jobs j
  where j.id = v_job_id
    and j.company_id = v_company_id
    and j.deleted_at is null
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  v_from := public.canonical_job_stage_from_row(
    v_job.stage,
    v_job.status,
    coalesce(v_job.archived, false),
    v_job.active_proposal_id,
    v_job.latest_proposal_id
  );

  if v_from = 'complete' and (
    v_job.completed_at is null
    or v_job.production_started_at is null
    or v_job.completed_at < v_job.production_started_at
  ) then
    return jsonb_build_object(
      'ok', false,
      'code', 'complete_work_integrity_error',
      'from_stage', v_from,
      'to_stage', 'complete'
    );
  end if;

  if v_from <> 'production' and v_from <> 'complete' then
    return jsonb_build_object(
      'ok', false,
      'code', 'illegal_stage',
      'from_stage', v_from,
      'to_stage', 'complete'
    );
  end if;

  if v_from = 'production' and v_job.status <> 'active' then
    return jsonb_build_object(
      'ok', false,
      'code', 'disposition_blocks_complete',
      'from_stage', v_from,
      'to_stage', 'complete',
      'disposition', v_job.status
    );
  end if;

  if v_from = 'production' and v_job.production_started_at is null then
    return jsonb_build_object(
      'ok', false,
      'code', 'complete_work_integrity_error',
      'from_stage', v_from,
      'to_stage', 'complete'
    );
  end if;

  -- Exactly one canonical planned work schedule. status='scheduled' is planned
  -- historical truth after Production/Complete; jobs.stage owns writability.
  select count(*)::integer
  into v_planned_count
  from public.job_schedules s
  where s.company_id = v_company_id
    and s.job_id = v_job_id
    and s.kind = 'work'
    and s.status = 'scheduled';

  if v_planned_count <> 1 then
    return jsonb_build_object(
      'ok', false,
      'code', 'complete_work_schedule_integrity_error',
      'from_stage', v_from,
      'to_stage', 'complete',
      'planned_schedule_count', v_planned_count
    );
  end if;

  select s.*
  into v_schedule
  from public.job_schedules s
  where s.company_id = v_company_id
    and s.job_id = v_job_id
    and s.kind = 'work'
    and s.status = 'scheduled'
  for update;

  if v_from = 'complete' then
    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'job_id', v_job.id,
      'from_stage', v_from,
      'to_stage', 'complete',
      'completed_at', v_job.completed_at,
      'production_started_at', v_job.production_started_at,
      'stage_entered_at', v_job.stage_entered_at,
      'disposition_unchanged', v_job.status,
      'schedule', public.job_schedule_row_json(v_schedule),
      'activity_id', null,
      'stage_activity_id', null,
      'job', jsonb_build_object(
        'id', v_job.id,
        'company_id', v_job.company_id,
        'stage', 'complete',
        'status', v_job.status,
        'completed_at', v_job.completed_at,
        'production_started_at', v_job.production_started_at,
        'stage_entered_at', v_job.stage_entered_at
      )
    );
  end if;

  perform set_config('job_lifecycle.allow_stage_write', '1', true);
  perform set_config('job_lifecycle.allow_job_complete_write', '1', true);

  update public.jobs
  set
    stage = 'complete',
    completed_at = v_now,
    stage_entered_at = v_now,
    last_activity_at = v_now
  where id = v_job.id
    and company_id = v_company_id;

  v_activity_id := public.job_lifecycle_insert_activity(
    v_company_id,
    v_job_id,
    'job_work_completed',
    v_uid,
    jsonb_build_object(
      'completed_at', v_now,
      'production_started_at', v_job.production_started_at,
      'schedule_id', v_schedule.id,
      'planned_window', public.job_schedule_window_json(
        v_schedule.all_day,
        v_schedule.starts_on,
        v_schedule.ends_on,
        v_schedule.start_local_time,
        v_schedule.end_local_time,
        v_schedule.timezone,
        v_schedule.notes
      )
    ),
    v_now
  );

  v_stage_activity_id := public.job_lifecycle_insert_activity(
    v_company_id,
    v_job_id,
    'stage_changed',
    v_uid,
    jsonb_build_object(
      'from_stage', v_from,
      'to_stage', 'complete',
      'reason', 'work_completed',
      'schedule_id', v_schedule.id
    ),
    v_now
  );

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'job_id', v_job.id,
    'from_stage', v_from,
    'to_stage', 'complete',
    'completed_at', v_now,
    'production_started_at', v_job.production_started_at,
    'stage_entered_at', v_now,
    'disposition_unchanged', v_job.status,
    'schedule', public.job_schedule_row_json(v_schedule),
    'activity_id', v_activity_id,
    'stage_activity_id', v_stage_activity_id,
    'job', jsonb_build_object(
      'id', v_job.id,
      'company_id', v_job.company_id,
      'stage', 'complete',
      'status', v_job.status,
      'completed_at', v_now,
      'production_started_at', v_job.production_started_at,
      'stage_entered_at', v_now
    )
  );
end;
$$;


ALTER FUNCTION "public"."complete_job_work_v1"("p_payload" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."complete_job_work_v1"("p_payload" "jsonb") IS 'R3H sole Production -> Complete writer. Requires one canonical planned work schedule, stamps immutable completed_at and Complete stage_entered_at from one DB transaction time, preserves production_started_at/schedule/payment/signature/disposition, and is idempotent under Job locking.';



CREATE OR REPLACE FUNCTION "public"."confirm_proposal_acceptance_v1"("p_payload" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_company_id uuid;
  v_job_id uuid;
  v_acceptance_id uuid;
  v_member boolean := false;
  v_acceptance public.proposal_acceptances%rowtype;
  v_job public.jobs%rowtype;
  v_canonical text;
  v_now timestamptz := now();
  v_stage jsonb;
  v_attention_id uuid;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;

  begin
    v_company_id := nullif(p_payload->>'company_id', '')::uuid;
    v_job_id := nullif(p_payload->>'job_id', '')::uuid;
    v_acceptance_id := nullif(p_payload->>'acceptance_id', '')::uuid;
  exception when others then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end;

  if v_company_id is null or v_job_id is null or v_acceptance_id is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  select exists (
    select 1 from public.company_memberships cm
    where cm.company_id = v_company_id
      and cm.user_id = v_uid
  ) into v_member;

  if not v_member then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('proposal_acceptance_confirm:' || v_acceptance_id::text, 0)
  );

  select a.*
  into v_acceptance
  from public.proposal_acceptances a
  where a.id = v_acceptance_id
    and a.company_id = v_company_id
    and a.job_id = v_job_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  if v_acceptance.confirmed_at is not null then
    select ai.id
    into v_attention_id
    from public.job_attention_items ai
    where ai.company_id = v_acceptance.company_id
      and ai.source_type = 'proposal_acceptances'
      and ai.source_id = v_acceptance.id;

    select j.*
    into v_job
    from public.jobs j
    where j.id = v_job_id
      and j.company_id = v_company_id
      and j.deleted_at is null;

    if not found then
      return jsonb_build_object('ok', false, 'code', 'not_found');
    end if;

    v_canonical := public.canonical_job_stage_from_row(
      v_job.stage,
      v_job.status,
      coalesce(v_job.archived, false),
      v_job.active_proposal_id,
      v_job.latest_proposal_id
    );

    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'acceptance_id', v_acceptance.id,
      'proposal_version_id', v_acceptance.proposal_version_id,
      'proposal_option_id', v_acceptance.proposal_option_id,
      'guard_result', v_acceptance.guard_result,
      'ambiguity_reason', v_acceptance.ambiguity_reason,
      'confirmed_at', v_acceptance.confirmed_at,
      'confirmed_by_user_id', v_acceptance.confirmed_by_user_id,
      'attention_id', v_attention_id,
      'job_id', v_job_id,
      'job_stage', v_canonical,
      'stage_entered_at', v_job.stage_entered_at,
      'status_unchanged', v_job.status
    );
  end if;

  if exists (
    select 1
    from public.proposal_acceptances a
    where a.company_id = v_company_id
      and a.job_id = v_job_id
      and a.id is distinct from v_acceptance.id
      and a.confirmed_at is not null
  ) then
    return jsonb_build_object(
      'ok', false,
      'code', 'job_already_approved'
    );
  end if;

  select j.*
  into v_job
  from public.jobs j
  where j.id = v_job_id
    and j.company_id = v_company_id
    and j.deleted_at is null
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  v_canonical := public.canonical_job_stage_from_row(
    v_job.stage,
    v_job.status,
    coalesce(v_job.archived, false),
    v_job.active_proposal_id,
    v_job.latest_proposal_id
  );

  if v_canonical in ('approved', 'scheduled', 'production', 'complete') then
    return jsonb_build_object(
      'ok', false,
      'code', 'job_already_approved'
    );
  end if;

  v_stage := public.job_lifecycle_apply_proposal_approved_from_acceptance_v1(
    v_company_id,
    v_job_id,
    v_acceptance.id,
    v_uid,
    'confirm',
    'contractor_approved'
  );

  if coalesce((v_stage->>'ok')::boolean, false) is not true then
    return v_stage;
  end if;

  update public.proposal_acceptances
  set
    confirmed_at = v_now,
    confirmed_by_user_id = v_uid
  where id = v_acceptance.id
    and company_id = v_company_id
    and confirmed_at is null;

  update public.job_attention_items
  set
    status = 'resolved',
    resolved_at = v_now,
    resolved_by = v_uid,
    resolution_reason = 'contractor_approved'
  where company_id = v_company_id
    and source_type = 'proposal_acceptances'
    and source_id = v_acceptance.id
    and status in ('open', 'acknowledged')
  returning id into v_attention_id;

  return jsonb_build_object(
    'ok', true,
    'idempotent', coalesce((v_stage->>'idempotent')::boolean, false),
    'acceptance_id', v_acceptance.id,
    'proposal_version_id', v_acceptance.proposal_version_id,
    'proposal_option_id', v_acceptance.proposal_option_id,
    'guard_result', v_acceptance.guard_result,
    'ambiguity_reason', v_acceptance.ambiguity_reason,
    'confirmed_at', v_now,
    'confirmed_by_user_id', v_uid,
    'attention_id', v_attention_id,
    'job_id', v_job_id,
    'from_stage', v_stage->>'from_stage',
    'to_stage', v_stage->>'to_stage',
    'stage_entered_at', v_stage->>'stage_entered_at',
    'activity_id', v_stage->>'activity_id'
  );
end;
$$;


ALTER FUNCTION "public"."confirm_proposal_acceptance_v1"("p_payload" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."confirm_proposal_acceptance_v1"("p_payload" "jsonb") IS 'R3C contractor Approve job. Requires a real unresolved proposal_acceptance. Preserves the historical accepted version. Resolves related Attention and transitions Proposal→Approved through the acceptance-owned lifecycle writer. Does not rewrite acceptance onto latest_sent_version_id. Does not silently reopen lost/closed. Explicit on_hold Approve may move stage while status stays on_hold. Refuses Approve job after Approved/Scheduled/Production/Complete so a later acceptance cannot become the confirmed basis. Already-confirmed retry is idempotent and returns the current canonical Job stage, not a hardcoded approved value.';



CREATE OR REPLACE FUNCTION "public"."create_job_payment_request_v1"("p_payload" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_company_id uuid;
  v_job_id uuid;
  v_kind text;
  v_amount integer;
  v_signature_id uuid;
  v_job public.jobs%rowtype;
  v_acceptance public.proposal_acceptances%rowtype;
  v_account public.company_payment_accounts%rowtype;
  v_existing public.job_payment_requests%rowtype;
  v_request public.job_payment_requests%rowtype;
  v_before_stage text;
  v_before_entered timestamptz;
  v_after_stage text;
  v_after_entered timestamptz;
  v_collectible integer;
  v_contract_option_id uuid;
  v_contract_total integer;
  v_active_other public.job_payment_requests%rowtype;
  v_matched_signature uuid;
  v_attention_id uuid;
  v_option_label text;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;

  begin
    v_company_id := nullif(p_payload->>'company_id', '')::uuid;
    v_job_id := nullif(p_payload->>'job_id', '')::uuid;
    v_kind := nullif(trim(p_payload->>'kind'), '');
    v_signature_id := nullif(p_payload->>'proposal_signature_id', '')::uuid;
  exception when others then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end;

  if v_company_id is null or v_job_id is null or v_kind is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  if v_kind = 'deposit' then
    return jsonb_build_object('ok', false, 'code', 'deposit_not_generic');
  end if;

  if v_kind is distinct from 'balance' then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  if not exists (
    select 1 from public.company_memberships cm
    where cm.company_id = v_company_id and cm.user_id = v_uid
  ) then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('job_payment_request:' || v_company_id::text || ':' || v_job_id::text, 0)
  );

  select j.*
  into v_job
  from public.jobs j
  where j.id = v_job_id
    and j.company_id = v_company_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  select s.job_stage, s.stage_entered_at
  into v_before_stage, v_before_entered
  from public.job_payment_snapshot_stage_v1(v_company_id, v_job_id) s;

  if coalesce(v_job.archived, false)
    or coalesce(v_job.status, 'active') <> 'active'
  then
    return jsonb_build_object('ok', false, 'code', 'job_not_active');
  end if;

  select a.*
  into v_acceptance
  from public.proposal_acceptances a
  where a.company_id = v_company_id
    and a.job_id = v_job_id
  order by a.accepted_at desc
  limit 1
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'no_acceptance');
  end if;

  select c.option_id, c.option_label
  into v_contract_option_id, v_option_label
  from public.proposal_acceptance_contract_option_v1(v_company_id, v_acceptance.id) c;

  v_contract_total := public.proposal_acceptance_contract_total_cents_v1(
    v_company_id,
    v_acceptance.id
  );

  if v_contract_option_id is null then
    v_contract_option_id := v_acceptance.proposal_option_id;
    v_option_label := v_acceptance.accepted_option_label;
  end if;

  v_option_label := left(trim(coalesce(v_option_label, v_acceptance.accepted_option_label)), 120);
  v_collectible := public.job_payment_collectible_cents_v1(v_company_id, v_job_id);

  select a.*
  into v_account
  from public.company_payment_accounts a
  where a.company_id = v_company_id
    and a.provider = 'stripe'
  for update;

  if not found or not v_account.charges_enabled then
    v_attention_id := public.job_payment_open_not_connected_attention_v1(
      v_company_id,
      v_job_id,
      v_acceptance.proposal_id,
      v_acceptance.proposal_version_id
    );
    return jsonb_build_object(
      'ok', false,
      'code', 'not_connected',
      'attention_id', v_attention_id
    );
  end if;

  select r.*
  into v_existing
  from public.job_payment_requests r
  where r.company_id = v_company_id
    and r.job_id = v_job_id
    and r.kind = v_kind
    and r.status in ('open', 'processing')
  limit 1;

  if found then
    select s.job_stage, s.stage_entered_at
    into v_after_stage, v_after_entered
    from public.job_payment_snapshot_stage_v1(v_company_id, v_job_id) s;

    if v_after_stage is distinct from v_before_stage
      or v_after_entered is distinct from v_before_entered
    then
      raise exception 'job payment request must not change job stage';
    end if;

    return jsonb_build_object(
      'ok', true,
      'id', v_existing.id,
      'company_id', v_existing.company_id,
      'job_id', v_existing.job_id,
      'kind', v_existing.kind,
      'status', v_existing.status,
      'amount_cents', v_existing.amount_cents,
      'currency', v_existing.currency,
      'proposal_signature_id', v_existing.proposal_signature_id,
      'accepted_total_cents_snapshot', v_existing.accepted_total_cents_snapshot,
      'option_label_snapshot', v_existing.option_label_snapshot,
      'requested_at', v_existing.requested_at,
      'idempotent_replay', true,
      'job_stage', v_after_stage,
      'stage_entered_at', v_after_entered,
      'job_stage_unchanged', true
    );
  end if;

  select r.*
  into v_active_other
  from public.job_payment_requests r
  where r.company_id = v_company_id
    and r.job_id = v_job_id
    and r.status in ('open', 'processing')
  limit 1;

  if found then
    return jsonb_build_object('ok', false, 'code', 'conflicting_request');
  end if;

  if v_before_stage is distinct from 'complete' then
    return jsonb_build_object('ok', false, 'code', 'not_complete');
  end if;

  v_amount := v_collectible;
  if v_amount is null or v_amount < 100 then
    return jsonb_build_object('ok', false, 'code', 'nothing_due');
  end if;

  select s.id
  into v_matched_signature
  from public.proposal_signatures s
  where s.company_id = v_company_id
    and s.proposal_acceptance_id = v_acceptance.id
    and s.job_id = v_job_id
    and s.proposal_id = v_acceptance.proposal_id
    and s.proposal_version_id = v_acceptance.proposal_version_id
    and s.proposal_option_id = v_acceptance.proposal_option_id
    and s.signer_slot = 'customer_primary'
  limit 1;

  if v_signature_id is not null then
    if v_matched_signature is null or v_signature_id is distinct from v_matched_signature then
      return jsonb_build_object('ok', false, 'code', 'signature_mismatch');
    end if;
  else
    v_signature_id := v_matched_signature;
  end if;

  begin
    insert into public.job_payment_requests (
      company_id,
      job_id,
      proposal_id,
      proposal_version_id,
      proposal_option_id,
      proposal_acceptance_id,
      proposal_signature_id,
      amount_cents,
      currency,
      kind,
      accepted_total_cents_snapshot,
      option_label_snapshot,
      provider,
      provider_account_id,
      status,
      created_by_user_id
    )
    values (
      v_company_id,
      v_job_id,
      v_acceptance.proposal_id,
      v_acceptance.proposal_version_id,
      v_contract_option_id,
      v_acceptance.id,
      v_signature_id,
      v_amount,
      'usd',
      v_kind,
      v_contract_total,
      v_option_label,
      'stripe',
      v_account.provider_account_id,
      'open',
      v_uid
    )
    returning * into v_request;
  exception
    when unique_violation then
      return jsonb_build_object('ok', false, 'code', 'conflicting_request');
  end;

  select s.job_stage, s.stage_entered_at
  into v_after_stage, v_after_entered
  from public.job_payment_snapshot_stage_v1(v_company_id, v_job_id) s;

  if v_after_stage is distinct from v_before_stage
    or v_after_entered is distinct from v_before_entered
  then
    raise exception 'job payment request must not change job stage';
  end if;

  return jsonb_build_object(
    'ok', true,
    'id', v_request.id,
    'company_id', v_request.company_id,
    'job_id', v_request.job_id,
    'proposal_id', v_request.proposal_id,
    'proposal_version_id', v_request.proposal_version_id,
    'proposal_option_id', v_request.proposal_option_id,
    'proposal_acceptance_id', v_request.proposal_acceptance_id,
    'proposal_signature_id', v_request.proposal_signature_id,
    'kind', v_request.kind,
    'status', v_request.status,
    'amount_cents', v_request.amount_cents,
    'currency', v_request.currency,
    'accepted_total_cents_snapshot', v_request.accepted_total_cents_snapshot,
    'option_label_snapshot', v_request.option_label_snapshot,
    'provider_account_id', v_request.provider_account_id,
    'requested_at', v_request.requested_at,
    'idempotent_replay', false,
    'job_stage', v_after_stage,
    'stage_entered_at', v_after_entered,
    'job_stage_unchanged', true
  );
end;
$$;


ALTER FUNCTION "public"."create_job_payment_request_v1"("p_payload" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."create_job_payment_request_v1"("p_payload" "jsonb") IS 'Contractor payment-request writer. kind=balance only: Complete-gated, amount = collectible (contract − gross), client amount ignored, open/processing replay, other active kinds conflict. kind=deposit is rejected (deposit_not_generic); deposit is owned by open_job_deposit_from_acceptance_v1. NEVER writes jobs.stage.';



CREATE OR REPLACE FUNCTION "public"."customers_prevent_company_id_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if tg_op = 'UPDATE' and new.company_id is distinct from old.company_id then
    raise exception 'customers.company_id is immutable';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."customers_prevent_company_id_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_company_payment_settings_v1"("p_company_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_row public.company_payment_settings%rowtype;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;
  if p_company_id is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;
  if not exists (
    select 1 from public.company_memberships cm
    where cm.company_id = p_company_id and cm.user_id = v_uid
  ) then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;

  insert into public.company_payment_settings (company_id)
  values (p_company_id)
  on conflict (company_id) do nothing;

  select s.* into v_row
  from public.company_payment_settings s
  where s.company_id = p_company_id;

  return jsonb_build_object(
    'ok', true,
    'company_id', v_row.company_id,
    'default_deposit_mode', v_row.default_deposit_mode,
    'default_deposit_percent_bps', v_row.default_deposit_percent_bps,
    'default_deposit_fixed_cents', v_row.default_deposit_fixed_cents
  );
end;
$$;


ALTER FUNCTION "public"."ensure_company_payment_settings_v1"("p_company_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."job_attachments_before_write"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  job_company uuid;
begin
  select j.company_id into job_company
  from public.jobs j
  where j.id = new.job_id;

  if job_company is null then
    raise exception 'job_attachments job not found';
  end if;

  if job_company is distinct from new.company_id then
    raise exception 'job_attachments company_id must match jobs.company_id';
  end if;

  if position(
    (new.company_id::text || '/' || new.job_id::text || '/' || new.id::text || '/')
    in new.storage_path
  ) <> 1 then
    raise exception 'job_attachments storage_path must be company/job/id prefixed';
  end if;

  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id
       or new.company_id is distinct from old.company_id
       or new.job_id is distinct from old.job_id
       or new.storage_bucket is distinct from old.storage_bucket
       or new.storage_path is distinct from old.storage_path
       or new.mime_type is distinct from old.mime_type
       or new.kind is distinct from old.kind
       or new.byte_size is distinct from old.byte_size
       or new.original_filename is distinct from old.original_filename
       or new.created_by is distinct from old.created_by
       or new.visibility is distinct from old.visibility
    then
      raise exception 'job_attachments identity fields are immutable';
    end if;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."job_attachments_before_write"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."job_attention_items_row_guard"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_request public.proposal_customer_requests%rowtype;
  v_acceptance public.proposal_acceptances%rowtype;
  v_job public.jobs%rowtype;
  v_payment public.job_payment_requests%rowtype;
  v_job_id uuid;
  v_attention_type text;
  v_expected_destination jsonb;
begin
  if tg_op = 'DELETE' then
    raise exception 'job_attention_items rows cannot be deleted';
  end if;

  if public.proposal_forbidden_token_json_keys(new.destination_json)
    or public.proposal_forbidden_token_json_keys(new.metadata_json)
  then
    raise exception 'job_attention_items JSON must not contain raw token keys';
  end if;

  if tg_op = 'INSERT' and new.source_type = 'proposal_customer_requests' then
    select r.*
    into v_request
    from public.proposal_customer_requests r
    where r.id = new.source_id
      and r.company_id = new.company_id;

    if not found then
      raise exception 'job_attention_items source request binding is invalid';
    end if;

    select p.job_id
    into v_job_id
    from public.proposals p
    join public.jobs j
      on j.id = p.job_id
     and j.company_id = p.company_id
    join public.proposal_versions pv
      on pv.id = v_request.proposal_version_id
     and pv.company_id = p.company_id
     and pv.proposal_id = p.id
    where p.id = v_request.proposal_id
      and p.company_id = v_request.company_id;

    if not found or v_job_id is null then
      raise exception 'job_attention_items source graph is invalid';
    end if;

    v_attention_type :=
      case
        when v_request.intent = 'request_package'
          then 'customer_package_request'
        when v_request.intent in ('ask_question', 'ask_about_package')
          then 'customer_question'
        else null
      end;

    v_expected_destination := jsonb_build_object(
      'proposal_id', v_request.proposal_id,
      'proposal_version_id', v_request.proposal_version_id,
      'request_id', v_request.id,
      'tab', 'proposals',
      'anchor', 'customer_request'
    );

    if new.job_id is distinct from v_job_id
      or new.proposal_id is distinct from v_request.proposal_id
      or new.proposal_version_id is distinct from v_request.proposal_version_id
      or new.attention_type is distinct from v_attention_type
      or new.source_occurred_at is distinct from v_request.created_at
      or new.opened_at is distinct from v_request.created_at
      or new.dedupe_key is distinct from
        ('customer_request:proposal_customer_requests:' || v_request.id::text)
      or new.destination_kind <> 'job_card_proposals'
      or new.destination_json is distinct from v_expected_destination
      or new.metadata_json->>'intent' is distinct from v_request.intent
      or (new.metadata_json - 'intent' - 'backfilled') <> '{}'::jsonb
      or (
        v_request.status = 'new'
        and (
          new.status <> 'open'
          or new.acknowledged_at is not null
          or new.acknowledged_by is not null
        )
      )
      or (
        v_request.status = 'seen'
        and (
          new.status <> 'acknowledged'
          or new.acknowledged_at is null
        )
      )
      or v_request.status = 'dismissed'
    then
      raise exception 'job_attention_items projection does not match verified source truth';
    end if;
  elsif tg_op = 'INSERT' and new.source_type = 'proposal_acceptances' then
    select a.*
    into v_acceptance
    from public.proposal_acceptances a
    where a.id = new.source_id
      and a.company_id = new.company_id;

    if not found then
      raise exception 'job_attention_items source acceptance binding is invalid';
    end if;

    if v_acceptance.guard_result not in ('valid_clean', 'valid_review_required') then
      raise exception 'job_attention_items acceptance attention requires a valid acceptance';
    end if;

    v_expected_destination := jsonb_build_object(
      'proposal_id', v_acceptance.proposal_id,
      'proposal_version_id', v_acceptance.proposal_version_id,
      'acceptance_id', v_acceptance.id,
      'tab', 'proposals',
      'anchor', 'acceptance_confirmation'
    );

    if new.job_id is distinct from v_acceptance.job_id
      or new.proposal_id is distinct from v_acceptance.proposal_id
      or new.proposal_version_id is distinct from v_acceptance.proposal_version_id
      or new.attention_type <> 'acceptance_confirmation_required'
      or new.source_occurred_at is distinct from v_acceptance.accepted_at
      or new.opened_at is distinct from v_acceptance.accepted_at
      or new.dedupe_key is distinct from
        ('acceptance_confirmation:proposal_acceptances:' || v_acceptance.id::text)
      or new.destination_kind <> 'job_card_proposals'
      or new.destination_json is distinct from v_expected_destination
      or new.metadata_json->>'guard_result' is distinct from v_acceptance.guard_result
      or new.metadata_json->>'ambiguity_reason' is distinct from v_acceptance.ambiguity_reason
      or (new.metadata_json - 'guard_result' - 'ambiguity_reason') <> '{}'::jsonb
      or new.status <> 'open'
      or new.acknowledged_at is not null
      or new.acknowledged_by is not null
    then
      raise exception 'job_attention_items acceptance projection does not match verified source truth';
    end if;
  elsif tg_op = 'INSERT' and new.source_type = 'jobs' then
    select j.*
    into v_job
    from public.jobs j
    where j.id = new.source_id
      and j.company_id = new.company_id;

    if not found then
      raise exception 'job_attention_items source job binding is invalid';
    end if;

    v_expected_destination := jsonb_build_object(
      'proposal_id', new.proposal_id,
      'proposal_version_id', new.proposal_version_id,
      'tab', 'overview',
      'anchor', 'payments'
    );

    if new.job_id is distinct from v_job.id
      or new.source_id is distinct from v_job.id
      or new.attention_type <> 'payments_not_connected'
      or new.dedupe_key is distinct from
        ('payments_not_connected:jobs:' || v_job.id::text)
      or new.destination_kind <> 'job_card_proposals'
      or new.destination_json is distinct from v_expected_destination
      or (new.metadata_json - 'reason') <> '{}'::jsonb
      or new.status <> 'open'
      or new.acknowledged_at is not null
      or new.acknowledged_by is not null
    then
      raise exception 'job_attention_items payments-not-connected projection is invalid';
    end if;
  elsif tg_op = 'INSERT' and new.source_type = 'job_payment_requests' then
    select r.*
    into v_payment
    from public.job_payment_requests r
    where r.id = new.source_id
      and r.company_id = new.company_id;

    if not found then
      raise exception 'job_attention_items source payment request binding is invalid';
    end if;

    v_expected_destination := jsonb_build_object(
      'proposal_id', v_payment.proposal_id,
      'proposal_version_id', v_payment.proposal_version_id,
      'payment_request_id', v_payment.id,
      'tab', 'overview',
      'anchor', 'payments'
    );

    if new.job_id is distinct from v_payment.job_id
      or new.proposal_id is distinct from v_payment.proposal_id
      or new.proposal_version_id is distinct from v_payment.proposal_version_id
      or new.attention_type <> 'payment_failed'
      or new.dedupe_key is distinct from
        ('payment_failed:job_payment_requests:' || v_payment.id::text)
      or new.destination_kind <> 'job_card_proposals'
      or new.destination_json is distinct from v_expected_destination
      or (new.metadata_json - 'kind') <> '{}'::jsonb
      or new.status <> 'open'
      or new.acknowledged_at is not null
      or new.acknowledged_by is not null
    then
      raise exception 'job_attention_items payment-failed projection is invalid';
    end if;
  elsif tg_op = 'INSERT' then
    raise exception 'job_attention_items source_type is not supported';
  end if;

  if tg_op = 'UPDATE' and (
    new.id is distinct from old.id
    or new.company_id is distinct from old.company_id
    or new.job_id is distinct from old.job_id
    or new.proposal_id is distinct from old.proposal_id
    or new.proposal_version_id is distinct from old.proposal_version_id
    or new.attention_type is distinct from old.attention_type
    or new.source_type is distinct from old.source_type
    or new.source_id is distinct from old.source_id
    or new.source_occurred_at is distinct from old.source_occurred_at
    or new.opened_at is distinct from old.opened_at
    or new.dedupe_key is distinct from old.dedupe_key
    or new.destination_kind is distinct from old.destination_kind
    or new.destination_json is distinct from old.destination_json
    or new.policy_version is distinct from old.policy_version
    or new.metadata_json is distinct from old.metadata_json
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'job_attention_items source binding and projection identity are immutable';
  end if;

  if tg_op = 'UPDATE' and old.status = 'resolved' and new.status <> 'resolved' then
    raise exception 'resolved job_attention_items cannot be reopened';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."job_attention_items_row_guard"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."job_lifecycle_apply_approved_from_unschedule_v1"("p_company_id" "uuid", "p_job_id" "uuid", "p_actor_user_id" "uuid", "p_schedule_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_job public.jobs%rowtype;
  v_from text;
  v_now timestamptz := now();
  v_activity_id uuid;
begin
  select j.*
  into v_job
  from public.jobs j
  where j.id = p_job_id
    and j.company_id = p_company_id
    and j.deleted_at is null
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  v_from := public.canonical_job_stage_from_row(
    v_job.stage,
    v_job.status,
    coalesce(v_job.archived, false),
    v_job.active_proposal_id,
    v_job.latest_proposal_id
  );

  if v_from = 'approved' then
    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'from_stage', v_from,
      'to_stage', 'approved',
      'stage_entered_at', v_job.stage_entered_at,
      'activity_id', null
    );
  end if;

  if v_from <> 'scheduled' then
    return jsonb_build_object(
      'ok', false,
      'code', 'illegal_stage',
      'from_stage', v_from,
      'to_stage', 'approved'
    );
  end if;

  perform set_config('job_lifecycle.allow_stage_write', '1', true);

  update public.jobs
  set
    stage = 'approved',
    stage_entered_at = v_now,
    last_activity_at = v_now
  where id = v_job.id
    and company_id = p_company_id;

  v_activity_id := public.job_lifecycle_insert_activity(
    p_company_id,
    p_job_id,
    'stage_changed',
    p_actor_user_id,
    jsonb_build_object(
      'from_stage', v_from,
      'to_stage', 'approved',
      'reason', 'unscheduled_job',
      'schedule_id', p_schedule_id
    ),
    v_now
  );

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'from_stage', v_from,
    'to_stage', 'approved',
    'stage_entered_at', v_now,
    'activity_id', v_activity_id
  );
end;
$$;


ALTER FUNCTION "public"."job_lifecycle_apply_approved_from_unschedule_v1"("p_company_id" "uuid", "p_job_id" "uuid", "p_actor_user_id" "uuid", "p_schedule_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."job_lifecycle_apply_proposal_approved_from_acceptance_v1"("p_company_id" "uuid", "p_job_id" "uuid", "p_acceptance_id" "uuid", "p_actor_user_id" "uuid", "p_mode" "text", "p_reason" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_job public.jobs%rowtype;
  v_from text;
  v_now timestamptz := now();
  v_activity_id uuid;
  v_mode text := coalesce(nullif(p_mode, ''), 'confirm');
begin
  if v_mode <> 'confirm' then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  select j.*
  into v_job
  from public.jobs j
  where j.id = p_job_id
    and j.company_id = p_company_id
    and j.deleted_at is null
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  if v_job.status in ('lost', 'closed') then
    return jsonb_build_object('ok', false, 'code', 'disposition_blocks_approval');
  end if;

  v_from := public.canonical_job_stage_from_row(
    v_job.stage,
    v_job.status,
    coalesce(v_job.archived, false),
    v_job.active_proposal_id,
    v_job.latest_proposal_id
  );

  if v_from = 'approved' then
    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'job_id', v_job.id,
      'from_stage', v_from,
      'to_stage', 'approved',
      'stage_entered_at', v_job.stage_entered_at,
      'status_unchanged', v_job.status,
      'activity_id', null
    );
  end if;

  if v_from <> 'proposal' then
    return jsonb_build_object(
      'ok', false,
      'code', 'illegal_edge',
      'from_stage', v_from,
      'to_stage', 'approved'
    );
  end if;

  if not public.job_lifecycle_has_proposal_truth(
    v_job.company_id,
    v_job.id,
    v_job.active_proposal_id
  ) then
    return jsonb_build_object(
      'ok', false,
      'code', 'proposal_truth_mismatch',
      'from_stage', v_from,
      'to_stage', 'approved'
    );
  end if;

  perform set_config('job_lifecycle.allow_stage_write', '1', true);

  update public.jobs
  set
    stage = 'approved',
    stage_entered_at = v_now,
    last_activity_at = v_now
  where id = v_job.id
    and company_id = p_company_id;

  v_activity_id := public.job_lifecycle_insert_activity(
    p_company_id,
    p_job_id,
    'stage_changed',
    p_actor_user_id,
    jsonb_build_object(
      'from_stage', v_from,
      'to_stage', 'approved',
      'reason', coalesce(nullif(p_reason, ''), 'contractor_approved'),
      'mode', v_mode,
      'acceptance_id', p_acceptance_id
    ),
    v_now
  );

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'job_id', p_job_id,
    'from_stage', v_from,
    'to_stage', 'approved',
    'stage_entered_at', v_now,
    'status_unchanged', v_job.status,
    'activity_id', v_activity_id
  );
end;
$$;


ALTER FUNCTION "public"."job_lifecycle_apply_proposal_approved_from_acceptance_v1"("p_company_id" "uuid", "p_job_id" "uuid", "p_acceptance_id" "uuid", "p_actor_user_id" "uuid", "p_mode" "text", "p_reason" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."job_lifecycle_apply_proposal_approved_from_acceptance_v1"("p_company_id" "uuid", "p_job_id" "uuid", "p_acceptance_id" "uuid", "p_actor_user_id" "uuid", "p_mode" "text", "p_reason" "text") IS 'R3C internal Proposal→Approved writer. Called only from contractor Approve job (confirm_proposal_acceptance_v1). Authenticated transition_job_stage_v1 remains blocked (approved_blocked_until_r3c). Public record_proposal_acceptance_v1 cannot call this. Lost/closed never approve. Does not mutate jobs.status.';



CREATE OR REPLACE FUNCTION "public"."job_lifecycle_apply_scheduled_from_work_v1"("p_company_id" "uuid", "p_job_id" "uuid", "p_actor_user_id" "uuid", "p_schedule_id" "uuid", "p_reason" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_job public.jobs%rowtype;
  v_from text;
  v_now timestamptz := now();
  v_activity_id uuid;
begin
  select j.*
  into v_job
  from public.jobs j
  where j.id = p_job_id
    and j.company_id = p_company_id
    and j.deleted_at is null
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  v_from := public.canonical_job_stage_from_row(
    v_job.stage,
    v_job.status,
    coalesce(v_job.archived, false),
    v_job.active_proposal_id,
    v_job.latest_proposal_id
  );

  if v_from = 'scheduled' then
    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'from_stage', v_from,
      'to_stage', 'scheduled',
      'stage_entered_at', v_job.stage_entered_at,
      'activity_id', null
    );
  end if;

  if v_from <> 'approved' then
    return jsonb_build_object(
      'ok', false,
      'code', 'illegal_stage',
      'from_stage', v_from,
      'to_stage', 'scheduled'
    );
  end if;

  perform set_config('job_lifecycle.allow_stage_write', '1', true);

  update public.jobs
  set
    stage = 'scheduled',
    stage_entered_at = v_now,
    last_activity_at = v_now
  where id = v_job.id
    and company_id = p_company_id;

  v_activity_id := public.job_lifecycle_insert_activity(
    p_company_id,
    p_job_id,
    'stage_changed',
    p_actor_user_id,
    jsonb_build_object(
      'from_stage', v_from,
      'to_stage', 'scheduled',
      'reason', coalesce(nullif(p_reason, ''), 'scheduled_job'),
      'schedule_id', p_schedule_id
    ),
    v_now
  );

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'from_stage', v_from,
    'to_stage', 'scheduled',
    'stage_entered_at', v_now,
    'activity_id', v_activity_id
  );
end;
$$;


ALTER FUNCTION "public"."job_lifecycle_apply_scheduled_from_work_v1"("p_company_id" "uuid", "p_job_id" "uuid", "p_actor_user_id" "uuid", "p_schedule_id" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."job_lifecycle_has_proposal_truth"("p_company_id" "uuid", "p_job_id" "uuid", "p_proposal_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    p_proposal_id is not null
    and exists (
      select 1
      from public.proposals p
      join public.proposal_versions pv
        on pv.proposal_id = p.id
       and pv.company_id = p.company_id
      where p.id = p_proposal_id
        and p.company_id = p_company_id
        and p.job_id = p_job_id
        and p.deleted_at is null
        and p.status is distinct from 'deleted'
    );
$$;


ALTER FUNCTION "public"."job_lifecycle_has_proposal_truth"("p_company_id" "uuid", "p_job_id" "uuid", "p_proposal_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."job_lifecycle_insert_activity"("p_company_id" "uuid", "p_job_id" "uuid", "p_event_type" "text", "p_actor_user_id" "uuid", "p_payload" "jsonb", "p_occurred_at" timestamp with time zone) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_id uuid;
  v_company_id uuid;
begin
  select j.company_id
  into v_company_id
  from public.jobs j
  where j.id = p_job_id
    and j.deleted_at is null;

  if not found or v_company_id is distinct from p_company_id then
    raise exception 'job_lifecycle_insert_activity: job/company mismatch'
      using errcode = 'P0001';
  end if;

  insert into public.job_activity_events (
    company_id,
    job_id,
    event_type,
    actor_user_id,
    payload_json,
    occurred_at
  ) values (
    p_company_id,
    p_job_id,
    p_event_type,
    p_actor_user_id,
    coalesce(p_payload, '{}'::jsonb),
    coalesce(p_occurred_at, now())
  )
  returning id into v_id;

  return v_id;
end;
$$;


ALTER FUNCTION "public"."job_lifecycle_insert_activity"("p_company_id" "uuid", "p_job_id" "uuid", "p_event_type" "text", "p_actor_user_id" "uuid", "p_payload" "jsonb", "p_occurred_at" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."job_payment_additional_deposit_cents_v1"("p_mode" "text", "p_percent_bps" integer, "p_fixed_cents" integer, "p_accepted_total_cents" integer, "p_net_received_cents" integer) RETURNS integer
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
declare
  v_obligation integer;
  v_remaining integer;
  v_uncovered integer;
begin
  v_obligation := public.job_payment_resolve_deposit_obligation_cents_v1(
    p_mode, p_percent_bps, p_fixed_cents, p_accepted_total_cents
  );
  v_remaining := greatest(0, coalesce(p_accepted_total_cents, 0) - greatest(0, coalesce(p_net_received_cents, 0)));
  v_uncovered := greatest(0, v_obligation - greatest(0, coalesce(p_net_received_cents, 0)));
  if least(v_uncovered, v_remaining) < 100 then
    return 0;
  end if;
  return least(v_uncovered, v_remaining);
end;
$$;


ALTER FUNCTION "public"."job_payment_additional_deposit_cents_v1"("p_mode" "text", "p_percent_bps" integer, "p_fixed_cents" integer, "p_accepted_total_cents" integer, "p_net_received_cents" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."job_payment_canonical_capture_identity_v1"("p_provider" "text", "p_provider_payment_intent_id" "text", "p_provider_event_id" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE PARALLEL SAFE
    SET "search_path" TO 'public'
    AS $$
  select case
    when nullif(trim(p_provider_payment_intent_id), '') is not null then
      'pi:' || coalesce(nullif(trim(p_provider), ''), 'stripe')
        || ':' || trim(p_provider_payment_intent_id)
    else
      'evt:' || coalesce(nullif(trim(p_provider), ''), 'stripe')
        || ':' || coalesce(nullif(trim(p_provider_event_id), ''), '')
  end;
$$;


ALTER FUNCTION "public"."job_payment_canonical_capture_identity_v1"("p_provider" "text", "p_provider_payment_intent_id" "text", "p_provider_event_id" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."job_payment_canonical_capture_identity_v1"("p_provider" "text", "p_provider_payment_intent_id" "text", "p_provider_event_id" "text") IS 'Financial capture identity. PaymentIntent when present; otherwise the provider event id so unknown-PI rows are not collapsed together.';



CREATE OR REPLACE FUNCTION "public"."job_payment_capture_refundable_cents_v1"("p_company_id" "uuid", "p_canonical_capture_transaction_id" "uuid") RETURNS integer
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  select greatest(
    0,
    coalesce((
      select t.amount_cents
      from public.job_payment_transactions t
      where t.id = p_canonical_capture_transaction_id
        and t.company_id = p_company_id
        and t.provider = 'stripe'
        and t.kind = 'capture'
        and t.status = 'succeeded'
    ), 0)
    - coalesce((
      select sum(r.amount_cents)
      from public.job_payment_refunds r
      where r.company_id = p_company_id
        and r.canonical_capture_transaction_id = p_canonical_capture_transaction_id
        and r.status in (
          'initiating',
          'pending',
          'requires_action',
          'succeeded'
        )
    ), 0)
  )::integer;
$$;


ALTER FUNCTION "public"."job_payment_capture_refundable_cents_v1"("p_company_id" "uuid", "p_canonical_capture_transaction_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."job_payment_collectible_cents_v1"("p_company_id" "uuid", "p_job_id" "uuid") RETURNS integer
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  select greatest(
    0,
    public.job_payment_current_contractual_total_cents_v1(p_company_id, p_job_id)
    - public.job_payment_gross_received_cents_v1(p_company_id, p_job_id)
  )::integer;
$$;


ALTER FUNCTION "public"."job_payment_collectible_cents_v1"("p_company_id" "uuid", "p_job_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."job_payment_collectible_cents_v1"("p_company_id" "uuid", "p_job_id" "uuid") IS 'Amount due / collectible for a job: max(0, 053 contractual total − canonical gross received). Refunds do not reopen amount due. Distinct from job_payment_remaining_cents_v1 (contract − net).';



CREATE OR REPLACE FUNCTION "public"."job_payment_current_contractual_total_cents_v1"("p_company_id" "uuid", "p_job_id" "uuid") RETURNS integer
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  select coalesce(
    (
      select public.proposal_acceptance_contract_total_cents_v1(a.company_id, a.id)
      from public.proposal_acceptances a
      where a.company_id = p_company_id
        and a.job_id = p_job_id
      order by a.accepted_at desc
      limit 1
    ),
    0
  )::integer;
$$;


ALTER FUNCTION "public"."job_payment_current_contractual_total_cents_v1"("p_company_id" "uuid", "p_job_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."job_payment_current_contractual_total_cents_v1"("p_company_id" "uuid", "p_job_id" "uuid") IS 'Latest acceptance contractual total for a job. Prefers customer-chosen cents when present; otherwise contractor accepted_total_cents.';



CREATE OR REPLACE FUNCTION "public"."job_payment_gross_received_cents_v1"("p_company_id" "uuid", "p_job_id" "uuid") RETURNS integer
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  select coalesce(sum(canonical.amount_cents), 0)::integer
  from (
    select distinct on (
      t.company_id,
      public.job_payment_canonical_capture_identity_v1(
        t.provider,
        t.provider_payment_intent_id,
        t.provider_event_id
      )
    )
      t.amount_cents
    from public.job_payment_transactions t
    join public.job_payment_requests r
      on r.id = t.payment_request_id
     and r.company_id = t.company_id
    where r.company_id = p_company_id
      and r.job_id = p_job_id
      and t.kind = 'capture'
      and t.status = 'succeeded'
    order by
      t.company_id,
      public.job_payment_canonical_capture_identity_v1(
        t.provider,
        t.provider_payment_intent_id,
        t.provider_event_id
      ),
      t.occurred_at asc,
      t.created_at asc
  ) canonical;
$$;


ALTER FUNCTION "public"."job_payment_gross_received_cents_v1"("p_company_id" "uuid", "p_job_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."job_payment_gross_received_cents_v1"("p_company_id" "uuid", "p_job_id" "uuid") IS 'Succeeded capture contribution per canonical provider-payment identity. Duplicate event-derived captures for one PaymentIntent count once. Distinct PaymentIntents are never collapsed, even at equal amounts.';



CREATE OR REPLACE FUNCTION "public"."job_payment_kind_net_paid_cents_v1"("p_company_id" "uuid", "p_acceptance_id" "uuid", "p_kind" "text") RETURNS integer
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  select greatest(
    0,
    coalesce((
      select sum(r.amount_cents)
      from public.job_payment_requests r
      where r.company_id = p_company_id
        and r.proposal_acceptance_id = p_acceptance_id
        and r.kind = p_kind
        and r.status = 'paid'
    ), 0)
    -
    coalesce((
      select sum(t.amount_cents)
      from public.job_payment_transactions t
      join public.job_payment_requests r
        on r.id = t.payment_request_id
       and r.company_id = t.company_id
      where r.company_id = p_company_id
        and r.proposal_acceptance_id = p_acceptance_id
        and r.kind = p_kind
        and t.kind = 'refund'
        and t.status = 'refunded'
    ), 0)
  )::integer;
$$;


ALTER FUNCTION "public"."job_payment_kind_net_paid_cents_v1"("p_company_id" "uuid", "p_acceptance_id" "uuid", "p_kind" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."job_payment_net_paid_cents_v1"("p_company_id" "uuid", "p_acceptance_id" "uuid") RETURNS integer
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  select greatest(
    0,
    coalesce((
      select sum(r.amount_cents)
      from public.job_payment_requests r
      where r.company_id = p_company_id
        and r.proposal_acceptance_id = p_acceptance_id
        and r.status = 'paid'
    ), 0)
    -
    coalesce((
      select sum(t.amount_cents)
      from public.job_payment_transactions t
      join public.job_payment_requests r
        on r.id = t.payment_request_id
       and r.company_id = t.company_id
      where r.company_id = p_company_id
        and r.proposal_acceptance_id = p_acceptance_id
        and t.kind = 'refund'
        and t.status = 'refunded'
    ), 0)
  )::integer;
$$;


ALTER FUNCTION "public"."job_payment_net_paid_cents_v1"("p_company_id" "uuid", "p_acceptance_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."job_payment_net_received_cents_v1"("p_company_id" "uuid", "p_job_id" "uuid") RETURNS integer
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  select greatest(
    0,
    public.job_payment_gross_received_cents_v1(p_company_id, p_job_id)
    - public.job_payment_refunded_cents_v1(p_company_id, p_job_id)
  )::integer;
$$;


ALTER FUNCTION "public"."job_payment_net_received_cents_v1"("p_company_id" "uuid", "p_job_id" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."job_payment_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "job_id" "uuid" NOT NULL,
    "proposal_id" "uuid" NOT NULL,
    "proposal_version_id" "uuid" NOT NULL,
    "proposal_option_id" "uuid" NOT NULL,
    "proposal_acceptance_id" "uuid" NOT NULL,
    "proposal_signature_id" "uuid",
    "amount_cents" integer NOT NULL,
    "currency" "text" DEFAULT 'usd'::"text" NOT NULL,
    "kind" "text" NOT NULL,
    "accepted_total_cents_snapshot" integer NOT NULL,
    "option_label_snapshot" "text" NOT NULL,
    "provider" "text" DEFAULT 'stripe'::"text" NOT NULL,
    "provider_account_id" "text" NOT NULL,
    "provider_checkout_session_id" "text",
    "checkout_generation" integer DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "requested_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone,
    "paid_at" timestamp with time zone,
    "cancelled_at" timestamp with time zone,
    "created_by_user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "settled_payment_method_label" "text",
    "amount_mode" "text",
    "percentage_bps" integer,
    CONSTRAINT "job_payment_requests_accepted_total_check" CHECK (("accepted_total_cents_snapshot" >= "amount_cents")),
    CONSTRAINT "job_payment_requests_amount_cents_check" CHECK (("amount_cents" >= 100)),
    CONSTRAINT "job_payment_requests_amount_mode_check" CHECK ((("amount_mode" IS NULL) OR ("amount_mode" = ANY (ARRAY['remaining'::"text", 'percentage'::"text", 'fixed'::"text"])))),
    CONSTRAINT "job_payment_requests_cancelled_at_check" CHECK ((("status" = 'cancelled'::"text") = ("cancelled_at" IS NOT NULL))),
    CONSTRAINT "job_payment_requests_checkout_generation_check" CHECK (("checkout_generation" >= 0)),
    CONSTRAINT "job_payment_requests_currency_check" CHECK (("currency" = 'usd'::"text")),
    CONSTRAINT "job_payment_requests_kind_check" CHECK (("kind" = ANY (ARRAY['deposit'::"text", 'progress'::"text", 'balance'::"text"]))),
    CONSTRAINT "job_payment_requests_option_label_check" CHECK ((("length"(TRIM(BOTH FROM "option_label_snapshot")) > 0) AND ("char_length"("option_label_snapshot") <= 120))),
    CONSTRAINT "job_payment_requests_paid_at_check" CHECK ((("status" = 'paid'::"text") = ("paid_at" IS NOT NULL))),
    CONSTRAINT "job_payment_requests_percentage_bps_check" CHECK (((("amount_mode" = 'percentage'::"text") AND ("percentage_bps" IS NOT NULL) AND ("percentage_bps" >= 1) AND ("percentage_bps" <= 10000)) OR ((COALESCE("amount_mode", ''::"text") IS DISTINCT FROM 'percentage'::"text") AND ("percentage_bps" IS NULL)))),
    CONSTRAINT "job_payment_requests_provider_account_id_check" CHECK ((("char_length"("provider_account_id") >= 4) AND ("char_length"("provider_account_id") <= 128) AND ("provider_account_id" ~ '^acct_'::"text"))),
    CONSTRAINT "job_payment_requests_provider_check" CHECK (("provider" = 'stripe'::"text")),
    CONSTRAINT "job_payment_requests_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'processing'::"text", 'paid'::"text", 'cancelled'::"text", 'expired'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."job_payment_requests" OWNER TO "postgres";


COMMENT ON TABLE "public"."job_payment_requests" IS 'R3E contractor payment intent against exact frozen accepted proposal truth. Amount is immutable. Signature id is optional.';



COMMENT ON COLUMN "public"."job_payment_requests"."proposal_signature_id" IS 'Optional matching signature evidence. Null is valid. Payment never creates or mutates signatures.';



COMMENT ON COLUMN "public"."job_payment_requests"."amount_cents" IS 'Integer cents stamped at create from contractor-chosen amount against remaining accepted total. Immutable.';



COMMENT ON COLUMN "public"."job_payment_requests"."amount_mode" IS 'Explanatory Collect calculation mode (remaining|percentage|fixed). Null for deposit and pre-056 rows. Never used to recalculate amount_cents.';



COMMENT ON COLUMN "public"."job_payment_requests"."percentage_bps" IS 'Explanatory Collect percentage in integer basis points (1–10000) when amount_mode=percentage. Never recalculation authority.';



COMMENT ON CONSTRAINT "job_payment_requests_kind_check" ON "public"."job_payment_requests" IS 'Payment request purpose: deposit (acceptance-owned), progress (contractor Collect), balance (Complete-gated final remaining).';



CREATE OR REPLACE FUNCTION "public"."job_payment_open_failed_attention_v1"("p_request" "public"."job_payment_requests") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_now timestamptz := now();
  v_id uuid;
begin
  insert into public.job_attention_items (
    company_id,
    job_id,
    proposal_id,
    proposal_version_id,
    attention_type,
    source_type,
    source_id,
    source_occurred_at,
    status,
    base_severity,
    opened_at,
    dedupe_key,
    destination_kind,
    destination_json,
    metadata_json
  )
  values (
    p_request.company_id,
    p_request.job_id,
    p_request.proposal_id,
    p_request.proposal_version_id,
    'payment_failed',
    'job_payment_requests',
    p_request.id,
    v_now,
    'open',
    'high',
    v_now,
    'payment_failed:job_payment_requests:' || p_request.id::text,
    'job_card_proposals',
    jsonb_build_object(
      'proposal_id', p_request.proposal_id,
      'proposal_version_id', p_request.proposal_version_id,
      'payment_request_id', p_request.id,
      'tab', 'overview',
      'anchor', 'payments'
    ),
    jsonb_build_object('kind', p_request.kind)
  )
  on conflict (company_id, dedupe_key) do nothing
  returning id into v_id;

  if v_id is null then
    select ai.id
    into v_id
    from public.job_attention_items ai
    where ai.company_id = p_request.company_id
      and ai.dedupe_key = 'payment_failed:job_payment_requests:' || p_request.id::text
      and ai.status in ('open', 'acknowledged');
  end if;

  return v_id;
end;
$$;


ALTER FUNCTION "public"."job_payment_open_failed_attention_v1"("p_request" "public"."job_payment_requests") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."job_payment_open_not_connected_attention_v1"("p_company_id" "uuid", "p_job_id" "uuid", "p_proposal_id" "uuid", "p_proposal_version_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_now timestamptz := now();
  v_id uuid;
begin
  insert into public.job_attention_items (
    company_id,
    job_id,
    proposal_id,
    proposal_version_id,
    attention_type,
    source_type,
    source_id,
    source_occurred_at,
    status,
    base_severity,
    opened_at,
    dedupe_key,
    destination_kind,
    destination_json,
    metadata_json
  )
  values (
    p_company_id,
    p_job_id,
    p_proposal_id,
    p_proposal_version_id,
    'payments_not_connected',
    'jobs',
    p_job_id,
    v_now,
    'open',
    'high',
    v_now,
    'payments_not_connected:jobs:' || p_job_id::text,
    'job_card_proposals',
    jsonb_build_object(
      'proposal_id', p_proposal_id,
      'proposal_version_id', p_proposal_version_id,
      'tab', 'overview',
      'anchor', 'payments'
    ),
    jsonb_build_object('reason', 'charges_not_enabled')
  )
  on conflict (company_id, dedupe_key) do nothing
  returning id into v_id;

  if v_id is null then
    select ai.id
    into v_id
    from public.job_attention_items ai
    where ai.company_id = p_company_id
      and ai.dedupe_key = 'payments_not_connected:jobs:' || p_job_id::text
      and ai.status in ('open', 'acknowledged');
  end if;

  return v_id;
end;
$$;


ALTER FUNCTION "public"."job_payment_open_not_connected_attention_v1"("p_company_id" "uuid", "p_job_id" "uuid", "p_proposal_id" "uuid", "p_proposal_version_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."job_payment_refund_events_row_guard_v1"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  if tg_op = 'UPDATE' then
    raise exception 'job_payment_refund_event_receipts rows cannot be updated';
  elsif tg_op = 'DELETE' then
    raise exception 'job_payment_refund_event_receipts rows cannot be deleted';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."job_payment_refund_events_row_guard_v1"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."job_payment_refund_status_rank_v1"("p_status" "text") RETURNS integer
    LANGUAGE "sql" IMMUTABLE PARALLEL SAFE
    SET "search_path" TO 'public'
    AS $$
  select case p_status
    when 'initiating' then 0
    when 'pending' then 1
    when 'requires_action' then 2
    when 'failed' then 3
    when 'canceled' then 3
    when 'succeeded' then 4
    else -1
  end;
$$;


ALTER FUNCTION "public"."job_payment_refund_status_rank_v1"("p_status" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."job_payment_refunded_cents_v1"("p_company_id" "uuid", "p_job_id" "uuid") RETURNS integer
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  select coalesce(sum(r.amount_cents), 0)::integer
  from public.job_payment_refunds r
  where r.company_id = p_company_id
    and r.job_id = p_job_id
    and r.status = 'succeeded';
$$;


ALTER FUNCTION "public"."job_payment_refunded_cents_v1"("p_company_id" "uuid", "p_job_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."job_payment_refunds_row_guard_v1"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_request public.job_payment_requests%rowtype;
  v_capture public.job_payment_transactions%rowtype;
  v_canonical_id uuid;
begin
  if tg_op = 'DELETE' then
    raise exception 'job_payment_refunds rows cannot be deleted';
  end if;

  if tg_op = 'INSERT' then
    select r.* into v_request
    from public.job_payment_requests r
    where r.id = new.payment_request_id
      and r.company_id = new.company_id;

    select t.* into v_capture
    from public.job_payment_transactions t
    where t.id = new.canonical_capture_transaction_id
      and t.company_id = new.company_id
      and t.payment_request_id = new.payment_request_id;

    if v_request.id is null
      or v_request.job_id is distinct from new.job_id
      or v_request.provider is distinct from 'stripe'
      or v_request.provider_account_id is distinct from new.provider_account_id
      or v_request.currency is distinct from 'usd'
    then
      raise exception 'refund request/account/job/currency binding is invalid';
    end if;

    if v_capture.id is null
      or v_capture.kind is distinct from 'capture'
      or v_capture.status is distinct from 'succeeded'
      or v_capture.currency is distinct from 'usd'
      or v_capture.provider is distinct from 'stripe'
      or v_capture.provider_payment_intent_id is null
      or v_capture.provider_payment_intent_id is distinct from new.provider_payment_intent_id
      or (
        new.provider_charge_id is not null
        and v_capture.provider_charge_id is not null
        and new.provider_charge_id is distinct from v_capture.provider_charge_id
      )
    then
      raise exception 'refund must bind to a successful USD Stripe capture';
    end if;

    select t.id into v_canonical_id
    from public.job_payment_transactions t
    where t.company_id = new.company_id
      and t.provider = 'stripe'
      and t.kind = 'capture'
      and t.status = 'succeeded'
      and t.provider_payment_intent_id = new.provider_payment_intent_id
    order by t.occurred_at asc, t.created_at asc, t.id asc
    limit 1;

    if v_canonical_id is distinct from new.canonical_capture_transaction_id then
      raise exception 'refund capture is not canonical for the PaymentIntent';
    end if;
  else
    if new.id is distinct from old.id
      or new.company_id is distinct from old.company_id
      or new.job_id is distinct from old.job_id
      or new.payment_request_id is distinct from old.payment_request_id
      or new.canonical_capture_transaction_id is distinct from old.canonical_capture_transaction_id
      or new.provider is distinct from old.provider
      or new.provider_account_id is distinct from old.provider_account_id
      or new.provider_payment_intent_id is distinct from old.provider_payment_intent_id
      or new.amount_cents is distinct from old.amount_cents
      or new.currency is distinct from old.currency
      or new.origin is distinct from old.origin
      or new.created_by_user_id is distinct from old.created_by_user_id
      or new.internal_reason is distinct from old.internal_reason
      or new.idempotency_key is distinct from old.idempotency_key
      or new.created_at is distinct from old.created_at
    then
      raise exception 'job_payment_refunds financial identity is immutable';
    end if;

    if old.provider_charge_id is not null
      and new.provider_charge_id is distinct from old.provider_charge_id
    then
      raise exception 'Stripe charge id is immutable once bound';
    end if;

    if old.provider_refund_id is not null
      and new.provider_refund_id is distinct from old.provider_refund_id
    then
      raise exception 'Stripe refund id is immutable once bound';
    end if;

    if old.status in ('succeeded', 'failed', 'canceled')
      and new.status not in ('succeeded', 'failed', 'canceled')
    then
      raise exception 'terminal refunds cannot regress to an in-flight status';
    end if;

    if old.initiated_at is not null and new.initiated_at is distinct from old.initiated_at
      or old.pending_at is not null and new.pending_at is distinct from old.pending_at
      or old.requires_action_at is not null and new.requires_action_at is distinct from old.requires_action_at
      or old.succeeded_at is not null and new.succeeded_at is distinct from old.succeeded_at
      or old.failed_at is not null and new.failed_at is distinct from old.failed_at
      or old.canceled_at is not null and new.canceled_at is distinct from old.canceled_at
    then
      raise exception 'refund lifecycle timestamps cannot be cleared or rewritten';
    end if;

    new.updated_at := now();
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."job_payment_refunds_row_guard_v1"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."job_payment_remaining_cents_v1"("p_company_id" "uuid", "p_job_id" "uuid") RETURNS integer
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  select greatest(
    0,
    public.job_payment_current_contractual_total_cents_v1(p_company_id, p_job_id)
    - public.job_payment_net_received_cents_v1(p_company_id, p_job_id)
  )::integer;
$$;


ALTER FUNCTION "public"."job_payment_remaining_cents_v1"("p_company_id" "uuid", "p_job_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."job_payment_requests_row_guard"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_acceptance public.proposal_acceptances%rowtype;
  v_signature public.proposal_signatures%rowtype;
  v_contract_option_id uuid;
  v_contract_total_cents integer;
begin
  if tg_op = 'DELETE' then
    raise exception 'job_payment_requests rows cannot be deleted';
  end if;

  if tg_op = 'INSERT' or tg_op = 'UPDATE' then
    select a.*
    into v_acceptance
    from public.proposal_acceptances a
    where a.id = new.proposal_acceptance_id
      and a.company_id = new.company_id;

    if not found then
      raise exception 'job_payment_requests require a matching proposal_acceptance';
    end if;

    v_contract_option_id :=
      coalesce(v_acceptance.customer_chosen_option_id, v_acceptance.proposal_option_id);
    v_contract_total_cents :=
      coalesce(v_acceptance.customer_chosen_total_cents, v_acceptance.accepted_total_cents);

    if new.job_id is distinct from v_acceptance.job_id
      or new.proposal_id is distinct from v_acceptance.proposal_id
      or new.proposal_version_id is distinct from v_acceptance.proposal_version_id
      or new.proposal_option_id is distinct from v_contract_option_id
    then
      raise exception 'job_payment_requests binding must match the acceptance row';
    end if;

    if new.accepted_total_cents_snapshot is distinct from v_contract_total_cents
      and tg_op = 'INSERT'
    then
      raise exception 'job_payment_requests accepted_total_cents_snapshot must match acceptance';
    end if;

    if new.proposal_signature_id is not null then
      select s.*
      into v_signature
      from public.proposal_signatures s
      where s.id = new.proposal_signature_id
        and s.company_id = new.company_id;

      if not found then
        raise exception 'job_payment_requests signature binding is invalid';
      end if;

      if v_signature.job_id is distinct from new.job_id
        or v_signature.proposal_id is distinct from new.proposal_id
        or v_signature.proposal_version_id is distinct from new.proposal_version_id
        or v_signature.proposal_option_id is distinct from new.proposal_option_id
        or v_signature.proposal_acceptance_id is distinct from new.proposal_acceptance_id
      then
        raise exception 'job_payment_requests signature must match the same acceptance binding';
      end if;
    end if;
  end if;

  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id
      or new.company_id is distinct from old.company_id
      or new.job_id is distinct from old.job_id
      or new.proposal_id is distinct from old.proposal_id
      or new.proposal_version_id is distinct from old.proposal_version_id
      or new.proposal_option_id is distinct from old.proposal_option_id
      or new.proposal_acceptance_id is distinct from old.proposal_acceptance_id
      or new.proposal_signature_id is distinct from old.proposal_signature_id
      or new.amount_cents is distinct from old.amount_cents
      or new.currency is distinct from old.currency
      or new.kind is distinct from old.kind
      or new.accepted_total_cents_snapshot is distinct from old.accepted_total_cents_snapshot
      or new.option_label_snapshot is distinct from old.option_label_snapshot
      or new.provider is distinct from old.provider
      or new.provider_account_id is distinct from old.provider_account_id
      or new.requested_at is distinct from old.requested_at
      or new.created_by_user_id is distinct from old.created_by_user_id
      or new.created_at is distinct from old.created_at
    then
      raise exception 'job_payment_requests financial identity is immutable';
    end if;

    if old.status = 'paid' and new.status is distinct from 'paid' then
      raise exception 'paid job_payment_requests cannot regress';
    end if;

    if old.status in ('cancelled', 'expired')
      and new.status is distinct from old.status
    then
      raise exception 'cancelled/expired job_payment_requests cannot change status';
    end if;

    new.updated_at := now();
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."job_payment_requests_row_guard"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."job_payment_resolve_attention_v1"("p_company_id" "uuid", "p_dedupe_key" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  update public.job_attention_items
  set
    status = 'resolved',
    resolved_at = now(),
    resolution_reason = 'payment_condition_cleared'
  where company_id = p_company_id
    and dedupe_key = p_dedupe_key
    and status in ('open', 'acknowledged');
end;
$$;


ALTER FUNCTION "public"."job_payment_resolve_attention_v1"("p_company_id" "uuid", "p_dedupe_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."job_payment_resolve_deposit_obligation_cents_v1"("p_mode" "text", "p_percent_bps" integer, "p_fixed_cents" integer, "p_accepted_total_cents" integer) RETURNS integer
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
begin
  if p_mode = 'percent' then
    if p_percent_bps is null or p_percent_bps < 1 or p_percent_bps > 10000 then
      return 0;
    end if;
    return greatest(0, (coalesce(p_accepted_total_cents, 0) * p_percent_bps) / 10000);
  end if;
  if p_mode = 'fixed' then
    if p_fixed_cents is null or p_fixed_cents < 100 then
      return 0;
    end if;
    return p_fixed_cents;
  end if;
  return 0;
end;
$$;


ALTER FUNCTION "public"."job_payment_resolve_deposit_obligation_cents_v1"("p_mode" "text", "p_percent_bps" integer, "p_fixed_cents" integer, "p_accepted_total_cents" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."job_payment_snapshot_stage_v1"("p_company_id" "uuid", "p_job_id" "uuid") RETURNS TABLE("job_stage" "text", "stage_entered_at" timestamp with time zone)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  select
    public.canonical_job_stage_from_row(
      j.stage, j.status, coalesce(j.archived, false), j.active_proposal_id, j.latest_proposal_id
    ),
    j.stage_entered_at
  from public.jobs j
  where j.id = p_job_id
    and j.company_id = p_company_id;
$$;


ALTER FUNCTION "public"."job_payment_snapshot_stage_v1"("p_company_id" "uuid", "p_job_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."job_payment_transactions_row_guard"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  if tg_op = 'DELETE' then
    raise exception 'job_payment_transactions rows cannot be deleted';
  end if;
  if tg_op = 'UPDATE' then
    raise exception 'job_payment_transactions rows cannot be updated';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."job_payment_transactions_row_guard"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."job_payment_uncovered_deposit_cents_v1"("p_company_id" "uuid", "p_job_id" "uuid", "p_mode" "text", "p_percent_bps" integer, "p_fixed_cents" integer, "p_canonical_total_cents" integer) RETURNS integer
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public'
    AS $$
declare
  v_obligation integer;
  v_gross integer;
  v_collectible integer;
  v_uncovered integer;
  v_amount integer;
begin
  v_obligation := public.job_payment_resolve_deposit_obligation_cents_v1(
    p_mode,
    p_percent_bps,
    p_fixed_cents,
    p_canonical_total_cents
  );
  v_gross := public.job_payment_gross_received_cents_v1(p_company_id, p_job_id);
  v_collectible := public.job_payment_collectible_cents_v1(p_company_id, p_job_id);
  v_uncovered := greatest(0, coalesce(v_obligation, 0) - greatest(0, coalesce(v_gross, 0)));
  v_amount := least(v_uncovered, greatest(0, coalesce(v_collectible, 0)));
  if v_amount < 100 then
    return 0;
  end if;
  return v_amount;
end;
$$;


ALTER FUNCTION "public"."job_payment_uncovered_deposit_cents_v1"("p_company_id" "uuid", "p_job_id" "uuid", "p_mode" "text", "p_percent_bps" integer, "p_fixed_cents" integer, "p_canonical_total_cents" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."job_payment_uncovered_deposit_cents_v1"("p_company_id" "uuid", "p_job_id" "uuid", "p_mode" "text", "p_percent_bps" integer, "p_fixed_cents" integer, "p_canonical_total_cents" integer) IS 'Incremental deposit still due: max(0, frozen obligation against 053 canonical contractual total − 053 gross successful captures), then min(uncovered, 054 collectible). Returns 0 when the result is under 100 cents. Does not use net or job_payment_additional_deposit_cents_v1. Refunds do not reopen deposit.';



CREATE OR REPLACE FUNCTION "public"."job_schedule_derive_range"("p_timezone" "text", "p_all_day" boolean, "p_starts_on" "date", "p_ends_on" "date", "p_start_local_time" time without time zone, "p_end_local_time" time without time zone) RETURNS TABLE("range_start_at" timestamp with time zone, "range_end_at" timestamp with time zone)
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public'
    AS $$
begin
  if p_all_day then
    range_start_at := (p_starts_on::timestamp at time zone p_timezone);
    range_end_at := ((p_ends_on + 1)::timestamp at time zone p_timezone);
    return next;
    return;
  end if;

  range_start_at := ((p_starts_on::timestamp + p_start_local_time) at time zone p_timezone);
  range_end_at := ((p_ends_on::timestamp + p_end_local_time) at time zone p_timezone);
  return next;
end;
$$;


ALTER FUNCTION "public"."job_schedule_derive_range"("p_timezone" "text", "p_all_day" boolean, "p_starts_on" "date", "p_ends_on" "date", "p_start_local_time" time without time zone, "p_end_local_time" time without time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."job_schedule_is_iana_timezone"("p_tz" "text") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  select
    p_tz is not null
    and length(trim(p_tz)) > 0
    and exists (
      select 1
      from pg_timezone_names n
      where n.name = trim(p_tz)
    );
$$;


ALTER FUNCTION "public"."job_schedule_is_iana_timezone"("p_tz" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_schedules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "job_id" "uuid" NOT NULL,
    "kind" "text" DEFAULT 'work'::"text" NOT NULL,
    "status" "text" DEFAULT 'scheduled'::"text" NOT NULL,
    "timezone" "text" NOT NULL,
    "all_day" boolean DEFAULT true NOT NULL,
    "starts_on" "date" NOT NULL,
    "ends_on" "date" NOT NULL,
    "start_local_time" time without time zone,
    "end_local_time" time without time zone,
    "range_start_at" timestamp with time zone NOT NULL,
    "range_end_at" timestamp with time zone NOT NULL,
    "notes" "text",
    "created_by_user_id" "uuid",
    "updated_by_user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "cancelled_at" timestamp with time zone,
    "row_version" integer DEFAULT 1 NOT NULL,
    CONSTRAINT "job_schedules_all_day_times_check" CHECK (((("all_day" = true) AND ("start_local_time" IS NULL) AND ("end_local_time" IS NULL)) OR (("all_day" = false) AND ("start_local_time" IS NOT NULL) AND ("end_local_time" IS NOT NULL)))),
    CONSTRAINT "job_schedules_cancelled_at_check" CHECK (((("status" = 'scheduled'::"text") AND ("cancelled_at" IS NULL)) OR (("status" = 'cancelled'::"text") AND ("cancelled_at" IS NOT NULL)))),
    CONSTRAINT "job_schedules_dates_order_check" CHECK (("ends_on" >= "starts_on")),
    CONSTRAINT "job_schedules_kind_check" CHECK (("kind" = 'work'::"text")),
    CONSTRAINT "job_schedules_notes_length_check" CHECK ((("notes" IS NULL) OR ("char_length"("notes") <= 500))),
    CONSTRAINT "job_schedules_row_version_check" CHECK (("row_version" >= 1)),
    CONSTRAINT "job_schedules_status_check" CHECK (("status" = ANY (ARRAY['scheduled'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."job_schedules" OWNER TO "postgres";


COMMENT ON TABLE "public"."job_schedules" IS 'Canonical FieldDive work-schedule truth. Calendar/Job Card/Board read this table. One active kind=work status=scheduled row per Job. Cancelled rows are historical and immutable.';



COMMENT ON COLUMN "public"."job_schedules"."starts_on" IS 'Inclusive civil start date in the schedule timezone. Not midnight UTC.';



COMMENT ON COLUMN "public"."job_schedules"."ends_on" IS 'Inclusive civil end date in the schedule timezone.';



COMMENT ON COLUMN "public"."job_schedules"."range_start_at" IS 'Derived timestamptz for indexed Calendar overlap queries. Not independent truth.';



COMMENT ON COLUMN "public"."job_schedules"."range_end_at" IS 'Derived timestamptz. All-day: exclusive start of the day after ends_on. Timed: exclusive of nothing — actual end instant.';



CREATE OR REPLACE FUNCTION "public"."job_schedule_row_json"("p_row" "public"."job_schedules") RETURNS "jsonb"
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  select jsonb_build_object(
    'id', p_row.id,
    'company_id', p_row.company_id,
    'job_id', p_row.job_id,
    'kind', p_row.kind,
    'status', p_row.status,
    'timezone', p_row.timezone,
    'all_day', p_row.all_day,
    'starts_on', p_row.starts_on,
    'ends_on', p_row.ends_on,
    'start_local_time', p_row.start_local_time,
    'end_local_time', p_row.end_local_time,
    'range_start_at', p_row.range_start_at,
    'range_end_at', p_row.range_end_at,
    'notes', p_row.notes,
    'created_by_user_id', p_row.created_by_user_id,
    'updated_by_user_id', p_row.updated_by_user_id,
    'created_at', p_row.created_at,
    'updated_at', p_row.updated_at,
    'cancelled_at', p_row.cancelled_at,
    'row_version', p_row.row_version
  );
$$;


ALTER FUNCTION "public"."job_schedule_row_json"("p_row" "public"."job_schedules") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."job_schedule_validate_window"("p_timezone" "text", "p_all_day" boolean, "p_starts_on" "date", "p_ends_on" "date", "p_start_local_time" time without time zone, "p_end_local_time" time without time zone) RETURNS "text"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public'
    AS $$
declare
  v_range record;
begin
  if not public.job_schedule_is_iana_timezone(p_timezone) then
    return 'invalid_timezone';
  end if;
  if p_starts_on is null or p_ends_on is null then
    return 'invalid_window';
  end if;
  if p_ends_on < p_starts_on then
    return 'invalid_window';
  end if;
  if p_all_day then
    if p_start_local_time is not null or p_end_local_time is not null then
      return 'invalid_window';
    end if;
  else
    if p_start_local_time is null or p_end_local_time is null then
      return 'invalid_window';
    end if;
    if p_starts_on = p_ends_on and p_end_local_time <= p_start_local_time then
      return 'invalid_window';
    end if;
  end if;

  select * into v_range
  from public.job_schedule_derive_range(
    p_timezone,
    p_all_day,
    p_starts_on,
    p_ends_on,
    p_start_local_time,
    p_end_local_time
  );

  if v_range.range_end_at <= v_range.range_start_at then
    return 'invalid_window';
  end if;

  return null;
end;
$$;


ALTER FUNCTION "public"."job_schedule_validate_window"("p_timezone" "text", "p_all_day" boolean, "p_starts_on" "date", "p_ends_on" "date", "p_start_local_time" time without time zone, "p_end_local_time" time without time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."job_schedule_window_json"("p_all_day" boolean, "p_starts_on" "date", "p_ends_on" "date", "p_start_local_time" time without time zone, "p_end_local_time" time without time zone, "p_timezone" "text", "p_notes" "text") RETURNS "jsonb"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  select jsonb_build_object(
    'all_day', p_all_day,
    'starts_on', p_starts_on,
    'ends_on', p_ends_on,
    'start_local_time', p_start_local_time,
    'end_local_time', p_end_local_time,
    'timezone', p_timezone,
    'notes', p_notes
  );
$$;


ALTER FUNCTION "public"."job_schedule_window_json"("p_all_day" boolean, "p_starts_on" "date", "p_ends_on" "date", "p_start_local_time" time without time zone, "p_end_local_time" time without time zone, "p_timezone" "text", "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."job_schedule_windows_equal"("p_a" "public"."job_schedules", "p_all_day" boolean, "p_starts_on" "date", "p_ends_on" "date", "p_start_local_time" time without time zone, "p_end_local_time" time without time zone, "p_notes" "text") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  select
    p_a.all_day is not distinct from p_all_day
    and p_a.starts_on is not distinct from p_starts_on
    and p_a.ends_on is not distinct from p_ends_on
    and p_a.start_local_time is not distinct from p_start_local_time
    and p_a.end_local_time is not distinct from p_end_local_time
    and p_a.notes is not distinct from p_notes;
$$;


ALTER FUNCTION "public"."job_schedule_windows_equal"("p_a" "public"."job_schedules", "p_all_day" boolean, "p_starts_on" "date", "p_ends_on" "date", "p_start_local_time" time without time zone, "p_end_local_time" time without time zone, "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."job_schedules_before_write"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_range record;
  v_error text;
begin
  if tg_op = 'UPDATE' and old.status = 'cancelled' then
    raise exception 'cancelled job_schedules rows are immutable and must not be revived'
      using errcode = 'P0001';
  end if;

  if new.kind is distinct from 'work' then
    raise exception 'job_schedules.kind must be work'
      using errcode = 'P0001';
  end if;

  if new.notes is not null then
    new.notes := nullif(trim(new.notes), '');
  end if;

  v_error := public.job_schedule_validate_window(
    new.timezone,
    new.all_day,
    new.starts_on,
    new.ends_on,
    new.start_local_time,
    new.end_local_time
  );
  if v_error is not null then
    raise exception 'job_schedules window is invalid: %', v_error
      using errcode = 'P0001';
  end if;

  select * into v_range
  from public.job_schedule_derive_range(
    new.timezone,
    new.all_day,
    new.starts_on,
    new.ends_on,
    new.start_local_time,
    new.end_local_time
  );
  new.range_start_at := v_range.range_start_at;
  new.range_end_at := v_range.range_end_at;
  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION "public"."job_schedules_before_write"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."job_tasks_before_write"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  job_company uuid;
begin
  select j.company_id into job_company
  from public.jobs j
  where j.id = new.job_id;

  if job_company is null then
    raise exception 'job_tasks job not found';
  end if;

  if job_company is distinct from new.company_id then
    raise exception 'job_tasks company_id must match jobs.company_id';
  end if;

  if new.status = 'open' then
    new.completed_at := null;
    new.completed_by := null;
  elsif new.status = 'complete' then
    if tg_op = 'INSERT' or old.status is distinct from 'complete' then
      new.completed_at := now();
    elsif new.completed_at is distinct from old.completed_at
       or new.completed_by is distinct from old.completed_by then
      raise exception 'job_tasks completion fields are immutable while complete';
    end if;
  end if;

  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id
       or new.company_id is distinct from old.company_id
       or new.job_id is distinct from old.job_id
       or new.created_by is distinct from old.created_by then
      raise exception 'job_tasks identity fields are immutable';
    end if;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."job_tasks_before_write"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."jobs_job_complete_guard"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_allow_complete boolean :=
    current_setting('job_lifecycle.allow_job_complete_write', true) = '1';
begin
  if tg_op = 'INSERT' then
    if new.completed_at is not null then
      raise exception 'new jobs cannot have completed_at'
        using errcode = 'P0001';
    end if;
    return new;
  end if;

  if new.completed_at is distinct from old.completed_at then
    if old.completed_at is not null then
      raise exception 'jobs.completed_at is immutable'
        using errcode = 'P0001';
    end if;

    if not v_allow_complete then
      raise exception 'jobs.completed_at may only be set by complete_job_work_v1'
        using errcode = 'P0001';
    end if;

    if old.stage is distinct from 'production'
       or new.stage is distinct from 'complete'
       or new.completed_at is null
       or new.production_started_at is null
       or new.completed_at < new.production_started_at
    then
      raise exception 'jobs.completed_at requires Production -> Complete'
        using errcode = 'P0001';
    end if;
  end if;

  if (
    new.stage = 'complete'
    and (
      new.completed_at is null
      or new.production_started_at is null
      or new.completed_at < new.production_started_at
    )
  ) or (
    new.stage is distinct from 'complete'
    and new.completed_at is not null
  ) then
    raise exception 'jobs.stage and completed_at are inconsistent'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."jobs_job_complete_guard"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."jobs_lifecycle_after_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  perform public.job_lifecycle_insert_activity(
    new.company_id,
    new.id,
    'job_created',
    coalesce(new.created_by, auth.uid()),
    jsonb_build_object('stage', new.stage, 'status', new.status),
    coalesce(new.created_at, now())
  );
  return new;
end;
$$;


ALTER FUNCTION "public"."jobs_lifecycle_after_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."jobs_lifecycle_after_update"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_from text;
begin
  -- AUTO Activity only. RPC transitions write Activity themselves after UPDATE.
  -- Do not key this off the session GUC: that GUC is client-settable.
  if new.stage is distinct from old.stage
     and old.active_proposal_id is null
     and new.active_proposal_id is not null
     and new.stage = 'proposal'
     and public.job_lifecycle_has_proposal_truth(
       new.company_id,
       new.id,
       new.active_proposal_id
     )
  then
    v_from := public.canonical_job_stage_from_row(
      old.stage,
      old.status,
      coalesce(old.archived, false),
      old.active_proposal_id,
      old.latest_proposal_id
    );
    if v_from = 'intake' then
      perform public.job_lifecycle_insert_activity(
        new.company_id,
        new.id,
        'stage_changed',
        auth.uid(),
        jsonb_build_object(
          'from_stage', v_from,
          'to_stage', 'proposal',
          'reason', 'first_proposal_created',
          'mode', 'auto',
          'active_proposal_id', new.active_proposal_id
        ),
        now()
      );
    end if;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."jobs_lifecycle_after_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."jobs_lifecycle_before_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  -- Legacy callers may still INSERT measurement/estimating; canonicalize to Intake.
  -- Existing stored rows are not rewritten: this trigger is INSERT-only.
  if new.stage in ('measurement', 'estimating') then
    new.stage := 'intake';
  end if;

  if new.stage is distinct from 'intake' then
    raise exception 'new jobs must start in intake'
      using errcode = 'P0001';
  end if;

  if new.status in ('won', 'archived') then
    raise exception 'jobs.status write target % is not an operational disposition', new.status
      using errcode = 'P0001';
  end if;

  -- New canonical jobs start in Intake with a truthful clock.
  if new.stage = 'intake' and new.stage_entered_at is null then
    new.stage_entered_at := coalesce(new.created_at, now());
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."jobs_lifecycle_before_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."jobs_lifecycle_before_update"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_from text;
  v_allow_stage boolean :=
    current_setting('job_lifecycle.allow_stage_write', true) = '1';
  v_allow_status boolean :=
    current_setting('job_lifecycle.allow_status_write', true) = '1';
  v_auto_first_proposal boolean := false;
begin
  v_from := public.canonical_job_stage_from_row(
    old.stage,
    old.status,
    coalesce(old.archived, false),
    old.active_proposal_id,
    old.latest_proposal_id
  );

  -- A. approved lifecycle RPC: transition_job_stage_v1 sets
  --    job_lifecycle.allow_stage_write=1 (transaction-local) then UPDATE.
  --    Column UPDATE(stage, stage_entered_at) is revoked from authenticated
  --    and service_role, so a client cannot spoof the GUC and SET stage.
  -- B. first-proposal AUTO: OLD.active_proposal_id IS NULL AND NEW pointer
  --    set AND canonical read = Intake. Mutates NEW (no second UPDATE).
  -- C. unauthorized direct UPDATE of stage / stage_entered_at / status:
  --    rejected here, and also denied by column privileges.
  if old.active_proposal_id is null
     and new.active_proposal_id is not null
     and v_from = 'intake'
     and public.job_lifecycle_has_proposal_truth(
       new.company_id,
       new.id,
       new.active_proposal_id
     )
  then
    v_auto_first_proposal := true;
    new.stage := 'proposal';
    new.stage_entered_at := now();
  end if;

  if new.stage is distinct from old.stage then
    if not v_allow_stage and not v_auto_first_proposal then
      raise exception 'jobs.stage may only change via transition_job_stage_v1'
        using errcode = 'P0001';
    end if;
    if new.stage not in (
      'intake',
      'proposal',
      'approved',
      'scheduled',
      'production',
      'complete'
    ) then
      raise exception 'jobs.stage write target % is not canonical', new.stage
        using errcode = 'P0001';
    end if;
  end if;

  if new.stage_entered_at is distinct from old.stage_entered_at
     and not v_allow_stage
     and not v_auto_first_proposal
  then
    raise exception 'jobs.stage_entered_at may only change via transition_job_stage_v1'
      using errcode = 'P0001';
  end if;

  if new.status is distinct from old.status then
    if not v_allow_status then
      raise exception 'jobs.status may only change via change_job_disposition_v1'
        using errcode = 'P0001';
    end if;
    if new.status not in ('active', 'on_hold', 'lost', 'closed') then
      raise exception 'jobs.status write target % is not an operational disposition', new.status
        using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."jobs_lifecycle_before_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."jobs_production_start_guard"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_allow_start boolean :=
    current_setting('job_lifecycle.allow_production_start_write', true) = '1';
begin
  if tg_op = 'INSERT' then
    if new.production_started_at is not null then
      raise exception 'new jobs cannot have production_started_at'
        using errcode = 'P0001';
    end if;
    return new;
  end if;

  if new.production_started_at is distinct from old.production_started_at then
    if old.production_started_at is not null then
      raise exception 'jobs.production_started_at is immutable'
        using errcode = 'P0001';
    end if;

    if not v_allow_start then
      raise exception 'jobs.production_started_at may only be set by start_job_work_v1'
        using errcode = 'P0001';
    end if;

    if old.stage is distinct from 'scheduled'
       or new.stage is distinct from 'production'
       or new.production_started_at is null
    then
      raise exception 'jobs.production_started_at requires Scheduled -> Production'
        using errcode = 'P0001';
    end if;
  end if;

  if (
    new.stage in ('production', 'complete')
    and new.production_started_at is null
  ) or (
    new.stage not in ('production', 'complete')
    and new.production_started_at is not null
  ) then
    raise exception 'jobs.stage and production_started_at are inconsistent'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."jobs_production_start_guard"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_job_attention_read_v1"("p_attention_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_attention public.job_attention_items%rowtype;
  v_read_at timestamptz;
  v_last_viewed_at timestamptz := now();
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;

  if p_attention_id is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_attention_id');
  end if;

  select ai.*
  into v_attention
  from public.job_attention_items ai
  where ai.id = p_attention_id
    and exists (
      select 1
      from public.company_memberships cm
      where cm.company_id = ai.company_id
        and cm.user_id = v_uid
    );

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  insert into public.job_attention_user_state (
    company_id,
    attention_item_id,
    user_id,
    read_at,
    last_viewed_at
  ) values (
    v_attention.company_id,
    v_attention.id,
    v_uid,
    v_last_viewed_at,
    v_last_viewed_at
  )
  on conflict (company_id, attention_item_id, user_id)
  do update set
    read_at = coalesce(public.job_attention_user_state.read_at, excluded.read_at),
    last_viewed_at = excluded.last_viewed_at
  returning read_at into v_read_at;

  return jsonb_build_object(
    'ok', true,
    'attention_id', v_attention.id,
    'user_id', v_uid,
    'read_at', v_read_at,
    'last_viewed_at', v_last_viewed_at,
    'attention_status_unchanged', v_attention.status,
    'request_status_unchanged', (
      select r.status
      from public.proposal_customer_requests r
      where r.id = v_attention.source_id
        and v_attention.source_type = 'proposal_customer_requests'
    )
  );
end;
$$;


ALTER FUNCTION "public"."mark_job_attention_read_v1"("p_attention_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mint_and_supersede_proposal_public_access_token_v1"("p_token_hash" "text", "p_token_prefix" "text", "p_company_id" "uuid", "p_proposal_id" "uuid", "p_proposal_version_id" "uuid", "p_expires_at" timestamp with time zone, "p_recipient_email_hash" "text" DEFAULT NULL::"text", "p_recipient_phone_hash" "text" DEFAULT NULL::"text", "p_metadata_json" "jsonb" DEFAULT '{}'::"jsonb", "p_created_by" "uuid" DEFAULT NULL::"uuid", "p_purpose" "text" DEFAULT 'customer_view'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
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
$_$;


ALTER FUNCTION "public"."mint_and_supersede_proposal_public_access_token_v1"("p_token_hash" "text", "p_token_prefix" "text", "p_company_id" "uuid", "p_proposal_id" "uuid", "p_proposal_version_id" "uuid", "p_expires_at" timestamp with time zone, "p_recipient_email_hash" "text", "p_recipient_phone_hash" "text", "p_metadata_json" "jsonb", "p_created_by" "uuid", "p_purpose" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."mint_and_supersede_proposal_public_access_token_v1"("p_token_hash" "text", "p_token_prefix" "text", "p_company_id" "uuid", "p_proposal_id" "uuid", "p_proposal_version_id" "uuid", "p_expires_at" timestamp with time zone, "p_recipient_email_hash" "text", "p_recipient_phone_hash" "text", "p_metadata_json" "jsonb", "p_created_by" "uuid", "p_purpose" "text") IS 'Stage C4 — Transactionally mint an email-send customer token for the current latest immutable sent version and supersede active email-send tokens bound to older versions only. Same-version tokens remain active. service_role only; never accepts or returns a raw token or returns token_hash.';



CREATE OR REPLACE FUNCTION "public"."mint_proposal_public_access_token_v1"("p_token_hash" "text", "p_token_prefix" "text", "p_company_id" "uuid", "p_proposal_id" "uuid", "p_proposal_version_id" "uuid", "p_expires_at" timestamp with time zone, "p_recipient_email_hash" "text" DEFAULT NULL::"text", "p_recipient_phone_hash" "text" DEFAULT NULL::"text", "p_metadata_json" "jsonb" DEFAULT '{}'::"jsonb", "p_created_by" "uuid" DEFAULT NULL::"uuid", "p_purpose" "text" DEFAULT 'customer_view'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
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
$_$;


ALTER FUNCTION "public"."mint_proposal_public_access_token_v1"("p_token_hash" "text", "p_token_prefix" "text", "p_company_id" "uuid", "p_proposal_id" "uuid", "p_proposal_version_id" "uuid", "p_expires_at" timestamp with time zone, "p_recipient_email_hash" "text", "p_recipient_phone_hash" "text", "p_metadata_json" "jsonb", "p_created_by" "uuid", "p_purpose" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."mint_proposal_public_access_token_v1"("p_token_hash" "text", "p_token_prefix" "text", "p_company_id" "uuid", "p_proposal_id" "uuid", "p_proposal_version_id" "uuid", "p_expires_at" timestamp with time zone, "p_recipient_email_hash" "text", "p_recipient_phone_hash" "text", "p_metadata_json" "jsonb", "p_created_by" "uuid", "p_purpose" "text") IS 'Stage C4 Phase A compatibility mint. Known QA/send-prep sources receive a durable token_category; email-send source routes to transactional C4 mint + older-version supersession; unknown legacy sources remain category null. service_role only; never accepts or returns a raw token or returns token_hash.';



CREATE OR REPLACE FUNCTION "public"."normalize_property_address_v1"("p_line1" "text", "p_line2" "text", "p_city" "text", "p_state" "text", "p_zip" "text", "p_formatted" "text" DEFAULT NULL::"text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
declare
  line1 text;
  line2 text;
  city text;
  state text;
  zip5 text;
begin
  line1 := public.normalize_property_line_v1(coalesce(nullif(trim(p_line1), ''), p_formatted));
  line2 := public.normalize_property_line_v1(p_line2);
  city := public.normalize_property_line_v1(p_city);
  state := public.normalize_property_line_v1(p_state);
  zip5 := left(regexp_replace(coalesce(p_zip, ''), '[^0-9]', '', 'g'), 5);
  if line1 = '' then
    return '';
  end if;
  -- Street-like: require a letter and a digit so ZIP-only / city-only rows are not Properties.
  if line1 !~ '[a-z]' or line1 !~ '[0-9]' then
    return '';
  end if;
  return line1 || '|' || line2 || '|' || city || '|' || state || '|' || zip5;
end;
$$;


ALTER FUNCTION "public"."normalize_property_address_v1"("p_line1" "text", "p_line2" "text", "p_city" "text", "p_state" "text", "p_zip" "text", "p_formatted" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalize_property_line_v1"("p_line" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
declare
  cleaned text;
  part text;
  out_text text := '';
begin
  cleaned := lower(trim(regexp_replace(coalesce(p_line, ''), '[.,#''\"]+', ' ', 'g')));
  cleaned := trim(regexp_replace(cleaned, '\s+', ' ', 'g'));
  if cleaned = '' then
    return '';
  end if;
  foreach part in array string_to_array(cleaned, ' ')
  loop
    part := public.normalize_property_token_v1(part);
    part := regexp_replace(part, '[^a-z0-9]', '', 'g');
    if part <> '' then
      if out_text = '' then
        out_text := part;
      else
        out_text := out_text || ' ' || part;
      end if;
    end if;
  end loop;
  return out_text;
end;
$$;


ALTER FUNCTION "public"."normalize_property_line_v1"("p_line" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalize_property_token_v1"("p_token" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select case lower(trim(coalesce(p_token, '')))
    when 'n' then 'north'
    when 's' then 'south'
    when 'e' then 'east'
    when 'w' then 'west'
    when 'ne' then 'northeast'
    when 'nw' then 'northwest'
    when 'se' then 'southeast'
    when 'sw' then 'southwest'
    when 'st' then 'street'
    when 'str' then 'street'
    when 'ave' then 'avenue'
    when 'av' then 'avenue'
    when 'blvd' then 'boulevard'
    when 'rd' then 'road'
    when 'dr' then 'drive'
    when 'ln' then 'lane'
    when 'ct' then 'court'
    when 'cir' then 'circle'
    when 'hwy' then 'highway'
    when 'pkwy' then 'parkway'
    when 'pl' then 'place'
    when 'ter' then 'terrace'
    when 'terr' then 'terrace'
    else lower(trim(coalesce(p_token, '')))
  end;
$$;


ALTER FUNCTION "public"."normalize_property_token_v1"("p_token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."open_job_deposit_from_acceptance_v1"("p_payload" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_company_id uuid;
  v_acceptance_id uuid;
  v_acceptance public.proposal_acceptances%rowtype;
  v_contract_option_id uuid;
  v_contract_option_label text;
  v_contract_total_cents integer;
  v_contract_customer_chose boolean := false;
  v_created_by_user_id uuid;
  v_job public.jobs%rowtype;
  v_terms public.proposal_version_payment_terms%rowtype;
  v_account public.company_payment_accounts%rowtype;
  v_existing public.job_payment_requests%rowtype;
  v_failed public.job_payment_requests%rowtype;
  v_request public.job_payment_requests%rowtype;
  v_amount integer;
  v_signature_id uuid;
  v_before_stage text;
  v_before_entered timestamptz;
  v_after_stage text;
  v_after_entered timestamptz;
begin
  begin
    v_company_id := nullif(p_payload->>'company_id', '')::uuid;
    v_acceptance_id := nullif(p_payload->>'acceptance_id', '')::uuid;
  exception when others then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end;

  if v_company_id is null or v_acceptance_id is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  select a.*
  into v_acceptance
  from public.proposal_acceptances a
  where a.id = v_acceptance_id
    and a.company_id = v_company_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'no_acceptance');
  end if;

  if exists (
    select 1
    from public.proposal_acceptances later
    where later.company_id = v_company_id
      and later.job_id = v_acceptance.job_id
      and later.accepted_at > v_acceptance.accepted_at
  ) then
    return jsonb_build_object('ok', false, 'code', 'superseded');
  end if;

  select c.option_id, c.option_label, c.customer_chose
  into
    v_contract_option_id,
    v_contract_option_label,
    v_contract_customer_chose
  from public.proposal_acceptance_contract_option_v1(v_company_id, v_acceptance_id) c;

  v_contract_total_cents := public.proposal_acceptance_contract_total_cents_v1(
    v_company_id,
    v_acceptance_id
  );

  if v_contract_option_id is null or v_contract_total_cents is null then
    return jsonb_build_object('ok', false, 'code', 'no_acceptance');
  end if;

  v_created_by_user_id := v_acceptance.confirmed_by_user_id;

  if v_created_by_user_id is null then
    select cm.user_id
    into v_created_by_user_id
    from public.company_memberships cm
    where cm.company_id = v_company_id
    order by cm.created_at asc
    limit 1;
  end if;

  if v_created_by_user_id is null then
    return jsonb_build_object('ok', false, 'code', 'no_actor');
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'job_payment_request:' || v_company_id::text || ':' || v_acceptance.job_id::text,
      0
    )
  );

  select j.*
  into v_job
  from public.jobs j
  where j.id = v_acceptance.job_id
    and j.company_id = v_company_id
  for update;

  if not found
    or coalesce(v_job.archived, false)
    or coalesce(v_job.status, 'active') <> 'active'
  then
    return jsonb_build_object('ok', false, 'code', 'job_not_active');
  end if;

  select s.job_stage, s.stage_entered_at
  into v_before_stage, v_before_entered
  from public.job_payment_snapshot_stage_v1(v_company_id, v_acceptance.job_id) s;

  -- Stale open requests on a prior acceptance must not remain payable after
  -- the latest acceptance. Do not cancel processing. Do not mutate failed.
  update public.job_payment_requests
  set
    status = 'cancelled',
    cancelled_at = coalesce(cancelled_at, now())
  where company_id = v_company_id
    and job_id = v_acceptance.job_id
    and status = 'open'
    and proposal_acceptance_id is distinct from v_acceptance.id;

  select t.*
  into v_terms
  from public.proposal_version_payment_terms t
  where t.proposal_version_id = v_acceptance.proposal_version_id
    and t.company_id = v_company_id;

  if not found or v_terms.deposit_mode = 'none' then
    return jsonb_build_object('ok', true, 'skipped', true, 'code', 'no_deposit');
  end if;

  v_amount := public.job_payment_uncovered_deposit_cents_v1(
    v_company_id,
    v_acceptance.job_id,
    v_terms.deposit_mode,
    v_terms.deposit_percent_bps,
    v_terms.deposit_fixed_cents,
    v_contract_total_cents
  );

  if v_amount < 100 then
    return jsonb_build_object('ok', true, 'skipped', true, 'code', 'deposit_satisfied');
  end if;

  select r.*
  into v_existing
  from public.job_payment_requests r
  where r.company_id = v_company_id
    and r.job_id = v_acceptance.job_id
    and r.proposal_acceptance_id = v_acceptance.id
    and r.kind = 'deposit'
    and r.status in ('open', 'processing')
  limit 1;

  if found then
    return jsonb_build_object(
      'ok', true,
      'id', v_existing.id,
      'amount_cents', v_existing.amount_cents,
      'idempotent_replay', true,
      'skipped', false
    );
  end if;

  select r.*
  into v_existing
  from public.job_payment_requests r
  where r.company_id = v_company_id
    and r.job_id = v_acceptance.job_id
    and r.status in ('open', 'processing')
  limit 1;

  if found then
    return jsonb_build_object('ok', false, 'code', 'conflicting_request');
  end if;

  select a.*
  into v_account
  from public.company_payment_accounts a
  where a.company_id = v_company_id
    and a.provider = 'stripe'
  for update;

  if not found or not v_account.charges_enabled then
    return jsonb_build_object('ok', false, 'code', 'not_connected');
  end if;

  select s.id
  into v_signature_id
  from public.proposal_signatures s
  where s.company_id = v_company_id
    and s.proposal_acceptance_id = v_acceptance.id
    and s.signer_slot = 'customer_primary'
  limit 1;

  begin
    insert into public.job_payment_requests (
      company_id,
      job_id,
      proposal_id,
      proposal_version_id,
      proposal_option_id,
      proposal_acceptance_id,
      proposal_signature_id,
      amount_cents,
      currency,
      kind,
      accepted_total_cents_snapshot,
      option_label_snapshot,
      provider,
      provider_account_id,
      status,
      created_by_user_id
    )
    values (
      v_company_id,
      v_acceptance.job_id,
      v_acceptance.proposal_id,
      v_acceptance.proposal_version_id,
      v_contract_option_id,
      v_acceptance.id,
      v_signature_id,
      v_amount,
      'usd',
      'deposit',
      v_contract_total_cents,
      left(trim(v_contract_option_label), 120),
      'stripe',
      v_account.provider_account_id,
      'open',
      v_created_by_user_id
    )
    returning * into v_request;
  exception
    when unique_violation then
      select r.*
      into v_existing
      from public.job_payment_requests r
      where r.company_id = v_company_id
        and r.job_id = v_acceptance.job_id
        and r.status in ('open', 'processing')
      limit 1;

      if found
        and v_existing.kind = 'deposit'
        and v_existing.proposal_acceptance_id = v_acceptance.id
      then
        return jsonb_build_object(
          'ok', true,
          'id', v_existing.id,
          'amount_cents', v_existing.amount_cents,
          'idempotent_replay', true,
          'skipped', false
        );
      end if;

      return jsonb_build_object('ok', false, 'code', 'conflicting_request');
  end;

  select r.*
  into v_failed
  from public.job_payment_requests r
  where r.company_id = v_company_id
    and r.job_id = v_acceptance.job_id
    and r.kind = 'deposit'
    and r.status = 'failed'
    and r.proposal_acceptance_id = v_acceptance.id
    and r.id is distinct from v_request.id
  order by r.requested_at desc
  limit 1;

  if found then
    perform public.job_payment_resolve_attention_v1(
      v_company_id,
      'payment_failed:job_payment_requests:' || v_failed.id::text
    );
  end if;

  select s.job_stage, s.stage_entered_at
  into v_after_stage, v_after_entered
  from public.job_payment_snapshot_stage_v1(v_company_id, v_acceptance.job_id) s;

  if v_after_stage is distinct from v_before_stage
    or v_after_entered is distinct from v_before_entered
  then
    raise exception 'job payment request must not change job stage';
  end if;

  return jsonb_build_object(
    'ok', true,
    'id', v_request.id,
    'amount_cents', v_request.amount_cents,
    'customer_chose_option', coalesce(v_contract_customer_chose, false),
    'idempotent_replay', false,
    'skipped', false,
    'job_stage_unchanged', true
  );
end;
$$;


ALTER FUNCTION "public"."open_job_deposit_from_acceptance_v1"("p_payload" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."open_job_deposit_from_acceptance_v1"("p_payload" "jsonb") IS 'Sole canonical deposit writer. Amount = uncovered obligation (053 contract total, 053 gross, 054 collectible). Failed is not revived in place; a retry inserts a new open row. Replay open/processing for the same acceptance. Other active kinds return conflicting_request. NEVER writes jobs.stage.';



CREATE OR REPLACE FUNCTION "public"."payments_prevent_company_id_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if tg_op = 'UPDATE' and new.company_id is distinct from old.company_id then
    raise exception 'payments.company_id is immutable';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."payments_prevent_company_id_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."persist_draft_pricing_refresh_v1"("p_payload" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_company_id uuid;
  v_proposal_id uuid;
  v_version_id uuid;
  v_proposal_status text;
  v_version_kind text;
  v_current_draft_version_id uuid;
  opt jsonb;
  v_option_id uuid;
  line jsonb;
  v_stamp jsonb;
  v_event jsonb;
begin
  v_company_id := nullif(trim(p_payload->>'company_id'), '')::uuid;
  v_proposal_id := nullif(trim(p_payload->>'proposal_id'), '')::uuid;
  v_version_id := nullif(trim(p_payload->>'proposal_version_id'), '')::uuid;

  if v_company_id is null or v_proposal_id is null or v_version_id is null then
    raise exception 'company_id, proposal_id, and proposal_version_id are required UUIDs';
  end if;

  select p.status, p.current_draft_version_id
    into v_proposal_status, v_current_draft_version_id
  from public.proposals p
  where p.id = v_proposal_id
    and p.company_id = v_company_id
  for update;

  if not found then
    raise exception 'Proposal not found for company';
  end if;

  if v_proposal_status <> 'draft' then
    raise exception 'Proposal is not in draft status';
  end if;

  if v_current_draft_version_id is distinct from v_version_id then
    raise exception 'proposal_version_id is not the current draft version';
  end if;

  select pv.version_kind
    into v_version_kind
  from public.proposal_versions pv
  where pv.id = v_version_id
    and pv.company_id = v_company_id
    and pv.proposal_id = v_proposal_id
  for update;

  if not found then
    raise exception 'Draft version not found for proposal';
  end if;

  if v_version_kind <> 'draft' then
    raise exception 'Version is not a mutable draft';
  end if;

  for opt in
    select value
    from jsonb_array_elements(coalesce(p_payload->'options', '[]'::jsonb))
  loop
    v_option_id := nullif(trim(opt->>'proposal_option_id'), '')::uuid;

    if v_option_id is null then
      raise exception 'Each option payload requires proposal_option_id';
    end if;

    if not exists (
      select 1
      from public.proposal_options po
      where po.id = v_option_id
        and po.company_id = v_company_id
        and po.proposal_version_id = v_version_id
    ) then
      raise exception 'proposal_option_id % does not belong to draft version', v_option_id;
    end if;

    update public.proposal_options
    set
      customer_subtotal_cents = nullif(opt->'pricing'->>'customer_subtotal_cents', '')::integer,
      discount_cents = coalesce(nullif(opt->'pricing'->>'discount_cents', '')::integer, 0),
      sales_tax_cents = coalesce(nullif(opt->'pricing'->>'sales_tax_cents', '')::integer, 0),
      customer_total_cents = nullif(opt->'pricing'->>'customer_total_cents', '')::integer,
      pricing_complete = coalesce((opt->'pricing'->>'pricing_complete')::boolean, false),
      blocking_line_count = coalesce(nullif(opt->'pricing'->>'blocking_line_count', '')::integer, 0),
      guardrail_outcome = coalesce(nullif(opt->'pricing'->>'guardrail_outcome', ''), 'pass')
    where id = v_option_id
      and company_id = v_company_id;

    delete from public.proposal_line_items
    where company_id = v_company_id
      and proposal_option_id = v_option_id;

    delete from public.proposal_internal_summaries
    where company_id = v_company_id
      and proposal_option_id = v_option_id;

    for line in
      select value
      from jsonb_array_elements(coalesce(opt->'line_items', '[]'::jsonb))
    loop
      insert into public.proposal_line_items (
        company_id,
        proposal_option_id,
        source_template_item_id,
        catalog_item_id,
        catalog_seed_key,
        composition_role,
        composition_slot_key,
        section_id,
        page_id,
        sort_order,
        customer_name,
        description,
        role,
        quantity,
        quantity_display_label,
        quantity_source_label,
        unit,
        customer_unit_price_cents,
        customer_line_total_cents,
        pricing_status,
        visible_to_customer,
        measurement_quantity_key,
        quantity_resolution_echo,
        upgrade_selection_state,
        upgrade_effect,
        replaces_source_template_item_id
      ) values (
        v_company_id,
        v_option_id,
        nullif(line->>'source_template_item_id', '')::uuid,
        nullif(line->>'catalog_item_id', '')::uuid,
        nullif(line->>'catalog_seed_key', ''),
        nullif(line->>'composition_role', ''),
        nullif(line->>'composition_slot_key', ''),
        nullif(line->>'section_id', '')::uuid,
        nullif(line->>'page_id', '')::uuid,
        coalesce(nullif(line->>'sort_order', '')::integer, 0),
        coalesce(nullif(line->>'customer_name', ''), 'Line item'),
        nullif(line->>'description', ''),
        nullif(line->>'role', ''),
        nullif(line->>'quantity', '')::numeric,
        nullif(line->>'quantity_display_label', ''),
        nullif(line->>'quantity_source_label', ''),
        nullif(line->>'unit', ''),
        nullif(line->>'customer_unit_price_cents', '')::integer,
        nullif(line->>'customer_line_total_cents', '')::integer,
        coalesce(nullif(line->>'pricing_status', ''), 'needs_quantity'),
        coalesce((line->>'visible_to_customer')::boolean, true),
        nullif(line->>'measurement_quantity_key', ''),
        case
          when jsonb_typeof(line->'quantity_resolution_echo') = 'object'
            then line->'quantity_resolution_echo'
          else null
        end,
        nullif(line->>'upgrade_selection_state', ''),
        nullif(line->>'upgrade_effect', ''),
        nullif(line->>'replaces_source_template_item_id', '')::uuid
      );
    end loop;

    if opt->'internal_summary' is not null
      and opt->'internal_summary' <> 'null'::jsonb
    then
      insert into public.proposal_internal_summaries (
        company_id,
        proposal_option_id,
        internal_cost_cents,
        internal_profit_cents,
        effective_margin_pct,
        policy_echo_json,
        computed_at
      ) values (
        v_company_id,
        v_option_id,
        nullif(opt->'internal_summary'->>'internal_cost_cents', '')::integer,
        nullif(opt->'internal_summary'->>'internal_profit_cents', '')::integer,
        nullif(opt->'internal_summary'->>'effective_margin_pct', '')::numeric,
        coalesce(opt->'internal_summary'->'policy_echo_json', '{}'::jsonb),
        coalesce(
          nullif(opt->'internal_summary'->>'computed_at', '')::timestamptz,
          now()
        )
      );
    end if;

    insert into public.proposal_option_upgrade_choices (
      company_id,
      proposal_id,
      proposal_version_id,
      proposal_option_id,
      source_template_item_id,
      selection_state,
      upgrade_effect,
      replaces_source_template_item_id
    )
    select
      v_company_id,
      v_proposal_id,
      v_version_id,
      v_option_id,
      nullif(trim(choice.value->>'source_template_item_id'), '')::uuid,
      nullif(trim(choice.value->>'selection_state'), ''),
      nullif(trim(choice.value->>'upgrade_effect'), ''),
      nullif(trim(choice.value->>'replaces_source_template_item_id'), '')::uuid
    from jsonb_array_elements(coalesce(opt->'upgrade_choices', '[]'::jsonb)) as choice(value)
    where nullif(trim(choice.value->>'source_template_item_id'), '') is not null
    on conflict (company_id, proposal_option_id, source_template_item_id)
    do update set
      selection_state = excluded.selection_state,
      upgrade_effect = excluded.upgrade_effect,
      replaces_source_template_item_id = excluded.replaces_source_template_item_id,
      proposal_id = excluded.proposal_id,
      proposal_version_id = excluded.proposal_version_id,
      updated_at = now();
  end loop;

  v_stamp := p_payload->'measurement_stamp';
  if v_stamp is not null and v_stamp <> 'null'::jsonb then
    update public.proposal_versions
    set context_echo = coalesce(v_stamp->'context_echo', '{}'::jsonb)
    where id = v_version_id
      and company_id = v_company_id
      and proposal_id = v_proposal_id;

    if v_stamp ? 'measurement_record_id' then
      update public.proposals
      set measurement_record_id = nullif(v_stamp->>'measurement_record_id', '')::uuid
      where id = v_proposal_id
        and company_id = v_company_id;
    end if;
  end if;

  v_event := p_payload->'event';
  if v_event is not null and v_event <> 'null'::jsonb then
    insert into public.proposal_events (
      company_id,
      proposal_id,
      proposal_version_id,
      event_type,
      actor_user_id,
      payload_json
    ) values (
      v_company_id,
      v_proposal_id,
      v_version_id,
      coalesce(nullif(v_event->>'event_type', ''), 'draft_saved'),
      null,
      coalesce(v_event->'payload_json', '{}'::jsonb)
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'proposal_id', v_proposal_id,
    'proposal_version_id', v_version_id,
    'option_count', jsonb_array_length(coalesce(p_payload->'options', '[]'::jsonb))
  );
end;
$$;


ALTER FUNCTION "public"."persist_draft_pricing_refresh_v1"("p_payload" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."persist_draft_pricing_refresh_v1"("p_payload" "jsonb") IS 'Atomically persists a pre-built draft pricing refresh payload (options, lines, summaries, upgrade choices upsert, measurement stamp, event). Draft-scoped triggers advance draft_content_changed_at. Does not change pricing math.';



CREATE OR REPLACE FUNCTION "public"."persist_draft_proposal_create_v1"("p_payload" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_company_id uuid;
  v_job_id uuid;
  v_customer_id uuid;
  v_template_id uuid;
  v_measurement_record_id uuid;
  v_pricing_policy_id uuid;
  v_title text;
  v_created_by uuid;
  v_proposal_id uuid;
  v_version_id uuid;
  v_selected_option_id uuid;
  v_selected_template_option_id uuid;
  v_page_count integer := 0;
  v_option_count integer := 0;
  page jsonb;
  opt jsonb;
  line jsonb;
  v_page_id uuid;
  v_option_id uuid;
  v_section_id uuid;
  v_section_to_page jsonb := '{}'::jsonb;
  v_template_to_option jsonb := '{}'::jsonb;
  v_event jsonb;
  v_set_job_active boolean;
begin
  v_company_id := nullif(trim(p_payload->>'company_id'), '')::uuid;
  v_job_id := nullif(trim(p_payload->>'job_id'), '')::uuid;
  v_template_id := nullif(trim(p_payload->>'template_id'), '')::uuid;
  v_pricing_policy_id := nullif(trim(p_payload->>'pricing_policy_id'), '')::uuid;

  if v_company_id is null or v_job_id is null or v_template_id is null or v_pricing_policy_id is null then
    raise exception 'company_id, job_id, template_id, and pricing_policy_id are required UUIDs';
  end if;

  v_customer_id := nullif(trim(p_payload->>'customer_id'), '')::uuid;
  v_measurement_record_id := nullif(trim(p_payload->>'measurement_record_id'), '')::uuid;
  v_created_by := nullif(trim(p_payload->>'created_by'), '')::uuid;
  v_title := nullif(trim(p_payload->>'title'), '');

  if jsonb_typeof(coalesce(p_payload->'context_echo', '{}'::jsonb)) <> 'object' then
    raise exception 'context_echo must be a JSON object';
  end if;

  if jsonb_typeof(coalesce(p_payload->'policy_echo', '{}'::jsonb)) <> 'object' then
    raise exception 'policy_echo must be a JSON object';
  end if;

  if jsonb_array_length(coalesce(p_payload->'pages', '[]'::jsonb)) = 0 then
    raise exception 'At least one page is required';
  end if;

  if jsonb_array_length(coalesce(p_payload->'options', '[]'::jsonb)) = 0 then
    raise exception 'At least one option is required';
  end if;

  if not exists (
    select 1
    from public.jobs j
    where j.id = v_job_id
      and j.company_id = v_company_id
  ) then
    raise exception 'Job not found for company';
  end if;

  if v_customer_id is not null and not exists (
    select 1
    from public.customers c
    where c.id = v_customer_id
      and c.company_id = v_company_id
  ) then
    raise exception 'Customer not found for company';
  end if;

  if not exists (
    select 1
    from public.proposal_templates pt
    where pt.id = v_template_id
      and pt.company_id = v_company_id
  ) then
    raise exception 'Template not found for company';
  end if;

  if not exists (
    select 1
    from public.company_pricing_policies cpp
    where cpp.id = v_pricing_policy_id
      and cpp.company_id = v_company_id
  ) then
    raise exception 'Pricing policy not found for company';
  end if;

  insert into public.proposals (
    company_id,
    job_id,
    customer_id,
    template_id,
    status,
    measurement_record_id,
    pricing_policy_id,
    title,
    created_by,
    draft_content_changed_at
  ) values (
    v_company_id,
    v_job_id,
    v_customer_id,
    v_template_id,
    'draft',
    v_measurement_record_id,
    v_pricing_policy_id,
    v_title,
    v_created_by,
    now()
  )
  returning id into v_proposal_id;

  insert into public.proposal_versions (
    company_id,
    proposal_id,
    version_number,
    version_kind,
    parent_version_id,
    frozen_at,
    context_echo,
    policy_echo,
    created_by
  ) values (
    v_company_id,
    v_proposal_id,
    1,
    'draft',
    null,
    null,
    coalesce(p_payload->'context_echo', '{}'::jsonb),
    coalesce(p_payload->'policy_echo', '{}'::jsonb),
    v_created_by
  )
  returning id into v_version_id;

  for page in
    select value
    from jsonb_array_elements(coalesce(p_payload->'pages', '[]'::jsonb))
  loop
    insert into public.proposal_pages (
      company_id,
      proposal_version_id,
      page_type,
      sort_order,
      title,
      customer_title,
      visible_to_customer,
      source_template_section_id,
      content_json,
      settings_json
    ) values (
      v_company_id,
      v_version_id,
      coalesce(nullif(page->>'page_type', ''), 'custom_text'),
      coalesce(nullif(page->>'sort_order', '')::integer, 0),
      coalesce(nullif(page->>'title', ''), 'Page'),
      nullif(page->>'customer_title', ''),
      coalesce((page->>'visible_to_customer')::boolean, true),
      nullif(page->>'source_template_section_id', '')::uuid,
      coalesce(page->'content_json', '{}'::jsonb),
      coalesce(page->'settings_json', '{}'::jsonb)
    )
    returning id into v_page_id;

    v_page_count := v_page_count + 1;

    if nullif(page->>'source_template_section_id', '') is not null then
      v_section_to_page := v_section_to_page || jsonb_build_object(
        nullif(page->>'source_template_section_id', ''),
        v_page_id::text
      );
    end if;
  end loop;

  for opt in
    select value
    from jsonb_array_elements(coalesce(p_payload->'options', '[]'::jsonb))
  loop
    if nullif(trim(opt->>'source_template_option_id'), '') is null then
      raise exception 'Each option payload requires source_template_option_id';
    end if;

    insert into public.proposal_options (
      company_id,
      proposal_version_id,
      source_template_option_id,
      name,
      customer_label,
      description,
      sort_order,
      is_default,
      visible_to_customer,
      customer_subtotal_cents,
      discount_cents,
      sales_tax_cents,
      customer_total_cents,
      pricing_complete,
      blocking_line_count,
      guardrail_outcome,
      selected_at
    ) values (
      v_company_id,
      v_version_id,
      nullif(opt->>'source_template_option_id', '')::uuid,
      coalesce(nullif(opt->>'name', ''), 'Option'),
      nullif(opt->>'customer_label', ''),
      nullif(opt->>'description', ''),
      coalesce(nullif(opt->>'sort_order', '')::integer, 0),
      coalesce((opt->>'is_default')::boolean, false),
      coalesce((opt->>'visible_to_customer')::boolean, true),
      nullif(opt->>'customer_subtotal_cents', '')::integer,
      coalesce(nullif(opt->>'discount_cents', '')::integer, 0),
      coalesce(nullif(opt->>'sales_tax_cents', '')::integer, 0),
      nullif(opt->>'customer_total_cents', '')::integer,
      coalesce((opt->>'pricing_complete')::boolean, false),
      coalesce(nullif(opt->>'blocking_line_count', '')::integer, 0),
      coalesce(nullif(opt->>'guardrail_outcome', ''), 'pass'),
      nullif(opt->>'selected_at', '')::timestamptz
    )
    returning id into v_option_id;

    v_option_count := v_option_count + 1;

    v_template_to_option := v_template_to_option || jsonb_build_object(
      opt->>'source_template_option_id',
      v_option_id::text
    );

    for line in
      select value
      from jsonb_array_elements(coalesce(opt->'line_items', '[]'::jsonb))
    loop
      v_section_id := nullif(line->>'section_id', '')::uuid;
      v_page_id := null;

      if v_section_id is not null then
        if v_section_to_page ? v_section_id::text then
          v_page_id := (v_section_to_page->>v_section_id::text)::uuid;
        else
          raise exception 'Line section_id % does not map to an inserted page', v_section_id;
        end if;
      end if;

      insert into public.proposal_line_items (
        company_id,
        proposal_option_id,
        source_template_item_id,
        catalog_item_id,
        catalog_seed_key,
        composition_role,
        composition_slot_key,
        section_id,
        page_id,
        sort_order,
        customer_name,
        description,
        role,
        quantity,
        quantity_display_label,
        quantity_source_label,
        unit,
        customer_unit_price_cents,
        customer_line_total_cents,
        pricing_status,
        visible_to_customer,
        measurement_quantity_key,
        quantity_resolution_echo,
        upgrade_selection_state,
        upgrade_effect,
        replaces_source_template_item_id
      ) values (
        v_company_id,
        v_option_id,
        nullif(line->>'source_template_item_id', '')::uuid,
        nullif(line->>'catalog_item_id', '')::uuid,
        nullif(line->>'catalog_seed_key', ''),
        nullif(line->>'composition_role', ''),
        nullif(line->>'composition_slot_key', ''),
        v_section_id,
        v_page_id,
        coalesce(nullif(line->>'sort_order', '')::integer, 0),
        coalesce(nullif(line->>'customer_name', ''), 'Line item'),
        nullif(line->>'description', ''),
        nullif(line->>'role', ''),
        nullif(line->>'quantity', '')::numeric,
        nullif(line->>'quantity_display_label', ''),
        nullif(line->>'quantity_source_label', ''),
        nullif(line->>'unit', ''),
        nullif(line->>'customer_unit_price_cents', '')::integer,
        nullif(line->>'customer_line_total_cents', '')::integer,
        coalesce(nullif(line->>'pricing_status', ''), 'needs_quantity'),
        coalesce((line->>'visible_to_customer')::boolean, true),
        nullif(line->>'measurement_quantity_key', ''),
        case
          when jsonb_typeof(line->'quantity_resolution_echo') = 'object'
            then line->'quantity_resolution_echo'
          else null
        end,
        nullif(line->>'upgrade_selection_state', ''),
        nullif(line->>'upgrade_effect', ''),
        nullif(line->>'replaces_source_template_item_id', '')::uuid
      );
    end loop;

    if opt->'internal_summary' is not null
      and opt->'internal_summary' <> 'null'::jsonb
    then
      insert into public.proposal_internal_summaries (
        company_id,
        proposal_option_id,
        internal_cost_cents,
        internal_profit_cents,
        effective_margin_pct,
        policy_echo_json,
        computed_at
      ) values (
        v_company_id,
        v_option_id,
        nullif(opt->'internal_summary'->>'internal_cost_cents', '')::integer,
        nullif(opt->'internal_summary'->>'internal_profit_cents', '')::integer,
        nullif(opt->'internal_summary'->>'effective_margin_pct', '')::numeric,
        coalesce(opt->'internal_summary'->'policy_echo_json', '{}'::jsonb),
        coalesce(
          nullif(opt->'internal_summary'->>'computed_at', '')::timestamptz,
          now()
        )
      );
    end if;

    insert into public.proposal_option_upgrade_choices (
      company_id,
      proposal_id,
      proposal_version_id,
      proposal_option_id,
      source_template_item_id,
      selection_state,
      upgrade_effect,
      replaces_source_template_item_id,
      created_by,
      updated_by
    )
    select
      v_company_id,
      v_proposal_id,
      v_version_id,
      v_option_id,
      nullif(trim(choice.value->>'source_template_item_id'), '')::uuid,
      nullif(trim(choice.value->>'selection_state'), ''),
      nullif(trim(choice.value->>'upgrade_effect'), ''),
      nullif(trim(choice.value->>'replaces_source_template_item_id'), '')::uuid,
      v_created_by,
      v_created_by
    from jsonb_array_elements(coalesce(opt->'upgrade_choices', '[]'::jsonb)) as choice(value)
    where nullif(trim(choice.value->>'source_template_item_id'), '') is not null;
  end loop;

  v_selected_template_option_id := nullif(trim(p_payload->>'selected_source_template_option_id'), '')::uuid;

  if v_selected_template_option_id is not null
    and v_template_to_option ? v_selected_template_option_id::text
  then
    v_selected_option_id := (v_template_to_option->>v_selected_template_option_id::text)::uuid;
  else
    select po.id
      into v_selected_option_id
    from public.proposal_options po
    where po.company_id = v_company_id
      and po.proposal_version_id = v_version_id
      and po.is_default = true
    order by po.sort_order
    limit 1;

    if v_selected_option_id is null then
      select po.id
        into v_selected_option_id
      from public.proposal_options po
      where po.company_id = v_company_id
        and po.proposal_version_id = v_version_id
      order by po.sort_order
      limit 1;
    end if;
  end if;

  update public.proposals
  set
    current_draft_version_id = v_version_id,
    selected_option_id = v_selected_option_id
  where id = v_proposal_id
    and company_id = v_company_id;

  v_event := p_payload->'event';
  if v_event is not null and v_event <> 'null'::jsonb then
    insert into public.proposal_events (
      company_id,
      proposal_id,
      proposal_version_id,
      event_type,
      actor_user_id,
      payload_json
    ) values (
      v_company_id,
      v_proposal_id,
      v_version_id,
      coalesce(nullif(v_event->>'event_type', ''), 'created'),
      nullif(v_event->>'actor_user_id', '')::uuid,
      coalesce(v_event->'payload_json', '{}'::jsonb)
    );
  end if;

  v_set_job_active := coalesce((p_payload->>'set_job_active_proposal')::boolean, false);
  if v_set_job_active then
    update public.jobs
    set active_proposal_id = v_proposal_id
    where id = v_job_id
      and company_id = v_company_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'proposal_id', v_proposal_id,
    'proposal_version_id', v_version_id,
    'selected_option_id', v_selected_option_id,
    'page_count', v_page_count,
    'option_count', v_option_count
  );
end;
$$;


ALTER FUNCTION "public"."persist_draft_proposal_create_v1"("p_payload" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."persist_draft_proposal_create_v1"("p_payload" "jsonb") IS 'Atomically persists a pre-built draft proposal create payload (proposal, version, pages, options, lines, summaries, upgrade choices, event). Initializes draft_content_changed_at = now().';



CREATE OR REPLACE FUNCTION "public"."persist_proposal_send_freeze_v1"("p_payload" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_company_id uuid;
  v_proposal_id uuid;
  v_draft_version_id uuid;
  v_sent_version_id uuid;
  v_version_number integer;
  v_frozen_at timestamptz;
  v_parent_version_id uuid;
  v_current_draft_version_id uuid;
  v_latest_sent_version_id uuid;
  v_signed_version_id uuid;
  v_draft_version_kind text;
  v_draft_frozen_at timestamptz;
  v_update_proposal_status text;
  page jsonb;
  opt jsonb;
  line jsonb;
  v_page_id uuid;
  v_option_id uuid;
  v_section_id uuid;
  v_line_page_id uuid;
  v_section_to_page jsonb := '{}'::jsonb;
  v_inserted_page_ids jsonb := '{}'::jsonb;
  v_page_count integer := 0;
  v_option_count integer := 0;
  v_event jsonb;
  v_forbidden_keys text[] := array[
    'public_token', 'token_hash', 'email', 'send',
    'scope_decisions', 'scopeDecisions', 'payment', 'signature', 'pdf'
  ];
  k text;
begin
  foreach k in array v_forbidden_keys loop
    if p_payload ? k then
      raise exception 'Forbidden send-freeze payload key: %', k;
    end if;
  end loop;

  v_company_id := nullif(trim(p_payload->>'company_id'), '')::uuid;
  v_proposal_id := nullif(trim(p_payload->>'proposal_id'), '')::uuid;
  v_draft_version_id := nullif(trim(p_payload->>'draft_version_id'), '')::uuid;
  v_sent_version_id := nullif(trim(p_payload->>'sent_version_id'), '')::uuid;
  v_version_number := nullif(trim(p_payload->>'version_number'), '')::integer;
  -- Caller frozen_at is ignored. The freeze transaction owns the timestamp.
  v_frozen_at := now();
  v_parent_version_id := nullif(trim(p_payload->>'parent_version_id'), '')::uuid;
  v_update_proposal_status := nullif(trim(p_payload->>'update_proposal_status'), '');

  if v_company_id is null
    or v_proposal_id is null
    or v_draft_version_id is null
    or v_sent_version_id is null
    or v_version_number is null
  then
    raise exception 'company_id, proposal_id, draft_version_id, sent_version_id, and version_number are required';
  end if;

  if coalesce(nullif(trim(p_payload->>'version_kind'), ''), 'sent') <> 'sent' then
    raise exception 'version_kind must be sent';
  end if;

  if v_parent_version_id is distinct from v_draft_version_id then
    raise exception 'parent_version_id must equal draft_version_id';
  end if;

  if jsonb_typeof(coalesce(p_payload->'context_echo', '{}'::jsonb)) <> 'object' then
    raise exception 'context_echo must be a JSON object';
  end if;

  if jsonb_typeof(coalesce(p_payload->'policy_echo', '{}'::jsonb)) <> 'object' then
    raise exception 'policy_echo must be a JSON object';
  end if;

  if jsonb_array_length(coalesce(p_payload->'pages', '[]'::jsonb)) = 0 then
    raise exception 'At least one page is required';
  end if;

  if jsonb_array_length(coalesce(p_payload->'options', '[]'::jsonb)) = 0 then
    raise exception 'At least one option is required';
  end if;

  if v_update_proposal_status is not null then
    raise exception 'update_proposal_status must be null until delivery phases are approved';
  end if;

  if exists (
    select 1
    from public.proposal_versions pv
    where pv.id = v_sent_version_id
  ) then
    raise exception 'sent_version_id already exists';
  end if;

  select
    p.current_draft_version_id,
    p.latest_sent_version_id,
    p.signed_version_id
    into v_current_draft_version_id, v_latest_sent_version_id, v_signed_version_id
  from public.proposals p
  where p.id = v_proposal_id
    and p.company_id = v_company_id
  for update;

  if not found then
    raise exception 'Proposal not found for company';
  end if;

  if v_current_draft_version_id is distinct from v_draft_version_id then
    raise exception 'draft_version_id is not the current draft version';
  end if;

  select pv.version_kind, pv.frozen_at
    into v_draft_version_kind, v_draft_frozen_at
  from public.proposal_versions pv
  where pv.id = v_draft_version_id
    and pv.company_id = v_company_id
    and pv.proposal_id = v_proposal_id
  for update;

  if not found then
    raise exception 'Draft version not found for proposal';
  end if;

  if v_draft_version_kind <> 'draft' then
    raise exception 'Source version is not a mutable draft';
  end if;

  if v_draft_frozen_at is not null then
    raise exception 'Draft version is already frozen';
  end if;

  if exists (
    select 1
    from public.proposal_versions pv
    where pv.company_id = v_company_id
      and pv.proposal_id = v_proposal_id
      and pv.version_number = v_version_number
  ) then
    raise exception 'version_number already exists for proposal';
  end if;

  insert into public.proposal_versions (
    id,
    company_id,
    proposal_id,
    version_number,
    version_kind,
    parent_version_id,
    frozen_at,
    context_echo,
    policy_echo,
    created_by
  ) values (
    v_sent_version_id,
    v_company_id,
    v_proposal_id,
    v_version_number,
    'sent',
    v_parent_version_id,
    v_frozen_at,
    coalesce(p_payload->'context_echo', '{}'::jsonb),
    coalesce(p_payload->'policy_echo', '{}'::jsonb),
    null
  );

  for page in
    select value
    from jsonb_array_elements(coalesce(p_payload->'pages', '[]'::jsonb))
  loop
    v_page_id := coalesce(
      nullif(page->>'client_page_id', '')::uuid,
      gen_random_uuid()
    );

    insert into public.proposal_pages (
      id,
      company_id,
      proposal_version_id,
      page_type,
      sort_order,
      title,
      customer_title,
      visible_to_customer,
      source_template_section_id,
      content_json,
      settings_json
    ) values (
      v_page_id,
      v_company_id,
      v_sent_version_id,
      coalesce(nullif(page->>'page_type', ''), 'custom_text'),
      coalesce(nullif(page->>'sort_order', '')::integer, 0),
      coalesce(nullif(page->>'title', ''), 'Page'),
      nullif(page->>'customer_title', ''),
      coalesce((page->>'visible_to_customer')::boolean, true),
      nullif(page->>'source_template_section_id', '')::uuid,
      coalesce(page->'content_json', '{}'::jsonb),
      coalesce(page->'settings_json', '{}'::jsonb)
    );

    v_page_count := v_page_count + 1;
    v_inserted_page_ids := v_inserted_page_ids || jsonb_build_object(v_page_id::text, true);

    if nullif(page->>'source_template_section_id', '') is not null then
      v_section_to_page := v_section_to_page || jsonb_build_object(
        nullif(page->>'source_template_section_id', ''),
        v_page_id::text
      );
    end if;
  end loop;

  for opt in
    select value
    from jsonb_array_elements(coalesce(p_payload->'options', '[]'::jsonb))
  loop
    if nullif(trim(opt->>'source_template_option_id'), '') is null then
      raise exception 'Each option payload requires source_template_option_id';
    end if;

    insert into public.proposal_options (
      company_id,
      proposal_version_id,
      source_template_option_id,
      name,
      customer_label,
      description,
      sort_order,
      is_default,
      visible_to_customer,
      customer_subtotal_cents,
      discount_cents,
      sales_tax_cents,
      customer_total_cents,
      pricing_complete,
      blocking_line_count,
      guardrail_outcome,
      selected_at
    ) values (
      v_company_id,
      v_sent_version_id,
      nullif(opt->>'source_template_option_id', '')::uuid,
      coalesce(nullif(opt->>'name', ''), 'Option'),
      nullif(opt->>'customer_label', ''),
      nullif(opt->>'description', ''),
      coalesce(nullif(opt->>'sort_order', '')::integer, 0),
      coalesce((opt->>'is_default')::boolean, false),
      coalesce((opt->>'visible_to_customer')::boolean, true),
      nullif(opt->>'customer_subtotal_cents', '')::integer,
      coalesce(nullif(opt->>'discount_cents', '')::integer, 0),
      coalesce(nullif(opt->>'sales_tax_cents', '')::integer, 0),
      nullif(opt->>'customer_total_cents', '')::integer,
      coalesce((opt->>'pricing_complete')::boolean, false),
      coalesce(nullif(opt->>'blocking_line_count', '')::integer, 0),
      coalesce(nullif(opt->>'guardrail_outcome', ''), 'pass'),
      nullif(opt->>'selected_at', '')::timestamptz
    )
    returning id into v_option_id;

    v_option_count := v_option_count + 1;

    for line in
      select value
      from jsonb_array_elements(coalesce(opt->'line_items', '[]'::jsonb))
    loop
      v_line_page_id := nullif(line->>'page_id', '')::uuid;
      v_section_id := nullif(line->>'section_id', '')::uuid;
      v_page_id := null;

      if v_line_page_id is not null and v_inserted_page_ids ? v_line_page_id::text then
        v_page_id := v_line_page_id;
      elsif v_section_id is not null and v_section_to_page ? v_section_id::text then
        v_page_id := (v_section_to_page->>v_section_id::text)::uuid;
      end if;

      insert into public.proposal_line_items (
        company_id,
        proposal_option_id,
        source_template_item_id,
        catalog_item_id,
        catalog_seed_key,
        composition_role,
        composition_slot_key,
        section_id,
        page_id,
        sort_order,
        customer_name,
        description,
        role,
        quantity,
        quantity_display_label,
        quantity_source_label,
        unit,
        customer_unit_price_cents,
        customer_line_total_cents,
        pricing_status,
        visible_to_customer,
        measurement_quantity_key,
        upgrade_selection_state,
        upgrade_effect,
        replaces_source_template_item_id
      ) values (
        v_company_id,
        v_option_id,
        nullif(line->>'source_template_item_id', '')::uuid,
        nullif(line->>'catalog_item_id', '')::uuid,
        nullif(line->>'catalog_seed_key', ''),
        nullif(line->>'composition_role', ''),
        nullif(line->>'composition_slot_key', ''),
        v_section_id,
        v_page_id,
        coalesce(nullif(line->>'sort_order', '')::integer, 0),
        coalesce(nullif(line->>'customer_name', ''), 'Line item'),
        nullif(line->>'description', ''),
        nullif(line->>'role', ''),
        nullif(line->>'quantity', '')::numeric,
        nullif(line->>'quantity_display_label', ''),
        nullif(line->>'quantity_source_label', ''),
        nullif(line->>'unit', ''),
        nullif(line->>'customer_unit_price_cents', '')::integer,
        nullif(line->>'customer_line_total_cents', '')::integer,
        coalesce(nullif(line->>'pricing_status', ''), 'needs_quantity'),
        coalesce((line->>'visible_to_customer')::boolean, true),
        nullif(line->>'measurement_quantity_key', ''),
        nullif(line->>'upgrade_selection_state', ''),
        nullif(line->>'upgrade_effect', ''),
        nullif(line->>'replaces_source_template_item_id', '')::uuid
      );
    end loop;

    if opt->'internal_summary' is not null
      and opt->'internal_summary' <> 'null'::jsonb
    then
      insert into public.proposal_internal_summaries (
        company_id,
        proposal_option_id,
        internal_cost_cents,
        internal_profit_cents,
        effective_margin_pct,
        policy_echo_json,
        computed_at
      ) values (
        v_company_id,
        v_option_id,
        nullif(opt->'internal_summary'->>'internal_cost_cents', '')::integer,
        nullif(opt->'internal_summary'->>'internal_profit_cents', '')::integer,
        nullif(opt->'internal_summary'->>'effective_margin_pct', '')::numeric,
        coalesce(opt->'internal_summary'->'policy_echo_json', '{}'::jsonb),
        coalesce(
          nullif(opt->'internal_summary'->>'computed_at', '')::timestamptz,
          v_frozen_at
        )
      );
    end if;

    insert into public.proposal_option_upgrade_choices (
      company_id,
      proposal_id,
      proposal_version_id,
      proposal_option_id,
      source_template_item_id,
      selection_state,
      upgrade_effect,
      replaces_source_template_item_id
    )
    select
      v_company_id,
      v_proposal_id,
      v_sent_version_id,
      v_option_id,
      nullif(trim(choice.value->>'source_template_item_id'), '')::uuid,
      nullif(trim(choice.value->>'selection_state'), ''),
      nullif(trim(choice.value->>'upgrade_effect'), ''),
      nullif(trim(choice.value->>'replaces_source_template_item_id'), '')::uuid
    from jsonb_array_elements(coalesce(opt->'upgrade_choices', '[]'::jsonb)) as choice(value)
    where nullif(trim(choice.value->>'source_template_item_id'), '') is not null;
  end loop;

  update public.proposals
  set latest_sent_version_id = v_sent_version_id
  where id = v_proposal_id
    and company_id = v_company_id;

  v_event := p_payload->'event';
  if v_event is null or v_event = 'null'::jsonb then
    raise exception 'event payload is required';
  end if;

  if coalesce(nullif(v_event->>'event_type', ''), '') <> 'snapshot_frozen' then
    raise exception 'event.event_type must be snapshot_frozen';
  end if;

  insert into public.proposal_events (
    company_id,
    proposal_id,
    proposal_version_id,
    event_type,
    actor_user_id,
    payload_json
  ) values (
    v_company_id,
    v_proposal_id,
    v_sent_version_id,
    'snapshot_frozen',
    nullif(v_event->>'actor_user_id', '')::uuid,
    coalesce(v_event->'payload_json', '{}'::jsonb)
  );

  return jsonb_build_object(
    'ok', true,
    'proposal_id', v_proposal_id,
    'draft_version_id', v_draft_version_id,
    'sent_version_id', v_sent_version_id,
    'version_number', v_version_number,
    'page_count', v_page_count,
    'option_count', v_option_count,
    'latest_sent_version_id', v_sent_version_id,
    'frozen_at', v_frozen_at
  );
end;
$$;


ALTER FUNCTION "public"."persist_proposal_send_freeze_v1"("p_payload" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."persist_proposal_send_freeze_v1"("p_payload" "jsonb") IS 'Atomically persists a pre-built send-freeze payload (immutable sent snapshot including upgrade choices and line echoes). frozen_at is DB-owned transaction now(); caller frozen_at is ignored. Does not mutate draft rows, enable delivery, or create public tokens.';



CREATE OR REPLACE FUNCTION "public"."project_proposal_acceptance_attention_v1"("p_acceptance_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_acceptance public.proposal_acceptances%rowtype;
  v_attention public.job_attention_items%rowtype;
  v_destination jsonb;
begin
  select a.*
  into v_acceptance
  from public.proposal_acceptances a
  where a.id = p_acceptance_id
  for update;

  if not found then
    raise exception 'acceptance % not found for attention projection', p_acceptance_id;
  end if;

  if v_acceptance.guard_result not in ('valid_clean', 'valid_review_required') then
    return jsonb_build_object('ok', true, 'attention_id', null, 'projected', false);
  end if;

  if v_acceptance.confirmed_at is not null then
    select ai.*
    into v_attention
    from public.job_attention_items ai
    where ai.company_id = v_acceptance.company_id
      and ai.source_type = 'proposal_acceptances'
      and ai.source_id = v_acceptance.id;

    return jsonb_build_object(
      'ok', true,
      'attention_id', v_attention.id,
      'projected', false
    );
  end if;

  select ai.*
  into v_attention
  from public.job_attention_items ai
  where ai.company_id = v_acceptance.company_id
    and ai.source_type = 'proposal_acceptances'
    and ai.source_id = v_acceptance.id
  for update;

  if found then
    return jsonb_build_object(
      'ok', true,
      'attention_id', v_attention.id,
      'projected', false
    );
  end if;

  v_destination := jsonb_build_object(
    'proposal_id', v_acceptance.proposal_id,
    'proposal_version_id', v_acceptance.proposal_version_id,
    'acceptance_id', v_acceptance.id,
    'tab', 'proposals',
    'anchor', 'acceptance_confirmation'
  );

  insert into public.job_attention_items (
    company_id,
    job_id,
    proposal_id,
    proposal_version_id,
    attention_type,
    source_type,
    source_id,
    source_occurred_at,
    status,
    base_severity,
    opened_at,
    dedupe_key,
    destination_kind,
    destination_json,
    policy_version,
    metadata_json
  ) values (
    v_acceptance.company_id,
    v_acceptance.job_id,
    v_acceptance.proposal_id,
    v_acceptance.proposal_version_id,
    'acceptance_confirmation_required',
    'proposal_acceptances',
    v_acceptance.id,
    v_acceptance.accepted_at,
    'open',
    case
      when v_acceptance.ambiguity_reason in (
        'older_sent_version',
        'conflicting_acceptance',
        'lost',
        'closed',
        'proposal_lineage_conflict',
        'job_already_approved'
      ) then 'high'
      else 'normal'
    end,
    v_acceptance.accepted_at,
    'acceptance_confirmation:proposal_acceptances:' || v_acceptance.id::text,
    'job_card_proposals',
    v_destination,
    'r3c.v1',
    jsonb_build_object(
      'guard_result', v_acceptance.guard_result,
      'ambiguity_reason', v_acceptance.ambiguity_reason
    )
  )
  returning * into v_attention;

  return jsonb_build_object(
    'ok', true,
    'attention_id', v_attention.id,
    'projected', true
  );
end;
$$;


ALTER FUNCTION "public"."project_proposal_acceptance_attention_v1"("p_acceptance_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."project_proposal_customer_request_attention_v1"("p_request_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_request public.proposal_customer_requests%rowtype;
  v_job_id uuid;
  v_attention_type text;
  v_attention_status text;
  v_attention_id uuid;
  v_existing_status text;
  v_dedupe_key text;
begin
  if p_request_id is null then
    raise exception 'request id is required for attention projection';
  end if;

  select r.*
  into v_request
  from public.proposal_customer_requests r
  where r.id = p_request_id
  for update;

  if not found then
    raise exception 'proposal_customer_requests source % not found', p_request_id;
  end if;

  if v_request.status not in ('new', 'seen') then
    raise exception 'only active proposal_customer_requests can create attention';
  end if;

  select p.job_id
  into v_job_id
  from public.proposals p
  join public.jobs j
    on j.id = p.job_id
   and j.company_id = p.company_id
  join public.proposal_versions pv
    on pv.id = v_request.proposal_version_id
   and pv.company_id = p.company_id
   and pv.proposal_id = p.id
  where p.id = v_request.proposal_id
    and p.company_id = v_request.company_id;

  if not found or v_job_id is null then
    raise exception 'customer request source has invalid company/job/proposal/version binding';
  end if;

  if v_request.intent = 'request_package' then
    v_attention_type := 'customer_package_request';
  elsif v_request.intent in ('ask_question', 'ask_about_package') then
    v_attention_type := 'customer_question';
  else
    raise exception 'customer request intent cannot create R3B4A attention';
  end if;

  v_attention_status :=
    case when v_request.status = 'seen' then 'acknowledged' else 'open' end;
  v_dedupe_key :=
    'customer_request:proposal_customer_requests:' || v_request.id::text;

  insert into public.job_attention_items (
    company_id,
    job_id,
    proposal_id,
    proposal_version_id,
    attention_type,
    source_type,
    source_id,
    source_occurred_at,
    status,
    base_severity,
    opened_at,
    acknowledged_at,
    dedupe_key,
    destination_kind,
    destination_json,
    policy_version,
    metadata_json
  ) values (
    v_request.company_id,
    v_job_id,
    v_request.proposal_id,
    v_request.proposal_version_id,
    v_attention_type,
    'proposal_customer_requests',
    v_request.id,
    v_request.created_at,
    v_attention_status,
    'high',
    v_request.created_at,
    case when v_attention_status = 'acknowledged' then now() else null end,
    v_dedupe_key,
    'job_card_proposals',
    jsonb_build_object(
      'proposal_id', v_request.proposal_id,
      'proposal_version_id', v_request.proposal_version_id,
      'request_id', v_request.id,
      'tab', 'proposals',
      'anchor', 'customer_request'
    ),
    'r3b4a-v1',
    jsonb_build_object('intent', v_request.intent)
  )
  on conflict (company_id, dedupe_key) do nothing
  returning id, status into v_attention_id, v_existing_status;

  if v_attention_id is null then
    select ai.id, ai.status
    into v_attention_id, v_existing_status
    from public.job_attention_items ai
    where ai.company_id = v_request.company_id
      and ai.dedupe_key = v_dedupe_key
      and ai.source_type = 'proposal_customer_requests'
      and ai.source_id = v_request.id
      and ai.job_id = v_job_id
      and ai.proposal_id = v_request.proposal_id
      and ai.proposal_version_id = v_request.proposal_version_id
      and ai.attention_type = v_attention_type;

    if not found then
      raise exception 'existing attention dedupe row does not match verified source binding';
    end if;

    if v_existing_status = 'resolved' then
      raise exception 'resolved attention cannot be reopened';
    end if;

    if v_attention_status = 'acknowledged' and v_existing_status = 'open' then
      update public.job_attention_items
      set
        status = 'acknowledged',
        acknowledged_at = now(),
        acknowledged_by = null
      where id = v_attention_id
        and company_id = v_request.company_id
        and status = 'open'
      returning status into v_existing_status;
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'attention_id', v_attention_id,
    'attention_status', v_existing_status,
    'attention_type', v_attention_type,
    'request_id', v_request.id,
    'company_id', v_request.company_id,
    'job_id', v_job_id,
    'proposal_id', v_request.proposal_id,
    'proposal_version_id', v_request.proposal_version_id
  );
end;
$$;


ALTER FUNCTION "public"."project_proposal_customer_request_attention_v1"("p_request_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."properties_prevent_company_id_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if tg_op = 'UPDATE' and new.company_id is distinct from old.company_id then
    raise exception 'properties.company_id is immutable';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."properties_prevent_company_id_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."proposal_acceptance_contract_option_v1"("p_company_id" "uuid", "p_acceptance_id" "uuid") RETURNS TABLE("option_id" "uuid", "option_label" "text", "total_cents" integer, "customer_chose" boolean)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    coalesce(a.customer_chosen_option_id, a.proposal_option_id),
    coalesce(a.customer_chosen_option_label, a.accepted_option_label),
    coalesce(a.customer_chosen_total_cents, a.accepted_total_cents),
    a.customer_chosen_option_id is not null
  from public.proposal_acceptances a
  where a.id = p_acceptance_id
    and a.company_id = p_company_id;
$$;


ALTER FUNCTION "public"."proposal_acceptance_contract_option_v1"("p_company_id" "uuid", "p_acceptance_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."proposal_acceptance_contract_option_v1"("p_company_id" "uuid", "p_acceptance_id" "uuid") IS 'Contractual option/label/total for one acceptance. Customer-chosen package governs when present, otherwise the contractor frozen selection. Use this wherever money is derived from an acceptance.';



CREATE OR REPLACE FUNCTION "public"."proposal_acceptance_contract_total_cents_v1"("p_company_id" "uuid", "p_acceptance_id" "uuid") RETURNS integer
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  select coalesce(
    coalesce(a.customer_chosen_total_cents, a.accepted_total_cents),
    0
  )::integer
  from public.proposal_acceptances a
  where a.company_id = p_company_id
    and a.id = p_acceptance_id;
$$;


ALTER FUNCTION "public"."proposal_acceptance_contract_total_cents_v1"("p_company_id" "uuid", "p_acceptance_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."proposal_acceptance_contract_total_cents_v1"("p_company_id" "uuid", "p_acceptance_id" "uuid") IS 'Contractual cents for one acceptance. customer_chosen_total_cents when present; otherwise accepted_total_cents. Does not mutate either column.';



CREATE OR REPLACE FUNCTION "public"."proposal_acceptance_frozen_selected_option_v1"("p_company_id" "uuid", "p_proposal_version_id" "uuid") RETURNS TABLE("option_id" "uuid", "option_label" "text", "customer_total_cents" integer)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  return query
  select
    po.id,
    left(
      coalesce(nullif(trim(po.customer_label), ''), nullif(trim(po.name), ''), 'Package'),
      120
    ),
    po.customer_total_cents
  from public.proposal_options po
  where po.company_id = p_company_id
    and po.proposal_version_id = p_proposal_version_id
  order by
    case when po.selected_at is not null then 0 else 1 end,
    po.selected_at asc nulls last,
    case when po.is_default then 0 else 1 end,
    po.sort_order,
    po.id
  limit 1;
end;
$$;


ALTER FUNCTION "public"."proposal_acceptance_frozen_selected_option_v1"("p_company_id" "uuid", "p_proposal_version_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."proposal_acceptances_row_guard"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  if tg_op = 'DELETE' then
    raise exception 'proposal_acceptances rows cannot be deleted';
  end if;

  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id
      or new.company_id is distinct from old.company_id
      or new.job_id is distinct from old.job_id
      or new.proposal_id is distinct from old.proposal_id
      or new.proposal_version_id is distinct from old.proposal_version_id
      or new.proposal_option_id is distinct from old.proposal_option_id
      or new.public_access_token_id is distinct from old.public_access_token_id
      or new.accepted_at is distinct from old.accepted_at
      or new.accepted_by_name is distinct from old.accepted_by_name
      or new.accepted_by_email is distinct from old.accepted_by_email
      or new.source is distinct from old.source
      or new.method is distinct from old.method
      or new.accepted_option_label is distinct from old.accepted_option_label
      or new.accepted_total_cents is distinct from old.accepted_total_cents
      or new.guard_result is distinct from old.guard_result
      or new.ambiguity_reason is distinct from old.ambiguity_reason
      or new.created_at is distinct from old.created_at
      or new.customer_chosen_option_id is distinct from old.customer_chosen_option_id
      or new.customer_chosen_option_label is distinct from old.customer_chosen_option_label
      or new.customer_chosen_total_cents is distinct from old.customer_chosen_total_cents
    then
      raise exception 'proposal_acceptances identity and evidence fields are immutable';
    end if;

    if old.confirmed_at is not null
      and (
        new.confirmed_at is distinct from old.confirmed_at
        or new.confirmed_by_user_id is distinct from old.confirmed_by_user_id
      )
    then
      raise exception 'proposal_acceptances confirmation fields cannot be rewritten';
    end if;

    if old.confirmed_at is null
      and new.confirmed_at is null
      and new.confirmed_by_user_id is null
    then
      raise exception 'proposal_acceptances UPDATE must set confirmation fields';
    end if;

    return new;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."proposal_acceptances_row_guard"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."proposal_apply_draft_content_changed_at_backfill_v1"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_row record;
  v_count integer := 0;
begin
  perform set_config('proposal.allow_draft_content_changed_at_touch', '1', true);

  for v_row in
    select p.company_id, p.id
    from public.proposals p
  loop
    update public.proposals
    set draft_content_changed_at =
      public.proposal_draft_content_changed_at_backfill_stamp_v1(v_row.company_id, v_row.id)
    where company_id = v_row.company_id
      and id = v_row.id;
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;


ALTER FUNCTION "public"."proposal_apply_draft_content_changed_at_backfill_v1"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."proposal_assert_public_access_token_active_v1"("p_token_hash" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
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
$_$;


ALTER FUNCTION "public"."proposal_assert_public_access_token_active_v1"("p_token_hash" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."proposal_assert_public_access_token_active_v1"("p_token_hash" "text") IS 'R18C2B internal — validates public access token hash and returns safe ID binding envelope only. Not for direct client execution. Never returns graph rows or token_hash.';



CREATE OR REPLACE FUNCTION "public"."proposal_customer_activity_row_guard"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."proposal_customer_activity_row_guard"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."proposal_customer_requests_row_guard"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_token record;
begin
  if tg_op = 'DELETE' then
    raise exception 'proposal_customer_requests rows cannot be deleted';
  end if;

  if tg_op = 'UPDATE' then
    if new.company_id is distinct from old.company_id
      or new.proposal_id is distinct from old.proposal_id
      or new.proposal_version_id is distinct from old.proposal_version_id
      or new.public_access_token_id is distinct from old.public_access_token_id
      or new.submission_key is distinct from old.submission_key
      or new.intent is distinct from old.intent
      or new.requested_option_id is distinct from old.requested_option_id
      or new.requested_option_label is distinct from old.requested_option_label
      or new.message is distinct from old.message
      or new.customer_name is distinct from old.customer_name
      or new.customer_email is distinct from old.customer_email
      or new.customer_phone is distinct from old.customer_phone
      or new.payload_json is distinct from old.payload_json
      or new.created_at is distinct from old.created_at
      or new.id is distinct from old.id
    then
      raise exception 'proposal_customer_requests binding, submission identity, and body fields are immutable';
    end if;

    if new.status not in ('new', 'seen', 'dismissed') then
      raise exception 'proposal_customer_requests.status must be new, seen, or dismissed';
    end if;

    return new;
  end if;

  if public.proposal_forbidden_token_json_keys(new.payload_json) then
    raise exception 'proposal_customer_requests.payload_json must not contain raw token keys';
  end if;

  select
    ppt.company_id,
    ppt.proposal_id,
    ppt.proposal_version_id
  into v_token
  from public.proposal_public_access_tokens ppt
  where ppt.id = new.public_access_token_id;

  if not found then
    raise exception 'public_access_token_id % not found', new.public_access_token_id;
  end if;

  if v_token.company_id is distinct from new.company_id then
    raise exception 'public_access_token_id company_id mismatch';
  end if;

  if v_token.proposal_id is distinct from new.proposal_id then
    raise exception 'public_access_token_id proposal_id mismatch';
  end if;

  if v_token.proposal_version_id is distinct from new.proposal_version_id then
    raise exception 'public_access_token_id proposal_version_id mismatch';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."proposal_customer_requests_row_guard"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."proposal_delivery_attempt_forbidden_metadata_keys"("p_json" "jsonb") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."proposal_delivery_attempt_forbidden_metadata_keys"("p_json" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."proposal_delivery_attempt_row_guard"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."proposal_delivery_attempt_row_guard"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."proposal_draft_content_backfill_package_key_v1"("p_source_template_option_id" "uuid", "p_sort_order" integer) RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select case
    when p_source_template_option_id is not null then 'src:' || p_source_template_option_id::text
    else 'sort:' || coalesce(p_sort_order, 0)::text
  end;
$$;


ALTER FUNCTION "public"."proposal_draft_content_backfill_package_key_v1"("p_source_template_option_id" "uuid", "p_sort_order" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."proposal_draft_content_changed_at_backfill_stamp_v1"("p_company_id" "uuid", "p_proposal_id" "uuid") RETURNS timestamp with time zone
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_outcome text;
  v_proposal public.proposals%rowtype;
  v_frozen_at timestamptz;
  v_saved_at timestamptz;
  v_freeze_event_at timestamptz;
begin
  select p.*
    into v_proposal
  from public.proposals p
  where p.id = p_proposal_id
    and p.company_id = p_company_id;

  if not found then
    return now();
  end if;

  v_outcome := public.proposal_draft_vs_sent_graph_outcome_v1(p_company_id, p_proposal_id);

  if v_outcome = 'unsent' then
    return coalesce(v_proposal.created_at, now());
  end if;

  select pv.frozen_at
    into v_frozen_at
  from public.proposal_versions pv
  where pv.id = v_proposal.latest_sent_version_id
    and pv.company_id = p_company_id;

  if v_outcome = 'clean' then
    -- Baseline clamp. Not a claim that content changed at freeze.
    -- Must use frozen_at, never snapshot_frozen.created_at (DB clock is after Node frozen_at).
    return v_frozen_at;
  end if;

  -- dirty or unknown → stamp must be > frozen_at when a freeze exists.
  select max(e.occurred_at)
    into v_freeze_event_at
  from public.proposal_events e
  where e.company_id = p_company_id
    and e.proposal_id = p_proposal_id
    and e.proposal_version_id = v_proposal.latest_sent_version_id
    and e.event_type = 'snapshot_frozen';

  select max(e.occurred_at)
    into v_saved_at
  from public.proposal_events e
  where e.company_id = p_company_id
    and e.proposal_id = p_proposal_id
    and e.event_type = 'draft_saved'
    and (v_freeze_event_at is null or e.occurred_at > v_freeze_event_at);

  if v_outcome = 'dirty' and v_saved_at is not null and (v_frozen_at is null or v_saved_at > v_frozen_at) then
    return v_saved_at;
  end if;

  return now();
end;
$$;


ALTER FUNCTION "public"."proposal_draft_content_changed_at_backfill_stamp_v1"("p_company_id" "uuid", "p_proposal_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."proposal_draft_content_identity_echo_slice_v1"("p_echo" "jsonb") RETURNS "jsonb"
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select jsonb_strip_nulls(
    jsonb_build_object(
      'company_name', nullif(trim(coalesce(p_echo->>'company_name', '')), ''),
      'company_logo_url', nullif(trim(coalesce(p_echo->>'company_logo_url', '')), ''),
      'company_phone', nullif(trim(coalesce(p_echo->>'company_phone', '')), ''),
      'company_email', nullif(trim(coalesce(p_echo->>'company_email', '')), ''),
      'company_website', nullif(trim(coalesce(p_echo->>'company_website', '')), ''),
      'company_address', nullif(trim(coalesce(p_echo->>'company_address', '')), ''),
      'customer_name', nullif(trim(coalesce(p_echo->>'customer_name', '')), ''),
      'customer_email', nullif(trim(coalesce(p_echo->>'customer_email', '')), ''),
      'customer_phone', nullif(trim(coalesce(p_echo->>'customer_phone', '')), ''),
      'customer_address', nullif(trim(coalesce(p_echo->>'customer_address', '')), ''),
      'address_formatted', nullif(trim(coalesce(p_echo->>'address_formatted', '')), ''),
      'job_name', nullif(trim(coalesce(p_echo->>'job_name', '')), ''),
      'template_name', nullif(trim(coalesce(p_echo->>'template_name', '')), ''),
      'proposal_number', nullif(trim(coalesce(p_echo->>'proposal_number', '')), ''),
      'proposal_title', nullif(trim(coalesce(p_echo->>'proposal_title', '')), '')
    )
  );
$$;


ALTER FUNCTION "public"."proposal_draft_content_identity_echo_slice_v1"("p_echo" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."proposal_draft_vs_sent_graph_outcome_v1"("p_company_id" "uuid", "p_proposal_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_proposal public.proposals%rowtype;
  v_draft public.proposal_versions%rowtype;
  v_sent public.proposal_versions%rowtype;
  v_dup integer;
  v_unmatched integer;
  v_diff integer;
begin
  select p.*
    into v_proposal
  from public.proposals p
  where p.id = p_proposal_id
    and p.company_id = p_company_id;

  if not found then
    return 'unknown';
  end if;

  if v_proposal.latest_sent_version_id is null then
    return 'unsent';
  end if;

  if v_proposal.current_draft_version_id is null then
    return 'unknown';
  end if;

  select pv.*
    into v_draft
  from public.proposal_versions pv
  where pv.id = v_proposal.current_draft_version_id
    and pv.company_id = p_company_id
    and pv.proposal_id = p_proposal_id;

  if not found or v_draft.version_kind is distinct from 'draft' then
    return 'unknown';
  end if;

  select pv.*
    into v_sent
  from public.proposal_versions pv
  where pv.id = v_proposal.latest_sent_version_id
    and pv.company_id = p_company_id
    and pv.proposal_id = p_proposal_id;

  if not found or v_sent.version_kind not in ('sent', 'signed') or v_sent.frozen_at is null then
    return 'unknown';
  end if;

  -- Identity echo + full persisted policy/context snapshot (no live Catalog).
  if public.proposal_draft_content_identity_echo_slice_v1(v_draft.context_echo)
       is distinct from public.proposal_draft_content_identity_echo_slice_v1(v_sent.context_echo)
     or v_draft.policy_echo is distinct from v_sent.policy_echo
     or coalesce(v_draft.context_echo - array[
          'company_name','company_logo_url','company_phone','company_email','company_website',
          'company_address','customer_name','customer_email','customer_phone','customer_address',
          'address_formatted','job_name','template_name','proposal_number','proposal_title'
        ], '{}'::jsonb)
        is distinct from
        coalesce(v_sent.context_echo - array[
          'company_name','company_logo_url','company_phone','company_email','company_website',
          'company_address','customer_name','customer_email','customer_phone','customer_address',
          'address_formatted','job_name','template_name','proposal_number','proposal_title'
        ], '{}'::jsonb) then
    return 'dirty';
  end if;

  -- Package key collisions → unknown. Count mismatch after unique keys → dirty.
  select count(*)
    into v_dup
  from (
    select public.proposal_draft_content_backfill_package_key_v1(source_template_option_id, sort_order) as k
    from public.proposal_options
    where company_id = p_company_id
      and proposal_version_id = v_draft.id
    group by 1
    having count(*) > 1
    union all
    select public.proposal_draft_content_backfill_package_key_v1(source_template_option_id, sort_order)
    from public.proposal_options
    where company_id = p_company_id
      and proposal_version_id = v_sent.id
    group by 1
    having count(*) > 1
  ) d;

  if v_dup > 0 then
    return 'unknown';
  end if;

  select count(*)
    into v_unmatched
  from (
    select public.proposal_draft_content_backfill_package_key_v1(source_template_option_id, sort_order) as k
    from public.proposal_options
    where company_id = p_company_id
      and proposal_version_id = v_draft.id
    except
    select public.proposal_draft_content_backfill_package_key_v1(source_template_option_id, sort_order)
    from public.proposal_options
    where company_id = p_company_id
      and proposal_version_id = v_sent.id
  ) u;

  if v_unmatched > 0 then
    return 'dirty';
  end if;

  select count(*)
    into v_unmatched
  from (
    select public.proposal_draft_content_backfill_package_key_v1(source_template_option_id, sort_order) as k
    from public.proposal_options
    where company_id = p_company_id
      and proposal_version_id = v_sent.id
    except
    select public.proposal_draft_content_backfill_package_key_v1(source_template_option_id, sort_order)
    from public.proposal_options
    where company_id = p_company_id
      and proposal_version_id = v_draft.id
  ) u;

  if v_unmatched > 0 then
    return 'dirty';
  end if;

  -- Selected package identity: source_template_option_id / sort key, not raw UUIDs.
  if (
    select public.proposal_draft_content_backfill_package_key_v1(d.source_template_option_id, d.sort_order)
    from public.proposal_options d
    where d.company_id = p_company_id
      and d.id = v_proposal.selected_option_id
      and d.proposal_version_id = v_draft.id
  ) is distinct from coalesce(
    (
      select public.proposal_draft_content_backfill_package_key_v1(s.source_template_option_id, s.sort_order)
      from public.proposal_options s
      where s.company_id = p_company_id
        and s.proposal_version_id = v_sent.id
        and s.selected_at is not null
      order by s.selected_at desc
      limit 1
    ),
    (
      select public.proposal_draft_content_backfill_package_key_v1(s.source_template_option_id, s.sort_order)
      from public.proposal_options s
      where s.company_id = p_company_id
        and s.proposal_version_id = v_sent.id
        and s.is_default
      order by s.sort_order
      limit 1
    )
  ) then
    return 'dirty';
  end if;

  select count(*)
    into v_diff
  from public.proposal_options d
  join public.proposal_options s
    on s.company_id = d.company_id
   and s.proposal_version_id = v_sent.id
   and public.proposal_draft_content_backfill_package_key_v1(s.source_template_option_id, s.sort_order)
     = public.proposal_draft_content_backfill_package_key_v1(d.source_template_option_id, d.sort_order)
  where d.company_id = p_company_id
    and d.proposal_version_id = v_draft.id
    and (
      d.name is distinct from s.name
      or d.customer_label is distinct from s.customer_label
      or d.description is distinct from s.description
      or d.visible_to_customer is distinct from s.visible_to_customer
      or d.customer_subtotal_cents is distinct from s.customer_subtotal_cents
      or d.discount_cents is distinct from s.discount_cents
      or d.sales_tax_cents is distinct from s.sales_tax_cents
      or d.customer_total_cents is distinct from s.customer_total_cents
      or d.pricing_complete is distinct from s.pricing_complete
      or d.blocking_line_count is distinct from s.blocking_line_count
    );

  if v_diff > 0 then
    return 'dirty';
  end if;

  -- Pages: page_type + source_template_section_id + sort_order. Collision → unknown.
  select count(*)
    into v_dup
  from (
    select page_type, source_template_section_id, sort_order
    from public.proposal_pages
    where company_id = p_company_id
      and proposal_version_id = v_draft.id
    group by 1, 2, 3
    having count(*) > 1
    union all
    select page_type, source_template_section_id, sort_order
    from public.proposal_pages
    where company_id = p_company_id
      and proposal_version_id = v_sent.id
    group by 1, 2, 3
    having count(*) > 1
  ) d;

  if v_dup > 0 then
    return 'unknown';
  end if;

  -- EXCEPT treats NULLs as equal. Do not use outer joins on nullable keys;
  -- this Postgres rejects those as non merge/hash-joinable conditions.
  if exists (
    select page_type, source_template_section_id, sort_order
    from public.proposal_pages
    where company_id = p_company_id
      and proposal_version_id = v_draft.id
    except
    select page_type, source_template_section_id, sort_order
    from public.proposal_pages
    where company_id = p_company_id
      and proposal_version_id = v_sent.id
  ) or exists (
    select page_type, source_template_section_id, sort_order
    from public.proposal_pages
    where company_id = p_company_id
      and proposal_version_id = v_sent.id
    except
    select page_type, source_template_section_id, sort_order
    from public.proposal_pages
    where company_id = p_company_id
      and proposal_version_id = v_draft.id
  ) then
    return 'dirty';
  end if;

  if exists (
    select 1
    from public.proposal_pages d
    join public.proposal_pages s
      on s.company_id = p_company_id
     and s.proposal_version_id = v_sent.id
     and s.page_type is not distinct from d.page_type
     and s.source_template_section_id is not distinct from d.source_template_section_id
     and s.sort_order is not distinct from d.sort_order
    where d.company_id = p_company_id
      and d.proposal_version_id = v_draft.id
      and (
        d.title is distinct from s.title
        or d.customer_title is distinct from s.customer_title
        or d.visible_to_customer is distinct from s.visible_to_customer
        or d.content_json is distinct from s.content_json
        or d.settings_json is distinct from s.settings_json
      )
  ) then
    return 'dirty';
  end if;

  -- Lines: package key + source_template_item_id + catalog_seed_key + slot + sort_order.
  select count(*)
    into v_dup
  from (
    select
      public.proposal_draft_content_backfill_package_key_v1(po.source_template_option_id, po.sort_order) as pkg,
      li.source_template_item_id,
      li.catalog_seed_key,
      li.composition_slot_key,
      li.sort_order
    from public.proposal_line_items li
    join public.proposal_options po
      on po.id = li.proposal_option_id
     and po.company_id = li.company_id
    where li.company_id = p_company_id
      and po.proposal_version_id = v_draft.id
    group by 1, 2, 3, 4, 5
    having count(*) > 1
    union all
    select
      public.proposal_draft_content_backfill_package_key_v1(po.source_template_option_id, po.sort_order),
      li.source_template_item_id,
      li.catalog_seed_key,
      li.composition_slot_key,
      li.sort_order
    from public.proposal_line_items li
    join public.proposal_options po
      on po.id = li.proposal_option_id
     and po.company_id = li.company_id
    where li.company_id = p_company_id
      and po.proposal_version_id = v_sent.id
    group by 1, 2, 3, 4, 5
    having count(*) > 1
  ) d;

  if v_dup > 0 then
    return 'unknown';
  end if;

  if exists (
    select
      public.proposal_draft_content_backfill_package_key_v1(po.source_template_option_id, po.sort_order),
      li.source_template_item_id,
      li.catalog_seed_key,
      li.composition_slot_key,
      li.sort_order
    from public.proposal_line_items li
    join public.proposal_options po
      on po.id = li.proposal_option_id
     and po.company_id = li.company_id
    where li.company_id = p_company_id
      and po.proposal_version_id = v_draft.id
    except
    select
      public.proposal_draft_content_backfill_package_key_v1(po.source_template_option_id, po.sort_order),
      li.source_template_item_id,
      li.catalog_seed_key,
      li.composition_slot_key,
      li.sort_order
    from public.proposal_line_items li
    join public.proposal_options po
      on po.id = li.proposal_option_id
     and po.company_id = li.company_id
    where li.company_id = p_company_id
      and po.proposal_version_id = v_sent.id
  ) or exists (
    select
      public.proposal_draft_content_backfill_package_key_v1(po.source_template_option_id, po.sort_order),
      li.source_template_item_id,
      li.catalog_seed_key,
      li.composition_slot_key,
      li.sort_order
    from public.proposal_line_items li
    join public.proposal_options po
      on po.id = li.proposal_option_id
     and po.company_id = li.company_id
    where li.company_id = p_company_id
      and po.proposal_version_id = v_sent.id
    except
    select
      public.proposal_draft_content_backfill_package_key_v1(po.source_template_option_id, po.sort_order),
      li.source_template_item_id,
      li.catalog_seed_key,
      li.composition_slot_key,
      li.sort_order
    from public.proposal_line_items li
    join public.proposal_options po
      on po.id = li.proposal_option_id
     and po.company_id = li.company_id
    where li.company_id = p_company_id
      and po.proposal_version_id = v_draft.id
  ) then
    return 'dirty';
  end if;

  if exists (
    select 1
    from public.proposal_line_items dli
    join public.proposal_options dpo
      on dpo.id = dli.proposal_option_id
     and dpo.company_id = dli.company_id
    join public.proposal_options spo
      on spo.company_id = dpo.company_id
     and spo.proposal_version_id = v_sent.id
     and public.proposal_draft_content_backfill_package_key_v1(spo.source_template_option_id, spo.sort_order)
       = public.proposal_draft_content_backfill_package_key_v1(dpo.source_template_option_id, dpo.sort_order)
    join public.proposal_line_items sli
      on sli.company_id = dli.company_id
     and sli.proposal_option_id = spo.id
     and sli.source_template_item_id is not distinct from dli.source_template_item_id
     and sli.catalog_seed_key is not distinct from dli.catalog_seed_key
     and sli.composition_slot_key is not distinct from dli.composition_slot_key
     and sli.sort_order is not distinct from dli.sort_order
    where dli.company_id = p_company_id
      and dpo.proposal_version_id = v_draft.id
      and (
        dli.customer_name is distinct from sli.customer_name
        or dli.description is distinct from sli.description
        or dli.quantity is distinct from sli.quantity
        or dli.unit is distinct from sli.unit
        or dli.customer_unit_price_cents is distinct from sli.customer_unit_price_cents
        or dli.customer_line_total_cents is distinct from sli.customer_line_total_cents
        or dli.visible_to_customer is distinct from sli.visible_to_customer
        or dli.composition_role is distinct from sli.composition_role
        or dli.upgrade_selection_state is distinct from sli.upgrade_selection_state
        or dli.upgrade_effect is distinct from sli.upgrade_effect
        or dli.replaces_source_template_item_id is distinct from sli.replaces_source_template_item_id
        or dli.quantity_resolution_echo is distinct from sli.quantity_resolution_echo
      )
  ) then
    return 'dirty';
  end if;

  -- Upgrade choices: package key + source_template_item_id. Collision → unknown.
  select count(*)
    into v_dup
  from (
    select
      public.proposal_draft_content_backfill_package_key_v1(po.source_template_option_id, po.sort_order) as pkg,
      c.source_template_item_id
    from public.proposal_option_upgrade_choices c
    join public.proposal_options po
      on po.id = c.proposal_option_id
     and po.company_id = c.company_id
    where c.company_id = p_company_id
      and c.proposal_version_id = v_draft.id
    group by 1, 2
    having count(*) > 1
    union all
    select
      public.proposal_draft_content_backfill_package_key_v1(po.source_template_option_id, po.sort_order),
      c.source_template_item_id
    from public.proposal_option_upgrade_choices c
    join public.proposal_options po
      on po.id = c.proposal_option_id
     and po.company_id = c.company_id
    where c.company_id = p_company_id
      and c.proposal_version_id = v_sent.id
    group by 1, 2
    having count(*) > 1
  ) d;

  if v_dup > 0 then
    return 'unknown';
  end if;

  if exists (
    select
      public.proposal_draft_content_backfill_package_key_v1(po.source_template_option_id, po.sort_order),
      c.source_template_item_id
    from public.proposal_option_upgrade_choices c
    join public.proposal_options po
      on po.id = c.proposal_option_id
     and po.company_id = c.company_id
    where c.company_id = p_company_id
      and c.proposal_version_id = v_draft.id
    except
    select
      public.proposal_draft_content_backfill_package_key_v1(po.source_template_option_id, po.sort_order),
      c.source_template_item_id
    from public.proposal_option_upgrade_choices c
    join public.proposal_options po
      on po.id = c.proposal_option_id
     and po.company_id = c.company_id
    where c.company_id = p_company_id
      and c.proposal_version_id = v_sent.id
  ) or exists (
    select
      public.proposal_draft_content_backfill_package_key_v1(po.source_template_option_id, po.sort_order),
      c.source_template_item_id
    from public.proposal_option_upgrade_choices c
    join public.proposal_options po
      on po.id = c.proposal_option_id
     and po.company_id = c.company_id
    where c.company_id = p_company_id
      and c.proposal_version_id = v_sent.id
    except
    select
      public.proposal_draft_content_backfill_package_key_v1(po.source_template_option_id, po.sort_order),
      c.source_template_item_id
    from public.proposal_option_upgrade_choices c
    join public.proposal_options po
      on po.id = c.proposal_option_id
     and po.company_id = c.company_id
    where c.company_id = p_company_id
      and c.proposal_version_id = v_draft.id
  ) then
    return 'dirty';
  end if;

  if exists (
    select 1
    from public.proposal_option_upgrade_choices dc
    join public.proposal_options dpo
      on dpo.id = dc.proposal_option_id
     and dpo.company_id = dc.company_id
    join public.proposal_options spo
      on spo.company_id = dpo.company_id
     and spo.proposal_version_id = v_sent.id
     and public.proposal_draft_content_backfill_package_key_v1(spo.source_template_option_id, spo.sort_order)
       = public.proposal_draft_content_backfill_package_key_v1(dpo.source_template_option_id, dpo.sort_order)
    join public.proposal_option_upgrade_choices sc
      on sc.company_id = dc.company_id
     and sc.proposal_option_id = spo.id
     and sc.source_template_item_id is not distinct from dc.source_template_item_id
    where dc.company_id = p_company_id
      and dc.proposal_version_id = v_draft.id
      and (
        dc.selection_state is distinct from sc.selection_state
        or dc.upgrade_effect is distinct from sc.upgrade_effect
        or dc.replaces_source_template_item_id is distinct from sc.replaces_source_template_item_id
      )
  ) then
    return 'dirty';
  end if;

  -- Scope-decision adjunct: not copied to sent. Post-freeze scope/draft_saved → dirty.
  if exists (
    select 1
    from public.proposal_events freeze_ev
    where freeze_ev.company_id = p_company_id
      and freeze_ev.proposal_id = p_proposal_id
      and freeze_ev.proposal_version_id = v_sent.id
      and freeze_ev.event_type = 'snapshot_frozen'
      and (
        exists (
          select 1
          from public.proposal_events saved
          where saved.company_id = p_company_id
            and saved.proposal_id = p_proposal_id
            and saved.event_type = 'draft_saved'
            and saved.occurred_at > freeze_ev.occurred_at
        )
        or exists (
          select 1
          from public.proposal_option_scope_decisions sd
          where sd.company_id = p_company_id
            and sd.proposal_id = p_proposal_id
            and sd.proposal_version_id = v_draft.id
            and sd.updated_at > freeze_ev.occurred_at
        )
      )
  ) then
    return 'dirty';
  end if;

  return 'clean';
end;
$$;


ALTER FUNCTION "public"."proposal_draft_vs_sent_graph_outcome_v1"("p_company_id" "uuid", "p_proposal_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."proposal_forbidden_token_json_keys"("p_json" "jsonb") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  select
    coalesce(p_json ? 'raw_token', false)
    or coalesce(p_json ? 'token', false)
    or coalesce(p_json ? 'public_token', false)
    or coalesce(p_json ? 'token_secret', false);
$$;


ALTER FUNCTION "public"."proposal_forbidden_token_json_keys"("p_json" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."proposal_immutable_version_child_guard"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_kind text;
  v_version_id uuid;
begin
  if tg_table_name = 'proposal_pages' then
    v_version_id := coalesce(old.proposal_version_id, new.proposal_version_id);
  elsif tg_table_name = 'proposal_options' then
    v_version_id := coalesce(old.proposal_version_id, new.proposal_version_id);
  elsif tg_table_name = 'proposal_option_upgrade_choices' then
    v_version_id := coalesce(old.proposal_version_id, new.proposal_version_id);
  elsif tg_table_name = 'proposal_line_items' then
    select po.proposal_version_id
      into v_version_id
    from public.proposal_options po
    where po.id = coalesce(old.proposal_option_id, new.proposal_option_id);
  elsif tg_table_name = 'proposal_internal_summaries' then
    select po.proposal_version_id
      into v_version_id
    from public.proposal_options po
    where po.id = coalesce(old.proposal_option_id, new.proposal_option_id);
  else
    return coalesce(new, old);
  end if;

  select pv.version_kind
    into v_kind
  from public.proposal_versions pv
  where pv.id = v_version_id;

  if v_kind in ('sent', 'signed', 'superseded') then
    raise exception 'Immutable proposal version rows cannot be modified (version_kind=%)', v_kind;
  end if;

  return coalesce(new, old);
end;
$$;


ALTER FUNCTION "public"."proposal_immutable_version_child_guard"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."proposal_immutable_version_row_guard"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  if tg_op = 'UPDATE' then
    if old.version_kind in ('sent', 'signed', 'superseded') then
      if new.version_kind = 'superseded' and old.version_kind = 'sent' then
        return new;
      end if;
      raise exception 'Immutable proposal_versions row cannot be updated (kind=%)', old.version_kind;
    end if;
  elsif tg_op = 'DELETE' then
    if old.version_kind in ('sent', 'signed', 'superseded') then
      raise exception 'Immutable proposal_versions row cannot be deleted (kind=%)', old.version_kind;
    end if;
  end if;
  return coalesce(new, old);
end;
$$;


ALTER FUNCTION "public"."proposal_immutable_version_row_guard"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."proposal_line_items_touch_draft_content_v1"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_company_id uuid;
  v_option_id uuid;
  v_version_id uuid;
begin
  v_company_id := coalesce(new.company_id, old.company_id);
  v_option_id := coalesce(new.proposal_option_id, old.proposal_option_id);

  select po.proposal_version_id
    into v_version_id
  from public.proposal_options po
  where po.id = v_option_id
    and po.company_id = v_company_id;

  if v_version_id is null then
    return coalesce(new, old);
  end if;

  if tg_op = 'UPDATE'
     and new.source_template_item_id is not distinct from old.source_template_item_id
     and new.catalog_item_id is not distinct from old.catalog_item_id
     and new.catalog_seed_key is not distinct from old.catalog_seed_key
     and new.composition_role is not distinct from old.composition_role
     and new.composition_slot_key is not distinct from old.composition_slot_key
     and new.sort_order is not distinct from old.sort_order
     and new.customer_name is not distinct from old.customer_name
     and new.description is not distinct from old.description
     and new.role is not distinct from old.role
     and new.quantity is not distinct from old.quantity
     and new.quantity_display_label is not distinct from old.quantity_display_label
     and new.unit is not distinct from old.unit
     and new.customer_unit_price_cents is not distinct from old.customer_unit_price_cents
     and new.customer_line_total_cents is not distinct from old.customer_line_total_cents
     and new.visible_to_customer is not distinct from old.visible_to_customer
     and new.quantity_resolution_echo is not distinct from old.quantity_resolution_echo
     and new.upgrade_selection_state is not distinct from old.upgrade_selection_state
     and new.upgrade_effect is not distinct from old.upgrade_effect
     and new.replaces_source_template_item_id is not distinct from old.replaces_source_template_item_id then
    return new;
  end if;

  perform public.proposal_touch_draft_content_from_version_id_v1(
    v_company_id,
    v_version_id
  );
  return coalesce(new, old);
end;
$$;


ALTER FUNCTION "public"."proposal_line_items_touch_draft_content_v1"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."proposal_options_touch_draft_content_v1"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_row public.proposal_options%rowtype;
begin
  v_row := coalesce(new, old);
  if tg_op = 'UPDATE'
     and new.name is not distinct from old.name
     and new.customer_label is not distinct from old.customer_label
     and new.description is not distinct from old.description
     and new.sort_order is not distinct from old.sort_order
     and new.is_default is not distinct from old.is_default
     and new.visible_to_customer is not distinct from old.visible_to_customer
     and new.customer_subtotal_cents is not distinct from old.customer_subtotal_cents
     and new.discount_cents is not distinct from old.discount_cents
     and new.sales_tax_cents is not distinct from old.sales_tax_cents
     and new.customer_total_cents is not distinct from old.customer_total_cents
     and new.pricing_complete is not distinct from old.pricing_complete
     and new.blocking_line_count is not distinct from old.blocking_line_count
     and new.selected_at is not distinct from old.selected_at then
    return new;
  end if;

  perform public.proposal_touch_draft_content_from_version_id_v1(
    v_row.company_id,
    v_row.proposal_version_id
  );
  return coalesce(new, old);
end;
$$;


ALTER FUNCTION "public"."proposal_options_touch_draft_content_v1"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."proposal_pages_touch_draft_content_v1"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_row public.proposal_pages%rowtype;
begin
  v_row := coalesce(new, old);
  if tg_op = 'UPDATE'
     and new.title is not distinct from old.title
     and new.customer_title is not distinct from old.customer_title
     and new.visible_to_customer is not distinct from old.visible_to_customer
     and new.sort_order is not distinct from old.sort_order
     and new.page_type is not distinct from old.page_type
     and new.content_json is not distinct from old.content_json
     and new.settings_json is not distinct from old.settings_json then
    return new;
  end if;

  perform public.proposal_touch_draft_content_from_version_id_v1(
    v_row.company_id,
    v_row.proposal_version_id
  );
  return coalesce(new, old);
end;
$$;


ALTER FUNCTION "public"."proposal_pages_touch_draft_content_v1"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."proposal_payment_terms_guard_immutable_v1"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_kind text;
begin
  select v.version_kind into v_kind
  from public.proposal_versions v
  where v.id = coalesce(new.proposal_version_id, old.proposal_version_id)
    and v.company_id = coalesce(new.company_id, old.company_id);

  if v_kind is distinct from 'draft' then
    if tg_op = 'DELETE' then
      raise exception 'proposal_version_payment_terms for sent versions cannot be deleted';
    end if;
    if tg_op = 'UPDATE' then
      if new.deposit_mode is distinct from old.deposit_mode
        or new.deposit_percent_bps is distinct from old.deposit_percent_bps
        or new.deposit_fixed_cents is distinct from old.deposit_fixed_cents
        or new.deposit_due_trigger is distinct from old.deposit_due_trigger
        or new.balance_due_trigger is distinct from old.balance_due_trigger
        or new.collection_channel is distinct from old.collection_channel
        or new.company_id is distinct from old.company_id
        or new.proposal_id is distinct from old.proposal_id
        or new.proposal_version_id is distinct from old.proposal_version_id
      then
        raise exception 'proposal_version_payment_terms for sent versions are immutable';
      end if;
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."proposal_payment_terms_guard_immutable_v1"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."proposal_payment_terms_on_version_insert_v1"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_parent public.proposal_version_payment_terms%rowtype;
begin
  if new.version_kind = 'draft' then
    insert into public.proposal_version_payment_terms (
      proposal_version_id,
      company_id,
      proposal_id,
      deposit_mode,
      deposit_percent_bps,
      deposit_fixed_cents
    )
    values (
      new.id,
      new.company_id,
      new.proposal_id,
      'none',
      null,
      null
    )
    on conflict (proposal_version_id) do nothing;
    return new;
  end if;

  if new.version_kind in ('sent', 'signed') and new.parent_version_id is not null then
    select * into v_parent
    from public.proposal_version_payment_terms
    where proposal_version_id = new.parent_version_id
      and company_id = new.company_id;

    if found then
      insert into public.proposal_version_payment_terms (
        proposal_version_id,
        company_id,
        proposal_id,
        deposit_mode,
        deposit_percent_bps,
        deposit_fixed_cents,
        deposit_due_trigger,
        balance_due_trigger,
        collection_channel
      )
      values (
        new.id,
        new.company_id,
        new.proposal_id,
        v_parent.deposit_mode,
        v_parent.deposit_percent_bps,
        v_parent.deposit_fixed_cents,
        v_parent.deposit_due_trigger,
        v_parent.balance_due_trigger,
        v_parent.collection_channel
      )
      on conflict (proposal_version_id) do nothing;
    else
      insert into public.proposal_version_payment_terms (
        proposal_version_id,
        company_id,
        proposal_id,
        deposit_mode,
        deposit_percent_bps,
        deposit_fixed_cents
      )
      values (
        new.id,
        new.company_id,
        new.proposal_id,
        'none',
        null,
        null
      )
      on conflict (proposal_version_id) do nothing;
    end if;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."proposal_payment_terms_on_version_insert_v1"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."proposal_payment_terms_on_version_insert_v1"() IS 'New draft payment terms initialize to deposit_mode=none. Does not call proposal_payment_terms_seed_from_settings_v1. Sent/signed copies frozen parent terms when a parent exists. Company settings defaults remain stored but inert for normal new proposal creation.';



CREATE OR REPLACE FUNCTION "public"."proposal_payment_terms_seed_from_settings_v1"("p_company_id" "uuid", "p_proposal_id" "uuid", "p_version_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_settings public.company_payment_settings%rowtype;
  v_mode text;
  v_bps integer;
  v_fixed integer;
begin
  perform public.ensure_company_payment_settings_v1(p_company_id);

  select * into v_settings
  from public.company_payment_settings
  where company_id = p_company_id;

  v_mode := coalesce(v_settings.default_deposit_mode, 'none');
  v_bps := v_settings.default_deposit_percent_bps;
  v_fixed := v_settings.default_deposit_fixed_cents;

  if v_mode = 'percent' and (v_bps is null or v_bps < 1 or v_bps > 10000) then
    v_mode := 'none';
    v_bps := null;
    v_fixed := null;
  elsif v_mode = 'fixed' and (v_fixed is null or v_fixed < 100) then
    v_mode := 'none';
    v_bps := null;
    v_fixed := null;
  elsif v_mode is distinct from 'percent' and v_mode is distinct from 'fixed' then
    v_mode := 'none';
    v_bps := null;
    v_fixed := null;
  end if;

  insert into public.proposal_version_payment_terms (
    proposal_version_id,
    company_id,
    proposal_id,
    deposit_mode,
    deposit_percent_bps,
    deposit_fixed_cents
  )
  values (
    p_version_id,
    p_company_id,
    p_proposal_id,
    v_mode,
    v_bps,
    v_fixed
  )
  on conflict (proposal_version_id) do nothing;
end;
$$;


ALTER FUNCTION "public"."proposal_payment_terms_seed_from_settings_v1"("p_company_id" "uuid", "p_proposal_id" "uuid", "p_version_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."proposal_public_access_token_row_guard"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."proposal_public_access_token_row_guard"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."proposal_public_option_choice_current_v1"("p_company_id" "uuid", "p_proposal_id" "uuid", "p_proposal_version_id" "uuid") RETURNS TABLE("option_id" "uuid", "option_key" "text", "option_label" "text", "total_cents" integer, "chosen_at" timestamp with time zone, "updated_at" timestamp with time zone, "locked" boolean)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    c.chosen_option_id,
    c.chosen_option_key,
    c.chosen_option_label,
    c.chosen_total_cents,
    c.chosen_at,
    c.updated_at,
    exists (
      select 1
      from public.proposal_acceptances a
      where a.company_id = c.company_id
        and a.proposal_id = c.proposal_id
        and a.proposal_version_id = c.proposal_version_id
    ) as locked
  from public.proposal_public_option_choices c
  where c.company_id = p_company_id
    and c.proposal_id = p_proposal_id
    and c.proposal_version_id = p_proposal_version_id;
$$;


ALTER FUNCTION "public"."proposal_public_option_choice_current_v1"("p_company_id" "uuid", "p_proposal_id" "uuid", "p_proposal_version_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."proposal_public_option_choices_row_guard"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_option public.proposal_options%rowtype;
begin
  if tg_op = 'DELETE' then
    raise exception 'proposal_public_option_choices rows cannot be deleted';
  end if;

  if tg_op = 'INSERT' or tg_op = 'UPDATE' then
    select po.*
    into v_option
    from public.proposal_options po
    where po.id = new.chosen_option_id
      and po.company_id = new.company_id;

    if not found
      or v_option.proposal_version_id is distinct from new.proposal_version_id
      or v_option.visible_to_customer is not true
      or v_option.customer_total_cents is null
      or v_option.customer_total_cents is distinct from new.chosen_total_cents
    then
      raise exception 'proposal_public_option_choices must bind a visible priced option on the frozen version';
    end if;

    if trim(coalesce(v_option.source_template_option_id::text, ''))
         is distinct from trim(new.chosen_option_key)
    then
      raise exception 'proposal_public_option_choices option key must match frozen source_template_option_id';
    end if;
  end if;

  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id
      or new.company_id is distinct from old.company_id
      or new.proposal_id is distinct from old.proposal_id
      or new.proposal_version_id is distinct from old.proposal_version_id
      or new.created_at is distinct from old.created_at
      or new.chosen_at is distinct from old.chosen_at
    then
      raise exception 'proposal_public_option_choices identity fields are immutable';
    end if;

    if exists (
      select 1
      from public.proposal_acceptances a
      where a.company_id = new.company_id
        and a.proposal_id = new.proposal_id
        and a.proposal_version_id = new.proposal_version_id
    ) and (
      new.chosen_option_id is distinct from old.chosen_option_id
      or new.chosen_option_key is distinct from old.chosen_option_key
      or new.chosen_total_cents is distinct from old.chosen_total_cents
    ) then
      raise exception 'proposal_public_option_choices cannot change after acceptance';
    end if;

    new.updated_at := now();
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."proposal_public_option_choices_row_guard"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."proposal_resolve_customer_chosen_option_v1"("p_company_id" "uuid", "p_proposal_version_id" "uuid", "p_option_key" "text") RETURNS TABLE("option_id" "uuid", "option_label" "text", "total_cents" integer)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    po.id,
    left(trim(coalesce(nullif(trim(po.customer_label), ''), po.name)), 120),
    po.customer_total_cents
  from public.proposal_options po
  where po.company_id = p_company_id
    and po.proposal_version_id = p_proposal_version_id
    and trim(coalesce(p_option_key, '')) <> ''
    and trim(coalesce(po.source_template_option_id::text, '')) = trim(coalesce(p_option_key, ''))
    and po.visible_to_customer is true
    and po.customer_total_cents is not null
  order by po.sort_order, po.id
  limit 1;
$$;


ALTER FUNCTION "public"."proposal_resolve_customer_chosen_option_v1"("p_company_id" "uuid", "p_proposal_version_id" "uuid", "p_option_key" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."proposal_resolve_customer_chosen_option_v1"("p_company_id" "uuid", "p_proposal_version_id" "uuid", "p_option_key" "text") IS 'Resolves a customer-supplied source_template_option_id to a frozen proposal_options row on exactly one version. Rejects options that are not on the version, hidden from the customer, or unpriced. Server-side price authority: the total is read from frozen truth, never from the client.';



CREATE OR REPLACE FUNCTION "public"."proposal_scope_decisions_touch_draft_content_v1"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_row public.proposal_option_scope_decisions%rowtype;
begin
  v_row := coalesce(new, old);
  perform public.proposal_touch_draft_content_from_version_id_v1(
    v_row.company_id,
    v_row.proposal_version_id
  );
  return coalesce(new, old);
end;
$$;


ALTER FUNCTION "public"."proposal_scope_decisions_touch_draft_content_v1"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."proposal_signature_mark_error_v1"("p_mark" "jsonb") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
declare
  v_strokes jsonb;
  v_stroke jsonb;
  v_point jsonb;
  v_stroke_count int;
  v_point_count int;
  v_total_points int := 0;
  v_i int;
  v_j int;
  v_x numeric;
  v_y numeric;
  v_t numeric;
  v_min_x numeric := 1;
  v_min_y numeric := 1;
  v_max_x numeric := 0;
  v_max_y numeric := 0;
  v_keys text[];
  v_point_keys text[];
begin
  if p_mark is null or jsonb_typeof(p_mark) <> 'object' then
    return 'invalid_mark';
  end if;

  if octet_length(p_mark::text) > 24576 then
    return 'mark_too_large';
  end if;

  select array_agg(k order by k)
  into v_keys
  from jsonb_object_keys(p_mark) as t(k);

  if v_keys is distinct from array['strokes', 'version']::text[] then
    return 'invalid_mark';
  end if;

  if jsonb_typeof(p_mark->'version') <> 'number'
    or (p_mark->>'version')::numeric <> 1 then
    return 'invalid_mark_version';
  end if;

  v_strokes := p_mark->'strokes';
  if jsonb_typeof(v_strokes) <> 'array' then
    return 'invalid_mark';
  end if;

  v_stroke_count := jsonb_array_length(v_strokes);
  if v_stroke_count < 1 or v_stroke_count > 24 then
    return 'invalid_mark';
  end if;

  for v_i in 0 .. v_stroke_count - 1 loop
    v_stroke := v_strokes->v_i;
    if jsonb_typeof(v_stroke) <> 'array' then
      return 'invalid_mark';
    end if;
    v_point_count := jsonb_array_length(v_stroke);
    if v_point_count < 2 or v_point_count > 256 then
      return 'invalid_mark';
    end if;
    v_total_points := v_total_points + v_point_count;
    if v_total_points > 1536 then
      return 'mark_too_large';
    end if;

    for v_j in 0 .. v_point_count - 1 loop
      v_point := v_stroke->v_j;
      if jsonb_typeof(v_point) <> 'object' then
        return 'invalid_mark';
      end if;

      select array_agg(k order by k)
      into v_point_keys
      from jsonb_object_keys(v_point) as t(k);

      if v_point_keys is distinct from array['x', 'y']::text[]
        and v_point_keys is distinct from array['t', 'x', 'y']::text[]
      then
        return 'invalid_mark';
      end if;

      if jsonb_typeof(v_point->'x') <> 'number'
        or jsonb_typeof(v_point->'y') <> 'number' then
        return 'invalid_mark';
      end if;

      v_x := (v_point->>'x')::numeric;
      v_y := (v_point->>'y')::numeric;
      if v_x is null or v_y is null
        or v_x < 0 or v_x > 1
        or v_y < 0 or v_y > 1 then
        return 'invalid_mark';
      end if;

      if v_point ? 't' then
        if jsonb_typeof(v_point->'t') <> 'number' then
          return 'invalid_mark';
        end if;
        v_t := (v_point->>'t')::numeric;
        if v_t is null or v_t < 0 then
          return 'invalid_mark';
        end if;
      end if;

      if v_x < v_min_x then v_min_x := v_x; end if;
      if v_y < v_min_y then v_min_y := v_y; end if;
      if v_x > v_max_x then v_max_x := v_x; end if;
      if v_y > v_max_y then v_max_y := v_y; end if;
    end loop;
  end loop;

  if (v_max_x - v_min_x) + (v_max_y - v_min_y) < 0.05 then
    return 'mark_too_small';
  end if;

  return null;
exception
  when others then
    return 'invalid_mark';
end;
$$;


ALTER FUNCTION "public"."proposal_signature_mark_error_v1"("p_mark" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."proposal_signature_mark_error_v1"("p_mark" "jsonb") IS 'INTERNAL. Returns an error code for invalid drawn_mark_json, or null when valid. Not granted to authenticated, anon, or public.';



CREATE OR REPLACE FUNCTION "public"."proposal_signatures_row_guard"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_acceptance public.proposal_acceptances%rowtype;
  v_mark_error text;
begin
  if tg_op = 'DELETE' then
    raise exception 'proposal_signatures rows cannot be deleted';
  end if;

  if tg_op = 'UPDATE' then
    raise exception 'proposal_signatures rows cannot be updated';
  end if;

  select a.*
  into v_acceptance
  from public.proposal_acceptances a
  where a.id = new.proposal_acceptance_id
    and a.company_id = new.company_id;

  if not found then
    raise exception 'proposal_signatures require a matching proposal_acceptance';
  end if;

  if new.job_id is distinct from v_acceptance.job_id
    or new.proposal_id is distinct from v_acceptance.proposal_id
    or new.proposal_version_id is distinct from v_acceptance.proposal_version_id
    or new.proposal_option_id is distinct from v_acceptance.proposal_option_id
  then
    raise exception 'proposal_signatures binding must match the acceptance row';
  end if;

  if new.typed_name_echo is distinct from new.signer_printed_name then
    raise exception 'proposal_signatures typed_name_echo must match signer_printed_name';
  end if;

  v_mark_error := public.proposal_signature_mark_error_v1(new.drawn_mark_json);
  if v_mark_error is not null then
    raise exception 'proposal_signatures drawn mark is invalid: %', v_mark_error;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."proposal_signatures_row_guard"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."proposal_touch_draft_content_changed_at_internal_v1"("p_company_id" "uuid", "p_proposal_id" "uuid") RETURNS timestamp with time zone
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_now timestamptz := now();
begin
  if p_company_id is null or p_proposal_id is null then
    return null;
  end if;

  perform set_config('proposal.allow_draft_content_changed_at_touch', '1', true);

  update public.proposals
  set draft_content_changed_at = v_now
  where id = p_proposal_id
    and company_id = p_company_id;

  if not found then
    return null;
  end if;

  return v_now;
end;
$$;


ALTER FUNCTION "public"."proposal_touch_draft_content_changed_at_internal_v1"("p_company_id" "uuid", "p_proposal_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."proposal_touch_draft_content_changed_at_internal_v1"("p_company_id" "uuid", "p_proposal_id" "uuid") IS 'INTERNAL. Called only from draft-scoped triggers. Advances proposals.draft_content_changed_at. Not granted to authenticated, anon, or service_role.';



CREATE OR REPLACE FUNCTION "public"."proposal_touch_draft_content_from_version_id_v1"("p_company_id" "uuid", "p_proposal_version_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_proposal_id uuid;
begin
  if p_company_id is null or p_proposal_version_id is null then
    return;
  end if;

  if not public.proposal_version_is_current_mutable_draft_v1(
    p_company_id,
    p_proposal_version_id
  ) then
    return;
  end if;

  select pv.proposal_id
    into v_proposal_id
  from public.proposal_versions pv
  where pv.id = p_proposal_version_id
    and pv.company_id = p_company_id;

  perform public.proposal_touch_draft_content_changed_at_internal_v1(
    p_company_id,
    v_proposal_id
  );
end;
$$;


ALTER FUNCTION "public"."proposal_touch_draft_content_from_version_id_v1"("p_company_id" "uuid", "p_proposal_version_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."proposal_upgrade_choices_touch_draft_content_v1"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_row public.proposal_option_upgrade_choices%rowtype;
begin
  v_row := coalesce(new, old);
  if tg_op = 'UPDATE'
     and new.selection_state is not distinct from old.selection_state
     and new.upgrade_effect is not distinct from old.upgrade_effect
     and new.replaces_source_template_item_id is not distinct from old.replaces_source_template_item_id then
    return new;
  end if;

  perform public.proposal_touch_draft_content_from_version_id_v1(
    v_row.company_id,
    v_row.proposal_version_id
  );
  return coalesce(new, old);
end;
$$;


ALTER FUNCTION "public"."proposal_upgrade_choices_touch_draft_content_v1"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."proposal_version_is_current_mutable_draft_v1"("p_company_id" "uuid", "p_proposal_version_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.proposal_versions pv
    join public.proposals p
      on p.id = pv.proposal_id
     and p.company_id = pv.company_id
    where pv.id = p_proposal_version_id
      and pv.company_id = p_company_id
      and pv.version_kind = 'draft'
      and (
        p.current_draft_version_id is not distinct from pv.id
        or p.current_draft_version_id is null
      )
  );
$$;


ALTER FUNCTION "public"."proposal_version_is_current_mutable_draft_v1"("p_company_id" "uuid", "p_proposal_version_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."proposal_version_is_current_mutable_draft_v1"("p_company_id" "uuid", "p_proposal_version_id" "uuid") IS 'True when the version is the current mutable draft (kind=draft and current_draft_version_id matches, or draft during create before the pointer is set). Sent/frozen/historical versions are false.';



CREATE OR REPLACE FUNCTION "public"."proposal_versions_touch_draft_content_v1"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if new.context_echo is not distinct from old.context_echo
     and new.policy_echo is not distinct from old.policy_echo then
    return new;
  end if;

  perform public.proposal_touch_draft_content_from_version_id_v1(
    new.company_id,
    new.id
  );
  return new;
end;
$$;


ALTER FUNCTION "public"."proposal_versions_touch_draft_content_v1"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."proposals_guard_draft_content_changed_at_v1"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if tg_op = 'INSERT' then
    new.draft_content_changed_at := coalesce(new.draft_content_changed_at, now());
    return new;
  end if;

  -- Clients cannot stamp the dirty clock. Internal trigger helper sets a txn GUC.
  if current_setting('proposal.allow_draft_content_changed_at_touch', true)
       is distinct from '1' then
    new.draft_content_changed_at := old.draft_content_changed_at;
  end if;

  if new.selected_option_id is distinct from old.selected_option_id
     or new.measurement_record_id is distinct from old.measurement_record_id then
    new.draft_content_changed_at := now();
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."proposals_guard_draft_content_changed_at_v1"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reconcile_job_payment_refund_result_v1"("p_payload" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_id uuid;
  v_account text;
  v_refund_id text;
  v_charge text;
  v_status text;
  v_reason_code text;
  v_reason_message text;
  v_provider_created timestamptz;
  v_provider_updated timestamptz;
  v_effective_at timestamptz;
  v_refund public.job_payment_refunds%rowtype;
  v_before_stage text;
  v_before_entered timestamptz;
  v_after_stage text;
  v_after_entered timestamptz;
begin
  begin
    v_id := nullif(p_payload->>'id', '')::uuid;
    v_account := nullif(trim(p_payload->>'provider_account_id'), '');
    v_refund_id := nullif(trim(p_payload->>'provider_refund_id'), '');
    v_charge := nullif(trim(p_payload->>'provider_charge_id'), '');
    v_status := nullif(trim(p_payload->>'status'), '');
    v_reason_code := nullif(left(trim(p_payload->>'provider_reason_code'), 120), '');
    v_reason_message := nullif(left(trim(p_payload->>'provider_reason_message'), 1000), '');
    v_provider_created := nullif(p_payload->>'provider_created_at', '')::timestamptz;
    v_provider_updated := nullif(p_payload->>'provider_updated_at', '')::timestamptz;
  exception when others then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end;

  if v_id is null
    or v_account is null
    or v_status is null
    or v_status not in (
      'pending', 'requires_action', 'succeeded', 'failed', 'canceled'
    )
    or (v_status not in ('failed') and v_refund_id is null)
  then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  select r.* into v_refund
  from public.job_payment_refunds r
  where r.id = v_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v_refund.provider_account_id is distinct from v_account then
    return jsonb_build_object('ok', false, 'code', 'account_mismatch');
  end if;
  if v_refund.provider_refund_id is not null
    and v_refund.provider_refund_id is distinct from v_refund_id
  then
    return jsonb_build_object('ok', false, 'code', 'refund_id_mismatch');
  end if;
  if v_refund.provider_charge_id is not null
    and v_charge is not null
    and v_refund.provider_charge_id is distinct from v_charge
  then
    return jsonb_build_object('ok', false, 'code', 'charge_id_mismatch');
  end if;

  select s.job_stage, s.stage_entered_at
  into v_before_stage, v_before_entered
  from public.job_payment_snapshot_stage_v1(v_refund.company_id, v_refund.job_id) s;

  v_effective_at := coalesce(v_provider_updated, v_provider_created, now());

  if v_effective_at >= coalesce(
      v_refund.provider_updated_at,
      v_refund.last_provider_event_created_at,
      '-infinity'::timestamptz
    )
    and not (
      v_refund.status in ('succeeded', 'failed', 'canceled')
      and v_status in ('pending', 'requires_action')
    )
  then
    update public.job_payment_refunds
    set
      provider_refund_id = coalesce(provider_refund_id, v_refund_id),
      provider_charge_id = coalesce(provider_charge_id, v_charge),
      status = v_status,
      provider_reason_code = coalesce(v_reason_code, provider_reason_code),
      provider_reason_message = coalesce(v_reason_message, provider_reason_message),
      provider_created_at = coalesce(provider_created_at, v_provider_created),
      provider_updated_at = greatest(
        coalesce(provider_updated_at, '-infinity'::timestamptz),
        coalesce(v_provider_updated, v_effective_at)
      ),
      pending_at = case
        when v_status = 'pending' then coalesce(pending_at, v_effective_at)
        else pending_at
      end,
      requires_action_at = case
        when v_status = 'requires_action' then coalesce(requires_action_at, v_effective_at)
        else requires_action_at
      end,
      succeeded_at = case
        when v_status = 'succeeded' then coalesce(succeeded_at, v_effective_at)
        else succeeded_at
      end,
      failed_at = case
        when v_status = 'failed' then coalesce(failed_at, v_effective_at)
        else failed_at
      end,
      canceled_at = case
        when v_status = 'canceled' then coalesce(canceled_at, v_effective_at)
        else canceled_at
      end
    where id = v_refund.id
    returning * into v_refund;
  end if;

  select s.job_stage, s.stage_entered_at
  into v_after_stage, v_after_entered
  from public.job_payment_snapshot_stage_v1(v_refund.company_id, v_refund.job_id) s;

  if v_after_stage is distinct from v_before_stage
    or v_after_entered is distinct from v_before_entered
  then
    raise exception 'refund reconcile must not change job stage';
  end if;

  return jsonb_build_object(
    'ok', true,
    'id', v_refund.id,
    'status', v_refund.status,
    'provider_refund_id', v_refund.provider_refund_id,
    'job_stage_unchanged', true
  );
end;
$$;


ALTER FUNCTION "public"."reconcile_job_payment_refund_result_v1"("p_payload" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_job_activity_v1"("p_payload" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_event_type text;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;

  v_event_type := nullif(p_payload->>'event_type', '');
  if v_event_type is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  if v_event_type in (
    'job_created',
    'stage_changed',
    'disposition_changed',
    'job_scheduled',
    'job_rescheduled',
    'job_unscheduled',
    'job_work_started',
    'job_work_completed'
  ) then
    return jsonb_build_object('ok', false, 'code', 'event_type_reserved');
  end if;

  return jsonb_build_object('ok', false, 'code', 'invalid_event_type');
end;
$$;


ALTER FUNCTION "public"."record_job_activity_v1"("p_payload" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_job_payment_provider_event_v1"("p_payload" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_event_id text;
  v_raw_type text;
  v_occurred timestamptz;
  v_request_id uuid;
  v_session_id text;
  v_account_id text;
  v_pi text;
  v_charge text;
  v_amount integer;
  v_txn_kind text;
  v_txn_status text;
  v_apply text;
  v_request public.job_payment_requests%rowtype;
  v_found_id uuid;
  v_txn public.job_payment_transactions%rowtype;
  v_existing_txn public.job_payment_transactions%rowtype;
  v_before_stage text;
  v_before_entered timestamptz;
  v_after_stage text;
  v_after_entered timestamptz;
  v_replay boolean := false;
  v_next_status text;
begin
  begin
    v_event_id := nullif(trim(p_payload->>'provider_event_id'), '');
    v_raw_type := nullif(trim(p_payload->>'raw_type'), '');
    v_occurred := coalesce(nullif(p_payload->>'occurred_at', '')::timestamptz, now());
    v_request_id := nullif(p_payload->>'payment_request_id', '')::uuid;
    v_session_id := nullif(trim(p_payload->>'provider_checkout_session_id'), '');
    v_account_id := nullif(trim(p_payload->>'provider_account_id'), '');
    v_pi := nullif(trim(p_payload->>'provider_payment_intent_id'), '');
    v_charge := nullif(trim(p_payload->>'provider_charge_id'), '');
    v_amount := nullif(p_payload->>'amount_cents', '')::integer;
    v_txn_kind := nullif(trim(p_payload->>'transaction_kind'), '');
    v_txn_status := nullif(trim(p_payload->>'transaction_status'), '');
    v_apply := nullif(trim(p_payload->>'apply_request_status'), '');
  exception when others then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end;

  if v_event_id is null or v_raw_type is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  select t.*
  into v_existing_txn
  from public.job_payment_transactions t
  where t.provider = 'stripe'
    and t.provider_event_id = v_event_id;

  if found then
    return jsonb_build_object(
      'ok', true,
      'idempotent_replay', true,
      'transaction_id', v_existing_txn.id,
      'payment_request_id', v_existing_txn.payment_request_id,
      'ignored', false
    );
  end if;

  v_found_id := null;
  if v_request_id is not null then
    select r.id
    into v_found_id
    from public.job_payment_requests r
    where r.id = v_request_id;
  end if;

  if v_found_id is null and v_session_id is not null then
    select r.id
    into v_found_id
    from public.job_payment_requests r
    where r.provider = 'stripe'
      and r.provider_checkout_session_id = v_session_id;
  end if;

  if v_found_id is null then
    return jsonb_build_object(
      'ok', true,
      'ignored', true,
      'reason', 'unbound_event'
    );
  end if;

  select r.*
  into v_request
  from public.job_payment_requests r
  where r.id = v_found_id
  for update;

  if v_account_id is not null
    and v_account_id is distinct from v_request.provider_account_id
  then
    return jsonb_build_object('ok', false, 'code', 'account_mismatch');
  end if;

  select s.job_stage, s.stage_entered_at
  into v_before_stage, v_before_entered
  from public.job_payment_snapshot_stage_v1(v_request.company_id, v_request.job_id) s;

  if v_session_id is not null
    and v_request.provider_checkout_session_id is distinct from v_session_id
    and v_request.status <> 'paid'
  then
    update public.job_payment_requests
    set provider_checkout_session_id = v_session_id
    where id = v_request.id
    returning * into v_request;
  end if;

  -- Canonical capture: PaymentIntent first, then one succeeded capture per
  -- request. Event order (PI then Checkout, or Checkout then PI) converges.
  if v_txn_kind = 'capture' then
    if v_pi is not null then
      select t.*
      into v_existing_txn
      from public.job_payment_transactions t
      where t.company_id = v_request.company_id
        and t.provider = 'stripe'
        and t.kind = 'capture'
        and t.status = 'succeeded'
        and t.provider_payment_intent_id = v_pi
      order by t.occurred_at asc, t.created_at asc
      limit 1;
      if found then
        v_txn := v_existing_txn;
        v_replay := true;
      end if;
    end if;

    if not v_replay then
      select t.*
      into v_existing_txn
      from public.job_payment_transactions t
      where t.company_id = v_request.company_id
        and t.payment_request_id = v_request.id
        and t.kind = 'capture'
        and t.status = 'succeeded'
      order by t.occurred_at asc, t.created_at asc
      limit 1;
      if found then
        v_txn := v_existing_txn;
        v_replay := true;
      end if;
    end if;
  end if;

  if v_txn_kind is not null and not v_replay then
    if v_amount is null then
      v_amount := v_request.amount_cents;
    end if;
    insert into public.job_payment_transactions (
      company_id,
      payment_request_id,
      provider,
      provider_event_id,
      provider_payment_intent_id,
      provider_charge_id,
      amount_cents,
      currency,
      kind,
      status,
      occurred_at,
      raw_type
    )
    values (
      v_request.company_id,
      v_request.id,
      'stripe',
      v_event_id,
      v_pi,
      v_charge,
      v_amount,
      v_request.currency,
      v_txn_kind,
      v_txn_status,
      v_occurred,
      v_raw_type
    )
    returning * into v_txn;
  end if;

  v_next_status := v_request.status;

  if v_apply = 'paid' and v_request.status <> 'paid' then
    v_next_status := 'paid';
  elsif v_apply = 'failed'
    and v_request.status in ('open', 'processing', 'failed')
  then
    v_next_status := 'failed';
  elsif v_apply = 'processing'
    and v_request.status in ('open', 'failed', 'processing')
  then
    v_next_status := 'processing';
  elsif v_apply = 'paid' and v_request.status = 'paid' then
    v_next_status := 'paid';
  end if;

  if v_next_status is distinct from v_request.status then
    update public.job_payment_requests
    set
      status = v_next_status,
      paid_at = case when v_next_status = 'paid' then coalesce(paid_at, v_occurred) else paid_at end
    where id = v_request.id
    returning * into v_request;
  end if;

  if v_request.status = 'failed' then
    perform public.job_payment_open_failed_attention_v1(v_request);
  elsif v_request.status = 'paid' then
    perform public.job_payment_resolve_attention_v1(
      v_request.company_id,
      'payment_failed:job_payment_requests:' || v_request.id::text
    );
  end if;

  select s.job_stage, s.stage_entered_at
  into v_after_stage, v_after_entered
  from public.job_payment_snapshot_stage_v1(v_request.company_id, v_request.job_id) s;

  if v_after_stage is distinct from v_before_stage
    or v_after_entered is distinct from v_before_entered
  then
    raise exception 'job payment provider event must not change job stage';
  end if;

  return jsonb_build_object(
    'ok', true,
    'idempotent_replay', v_replay,
    'ignored', false,
    'payment_request_id', v_request.id,
    'request_status', v_request.status,
    'transaction_id', v_txn.id,
    'job_stage', v_after_stage,
    'job_stage_unchanged', true
  );
end;
$$;


ALTER FUNCTION "public"."record_job_payment_provider_event_v1"("p_payload" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."record_job_payment_provider_event_v1"("p_payload" "jsonb") IS 'Stripe Connect webhook settlement. Event id is delivery idempotency. Succeeded capture is canonical per PaymentIntent (and at most one per request). Paid never regresses. NEVER writes jobs.stage.';



CREATE OR REPLACE FUNCTION "public"."record_job_payment_refund_event_v1"("p_payload" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_event_id text;
  v_raw_type text;
  v_event_at timestamptz;
  v_account text;
  v_provider_refund_id text;
  v_command_id uuid;
  v_pi text;
  v_charge text;
  v_amount integer;
  v_status text;
  v_reason_code text;
  v_reason_message text;
  v_provider_created timestamptz;
  v_refund public.job_payment_refunds%rowtype;
  v_capture public.job_payment_transactions%rowtype;
  v_request public.job_payment_requests%rowtype;
  v_receipt public.job_payment_refund_event_receipts%rowtype;
  v_correlation text := 'none';
  v_disposition text := 'unbound';
  v_before_stage text;
  v_before_entered timestamptz;
  v_after_stage text;
  v_after_entered timestamptz;
  v_reserved bigint;
  v_apply boolean := false;
begin
  begin
    v_event_id := nullif(trim(p_payload->>'provider_event_id'), '');
    v_raw_type := nullif(trim(p_payload->>'raw_type'), '');
    v_event_at := nullif(p_payload->>'provider_event_created_at', '')::timestamptz;
    v_account := nullif(trim(p_payload->>'provider_account_id'), '');
    v_provider_refund_id := nullif(trim(p_payload->>'provider_refund_id'), '');
    v_command_id := nullif(p_payload->>'metadata_refund_command_id', '')::uuid;
    v_pi := nullif(trim(p_payload->>'provider_payment_intent_id'), '');
    v_charge := nullif(trim(p_payload->>'provider_charge_id'), '');
    v_amount := nullif(p_payload->>'amount_cents', '')::integer;
    v_status := nullif(trim(p_payload->>'status'), '');
    v_reason_code := nullif(left(trim(p_payload->>'provider_reason_code'), 120), '');
    v_reason_message := nullif(left(trim(p_payload->>'provider_reason_message'), 1000), '');
    v_provider_created := nullif(p_payload->>'provider_created_at', '')::timestamptz;
  exception when others then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end;

  if v_event_id is null
    or v_raw_type is null
    or v_event_at is null
    or v_account is null
  then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('job_payment_refund_event:' || v_account || ':' || v_event_id, 0)
  );

  if v_provider_refund_id is not null then
    perform pg_advisory_xact_lock(
      hashtextextended(
        'stripe_refund_identity:' || v_account || ':' || v_provider_refund_id,
        0
      )
    );
  end if;

  select e.* into v_receipt
  from public.job_payment_refund_event_receipts e
  where e.provider_account_id = v_account
    and e.provider_event_id = v_event_id;

  if found then
    return jsonb_build_object(
      'ok', true,
      'idempotent_replay', true,
      'receipt_id', v_receipt.id,
      'refund_id', v_receipt.refund_id,
      'disposition', v_receipt.disposition
    );
  end if;

  if v_provider_refund_id is not null then
    select r.* into v_refund
    from public.job_payment_refunds r
    where r.provider_account_id = v_account
      and r.provider_refund_id = v_provider_refund_id
    for update;
    if found then
      v_correlation := 'provider_refund_id';
    end if;
  end if;

  if v_refund.id is null and v_command_id is not null then
    select r.* into v_refund
    from public.job_payment_refunds r
    where r.id = v_command_id
      and r.provider_account_id = v_account
    for update;
    if found then
      v_correlation := 'metadata_command_id';
    end if;
  end if;

  if v_refund.id is null and (v_pi is not null or v_charge is not null) then
    select t.* into v_capture
    from public.job_payment_transactions t
    join public.job_payment_requests r
      on r.id = t.payment_request_id
     and r.company_id = t.company_id
    where t.provider = 'stripe'
      and t.kind = 'capture'
      and t.status = 'succeeded'
      and t.currency = 'usd'
      and r.provider_account_id = v_account
      and (
        (v_pi is not null and t.provider_payment_intent_id = v_pi)
        or (
          v_pi is null
          and v_charge is not null
          and t.provider_charge_id = v_charge
        )
      )
    order by t.occurred_at asc, t.created_at asc, t.id asc
    limit 1;

    if found then
      perform pg_advisory_xact_lock(
        hashtextextended(
          'job_payment_refund:' || v_capture.company_id::text || ':' || v_capture.id::text,
          0
        )
      );

      select t.* into v_capture
      from public.job_payment_transactions t
      where t.id = v_capture.id
        and t.company_id = v_capture.company_id
        and t.kind = 'capture'
        and t.status = 'succeeded'
      for update;

      v_correlation := case when v_pi is not null then 'payment_intent' else 'charge' end;
      select r.* into v_request
      from public.job_payment_requests r
      where r.id = v_capture.payment_request_id
        and r.company_id = v_capture.company_id
      for update;
    end if;
  end if;

  if v_refund.id is not null then
    if (v_provider_refund_id is not null
        and v_refund.provider_refund_id is not null
        and v_refund.provider_refund_id is distinct from v_provider_refund_id)
      or (v_pi is not null and v_refund.provider_payment_intent_id is distinct from v_pi)
      or (v_charge is not null
          and v_refund.provider_charge_id is not null
          and v_refund.provider_charge_id is distinct from v_charge)
      or (v_amount is not null and v_refund.amount_cents is distinct from v_amount)
    then
      v_disposition := 'identity_mismatch';
      v_refund := null;
    elsif v_amount is null
      or (
        v_status is distinct from 'failed'
        and v_provider_refund_id is null
        and v_refund.provider_refund_id is null
      )
      or v_status is null
      or v_status not in (
        'pending', 'requires_action', 'succeeded', 'failed', 'canceled'
      )
    then
      v_disposition := 'unsupported';
    else
      select s.job_stage, s.stage_entered_at
      into v_before_stage, v_before_entered
      from public.job_payment_snapshot_stage_v1(v_refund.company_id, v_refund.job_id) s;

      v_apply :=
        v_event_at >= coalesce(
          v_refund.last_provider_event_created_at,
          v_refund.provider_updated_at,
          '-infinity'::timestamptz
        )
        and not (
          v_refund.status in ('succeeded', 'failed', 'canceled')
          and v_status in ('pending', 'requires_action')
        );

      if v_apply then
        update public.job_payment_refunds
        set
          provider_refund_id = coalesce(provider_refund_id, v_provider_refund_id),
          provider_charge_id = coalesce(provider_charge_id, v_charge),
          status = v_status,
          provider_reason_code = coalesce(v_reason_code, provider_reason_code),
          provider_reason_message = coalesce(v_reason_message, provider_reason_message),
          provider_created_at = coalesce(provider_created_at, v_provider_created),
          provider_updated_at = greatest(
            coalesce(provider_updated_at, '-infinity'::timestamptz),
            v_event_at
          ),
          last_provider_event_created_at = greatest(
            coalesce(last_provider_event_created_at, '-infinity'::timestamptz),
            v_event_at
          ),
          pending_at = case
            when v_status = 'pending' then coalesce(pending_at, v_event_at)
            else pending_at
          end,
          requires_action_at = case
            when v_status = 'requires_action' then coalesce(requires_action_at, v_event_at)
            else requires_action_at
          end,
          succeeded_at = case
            when v_status = 'succeeded' then coalesce(succeeded_at, v_event_at)
            else succeeded_at
          end,
          failed_at = case
            when v_status = 'failed' then coalesce(failed_at, v_event_at)
            else failed_at
          end,
          canceled_at = case
            when v_status = 'canceled' then coalesce(canceled_at, v_event_at)
            else canceled_at
          end
        where id = v_refund.id
        returning * into v_refund;
        v_disposition := 'applied';
      else
        v_disposition := 'stale';
      end if;

      select s.job_stage, s.stage_entered_at
      into v_after_stage, v_after_entered
      from public.job_payment_snapshot_stage_v1(v_refund.company_id, v_refund.job_id) s;
      if v_after_stage is distinct from v_before_stage
        or v_after_entered is distinct from v_before_entered
      then
        raise exception 'refund event must not change job stage';
      end if;
    end if;
  elsif v_capture.id is not null
    and v_capture.provider_payment_intent_id is not null
    and v_request.id is not null
    and v_provider_refund_id is not null
    and v_amount is not null
    and v_amount > 0
    and v_status in ('pending', 'requires_action', 'succeeded', 'failed', 'canceled')
  then
    select coalesce(sum(r.amount_cents), 0)
    into v_reserved
    from public.job_payment_refunds r
    where r.company_id = v_capture.company_id
      and r.canonical_capture_transaction_id = v_capture.id
      and r.status in ('initiating', 'pending', 'requires_action', 'succeeded');

    if v_reserved + v_amount <= v_capture.amount_cents then
      select s.job_stage, s.stage_entered_at
      into v_before_stage, v_before_entered
      from public.job_payment_snapshot_stage_v1(v_capture.company_id, v_request.job_id) s;

      insert into public.job_payment_refunds (
        id,
        company_id,
        job_id,
        payment_request_id,
        canonical_capture_transaction_id,
        provider,
        provider_account_id,
        provider_payment_intent_id,
        provider_charge_id,
        provider_refund_id,
        amount_cents,
        currency,
        origin,
        created_by_user_id,
        internal_reason,
        idempotency_key,
        status,
        provider_reason_code,
        provider_reason_message,
        provider_created_at,
        provider_updated_at,
        last_provider_event_created_at,
        pending_at,
        requires_action_at,
        succeeded_at,
        failed_at,
        canceled_at
      )
      values (
        gen_random_uuid(),
        v_capture.company_id,
        v_request.job_id,
        v_request.id,
        v_capture.id,
        'stripe',
        v_account,
        v_capture.provider_payment_intent_id,
        coalesce(v_charge, v_capture.provider_charge_id),
        v_provider_refund_id,
        v_amount,
        'usd',
        'stripe_dashboard',
        null,
        null,
        'stripe-refund:' || v_provider_refund_id,
        v_status,
        v_reason_code,
        v_reason_message,
        v_provider_created,
        v_event_at,
        v_event_at,
        case when v_status = 'pending' then v_event_at end,
        case when v_status = 'requires_action' then v_event_at end,
        case when v_status = 'succeeded' then v_event_at end,
        case when v_status = 'failed' then v_event_at end,
        case when v_status = 'canceled' then v_event_at end
      )
      returning * into v_refund;
      v_disposition := 'applied';

      select s.job_stage, s.stage_entered_at
      into v_after_stage, v_after_entered
      from public.job_payment_snapshot_stage_v1(v_refund.company_id, v_refund.job_id) s;
      if v_after_stage is distinct from v_before_stage
        or v_after_entered is distinct from v_before_entered
      then
        raise exception 'refund event must not change job stage';
      end if;
    else
      v_disposition := 'overrefund_conflict';
    end if;
  elsif v_disposition = 'unbound'
    and v_status not in (
      'pending', 'requires_action', 'succeeded', 'failed', 'canceled'
    )
  then
    v_disposition := 'unsupported';
  end if;

  insert into public.job_payment_refund_event_receipts (
    company_id,
    refund_id,
    provider,
    provider_account_id,
    provider_event_id,
    raw_type,
    provider_event_created_at,
    provider_refund_id,
    metadata_refund_command_id,
    provider_payment_intent_id,
    provider_charge_id,
    amount_cents,
    provider_status_raw,
    refund_status,
    correlation_method,
    disposition
  )
  values (
    v_refund.company_id,
    v_refund.id,
    'stripe',
    v_account,
    v_event_id,
    v_raw_type,
    v_event_at,
    v_provider_refund_id,
    v_command_id,
    v_pi,
    v_charge,
    v_amount,
    left(v_status, 120),
    case
      when v_status in (
        'pending', 'requires_action', 'succeeded', 'failed', 'canceled'
      ) then v_status
      else null
    end,
    v_correlation,
    v_disposition
  )
  returning * into v_receipt;

  return jsonb_build_object(
    'ok', true,
    'idempotent_replay', false,
    'receipt_id', v_receipt.id,
    'refund_id', v_receipt.refund_id,
    'status', v_refund.status,
    'disposition', v_receipt.disposition,
    'correlation_method', v_receipt.correlation_method,
    'job_stage_unchanged', case when v_refund.id is not null then true else null end
  );
end;
$$;


ALTER FUNCTION "public"."record_job_payment_refund_event_v1"("p_payload" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."record_job_payment_refund_event_v1"("p_payload" "jsonb") IS 'Service-only Stripe refund event owner. Dedupes by connected account + event id, correlates Refund/command/canonical capture, uses the individual Refund amount, projects Dashboard refunds, and never reads charge.amount_refunded.';



CREATE OR REPLACE FUNCTION "public"."record_proposal_acceptance_v1"("p_token_hash" "text", "p_accepted_by_name" "text" DEFAULT NULL::"text", "p_accepted_by_email" "text" DEFAULT NULL::"text", "p_payload_json" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_assert jsonb;
  v_token_id uuid;
  v_company_id uuid;
  v_proposal_id uuid;
  v_proposal_version_id uuid;
  v_job_id uuid;
  v_locked_token record;
  v_proposal public.proposals%rowtype;
  v_job public.jobs%rowtype;
  v_frozen record;
  v_name text;
  v_email text;
  v_payload jsonb;
  v_before_selected_option_id uuid;
  v_acceptance public.proposal_acceptances%rowtype;
  v_idempotent_replay boolean := false;
  v_guard jsonb;
  v_guard_result text;
  v_reason text;
  v_attention jsonb;
  v_attention_id uuid;
  v_after_selected_option_id uuid;
  v_option_key text;
  v_choice_option_id uuid := null;
  v_choice_option_label text := null;
  v_choice_total_cents integer := null;
begin
  v_assert := public.proposal_assert_public_access_token_active_v1(p_token_hash);

  if coalesce((v_assert->>'ok')::boolean, false) is not true then
    return v_assert;
  end if;

  v_token_id := (v_assert->>'token_id')::uuid;
  v_company_id := (v_assert->>'company_id')::uuid;
  v_proposal_id := (v_assert->>'proposal_id')::uuid;
  v_proposal_version_id := (v_assert->>'proposal_version_id')::uuid;

  select
    t.id,
    t.company_id,
    t.proposal_id,
    t.proposal_version_id,
    t.status,
    t.expires_at,
    pv.version_kind,
    pv.frozen_at
  into v_locked_token
  from public.proposal_public_access_tokens t
  join public.proposal_versions pv
    on pv.id = t.proposal_version_id
   and pv.company_id = t.company_id
   and pv.proposal_id = t.proposal_id
  where t.id = v_token_id
    and t.token_hash = trim(coalesce(p_token_hash, ''))
  for share of t, pv;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'invalid_binding');
  end if;

  if v_locked_token.status = 'revoked' then
    return jsonb_build_object('ok', false, 'code', 'revoked');
  end if;

  if v_locked_token.status = 'superseded' then
    return jsonb_build_object('ok', false, 'code', 'superseded');
  end if;

  if v_locked_token.status <> 'active'
    or v_locked_token.expires_at < now() then
    return jsonb_build_object('ok', false, 'code', 'expired');
  end if;

  if v_locked_token.company_id is distinct from v_company_id
    or v_locked_token.proposal_id is distinct from v_proposal_id
    or v_locked_token.proposal_version_id is distinct from v_proposal_version_id
    or v_locked_token.version_kind not in ('sent', 'signed')
    or v_locked_token.frozen_at is null
  then
    return jsonb_build_object('ok', false, 'code', 'invalid_binding');
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('proposal_acceptance:' || v_proposal_id::text, 0)
  );

  select p.*
  into v_proposal
  from public.proposals p
  where p.id = v_proposal_id
    and p.company_id = v_company_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'proposal_unavailable');
  end if;

  v_job_id := v_proposal.job_id;
  v_before_selected_option_id := v_proposal.selected_option_id;

  if v_job_id is null then
    return jsonb_build_object('ok', false, 'code', 'proposal_unavailable');
  end if;

  select j.*
  into v_job
  from public.jobs j
  where j.id = v_job_id
    and j.company_id = v_company_id
    and j.deleted_at is null
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'job_mismatch');
  end if;

  select *
  into v_frozen
  from public.proposal_acceptance_frozen_selected_option_v1(
    v_company_id,
    v_proposal_version_id
  );

  if v_frozen.option_id is null then
    return jsonb_build_object('ok', false, 'code', 'option_not_on_version');
  end if;

  v_name := nullif(trim(coalesce(p_accepted_by_name, '')), '');
  if v_name is not null and char_length(v_name) > 120 then
    return jsonb_build_object('ok', false, 'code', 'invalid_customer_name');
  end if;

  v_email := nullif(trim(coalesce(p_accepted_by_email, '')), '');
  if v_email is not null and char_length(v_email) > 254 then
    return jsonb_build_object('ok', false, 'code', 'invalid_customer_email');
  end if;

  v_payload := coalesce(p_payload_json, '{}'::jsonb);
  if jsonb_typeof(v_payload) <> 'object' then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  if public.proposal_forbidden_token_json_keys(v_payload) then
    return jsonb_build_object('ok', false, 'code', 'forbidden_payload_keys');
  end if;

  -- Customer package choice. Absent key preserves pre-049 behavior exactly.
  v_option_key := nullif(trim(coalesce(v_payload->>'customer_option_key', '')), '');

  if v_option_key is not null then
    if char_length(v_option_key) > 200 then
      return jsonb_build_object('ok', false, 'code', 'invalid_option_choice');
    end if;

    select c.option_id, c.option_label, c.total_cents
    into v_choice_option_id, v_choice_option_label, v_choice_total_cents
    from public.proposal_resolve_customer_chosen_option_v1(
      v_company_id,
      v_proposal_version_id,
      v_option_key
    ) c;

    if v_choice_option_id is null or v_choice_total_cents is null then
      return jsonb_build_object('ok', false, 'code', 'invalid_option_choice');
    end if;
  end if;

  select a.*
  into v_acceptance
  from public.proposal_acceptances a
  where a.company_id = v_company_id
    and a.proposal_id = v_proposal_id
    and a.proposal_version_id = v_proposal_version_id
    and a.proposal_option_id = v_frozen.option_id
  for update;

  if found then
    v_idempotent_replay := true;
  else
    v_guard := public.classify_proposal_acceptance_guard_v1(
      v_company_id,
      v_job_id,
      v_proposal_id,
      v_proposal_version_id,
      v_frozen.option_id,
      null
    );

    if coalesce(v_guard->>'result', '') = 'invalid' then
      return jsonb_build_object(
        'ok', false,
        'code', coalesce(v_guard->>'reason', 'invalid_binding')
      );
    end if;

    v_guard_result := v_guard->>'result';
    v_reason := nullif(v_guard->>'reason', '');

    begin
      insert into public.proposal_acceptances (
        company_id,
        job_id,
        proposal_id,
        proposal_version_id,
        proposal_option_id,
        public_access_token_id,
        accepted_by_name,
        accepted_by_email,
        accepted_option_label,
        accepted_total_cents,
        guard_result,
        ambiguity_reason,
        customer_chosen_option_id,
        customer_chosen_option_label,
        customer_chosen_total_cents
      ) values (
        v_company_id,
        v_job_id,
        v_proposal_id,
        v_proposal_version_id,
        v_frozen.option_id,
        v_token_id,
        v_name,
        v_email,
        v_frozen.option_label,
        v_frozen.customer_total_cents,
        v_guard_result,
        v_reason,
        v_choice_option_id,
        v_choice_option_label,
        v_choice_total_cents
      )
      returning * into v_acceptance;
    exception
      when unique_violation then
        select a.*
        into v_acceptance
        from public.proposal_acceptances a
        where a.company_id = v_company_id
          and a.proposal_id = v_proposal_id
          and a.proposal_version_id = v_proposal_version_id
          and a.proposal_option_id = v_frozen.option_id
        for update;
        v_idempotent_replay := true;
    end;
  end if;

  -- Customer acceptance never moves Job stage. Always surface Attention
  -- until the contractor explicitly Approves job — unless this logical
  -- acceptance was already operationally confirmed.
  if v_acceptance.confirmed_at is null then
    v_attention := public.project_proposal_acceptance_attention_v1(v_acceptance.id);
    v_attention_id := nullif(v_attention->>'attention_id', '')::uuid;
  else
    select ai.id
    into v_attention_id
    from public.job_attention_items ai
    where ai.company_id = v_acceptance.company_id
      and ai.source_type = 'proposal_acceptances'
      and ai.source_id = v_acceptance.id;
  end if;

  select p.selected_option_id
  into v_after_selected_option_id
  from public.proposals p
  where p.id = v_proposal_id
    and p.company_id = v_company_id;

  if v_after_selected_option_id is distinct from v_before_selected_option_id then
    raise exception 'formal acceptance must not mutate proposals.selected_option_id';
  end if;

  return jsonb_build_object(
    'ok', true,
    'acceptance_id', v_acceptance.id,
    'token_id', v_token_id,
    'company_id', v_company_id,
    'job_id', v_job_id,
    'proposal_id', v_proposal_id,
    'proposal_version_id', v_proposal_version_id,
    'proposal_option_id', v_acceptance.proposal_option_id,
    'accepted_option_label', v_acceptance.accepted_option_label,
    'accepted_total_cents', v_acceptance.accepted_total_cents,
    'customer_chosen_option_id', v_acceptance.customer_chosen_option_id,
    'customer_chosen_option_label', v_acceptance.customer_chosen_option_label,
    'customer_chosen_total_cents', v_acceptance.customer_chosen_total_cents,
    'contract_total_cents', coalesce(
      v_acceptance.customer_chosen_total_cents,
      v_acceptance.accepted_total_cents
    ),
    'accepted_at', v_acceptance.accepted_at,
    'guard_result', v_acceptance.guard_result,
    'ambiguity_reason', v_acceptance.ambiguity_reason,
    'attention_id', v_attention_id,
    'job_stage', (
      select public.canonical_job_stage_from_row(
        j.stage, j.status, coalesce(j.archived, false), j.active_proposal_id, j.latest_proposal_id
      )
      from public.jobs j
      where j.id = v_job_id and j.company_id = v_company_id
    ),
    'stage_entered_at', (
      select j.stage_entered_at
      from public.jobs j
      where j.id = v_job_id and j.company_id = v_company_id
    ),
    'job_stage_unchanged', true,
    'idempotent_replay', v_idempotent_replay,
    'selected_option_id_unchanged', v_after_selected_option_id
  );
end;
$$;


ALTER FUNCTION "public"."record_proposal_acceptance_v1"("p_token_hash" "text", "p_accepted_by_name" "text", "p_accepted_by_email" "text", "p_payload_json" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."record_proposal_acceptance_v1"("p_token_hash" "text", "p_accepted_by_name" "text", "p_accepted_by_email" "text", "p_payload_json" "jsonb") IS 'R3C public formal acceptance. Validates the existing public-access token, inserts one immutable logical acceptance per frozen version+selected option, classifies valid_clean vs valid_review_required, and projects contractor Attention. NEVER updates jobs.stage or stage_entered_at. Never stores raw tokens. Same-version resend tokens reuse the logical row. Superseded/revoked/expired tokens are invalid and create no row.';



CREATE OR REPLACE FUNCTION "public"."record_proposal_customer_request_v1"("p_token_hash" "text", "p_intent" "text", "p_requested_option_id" "uuid" DEFAULT NULL::"uuid", "p_message" "text" DEFAULT NULL::"text", "p_customer_name" "text" DEFAULT NULL::"text", "p_customer_email" "text" DEFAULT NULL::"text", "p_customer_phone" "text" DEFAULT NULL::"text", "p_payload_json" "jsonb" DEFAULT '{}'::"jsonb", "p_submission_key" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_assert jsonb;
  v_token_id uuid;
  v_company_id uuid;
  v_proposal_id uuid;
  v_proposal_version_id uuid;
  v_job_id uuid;
  v_intent text;
  v_message text;
  v_customer_name text;
  v_customer_email text;
  v_customer_phone text;
  v_payload jsonb;
  v_option_id uuid;
  v_option_label text;
  v_request public.proposal_customer_requests%rowtype;
  v_attention jsonb;
  v_attention_id uuid;
  v_attention_status text;
  v_before_status text;
  v_before_selected_option_id uuid;
  v_before_job_stage text;
  v_after_status text;
  v_after_selected_option_id uuid;
  v_after_job_stage text;
  v_locked_token record;
  v_idempotent_replay boolean := false;
begin
  if p_submission_key is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_submission_key');
  end if;

  v_assert := public.proposal_assert_public_access_token_active_v1(p_token_hash);

  if coalesce((v_assert->>'ok')::boolean, false) is not true then
    return v_assert;
  end if;

  v_token_id := (v_assert->>'token_id')::uuid;
  v_company_id := (v_assert->>'company_id')::uuid;
  v_proposal_id := (v_assert->>'proposal_id')::uuid;
  v_proposal_version_id := (v_assert->>'proposal_version_id')::uuid;

  -- Lock token lifecycle and immutable version binding through source insert.
  select
    t.id,
    t.company_id,
    t.proposal_id,
    t.proposal_version_id,
    t.status,
    t.expires_at,
    pv.version_kind
  into v_locked_token
  from public.proposal_public_access_tokens t
  join public.proposal_versions pv
    on pv.id = t.proposal_version_id
   and pv.company_id = t.company_id
   and pv.proposal_id = t.proposal_id
  where t.id = v_token_id
    and t.token_hash = trim(coalesce(p_token_hash, ''))
  for share of t, pv;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'invalid_binding');
  end if;

  if v_locked_token.status = 'revoked' then
    return jsonb_build_object('ok', false, 'code', 'revoked');
  end if;

  if v_locked_token.status = 'superseded' then
    return jsonb_build_object('ok', false, 'code', 'superseded');
  end if;

  if v_locked_token.status <> 'active'
    or v_locked_token.expires_at < now() then
    return jsonb_build_object('ok', false, 'code', 'expired');
  end if;

  if v_locked_token.company_id is distinct from v_company_id
    or v_locked_token.proposal_id is distinct from v_proposal_id
    or v_locked_token.proposal_version_id is distinct from v_proposal_version_id
    or v_locked_token.version_kind not in ('sent', 'signed')
  then
    return jsonb_build_object('ok', false, 'code', 'invalid_binding');
  end if;

  select p.status, p.selected_option_id, p.job_id, j.stage
  into
    v_before_status,
    v_before_selected_option_id,
    v_job_id,
    v_before_job_stage
  from public.proposals p
  join public.jobs j
    on j.id = p.job_id
   and j.company_id = p.company_id
  where p.id = v_proposal_id
    and p.company_id = v_company_id
  for share of p, j;

  if not found or v_job_id is null then
    return jsonb_build_object('ok', false, 'code', 'proposal_unavailable');
  end if;

  v_intent := nullif(trim(coalesce(p_intent, '')), '');
  if v_intent is null
    or v_intent not in ('request_package', 'ask_question', 'ask_about_package') then
    return jsonb_build_object('ok', false, 'code', 'invalid_intent');
  end if;

  v_message := nullif(trim(coalesce(p_message, '')), '');
  if v_message is not null and char_length(v_message) > 2000 then
    return jsonb_build_object('ok', false, 'code', 'invalid_message');
  end if;

  v_customer_name := nullif(trim(coalesce(p_customer_name, '')), '');
  if v_customer_name is not null and char_length(v_customer_name) > 120 then
    return jsonb_build_object('ok', false, 'code', 'invalid_customer_name');
  end if;

  v_customer_email := nullif(trim(coalesce(p_customer_email, '')), '');
  if v_customer_email is not null and char_length(v_customer_email) > 254 then
    return jsonb_build_object('ok', false, 'code', 'invalid_customer_email');
  end if;

  v_customer_phone := nullif(trim(coalesce(p_customer_phone, '')), '');
  if v_customer_phone is not null and char_length(v_customer_phone) > 40 then
    return jsonb_build_object('ok', false, 'code', 'invalid_customer_phone');
  end if;

  v_payload := coalesce(p_payload_json, '{}'::jsonb);
  if jsonb_typeof(v_payload) <> 'object' then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  if public.proposal_forbidden_token_json_keys(v_payload) then
    return jsonb_build_object('ok', false, 'code', 'forbidden_payload_keys');
  end if;

  v_payload := v_payload
    - 'company_id'
    - 'job_id'
    - 'proposal_id'
    - 'proposal_version_id'
    - 'token_id'
    - 'public_access_token_id'
    - 'raw_token'
    - 'token'
    - 'token_hash'
    - 'attention_type'
    - 'attention_id';

  if v_intent in ('request_package', 'ask_about_package') then
    if p_requested_option_id is null then
      return jsonb_build_object('ok', false, 'code', 'option_required');
    end if;

    select
      po.id,
      left(
        coalesce(nullif(trim(po.customer_label), ''), nullif(trim(po.name), ''), 'Package'),
        120
      )
    into v_option_id, v_option_label
    from public.proposal_options po
    where po.company_id = v_company_id
      and po.proposal_version_id = v_proposal_version_id
      and po.visible_to_customer = true
      and (
        po.id = p_requested_option_id
        or po.source_template_option_id = p_requested_option_id
      )
    order by
      case when po.id = p_requested_option_id then 0 else 1 end,
      po.sort_order
    limit 1;

    if v_option_id is null then
      return jsonb_build_object('ok', false, 'code', 'option_not_on_version');
    end if;
  else
    v_option_id := null;
    v_option_label := null;
  end if;

  -- Serialize retries for this token + deliberate submission occurrence.
  perform pg_advisory_xact_lock(
    hashtextextended(v_token_id::text || ':' || p_submission_key::text, 0)
  );

  select r.*
  into v_request
  from public.proposal_customer_requests r
  where r.public_access_token_id = v_token_id
    and r.submission_key = p_submission_key
  for update;

  if found then
    v_idempotent_replay := true;
    if v_request.company_id is distinct from v_company_id
      or v_request.proposal_id is distinct from v_proposal_id
      or v_request.proposal_version_id is distinct from v_proposal_version_id
      or v_request.intent is distinct from v_intent
      or v_request.requested_option_id is distinct from v_option_id
      or v_request.message is distinct from v_message
      or v_request.customer_name is distinct from v_customer_name
      or v_request.customer_email is distinct from v_customer_email
      or v_request.customer_phone is distinct from v_customer_phone
      or v_request.payload_json is distinct from v_payload
    then
      return jsonb_build_object('ok', false, 'code', 'idempotency_conflict');
    end if;

    if v_request.status in ('new', 'seen') then
      v_attention :=
        public.project_proposal_customer_request_attention_v1(v_request.id);
      v_attention_id := (v_attention->>'attention_id')::uuid;
    else
      select ai.id, ai.status
      into v_attention_id, v_attention_status
      from public.job_attention_items ai
      where ai.company_id = v_request.company_id
        and ai.source_type = 'proposal_customer_requests'
        and ai.source_id = v_request.id
        and ai.job_id = v_job_id
        and ai.proposal_id = v_request.proposal_id
        and ai.proposal_version_id = v_request.proposal_version_id
        and ai.attention_type = case
          when v_request.intent = 'request_package'
            then 'customer_package_request'
          else 'customer_question'
        end
        and ai.source_occurred_at = v_request.created_at
        and ai.dedupe_key =
          ('customer_request:proposal_customer_requests:' || v_request.id::text)
        and ai.destination_kind = 'job_card_proposals'
        and ai.destination_json = jsonb_build_object(
          'proposal_id', v_request.proposal_id,
          'proposal_version_id', v_request.proposal_version_id,
          'request_id', v_request.id,
          'tab', 'proposals',
          'anchor', 'customer_request'
        );

      if not found then
        raise exception 'idempotent request exists without its required attention item';
      end if;

      if v_attention_status <> 'resolved' then
        raise exception 'dismissed idempotent request must retain resolved attention';
      end if;
    end if;
  else
    insert into public.proposal_customer_requests (
      company_id,
      proposal_id,
      proposal_version_id,
      public_access_token_id,
      submission_key,
      intent,
      requested_option_id,
      requested_option_label,
      message,
      customer_name,
      customer_email,
      customer_phone,
      status,
      payload_json
    ) values (
      v_company_id,
      v_proposal_id,
      v_proposal_version_id,
      v_token_id,
      p_submission_key,
      v_intent,
      v_option_id,
      v_option_label,
      v_message,
      v_customer_name,
      v_customer_email,
      v_customer_phone,
      'new',
      v_payload
    )
    returning * into v_request;

    -- Same transaction: any projection exception rolls back the source insert.
    v_attention :=
      public.project_proposal_customer_request_attention_v1(v_request.id);
    v_attention_id := (v_attention->>'attention_id')::uuid;
  end if;

  select p.status, p.selected_option_id, j.stage
  into v_after_status, v_after_selected_option_id, v_after_job_stage
  from public.proposals p
  join public.jobs j
    on j.id = p.job_id
   and j.company_id = p.company_id
  where p.id = v_proposal_id
    and p.company_id = v_company_id;

  if v_after_status is distinct from v_before_status
    or v_after_selected_option_id is distinct from v_before_selected_option_id
    or v_after_job_stage is distinct from v_before_job_stage
  then
    raise exception 'customer request attention producer must not mutate proposal/job/package/lifecycle truth';
  end if;

  return jsonb_build_object(
    'ok', true,
    'request_id', v_request.id,
    'attention_id', v_attention_id,
    'intent', v_request.intent,
    'status', v_request.status,
    'token_id', v_token_id,
    'proposal_id', v_proposal_id,
    'proposal_version_id', v_proposal_version_id,
    'requested_option_id', v_request.requested_option_id,
    'requested_option_label', v_request.requested_option_label,
    'idempotent_replay', v_idempotent_replay,
    'proposal_status_unchanged', v_after_status,
    'selected_option_id_unchanged', v_after_selected_option_id,
    'job_stage_unchanged', v_after_job_stage
  );
end;
$$;


ALTER FUNCTION "public"."record_proposal_customer_request_v1"("p_token_hash" "text", "p_intent" "text", "p_requested_option_id" "uuid", "p_message" "text", "p_customer_name" "text", "p_customer_email" "text", "p_customer_phone" "text", "p_payload_json" "jsonb", "p_submission_key" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."record_proposal_customer_request_v1"("p_token_hash" "text", "p_intent" "text", "p_requested_option_id" "uuid", "p_message" "text", "p_customer_name" "text", "p_customer_email" "text", "p_customer_phone" "text", "p_payload_json" "jsonb", "p_submission_key" "uuid") IS 'R3B4A atomically creates or reuses one idempotent customer request and exactly one linked attention item. Never stores raw tokens or mutates lifecycle truth.';



CREATE OR REPLACE FUNCTION "public"."record_proposal_customer_view_v1"("p_token_hash" "text", "p_ip_hash" "text" DEFAULT NULL::"text", "p_user_agent" "text" DEFAULT NULL::"text", "p_referrer_host" "text" DEFAULT NULL::"text", "p_payload_json" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
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
$_$;


ALTER FUNCTION "public"."record_proposal_customer_view_v1"("p_token_hash" "text", "p_ip_hash" "text", "p_user_agent" "text", "p_referrer_host" "text", "p_payload_json" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."record_proposal_customer_view_v1"("p_token_hash" "text", "p_ip_hash" "text", "p_user_agent" "text", "p_referrer_host" "text", "p_payload_json" "jsonb") IS 'R18C2B — Record customer view activity. service_role execute only; called from Next.js server after successful public proposal serve (R18C4+).';



CREATE OR REPLACE FUNCTION "public"."record_proposal_public_option_choice_v1"("p_token_hash" "text", "p_option_key" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_assert jsonb;
  v_token_id uuid;
  v_company_id uuid;
  v_proposal_id uuid;
  v_proposal_version_id uuid;
  v_option_key text;
  v_option_id uuid;
  v_option_label text;
  v_total_cents integer;
  v_existing public.proposal_public_option_choices%rowtype;
  v_row public.proposal_public_option_choices%rowtype;
  v_locked boolean := false;
begin
  v_assert := public.proposal_assert_public_access_token_active_v1(p_token_hash);
  if coalesce(v_assert->>'ok', '') <> 'true' then
    return v_assert;
  end if;

  v_token_id := (v_assert->>'token_id')::uuid;
  v_company_id := (v_assert->>'company_id')::uuid;
  v_proposal_id := (v_assert->>'proposal_id')::uuid;
  v_proposal_version_id := (v_assert->>'proposal_version_id')::uuid;

  v_option_key := nullif(trim(coalesce(p_option_key, '')), '');
  if v_option_key is null or char_length(v_option_key) > 200 then
    return jsonb_build_object('ok', false, 'code', 'invalid_option_choice');
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'proposal_public_option_choice:' || v_company_id::text || ':' || v_proposal_version_id::text,
      0
    )
  );

  if exists (
    select 1
    from public.proposal_acceptances a
    where a.company_id = v_company_id
      and a.proposal_id = v_proposal_id
      and a.proposal_version_id = v_proposal_version_id
  ) then
    v_locked := true;
  end if;

  select c.option_id, c.option_label, c.total_cents
  into v_option_id, v_option_label, v_total_cents
  from public.proposal_resolve_customer_chosen_option_v1(
    v_company_id,
    v_proposal_version_id,
    v_option_key
  ) c;

  if v_option_id is null or v_total_cents is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_option_choice');
  end if;

  select *
  into v_existing
  from public.proposal_public_option_choices c
  where c.company_id = v_company_id
    and c.proposal_id = v_proposal_id
    and c.proposal_version_id = v_proposal_version_id
  for update;

  if found then
    if v_locked and v_existing.chosen_option_id is distinct from v_option_id then
      return jsonb_build_object(
        'ok', false,
        'code', 'choice_locked',
        'option_key', v_existing.chosen_option_key,
        'option_id', v_existing.chosen_option_id,
        'option_label', v_existing.chosen_option_label,
        'total_cents', v_existing.chosen_total_cents
      );
    end if;

    if v_existing.chosen_option_id is not distinct from v_option_id
      and v_existing.chosen_total_cents is not distinct from v_total_cents
    then
      update public.proposal_public_option_choices
      set public_access_token_id = v_token_id
      where id = v_existing.id
      returning * into v_row;

      return jsonb_build_object(
        'ok', true,
        'id', v_row.id,
        'option_id', v_row.chosen_option_id,
        'option_key', v_row.chosen_option_key,
        'option_label', v_row.chosen_option_label,
        'total_cents', v_row.chosen_total_cents,
        'idempotent_replay', true,
        'locked', v_locked
      );
    end if;

    update public.proposal_public_option_choices
    set
      public_access_token_id = v_token_id,
      chosen_option_id = v_option_id,
      chosen_option_key = v_option_key,
      chosen_option_label = v_option_label,
      chosen_total_cents = v_total_cents
    where id = v_existing.id
    returning * into v_row;
  else
    if v_locked then
      return jsonb_build_object('ok', false, 'code', 'choice_locked');
    end if;

    insert into public.proposal_public_option_choices (
      company_id,
      proposal_id,
      proposal_version_id,
      public_access_token_id,
      chosen_option_id,
      chosen_option_key,
      chosen_option_label,
      chosen_total_cents
    )
    values (
      v_company_id,
      v_proposal_id,
      v_proposal_version_id,
      v_token_id,
      v_option_id,
      v_option_key,
      v_option_label,
      v_total_cents
    )
    returning * into v_row;
  end if;

  return jsonb_build_object(
    'ok', true,
    'id', v_row.id,
    'option_id', v_row.chosen_option_id,
    'option_key', v_row.chosen_option_key,
    'option_label', v_row.chosen_option_label,
    'total_cents', v_row.chosen_total_cents,
    'idempotent_replay', false,
    'locked', false
  );
end;
$$;


ALTER FUNCTION "public"."record_proposal_public_option_choice_v1"("p_token_hash" "text", "p_option_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_proposal_signature_v1"("p_token_hash" "text", "p_signer_printed_name" "text", "p_signer_email" "text", "p_drawn_mark_json" "jsonb", "p_payload_json" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_name text;
  v_email text;
  v_payload jsonb;
  v_mark_error text;
  v_accept jsonb;
  v_acceptance public.proposal_acceptances%rowtype;
  v_signature public.proposal_signatures%rowtype;
  v_idempotent_replay boolean := false;
  v_acceptance_replay boolean := false;
  v_before_stage text;
  v_before_entered timestamptz;
  v_before_signed_version uuid;
  v_after_stage text;
  v_after_entered timestamptz;
  v_after_signed_version uuid;
  v_company_id uuid;
  v_job_id uuid;
  v_proposal_id uuid;
  v_ack_text constant text :=
    'I accept and sign this proposal as shown, including the selected package and total.';
begin
  v_name := nullif(trim(regexp_replace(coalesce(p_signer_printed_name, ''), '\s+', ' ', 'g')), '');
  if v_name is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_signer_name');
  end if;
  if char_length(v_name) > 120 then
    return jsonb_build_object('ok', false, 'code', 'invalid_signer_name');
  end if;

  v_email := nullif(trim(coalesce(p_signer_email, '')), '');
  if v_email is not null and char_length(v_email) > 254 then
    return jsonb_build_object('ok', false, 'code', 'invalid_signer_email');
  end if;

  v_payload := coalesce(p_payload_json, '{}'::jsonb);
  if jsonb_typeof(v_payload) <> 'object' then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;
  if public.proposal_forbidden_token_json_keys(v_payload) then
    return jsonb_build_object('ok', false, 'code', 'forbidden_payload_keys');
  end if;

  v_mark_error := public.proposal_signature_mark_error_v1(p_drawn_mark_json);
  if v_mark_error is not null then
    return jsonb_build_object('ok', false, 'code', v_mark_error);
  end if;

  -- Nested R3C owner shares this transaction. Later RAISE rolls it back.
  v_accept := public.record_proposal_acceptance_v1(
    p_token_hash,
    v_name,
    v_email,
    '{}'::jsonb
  );

  if coalesce((v_accept->>'ok')::boolean, false) is not true then
    return v_accept;
  end if;

  v_acceptance_replay := coalesce((v_accept->>'idempotent_replay')::boolean, false);
  v_company_id := (v_accept->>'company_id')::uuid;
  v_job_id := (v_accept->>'job_id')::uuid;
  v_proposal_id := (v_accept->>'proposal_id')::uuid;

  select a.*
  into v_acceptance
  from public.proposal_acceptances a
  where a.id = (v_accept->>'acceptance_id')::uuid
    and a.company_id = v_company_id
  for update;

  if not found then
    raise exception 'signature acceptance row missing after record_proposal_acceptance_v1';
  end if;

  select
    public.canonical_job_stage_from_row(
      j.stage, j.status, coalesce(j.archived, false), j.active_proposal_id, j.latest_proposal_id
    ),
    j.stage_entered_at,
    p.signed_version_id
  into v_before_stage, v_before_entered, v_before_signed_version
  from public.jobs j
  join public.proposals p
    on p.id = v_proposal_id
   and p.company_id = j.company_id
  where j.id = v_job_id
    and j.company_id = v_company_id;

  select s.*
  into v_signature
  from public.proposal_signatures s
  where s.company_id = v_company_id
    and s.proposal_acceptance_id = v_acceptance.id
    and s.signer_slot = 'customer_primary'
  for update;

  if found then
    v_idempotent_replay := true;
  else
    begin
      insert into public.proposal_signatures (
        company_id,
        job_id,
        proposal_id,
        proposal_version_id,
        proposal_option_id,
        proposal_acceptance_id,
        public_access_token_id,
        signer_slot,
        signer_printed_name,
        signer_email,
        typed_name_echo,
        drawn_mark_json,
        acknowledgement_key,
        acknowledgement_text,
        source,
        method
      ) values (
        v_acceptance.company_id,
        v_acceptance.job_id,
        v_acceptance.proposal_id,
        v_acceptance.proposal_version_id,
        v_acceptance.proposal_option_id,
        v_acceptance.id,
        (v_accept->>'token_id')::uuid,
        'customer_primary',
        v_name,
        v_email,
        v_name,
        p_drawn_mark_json,
        'fielddive_proposal_signature_v1',
        v_ack_text,
        'public_token',
        'drawn_signature'
      )
      returning * into v_signature;
    exception
      when unique_violation then
        select s.*
        into v_signature
        from public.proposal_signatures s
        where s.company_id = v_company_id
          and s.proposal_acceptance_id = v_acceptance.id
          and s.signer_slot = 'customer_primary'
        for update;
        v_idempotent_replay := true;
    end;
  end if;

  select
    public.canonical_job_stage_from_row(
      j.stage, j.status, coalesce(j.archived, false), j.active_proposal_id, j.latest_proposal_id
    ),
    j.stage_entered_at,
    p.signed_version_id
  into v_after_stage, v_after_entered, v_after_signed_version
  from public.jobs j
  join public.proposals p
    on p.id = v_proposal_id
   and p.company_id = j.company_id
  where j.id = v_job_id
    and j.company_id = v_company_id;

  if v_after_stage is distinct from v_before_stage
    or v_after_entered is distinct from v_before_entered
  then
    raise exception 'proposal signature must not change job stage';
  end if;

  if v_after_signed_version is distinct from v_before_signed_version then
    raise exception 'proposal signature must not write proposals.signed_version_id';
  end if;

  return jsonb_build_object(
    'ok', true,
    'signature_id', v_signature.id,
    'acceptance_id', v_acceptance.id,
    'token_id', v_signature.public_access_token_id,
    'company_id', v_signature.company_id,
    'job_id', v_signature.job_id,
    'proposal_id', v_signature.proposal_id,
    'proposal_version_id', v_signature.proposal_version_id,
    'proposal_option_id', v_signature.proposal_option_id,
    'signer_slot', v_signature.signer_slot,
    'signer_printed_name', v_signature.signer_printed_name,
    'signed_at', v_signature.signed_at,
    'accepted_at', v_acceptance.accepted_at,
    'accepted_option_label', v_acceptance.accepted_option_label,
    'accepted_total_cents', v_acceptance.accepted_total_cents,
    'acknowledgement_key', v_signature.acknowledgement_key,
    'job_stage', v_after_stage,
    'stage_entered_at', v_after_entered,
    'job_stage_unchanged', true,
    'signed_version_id_unchanged', v_after_signed_version,
    'idempotent_replay', v_idempotent_replay,
    'acceptance_replay', v_acceptance_replay,
    'attention_id', v_accept->'attention_id'
  );
end;
$$;


ALTER FUNCTION "public"."record_proposal_signature_v1"("p_token_hash" "text", "p_signer_printed_name" "text", "p_signer_email" "text", "p_drawn_mark_json" "jsonb", "p_payload_json" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."record_proposal_signature_v1"("p_token_hash" "text", "p_signer_printed_name" "text", "p_signer_email" "text", "p_drawn_mark_json" "jsonb", "p_payload_json" "jsonb") IS 'R3D public Accept & sign. Calls record_proposal_acceptance_v1 in the same transaction, then inserts one customer_primary signature. Invalid mark/name fails before acceptance. Later failures RAISE and roll back a newly created acceptance. NEVER writes jobs.stage or proposals.signed_version_id. Same-version resend tokens reuse the logical acceptance and signature row. Older still-active tokens sign that exact historical version.';



CREATE OR REPLACE FUNCTION "public"."reschedule_job_v1"("p_payload" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_company_id uuid;
  v_job_id uuid;
  v_expected integer;
  v_member boolean;
  v_job public.jobs%rowtype;
  v_from text;
  v_all_day boolean;
  v_starts_on date;
  v_ends_on date;
  v_start_time time;
  v_end_time time;
  v_notes text;
  v_window_error text;
  v_active public.job_schedules%rowtype;
  v_previous jsonb;
  v_now timestamptz := now();
  v_activity_id uuid;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;

  begin
    v_company_id := nullif(p_payload->>'company_id', '')::uuid;
    v_job_id := nullif(p_payload->>'job_id', '')::uuid;
    v_expected := nullif(p_payload->>'expected_row_version', '')::integer;
    v_starts_on := nullif(p_payload->>'starts_on', '')::date;
    v_ends_on := coalesce(nullif(p_payload->>'ends_on', '')::date, v_starts_on);
  exception when others then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end;

  if v_company_id is null or v_job_id is null or v_starts_on is null or v_expected is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  v_all_day := coalesce((p_payload->>'all_day')::boolean, true);
  v_notes := nullif(trim(p_payload->>'notes'), '');
  if v_notes is not null and char_length(v_notes) > 500 then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  begin
    if v_all_day then
      v_start_time := null;
      v_end_time := null;
    else
      v_start_time := nullif(p_payload->>'start_local_time', '')::time;
      v_end_time := nullif(p_payload->>'end_local_time', '')::time;
    end if;
  exception when others then
    return jsonb_build_object('ok', false, 'code', 'invalid_window');
  end;

  select exists (
    select 1 from public.company_memberships cm
    where cm.company_id = v_company_id
      and cm.user_id = v_uid
  ) into v_member;

  if not v_member then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;

  select j.*
  into v_job
  from public.jobs j
  where j.id = v_job_id
    and j.company_id = v_company_id
    and j.deleted_at is null
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  if v_job.status in ('lost', 'closed') then
    return jsonb_build_object('ok', false, 'code', 'disposition_blocks_reschedule');
  end if;

  if v_job.status = 'on_hold' then
    return jsonb_build_object('ok', false, 'code', 'disposition_blocks_reschedule');
  end if;

  v_from := public.canonical_job_stage_from_row(
    v_job.stage,
    v_job.status,
    coalesce(v_job.archived, false),
    v_job.active_proposal_id,
    v_job.latest_proposal_id
  );

  if v_from <> 'scheduled' then
    return jsonb_build_object(
      'ok', false,
      'code', 'illegal_stage',
      'from_stage', v_from
    );
  end if;

  select s.*
  into v_active
  from public.job_schedules s
  where s.job_id = v_job_id
    and s.company_id = v_company_id
    and s.kind = 'work'
    and s.status = 'scheduled'
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'no_active_schedule');
  end if;

  if v_active.row_version is distinct from v_expected then
    return jsonb_build_object(
      'ok', false,
      'code', 'schedule_stale',
      'row_version', v_active.row_version
    );
  end if;

  v_window_error := public.job_schedule_validate_window(
    v_active.timezone,
    v_all_day,
    v_starts_on,
    v_ends_on,
    v_start_time,
    v_end_time
  );
  if v_window_error is not null then
    return jsonb_build_object('ok', false, 'code', coalesce(v_window_error, 'invalid_window'));
  end if;

  if public.job_schedule_windows_equal(
    v_active, v_all_day, v_starts_on, v_ends_on, v_start_time, v_end_time, v_notes
  ) then
    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'job_id', v_job_id,
      'from_stage', v_from,
      'to_stage', v_from,
      'stage_entered_at', v_job.stage_entered_at,
      'schedule', public.job_schedule_row_json(v_active),
      'activity_id', null
    );
  end if;

  v_previous := public.job_schedule_window_json(
    v_active.all_day,
    v_active.starts_on,
    v_active.ends_on,
    v_active.start_local_time,
    v_active.end_local_time,
    v_active.timezone,
    v_active.notes
  );

  update public.job_schedules
  set
    all_day = v_all_day,
    starts_on = v_starts_on,
    ends_on = v_ends_on,
    start_local_time = v_start_time,
    end_local_time = v_end_time,
    notes = v_notes,
    updated_by_user_id = v_uid,
    row_version = v_active.row_version + 1
  where id = v_active.id
    and company_id = v_company_id
  returning * into v_active;

  v_activity_id := public.job_lifecycle_insert_activity(
    v_company_id,
    v_job_id,
    'job_rescheduled',
    v_uid,
    jsonb_build_object(
      'schedule_id', v_active.id,
      'previous_window', v_previous,
      'window', public.job_schedule_window_json(
        v_active.all_day,
        v_active.starts_on,
        v_active.ends_on,
        v_active.start_local_time,
        v_active.end_local_time,
        v_active.timezone,
        v_active.notes
      )
    ),
    v_now
  );

  update public.jobs
  set last_activity_at = v_now
  where id = v_job_id
    and company_id = v_company_id;

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'job_id', v_job_id,
    'from_stage', v_from,
    'to_stage', v_from,
    'stage_entered_at', v_job.stage_entered_at,
    'schedule', public.job_schedule_row_json(v_active),
    'activity_id', v_activity_id
  );
end;
$$;


ALTER FUNCTION "public"."reschedule_job_v1"("p_payload" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."reschedule_job_v1"("p_payload" "jsonb") IS 'R3F: update the SAME active work schedule. Does not change Job stage or stage_entered_at.';



CREATE OR REPLACE FUNCTION "public"."reserve_job_payment_refund_v1"("p_payload" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_company_id uuid;
  v_job_id uuid;
  v_request_id uuid;
  v_capture_id uuid;
  v_amount integer;
  v_reason text;
  v_key text;
  v_job public.jobs%rowtype;
  v_request public.job_payment_requests%rowtype;
  v_capture public.job_payment_transactions%rowtype;
  v_existing public.job_payment_refunds%rowtype;
  v_refund public.job_payment_refunds%rowtype;
  v_canonical_id uuid;
  v_succeeded bigint;
  v_inflight bigint;
  v_before_stage text;
  v_before_entered timestamptz;
  v_after_stage text;
  v_after_entered timestamptz;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;

  begin
    v_id := nullif(p_payload->>'id', '')::uuid;
    v_company_id := nullif(p_payload->>'company_id', '')::uuid;
    v_job_id := nullif(p_payload->>'job_id', '')::uuid;
    v_request_id := nullif(p_payload->>'payment_request_id', '')::uuid;
    v_capture_id := nullif(p_payload->>'canonical_capture_transaction_id', '')::uuid;
    v_amount := nullif(p_payload->>'amount_cents', '')::integer;
    v_reason := nullif(trim(p_payload->>'internal_reason'), '');
    v_key := nullif(trim(p_payload->>'idempotency_key'), '');
  exception when others then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end;

  if v_id is null
    or v_company_id is null
    or v_job_id is null
    or v_request_id is null
    or v_capture_id is null
    or v_amount is null
    or v_amount <= 0
    or v_key is null
    or char_length(v_key) not between 8 and 255
    or (v_reason is not null and char_length(v_reason) > 500)
  then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  if not exists (
    select 1
    from public.company_memberships cm
    where cm.company_id = v_company_id
      and cm.user_id = v_uid
  ) then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'job_payment_refund:' || v_company_id::text || ':' || v_capture_id::text,
      0
    )
  );

  select j.* into v_job
  from public.jobs j
  where j.id = v_job_id
    and j.company_id = v_company_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'job_not_found');
  end if;

  select s.job_stage, s.stage_entered_at
  into v_before_stage, v_before_entered
  from public.job_payment_snapshot_stage_v1(v_company_id, v_job_id) s;

  select r.* into v_request
  from public.job_payment_requests r
  where r.id = v_request_id
    and r.company_id = v_company_id
    and r.job_id = v_job_id
  for update;

  if not found
    or v_request.status is distinct from 'paid'
    or v_request.provider is distinct from 'stripe'
    or v_request.currency is distinct from 'usd'
  then
    return jsonb_build_object('ok', false, 'code', 'invalid_payment_request');
  end if;

  if not exists (
    select 1
    from public.company_payment_accounts a
    where a.company_id = v_company_id
      and a.provider = 'stripe'
      and a.provider_account_id = v_request.provider_account_id
  ) then
    return jsonb_build_object('ok', false, 'code', 'account_mismatch');
  end if;

  select t.* into v_capture
  from public.job_payment_transactions t
  where t.id = v_capture_id
    and t.company_id = v_company_id
    and t.payment_request_id = v_request_id
    and t.provider = 'stripe'
    and t.kind = 'capture'
    and t.status = 'succeeded'
    and t.currency = 'usd'
  for update;

  if not found or v_capture.provider_payment_intent_id is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_capture');
  end if;

  select t.id into v_canonical_id
  from public.job_payment_transactions t
  where t.company_id = v_company_id
    and t.provider = 'stripe'
    and t.kind = 'capture'
    and t.status = 'succeeded'
    and t.provider_payment_intent_id = v_capture.provider_payment_intent_id
  order by t.occurred_at asc, t.created_at asc, t.id asc
  limit 1;

  if v_canonical_id is distinct from v_capture_id then
    return jsonb_build_object('ok', false, 'code', 'noncanonical_capture');
  end if;

  select r.* into v_existing
  from public.job_payment_refunds r
  where r.id = v_id
  for update;

  if found then
    if v_existing.company_id is not distinct from v_company_id
      and v_existing.job_id is not distinct from v_job_id
      and v_existing.payment_request_id is not distinct from v_request_id
      and v_existing.canonical_capture_transaction_id is not distinct from v_capture_id
      and v_existing.provider_account_id is not distinct from v_request.provider_account_id
      and v_existing.provider_payment_intent_id is not distinct from v_capture.provider_payment_intent_id
      and (
        v_capture.provider_charge_id is null
        or v_existing.provider_charge_id is not distinct from v_capture.provider_charge_id
      )
      and v_existing.amount_cents is not distinct from v_amount
      and v_existing.currency = 'usd'
      and v_existing.origin = 'fielddive'
      and v_existing.created_by_user_id is not distinct from v_uid
      and v_existing.internal_reason is not distinct from v_reason
      and v_existing.idempotency_key is not distinct from v_key
    then
      return jsonb_build_object(
        'ok', true,
        'id', v_existing.id,
        'status', v_existing.status,
        'amount_cents', v_existing.amount_cents,
        'currency', v_existing.currency,
        'provider_account_id', v_existing.provider_account_id,
        'provider_payment_intent_id', v_existing.provider_payment_intent_id,
        'provider_charge_id', v_existing.provider_charge_id,
        'provider_refund_id', v_existing.provider_refund_id,
        'idempotent_replay', true,
        'job_stage', v_before_stage,
        'stage_entered_at', v_before_entered,
        'job_stage_unchanged', true
      );
    end if;
    return jsonb_build_object('ok', false, 'code', 'idempotency_mismatch');
  end if;

  if exists (
    select 1
    from public.job_payment_refunds r
    where r.provider_account_id = v_request.provider_account_id
      and r.idempotency_key = v_key
  ) then
    return jsonb_build_object('ok', false, 'code', 'idempotency_key_conflict');
  end if;

  select
    coalesce(sum(r.amount_cents) filter (where r.status = 'succeeded'), 0),
    coalesce(sum(r.amount_cents) filter (
      where r.status in ('initiating', 'pending', 'requires_action')
    ), 0)
  into v_succeeded, v_inflight
  from public.job_payment_refunds r
  where r.company_id = v_company_id
    and r.canonical_capture_transaction_id = v_capture_id;

  if v_succeeded + v_inflight + v_amount > v_capture.amount_cents then
    return jsonb_build_object(
      'ok', false,
      'code', 'amount_exceeds_refundable',
      'refundable_cents',
        greatest(0, v_capture.amount_cents - v_succeeded - v_inflight),
      'succeeded_refund_cents', v_succeeded,
      'inflight_refund_cents', v_inflight
    );
  end if;

  insert into public.job_payment_refunds (
    id,
    company_id,
    job_id,
    payment_request_id,
    canonical_capture_transaction_id,
    provider,
    provider_account_id,
    provider_payment_intent_id,
    provider_charge_id,
    amount_cents,
    currency,
    origin,
    created_by_user_id,
    internal_reason,
    idempotency_key,
    status,
    initiated_at
  )
  values (
    v_id,
    v_company_id,
    v_job_id,
    v_request_id,
    v_capture_id,
    'stripe',
    v_request.provider_account_id,
    v_capture.provider_payment_intent_id,
    v_capture.provider_charge_id,
    v_amount,
    'usd',
    'fielddive',
    v_uid,
    v_reason,
    v_key,
    'initiating',
    now()
  )
  returning * into v_refund;

  select s.job_stage, s.stage_entered_at
  into v_after_stage, v_after_entered
  from public.job_payment_snapshot_stage_v1(v_company_id, v_job_id) s;

  if v_after_stage is distinct from v_before_stage
    or v_after_entered is distinct from v_before_entered
  then
    raise exception 'refund reservation must not change job stage';
  end if;

  return jsonb_build_object(
    'ok', true,
    'id', v_refund.id,
    'status', v_refund.status,
    'amount_cents', v_refund.amount_cents,
    'currency', v_refund.currency,
    'provider_account_id', v_refund.provider_account_id,
    'provider_payment_intent_id', v_refund.provider_payment_intent_id,
    'provider_charge_id', v_refund.provider_charge_id,
    'idempotency_key', v_refund.idempotency_key,
    'idempotent_replay', false,
    'job_stage', v_after_stage,
    'stage_entered_at', v_after_entered,
    'job_stage_unchanged', true
  );
end;
$$;


ALTER FUNCTION "public"."reserve_job_payment_refund_v1"("p_payload" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."reserve_job_payment_refund_v1"("p_payload" "jsonb") IS 'Authenticated atomic refund reservation. Locks job/request/canonical capture, counts succeeded plus in-flight refunds, rejects over-refund, and proves job stage unchanged.';



CREATE OR REPLACE FUNCTION "public"."resolve_proposal_public_access_token_v1"("p_token_hash" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  return public.proposal_assert_public_access_token_active_v1(p_token_hash);
end;
$$;


ALTER FUNCTION "public"."resolve_proposal_public_access_token_v1"("p_token_hash" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."resolve_proposal_public_access_token_v1"("p_token_hash" "text") IS 'R18C2B — Resolve hash-only public access token to IDs. service_role execute only; Next.js server-side /p/[token] route (R18C4+) hashes raw URL token before calling.';



CREATE OR REPLACE FUNCTION "public"."resolve_public_job_payment_checkout_v1"("p_token_hash" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_assert jsonb;
  v_company_id uuid;
  v_proposal_id uuid;
  v_version_id uuid;
  v_request public.job_payment_requests%rowtype;
  v_account public.company_payment_accounts%rowtype;
  v_latest public.proposal_acceptances%rowtype;
begin
  v_assert := public.proposal_assert_public_access_token_active_v1(p_token_hash);
  if coalesce(v_assert->>'ok', '') <> 'true' then
    return v_assert;
  end if;

  v_company_id := (v_assert->>'company_id')::uuid;
  v_proposal_id := (v_assert->>'proposal_id')::uuid;
  v_version_id := (v_assert->>'proposal_version_id')::uuid;

  select a.*
  into v_latest
  from public.proposal_acceptances a
  where a.company_id = v_company_id
    and a.proposal_id = v_proposal_id
  order by a.accepted_at desc
  limit 1;

  select r.*
  into v_request
  from public.job_payment_requests r
  where r.company_id = v_company_id
    and r.proposal_id = v_proposal_id
    and r.proposal_version_id = v_version_id
    and r.status in ('open', 'processing')
  order by r.requested_at desc
  limit 1
  for update;

  if found then
    if v_latest.id is not null
      and v_request.proposal_acceptance_id is distinct from v_latest.id
    then
      return jsonb_build_object('ok', false, 'code', 'superseded');
    end if;
    if v_latest.proposal_version_id is not null
      and v_latest.proposal_version_id is distinct from v_version_id
    then
      return jsonb_build_object('ok', false, 'code', 'superseded');
    end if;

    select a.*
    into v_account
    from public.company_payment_accounts a
    where a.company_id = v_company_id
      and a.provider = 'stripe';

    if not found or not v_account.charges_enabled then
      return jsonb_build_object('ok', false, 'code', 'not_connected');
    end if;

    if v_account.provider_account_id is distinct from v_request.provider_account_id then
      return jsonb_build_object('ok', false, 'code', 'account_mismatch');
    end if;

    return jsonb_build_object(
      'ok', true,
      'id', v_request.id,
      'company_id', v_request.company_id,
      'job_id', v_request.job_id,
      'proposal_id', v_request.proposal_id,
      'proposal_version_id', v_request.proposal_version_id,
      'kind', v_request.kind,
      'status', v_request.status,
      'amount_cents', v_request.amount_cents,
      'currency', v_request.currency,
      'provider_account_id', v_request.provider_account_id,
      'provider_checkout_session_id', v_request.provider_checkout_session_id,
      'checkout_generation', v_request.checkout_generation
    );
  end if;

  select r.*
  into v_request
  from public.job_payment_requests r
  where r.company_id = v_company_id
    and r.proposal_id = v_proposal_id
    and r.proposal_version_id = v_version_id
    and r.status = 'paid'
  order by r.paid_at desc nulls last
  limit 1;

  if found then
    return jsonb_build_object('ok', false, 'code', 'already_paid');
  end if;

  if exists (
    select 1
    from public.job_payment_requests r
    where r.company_id = v_company_id
      and r.proposal_id = v_proposal_id
      and r.proposal_version_id = v_version_id
      and r.status in ('failed', 'cancelled', 'expired')
  ) then
    return jsonb_build_object('ok', false, 'code', 'not_payable');
  end if;

  return jsonb_build_object('ok', false, 'code', 'not_found');
end;
$$;


ALTER FUNCTION "public"."resolve_public_job_payment_checkout_v1"("p_token_hash" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."resolve_public_job_payment_checkout_v1"("p_token_hash" "text") IS 'Public payment portal resolve. Pays only the current open or processing request. Failed is inactive and is never mutated to open. No inserts.';



CREATE OR REPLACE FUNCTION "public"."schedule_job_v1"("p_payload" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_company_id uuid;
  v_job_id uuid;
  v_member boolean;
  v_job public.jobs%rowtype;
  v_from text;
  v_tz text;
  v_all_day boolean;
  v_starts_on date;
  v_ends_on date;
  v_start_time time;
  v_end_time time;
  v_notes text;
  v_window_error text;
  v_active public.job_schedules%rowtype;
  v_row public.job_schedules%rowtype;
  v_now timestamptz := now();
  v_activity_id uuid;
  v_stage jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;

  begin
    v_company_id := nullif(p_payload->>'company_id', '')::uuid;
    v_job_id := nullif(p_payload->>'job_id', '')::uuid;
    v_starts_on := nullif(p_payload->>'starts_on', '')::date;
    v_ends_on := coalesce(nullif(p_payload->>'ends_on', '')::date, v_starts_on);
  exception when others then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end;

  if v_company_id is null or v_job_id is null or v_starts_on is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  v_all_day := coalesce((p_payload->>'all_day')::boolean, true);
  v_notes := nullif(trim(p_payload->>'notes'), '');
  if v_notes is not null and char_length(v_notes) > 500 then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  begin
    if v_all_day then
      v_start_time := null;
      v_end_time := null;
    else
      v_start_time := nullif(p_payload->>'start_local_time', '')::time;
      v_end_time := nullif(p_payload->>'end_local_time', '')::time;
    end if;
  exception when others then
    return jsonb_build_object('ok', false, 'code', 'invalid_window');
  end;

  select exists (
    select 1 from public.company_memberships cm
    where cm.company_id = v_company_id
      and cm.user_id = v_uid
  ) into v_member;

  if not v_member then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;

  select j.*
  into v_job
  from public.jobs j
  where j.id = v_job_id
    and j.company_id = v_company_id
    and j.deleted_at is null
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  if v_job.status in ('lost', 'closed') then
    return jsonb_build_object('ok', false, 'code', 'disposition_blocks_schedule');
  end if;

  if v_job.status = 'on_hold' then
    return jsonb_build_object('ok', false, 'code', 'disposition_blocks_schedule');
  end if;

  v_from := public.canonical_job_stage_from_row(
    v_job.stage,
    v_job.status,
    coalesce(v_job.archived, false),
    v_job.active_proposal_id,
    v_job.latest_proposal_id
  );

  select c.timezone into v_tz
  from public.companies c
  where c.id = v_company_id;

  if v_tz is null or not public.job_schedule_is_iana_timezone(v_tz) then
    return jsonb_build_object('ok', false, 'code', 'company_timezone_required');
  end if;

  v_window_error := public.job_schedule_validate_window(
    v_tz, v_all_day, v_starts_on, v_ends_on, v_start_time, v_end_time
  );
  if v_window_error is not null then
    return jsonb_build_object('ok', false, 'code', coalesce(v_window_error, 'invalid_window'));
  end if;

  select s.*
  into v_active
  from public.job_schedules s
  where s.job_id = v_job_id
    and s.company_id = v_company_id
    and s.kind = 'work'
    and s.status = 'scheduled'
  for update;

  if found then
    if v_from = 'scheduled'
      and public.job_schedule_windows_equal(
        v_active, v_all_day, v_starts_on, v_ends_on, v_start_time, v_end_time, v_notes
      )
    then
      return jsonb_build_object(
        'ok', true,
        'idempotent', true,
        'job_id', v_job_id,
        'from_stage', v_from,
        'to_stage', 'scheduled',
        'stage_entered_at', v_job.stage_entered_at,
        'schedule', public.job_schedule_row_json(v_active),
        'activity_id', null,
        'stage_activity_id', null
      );
    end if;
    return jsonb_build_object('ok', false, 'code', 'already_scheduled');
  end if;

  if v_from <> 'approved' and v_from <> 'scheduled' then
    return jsonb_build_object(
      'ok', false,
      'code', 'illegal_stage',
      'from_stage', v_from,
      'to_stage', 'scheduled'
    );
  end if;

  if v_from = 'scheduled' then
    return jsonb_build_object('ok', false, 'code', 'schedule_stage_mismatch');
  end if;

  insert into public.job_schedules (
    company_id,
    job_id,
    kind,
    status,
    timezone,
    all_day,
    starts_on,
    ends_on,
    start_local_time,
    end_local_time,
    range_start_at,
    range_end_at,
    notes,
    created_by_user_id,
    updated_by_user_id,
    created_at,
    updated_at,
    cancelled_at,
    row_version
  )
  values (
    v_company_id,
    v_job_id,
    'work',
    'scheduled',
    v_tz,
    v_all_day,
    v_starts_on,
    v_ends_on,
    v_start_time,
    v_end_time,
    v_now,
    v_now,
    v_notes,
    v_uid,
    v_uid,
    v_now,
    v_now,
    null,
    1
  )
  returning * into v_row;

  v_activity_id := public.job_lifecycle_insert_activity(
    v_company_id,
    v_job_id,
    'job_scheduled',
    v_uid,
    jsonb_build_object(
      'schedule_id', v_row.id,
      'window', public.job_schedule_window_json(
        v_row.all_day,
        v_row.starts_on,
        v_row.ends_on,
        v_row.start_local_time,
        v_row.end_local_time,
        v_row.timezone,
        v_row.notes
      )
    ),
    v_now
  );

  v_stage := public.job_lifecycle_apply_scheduled_from_work_v1(
    v_company_id,
    v_job_id,
    v_uid,
    v_row.id,
    'scheduled_job'
  );

  if coalesce(v_stage->>'ok', '') <> 'true' then
    raise exception 'schedule stage synchronization failed: %', v_stage
      using errcode = 'P0001';
  end if;

  update public.jobs
  set last_activity_at = v_now
  where id = v_job_id
    and company_id = v_company_id
    and last_activity_at is distinct from v_now;

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'job_id', v_job_id,
    'from_stage', v_stage->>'from_stage',
    'to_stage', v_stage->>'to_stage',
    'stage_entered_at', v_stage->>'stage_entered_at',
    'schedule', public.job_schedule_row_json(v_row),
    'activity_id', v_activity_id,
    'stage_activity_id', v_stage->'activity_id'
  );
end;
$$;


ALTER FUNCTION "public"."schedule_job_v1"("p_payload" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."schedule_job_v1"("p_payload" "jsonb") IS 'R3F: insert a NEW active work schedule and atomically move Approved → Scheduled. Never revives cancelled rows. Generic transition_job_stage_v1 remains blocked.';



CREATE OR REPLACE FUNCTION "public"."search_company_customers_v1"("p_query" "text") RETURNS TABLE("id" "uuid", "name" "text", "email" "text", "phone" "text")
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  with q as (
    select
      trim(coalesce(p_query, '')) as raw,
      lower(trim(regexp_replace(coalesce(p_query, ''), '\s+', ' ', 'g'))) as text,
      regexp_replace(trim(coalesce(p_query, '')), '[^0-9]', '', 'g') as digits
  )
  select
    c.id,
    c.name,
    c.email,
    c.phone
  from public.customers c
  cross join q
  where auth.uid() is not null
    and c.company_id in (
      select cm.company_id
      from public.company_memberships cm
      where cm.user_id = auth.uid()
    )
    and length(q.raw) >= 2
    and (
      (
        q.text <> ''
        and (
          lower(coalesce(c.email, '')) = q.text
          or strpos(lower(coalesce(c.email, '')), q.text) > 0
          or strpos(lower(coalesce(c.name, '')), q.text) > 0
          or (
            select bool_and(
              length(part) = 0
              or strpos(lower(coalesce(c.name, '')), part) > 0
            )
            from unnest(string_to_array(q.text, ' ')) as part
          )
        )
      )
      or (
        length(q.digits) >= 7
        and strpos(
          regexp_replace(coalesce(c.phone, ''), '[^0-9]', '', 'g'),
          q.digits
        ) > 0
      )
    )
  order by
    case when lower(coalesce(c.email, '')) = q.text then 0 else 1 end,
    case
      when length(q.digits) >= 7
        and strpos(regexp_replace(coalesce(c.phone, ''), '[^0-9]', '', 'g'), q.digits) > 0
      then 0 else 1
    end,
    lower(coalesce(c.name, '')),
    c.id
  limit 8;
$$;


ALTER FUNCTION "public"."search_company_customers_v1"("p_query" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_company_jobs_v1"("p_query" "text") RETURNS TABLE("id" "uuid", "customer_name" "text", "job_name" "text", "address_formatted" "text", "address_line1" "text", "address_city" "text", "address_state" "text", "address_zip" "text", "stage" "text", "updated_at" timestamp with time zone)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $_$
  with q as (
    select
      trim(coalesce(p_query, '')) as raw,
      lower(trim(regexp_replace(coalesce(p_query, ''), '\s+', ' ', 'g'))) as text,
      regexp_replace(trim(coalesce(p_query, '')), '[^0-9]', '', 'g') as digits
  )
  select
    j.id,
    j.customer_name,
    j.job_name,
    j.address_formatted,
    j.address_line1,
    j.address_city,
    j.address_state,
    j.address_zip,
    j.stage,
    j.updated_at
  from public.jobs j
  cross join q
  where auth.uid() is not null
    and j.company_id in (
      select cm.company_id
      from public.company_memberships cm
      where cm.user_id = auth.uid()
    )
    and coalesce(j.archived, false) = false
    and j.deleted_at is null
    and length(q.raw) >= 2
    and (
      (
        q.text <> ''
        and (
          select bool_and(
            length(part) = 0
            or strpos(
              lower(concat_ws(' ',
                coalesce(j.customer_name, ''),
                coalesce(j.customer_email, ''),
                coalesce(j.job_name, ''),
                coalesce(j.address_formatted, ''),
                coalesce(j.address_line1, ''),
                coalesce(j.address_city, ''),
                coalesce(j.address_state, ''),
                coalesce(j.address_zip, '')
              )),
              part
            ) > 0
            or (
              length(regexp_replace(part, '[^0-9]', '', 'g')) >= 7
              and strpos(
                regexp_replace(coalesce(j.customer_phone, ''), '[^0-9]', '', 'g'),
                regexp_replace(part, '[^0-9]', '', 'g')
              ) > 0
            )
            or (
              part ~ '^[0-9a-f-]{8,36}$'
              and j.id::text ilike part || '%'
            )
          )
          from unnest(string_to_array(q.text, ' ')) as part
        )
      )
      or (
        length(q.digits) >= 7
        and strpos(
          regexp_replace(coalesce(j.customer_phone, ''), '[^0-9]', '', 'g'),
          q.digits
        ) > 0
      )
      or (
        q.raw ~ '^[0-9a-fA-F-]{8,36}$'
        and j.id::text ilike q.raw || '%'
      )
    )
  order by j.updated_at desc nulls last, j.id
  limit 25;
$_$;


ALTER FUNCTION "public"."search_company_jobs_v1"("p_query" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_company_properties_v1"("p_query" "text") RETURNS TABLE("id" "uuid", "address_line1" "text", "address_city" "text", "address_state" "text", "address_zip" "text", "address_formatted" "text", "address_normalized" "text", "job_count" bigint)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  with q as (
    select
      trim(coalesce(p_query, '')) as raw,
      lower(trim(regexp_replace(coalesce(p_query, ''), '\s+', ' ', 'g'))) as text
  )
  select
    p.id,
    p.address_line1,
    p.address_city,
    p.address_state,
    p.address_zip,
    p.address_formatted,
    p.address_normalized,
    (
      select count(*)
      from public.jobs j
      where j.property_id = p.id
        and j.deleted_at is null
        and coalesce(j.archived, false) = false
    ) as job_count
  from public.properties p
  cross join q
  where auth.uid() is not null
    and p.company_id in (
      select cm.company_id
      from public.company_memberships cm
      where cm.user_id = auth.uid()
    )
    and length(q.raw) >= 3
    and (
      p.address_normalized = q.text
      or strpos(p.address_normalized, q.text) > 0
      or (
        q.text <> ''
        and (
          select bool_and(
            length(part) = 0
            or strpos(
              lower(concat_ws(' ',
                coalesce(p.address_line1, ''),
                coalesce(p.address_line2, ''),
                coalesce(p.address_city, ''),
                coalesce(p.address_state, ''),
                coalesce(p.address_zip, ''),
                coalesce(p.address_formatted, ''),
                coalesce(p.address_normalized, '')
              )),
              part
            ) > 0
          )
          from unnest(string_to_array(q.text, ' ')) as part
        )
      )
    )
  order by p.updated_at desc nulls last, p.id
  limit 8;
$$;


ALTER FUNCTION "public"."search_company_properties_v1"("p_query" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_company_workspace_v1"("p_query" "text") RETURNS TABLE("entity_type" "text", "id" "uuid", "primary_label" "text", "secondary_label" "text", "job_stage" "text", "updated_at" timestamp with time zone)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $_$
  with q as (
    select
      trim(coalesce(p_query, '')) as raw,
      lower(trim(regexp_replace(coalesce(p_query, ''), '\s+', ' ', 'g'))) as text,
      regexp_replace(trim(coalesce(p_query, '')), '[^0-9]', '', 'g') as digits
  ),
  member_companies as (
    select cm.company_id
    from public.company_memberships cm
    where cm.user_id = auth.uid()
  ),
  job_hits as (
    select
      'job'::text as entity_type,
      j.id,
      coalesce(nullif(trim(j.customer_name), ''), nullif(trim(j.job_name), ''), 'Job') as primary_label,
      coalesce(
        nullif(trim(j.address_formatted), ''),
        nullif(trim(concat_ws(', ',
          nullif(trim(j.address_line1), ''),
          nullif(trim(j.address_city), ''),
          nullif(trim(j.address_state), ''),
          nullif(trim(j.address_zip), '')
        )), ''),
        ''
      ) as secondary_label,
      j.stage as job_stage,
      j.updated_at
    from public.jobs j
    cross join q
    where auth.uid() is not null
      and j.company_id in (select company_id from member_companies)
      and coalesce(j.archived, false) = false
      and j.deleted_at is null
      and length(q.raw) >= 2
      and (
        (
          q.text <> ''
          and (
            select bool_and(
              length(part) = 0
              or strpos(
                lower(concat_ws(' ',
                  coalesce(j.customer_name, ''),
                  coalesce(j.customer_email, ''),
                  coalesce(j.job_name, ''),
                  coalesce(j.address_formatted, ''),
                  coalesce(j.address_line1, ''),
                  coalesce(j.address_city, ''),
                  coalesce(j.address_state, ''),
                  coalesce(j.address_zip, '')
                )),
                part
              ) > 0
              or (
                length(regexp_replace(part, '[^0-9]', '', 'g')) >= 7
                and strpos(
                  regexp_replace(coalesce(j.customer_phone, ''), '[^0-9]', '', 'g'),
                  regexp_replace(part, '[^0-9]', '', 'g')
                ) > 0
              )
              or (
                part ~ '^[0-9a-f-]{8,36}$'
                and j.id::text ilike part || '%'
              )
            )
            from unnest(string_to_array(q.text, ' ')) as part
          )
        )
        or (
          length(q.digits) >= 7
          and strpos(
            regexp_replace(coalesce(j.customer_phone, ''), '[^0-9]', '', 'g'),
            q.digits
          ) > 0
        )
      )
    order by j.updated_at desc nulls last, j.id
    limit 8
  ),
  customer_hits as (
    select
      'customer'::text as entity_type,
      c.id,
      coalesce(nullif(trim(c.name), ''), 'Customer') as primary_label,
      nullif(trim(concat_ws(' · ', nullif(trim(c.email), ''), nullif(trim(c.phone), ''))), '') as secondary_label,
      null::text as job_stage,
      c.created_at as updated_at
    from public.customers c
    cross join q
    where auth.uid() is not null
      and c.company_id in (select company_id from member_companies)
      and length(q.raw) >= 2
      and (
        (
          q.text <> ''
          and (
            lower(coalesce(c.email, '')) = q.text
            or strpos(lower(coalesce(c.email, '')), q.text) > 0
            or strpos(lower(coalesce(c.name, '')), q.text) > 0
            or (
              select bool_and(
                length(part) = 0
                or strpos(lower(coalesce(c.name, '')), part) > 0
              )
              from unnest(string_to_array(q.text, ' ')) as part
            )
          )
        )
        or (
          length(q.digits) >= 7
          and strpos(
            regexp_replace(coalesce(c.phone, ''), '[^0-9]', '', 'g'),
            q.digits
          ) > 0
        )
      )
    order by c.created_at desc nulls last, c.id
    limit 8
  ),
  property_hits as (
    select
      'property'::text as entity_type,
      p.id,
      coalesce(
        nullif(trim(p.address_line1), ''),
        nullif(trim(p.address_formatted), ''),
        'Property'
      ) as primary_label,
      nullif(trim(concat_ws(', ',
        nullif(trim(p.address_city), ''),
        nullif(trim(p.address_state), ''),
        nullif(trim(p.address_zip), '')
      )), '') as secondary_label,
      null::text as job_stage,
      p.updated_at
    from public.properties p
    cross join q
    where auth.uid() is not null
      and p.company_id in (select company_id from member_companies)
      and length(q.raw) >= 2
      and q.text <> ''
      and (
        select bool_and(
          length(part) = 0
          or strpos(
            lower(concat_ws(' ',
              coalesce(p.address_line1, ''),
              coalesce(p.address_line2, ''),
              coalesce(p.address_city, ''),
              coalesce(p.address_state, ''),
              coalesce(p.address_zip, ''),
              coalesce(p.address_formatted, ''),
              coalesce(p.address_normalized, '')
            )),
            part
          ) > 0
        )
        from unnest(string_to_array(q.text, ' ')) as part
      )
    order by p.updated_at desc nulls last, p.id
    limit 8
  )
  select * from job_hits
  union all
  select * from customer_hits
  union all
  select * from property_hits;
$_$;


ALTER FUNCTION "public"."search_company_workspace_v1"("p_query" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_company_timezone_v1"("p_payload" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_company_id uuid;
  v_tz text;
  v_member boolean;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;

  begin
    v_company_id := nullif(p_payload->>'company_id', '')::uuid;
  exception when others then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end;

  v_tz := nullif(trim(p_payload->>'timezone'), '');
  if v_company_id is null or v_tz is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  if not public.job_schedule_is_iana_timezone(v_tz) then
    return jsonb_build_object('ok', false, 'code', 'invalid_timezone');
  end if;

  select exists (
    select 1 from public.company_memberships cm
    where cm.company_id = v_company_id
      and cm.user_id = v_uid
  ) into v_member;

  if not v_member then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;

  update public.companies
  set timezone = v_tz
  where id = v_company_id;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  return jsonb_build_object(
    'ok', true,
    'company_id', v_company_id,
    'timezone', v_tz
  );
end;
$$;


ALTER FUNCTION "public"."set_company_timezone_v1"("p_payload" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_job_payment_settled_method_v1"("p_payload" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_request_id uuid;
  v_label text;
begin
  begin
    v_request_id := nullif(p_payload->>'payment_request_id', '')::uuid;
    v_label := nullif(trim(p_payload->>'label'), '');
  exception when others then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end;

  if v_request_id is null or v_label is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  if length(v_label) > 80 then
    v_label := left(v_label, 80);
  end if;

  update public.job_payment_requests
  set settled_payment_method_label = v_label
  where id = v_request_id
    and settled_payment_method_label is null;

  return jsonb_build_object('ok', true);
end;
$$;


ALTER FUNCTION "public"."set_job_payment_settled_method_v1"("p_payload" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."start_job_work_v1"("p_payload" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_company_id uuid;
  v_job_id uuid;
  v_job public.jobs%rowtype;
  v_schedule public.job_schedules%rowtype;
  v_from text;
  v_active_count integer := 0;
  v_now timestamptz := transaction_timestamp();
  v_activity_id uuid;
  v_stage_activity_id uuid;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;

  begin
    v_company_id := nullif(p_payload->>'company_id', '')::uuid;
    v_job_id := nullif(p_payload->>'job_id', '')::uuid;
  exception when others then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end;

  if v_company_id is null or v_job_id is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  if not exists (
    select 1
    from public.company_memberships cm
    where cm.company_id = v_company_id
      and cm.user_id = v_uid
  ) then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;

  select j.*
  into v_job
  from public.jobs j
  where j.id = v_job_id
    and j.company_id = v_company_id
    and j.deleted_at is null
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  v_from := public.canonical_job_stage_from_row(
    v_job.stage,
    v_job.status,
    coalesce(v_job.archived, false),
    v_job.active_proposal_id,
    v_job.latest_proposal_id
  );

  if v_from = 'complete' then
    return jsonb_build_object(
      'ok', false,
      'code', 'illegal_stage',
      'from_stage', v_from,
      'to_stage', 'production'
    );
  end if;

  if v_from = 'production' and v_job.production_started_at is null then
    return jsonb_build_object(
      'ok', false,
      'code', 'production_start_integrity_error',
      'from_stage', v_from,
      'to_stage', 'production'
    );
  end if;

  if v_from <> 'scheduled' and v_from <> 'production' then
    return jsonb_build_object(
      'ok', false,
      'code', 'illegal_stage',
      'from_stage', v_from,
      'to_stage', 'production'
    );
  end if;

  if v_from = 'scheduled' and v_job.status <> 'active' then
    return jsonb_build_object(
      'ok', false,
      'code', 'disposition_blocks_start_work',
      'from_stage', v_from,
      'to_stage', 'production',
      'disposition', v_job.status
    );
  end if;

  if v_from = 'scheduled' and v_job.production_started_at is not null then
    return jsonb_build_object(
      'ok', false,
      'code', 'production_start_integrity_error',
      'from_stage', v_from,
      'to_stage', 'production'
    );
  end if;

  select count(*)::integer
  into v_active_count
  from public.job_schedules s
  where s.company_id = v_company_id
    and s.job_id = v_job_id
    and s.kind = 'work'
    and s.status = 'scheduled';

  if v_active_count <> 1 then
    return jsonb_build_object(
      'ok', false,
      'code', 'start_work_schedule_integrity_error',
      'from_stage', v_from,
      'to_stage', 'production',
      'active_schedule_count', v_active_count
    );
  end if;

  select s.*
  into v_schedule
  from public.job_schedules s
  where s.company_id = v_company_id
    and s.job_id = v_job_id
    and s.kind = 'work'
    and s.status = 'scheduled'
  for update;

  if v_from = 'production' then
    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'job_id', v_job.id,
      'from_stage', v_from,
      'to_stage', 'production',
      'production_started_at', v_job.production_started_at,
      'stage_entered_at', v_job.stage_entered_at,
      'disposition_unchanged', v_job.status,
      'schedule', public.job_schedule_row_json(v_schedule),
      'activity_id', null,
      'stage_activity_id', null,
      'job', jsonb_build_object(
        'id', v_job.id,
        'company_id', v_job.company_id,
        'stage', 'production',
        'status', v_job.status,
        'production_started_at', v_job.production_started_at,
        'stage_entered_at', v_job.stage_entered_at
      )
    );
  end if;

  perform set_config('job_lifecycle.allow_stage_write', '1', true);
  perform set_config('job_lifecycle.allow_production_start_write', '1', true);

  update public.jobs
  set
    stage = 'production',
    production_started_at = v_now,
    stage_entered_at = v_now,
    last_activity_at = v_now
  where id = v_job.id
    and company_id = v_company_id;

  v_activity_id := public.job_lifecycle_insert_activity(
    v_company_id,
    v_job_id,
    'job_work_started',
    v_uid,
    jsonb_build_object(
      'production_started_at', v_now,
      'schedule_id', v_schedule.id,
      'planned_window', public.job_schedule_window_json(
        v_schedule.all_day,
        v_schedule.starts_on,
        v_schedule.ends_on,
        v_schedule.start_local_time,
        v_schedule.end_local_time,
        v_schedule.timezone,
        v_schedule.notes
      )
    ),
    v_now
  );

  v_stage_activity_id := public.job_lifecycle_insert_activity(
    v_company_id,
    v_job_id,
    'stage_changed',
    v_uid,
    jsonb_build_object(
      'from_stage', v_from,
      'to_stage', 'production',
      'reason', 'work_started',
      'schedule_id', v_schedule.id
    ),
    v_now
  );

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'job_id', v_job.id,
    'from_stage', v_from,
    'to_stage', 'production',
    'production_started_at', v_now,
    'stage_entered_at', v_now,
    'disposition_unchanged', v_job.status,
    'schedule', public.job_schedule_row_json(v_schedule),
    'activity_id', v_activity_id,
    'stage_activity_id', v_stage_activity_id,
    'job', jsonb_build_object(
      'id', v_job.id,
      'company_id', v_job.company_id,
      'stage', 'production',
      'status', v_job.status,
      'production_started_at', v_now,
      'stage_entered_at', v_now
    )
  );
end;
$$;


ALTER FUNCTION "public"."start_job_work_v1"("p_payload" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."start_job_work_v1"("p_payload" "jsonb") IS 'R3G sole Scheduled -> Production writer. Requires one active work schedule, stamps immutable production_started_at and stage_entered_at from one DB transaction time, preserves schedule/payment/signature truth, and is idempotent under Job locking.';



CREATE OR REPLACE FUNCTION "public"."transition_job_stage_v1"("p_payload" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_company_id uuid;
  v_job_id uuid;
  v_to text;
  v_reason text;
  v_job public.jobs%rowtype;
  v_from text;
  v_member boolean := false;
  v_now timestamptz := now();
  v_activity_id uuid;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;

  begin
    v_company_id := nullif(p_payload->>'company_id', '')::uuid;
    v_job_id := nullif(p_payload->>'job_id', '')::uuid;
  exception when others then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end;

  v_to := lower(nullif(p_payload->>'to_stage', ''));
  v_reason := nullif(p_payload->>'reason', '');

  if v_company_id is null or v_job_id is null or v_to is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  select exists (
    select 1 from public.company_memberships cm
    where cm.company_id = v_company_id
      and cm.user_id = v_uid
  ) into v_member;

  if not v_member then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;

  if v_to not in (
    'intake',
    'proposal',
    'approved',
    'scheduled',
    'production',
    'complete'
  ) then
    return jsonb_build_object('ok', false, 'code', 'noncanonical_target');
  end if;

  select j.*
  into v_job
  from public.jobs j
  where j.id = v_job_id
    and j.company_id = v_company_id
    and j.deleted_at is null
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  v_from := public.canonical_job_stage_from_row(
    v_job.stage,
    v_job.status,
    coalesce(v_job.archived, false),
    v_job.active_proposal_id,
    v_job.latest_proposal_id
  );

  if v_from = v_to then
    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'job_id', v_job.id,
      'from_stage', v_from,
      'to_stage', v_to,
      'stage_entered_at', v_job.stage_entered_at,
      'status_unchanged', v_job.status
    );
  end if;

  -- Live write surface before R3C / R3F / production actions:
  -- only Intake → Proposal is enabled. Conceptual later edges stay blocked.
  if v_from = 'proposal' and v_to = 'approved' then
    return jsonb_build_object(
      'ok', false,
      'code', 'approved_blocked_until_r3c',
      'from_stage', v_from,
      'to_stage', v_to
    );
  end if;

  if v_from = 'approved' and v_to = 'scheduled' then
    return jsonb_build_object(
      'ok', false,
      'code', 'scheduled_blocked_until_r3f',
      'from_stage', v_from,
      'to_stage', v_to
    );
  end if;

  if v_to = 'scheduled' then
    return jsonb_build_object(
      'ok', false,
      'code', 'scheduled_blocked_until_r3f',
      'from_stage', v_from,
      'to_stage', v_to
    );
  end if;

  if v_from = 'scheduled' and v_to = 'production' then
    return jsonb_build_object(
      'ok', false,
      'code', 'production_blocked_until_start_work',
      'from_stage', v_from,
      'to_stage', v_to
    );
  end if;

  if v_to = 'production' then
    return jsonb_build_object(
      'ok', false,
      'code', 'production_blocked_until_start_work',
      'from_stage', v_from,
      'to_stage', v_to
    );
  end if;

  if v_from = 'production' and v_to = 'complete' then
    return jsonb_build_object(
      'ok', false,
      'code', 'complete_blocked_until_complete_action',
      'from_stage', v_from,
      'to_stage', v_to
    );
  end if;

  if v_to = 'complete' then
    return jsonb_build_object(
      'ok', false,
      'code', 'complete_blocked_until_complete_action',
      'from_stage', v_from,
      'to_stage', v_to
    );
  end if;

  if not (v_from = 'intake' and v_to = 'proposal') then
    return jsonb_build_object(
      'ok', false,
      'code', 'illegal_edge',
      'from_stage', v_from,
      'to_stage', v_to
    );
  end if;

  -- Intake → Proposal requires durable first-proposal truth. The RPC cannot
  -- manufacture Proposal when no real proposal exists. AUTO remains primary.
  if v_job.active_proposal_id is null then
    return jsonb_build_object(
      'ok', false,
      'code', 'proposal_truth_required',
      'from_stage', v_from,
      'to_stage', v_to
    );
  end if;

  if not public.job_lifecycle_has_proposal_truth(
    v_job.company_id,
    v_job.id,
    v_job.active_proposal_id
  ) then
    return jsonb_build_object(
      'ok', false,
      'code', 'proposal_truth_mismatch',
      'from_stage', v_from,
      'to_stage', v_to
    );
  end if;

  perform set_config('job_lifecycle.allow_stage_write', '1', true);

  update public.jobs
  set
    stage = v_to,
    stage_entered_at = v_now,
    last_activity_at = v_now
  where id = v_job.id
    and company_id = v_company_id;

  v_activity_id := public.job_lifecycle_insert_activity(
    v_company_id,
    v_job_id,
    'stage_changed',
    v_uid,
    jsonb_build_object(
      'from_stage', v_from,
      'to_stage', v_to,
      'reason', v_reason,
      'mode', coalesce(nullif(p_payload->>'mode', ''), 'manual')
    ),
    v_now
  );

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'job_id', v_job_id,
    'from_stage', v_from,
    'to_stage', v_to,
    'stage_entered_at', v_now,
    'status_unchanged', v_job.status,
    'activity_id', v_activity_id
  );
end;
$$;


ALTER FUNCTION "public"."transition_job_stage_v1"("p_payload" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."transition_job_stage_v1"("p_payload" "jsonb") IS 'Sole application writer of jobs.stage after Job Lifecycle Foundation. Live enabled edge: Intake→Proposal only, and only when jobs.active_proposal_id points at a live same-job/same-company Proposal V2 lineage. Idempotent same-target. Does not mutate jobs.status. Proposal→Approved blocked until R3C. Approved→Scheduled blocked until R3F. Scheduled→Production and Production→Complete blocked until those actions exist.';



CREATE OR REPLACE FUNCTION "public"."unschedule_job_v1"("p_payload" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_company_id uuid;
  v_job_id uuid;
  v_expected integer;
  v_member boolean;
  v_job public.jobs%rowtype;
  v_from text;
  v_active public.job_schedules%rowtype;
  v_now timestamptz := now();
  v_activity_id uuid;
  v_stage jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;

  begin
    v_company_id := nullif(p_payload->>'company_id', '')::uuid;
    v_job_id := nullif(p_payload->>'job_id', '')::uuid;
    v_expected := nullif(p_payload->>'expected_row_version', '')::integer;
  exception when others then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end;

  if v_company_id is null or v_job_id is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  select exists (
    select 1 from public.company_memberships cm
    where cm.company_id = v_company_id
      and cm.user_id = v_uid
  ) into v_member;

  if not v_member then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;

  select j.*
  into v_job
  from public.jobs j
  where j.id = v_job_id
    and j.company_id = v_company_id
    and j.deleted_at is null
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  if v_job.status in ('lost', 'closed') then
    return jsonb_build_object('ok', false, 'code', 'disposition_blocks_unschedule');
  end if;

  v_from := public.canonical_job_stage_from_row(
    v_job.stage,
    v_job.status,
    coalesce(v_job.archived, false),
    v_job.active_proposal_id,
    v_job.latest_proposal_id
  );

  if v_from = 'production' then
    return jsonb_build_object('ok', false, 'code', 'unschedule_blocked_production');
  end if;

  if v_from = 'complete' then
    return jsonb_build_object('ok', false, 'code', 'unschedule_blocked_complete');
  end if;

  select s.*
  into v_active
  from public.job_schedules s
  where s.job_id = v_job_id
    and s.company_id = v_company_id
    and s.kind = 'work'
    and s.status = 'scheduled'
  for update;

  if not found then
    if v_from = 'approved' then
      return jsonb_build_object(
        'ok', true,
        'idempotent', true,
        'job_id', v_job_id,
        'from_stage', v_from,
        'to_stage', 'approved',
        'stage_entered_at', v_job.stage_entered_at,
        'schedule', null,
        'activity_id', null,
        'stage_activity_id', null
      );
    end if;
    if v_from = 'scheduled' then
      return jsonb_build_object('ok', false, 'code', 'schedule_stage_mismatch');
    end if;
    return jsonb_build_object('ok', false, 'code', 'no_active_schedule');
  end if;

  if v_expected is not null and v_active.row_version is distinct from v_expected then
    return jsonb_build_object(
      'ok', false,
      'code', 'schedule_stale',
      'row_version', v_active.row_version
    );
  end if;

  if v_from <> 'scheduled' and v_from <> 'approved' then
    return jsonb_build_object(
      'ok', false,
      'code', 'illegal_stage',
      'from_stage', v_from
    );
  end if;

  if v_from = 'approved' then
    return jsonb_build_object('ok', false, 'code', 'schedule_stage_mismatch');
  end if;

  update public.job_schedules
  set
    status = 'cancelled',
    cancelled_at = v_now,
    updated_by_user_id = v_uid,
    row_version = v_active.row_version + 1
  where id = v_active.id
    and company_id = v_company_id
  returning * into v_active;

  v_activity_id := public.job_lifecycle_insert_activity(
    v_company_id,
    v_job_id,
    'job_unscheduled',
    v_uid,
    jsonb_build_object(
      'schedule_id', v_active.id,
      'previous_window', public.job_schedule_window_json(
        v_active.all_day,
        v_active.starts_on,
        v_active.ends_on,
        v_active.start_local_time,
        v_active.end_local_time,
        v_active.timezone,
        v_active.notes
      )
    ),
    v_now
  );

  v_stage := public.job_lifecycle_apply_approved_from_unschedule_v1(
    v_company_id,
    v_job_id,
    v_uid,
    v_active.id
  );

  if coalesce(v_stage->>'ok', '') <> 'true' then
    raise exception 'unschedule stage synchronization failed: %', v_stage
      using errcode = 'P0001';
  end if;

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'job_id', v_job_id,
    'from_stage', v_stage->>'from_stage',
    'to_stage', v_stage->>'to_stage',
    'stage_entered_at', v_stage->>'stage_entered_at',
    'schedule', public.job_schedule_row_json(v_active),
    'activity_id', v_activity_id,
    'stage_activity_id', v_stage->'activity_id'
  );
end;
$$;


ALTER FUNCTION "public"."unschedule_job_v1"("p_payload" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."unschedule_job_v1"("p_payload" "jsonb") IS 'R3F: cancel the active work schedule and atomically move Scheduled → Approved. Blocked for Production and Complete. Does not reopen disposition.';



CREATE OR REPLACE FUNCTION "public"."update_proposal_customer_request_status_v1"("p_request_id" "uuid", "p_status" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_request public.proposal_customer_requests%rowtype;
  v_next_status text;
  v_attention jsonb;
  v_attention_id uuid;
  v_attention_status text;
  v_before_proposal_status text;
  v_before_selected_option_id uuid;
  v_before_job_stage text;
  v_after_proposal_status text;
  v_after_selected_option_id uuid;
  v_after_job_stage text;
  v_job_id uuid;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;

  if p_request_id is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_request_id');
  end if;

  v_next_status := nullif(trim(coalesce(p_status, '')), '');
  if v_next_status is null or v_next_status not in ('seen', 'dismissed') then
    return jsonb_build_object('ok', false, 'code', 'invalid_status');
  end if;

  if lower(coalesce(p_status, '')) in (
    'accepted', 'approved', 'signed', 'paid', 'won', 'scheduled'
  ) then
    return jsonb_build_object('ok', false, 'code', 'invalid_status');
  end if;

  select *
  into v_request
  from public.proposal_customer_requests r
  where r.id = p_request_id
    and exists (
      select 1
      from public.company_memberships cm
      where cm.company_id = r.company_id
        and cm.user_id = v_uid
    )
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  if v_request.status = v_next_status then
    null;
  elsif v_request.status = 'new' and v_next_status in ('seen', 'dismissed') then
    null;
  elsif v_request.status = 'seen' and v_next_status = 'dismissed' then
    null;
  else
    return jsonb_build_object('ok', false, 'code', 'invalid_transition');
  end if;

  select p.status, p.selected_option_id, p.job_id, j.stage
  into
    v_before_proposal_status,
    v_before_selected_option_id,
    v_job_id,
    v_before_job_stage
  from public.proposals p
  join public.jobs j
    on j.id = p.job_id
   and j.company_id = p.company_id
  where p.id = v_request.proposal_id
    and p.company_id = v_request.company_id
  for share of p, j;

  if not found or v_job_id is null then
    return jsonb_build_object('ok', false, 'code', 'proposal_unavailable');
  end if;

  -- R3B4A rows must retain resolved attention. Pre-R3B4A dismissed history
  -- (submission_key null) intentionally remains source history only.
  if v_request.status = 'dismissed' and v_next_status = 'dismissed' then
    select ai.id, ai.status
    into v_attention_id, v_attention_status
    from public.job_attention_items ai
    where ai.company_id = v_request.company_id
      and ai.source_type = 'proposal_customer_requests'
      and ai.source_id = v_request.id;

    if found then
      if v_attention_status <> 'resolved' then
        raise exception 'dismissed request must retain resolved attention';
      end if;
    elsif v_request.submission_key is not null then
      raise exception 'R3B4A request exists without its required attention item';
    end if;
  else
    v_attention :=
      public.project_proposal_customer_request_attention_v1(v_request.id);
    v_attention_id := (v_attention->>'attention_id')::uuid;

    if v_request.status is distinct from v_next_status then
      update public.proposal_customer_requests
      set status = v_next_status
      where id = v_request.id
        and company_id = v_request.company_id;
    end if;

    if v_next_status = 'seen' then
      update public.job_attention_items
      set
        status = 'acknowledged',
        acknowledged_at = coalesce(acknowledged_at, now()),
        acknowledged_by = coalesce(acknowledged_by, v_uid)
      where id = v_attention_id
        and company_id = v_request.company_id
        and status in ('open', 'acknowledged');
    else
      update public.job_attention_items
      set
        status = 'resolved',
        resolved_at = coalesce(resolved_at, now()),
        resolved_by = coalesce(resolved_by, v_uid),
        resolution_reason = coalesce(resolution_reason, 'request_dismissed')
      where id = v_attention_id
        and company_id = v_request.company_id
        and status in ('open', 'acknowledged', 'resolved');
    end if;

    select ai.status
    into v_attention_status
    from public.job_attention_items ai
    where ai.id = v_attention_id
      and ai.company_id = v_request.company_id;

    if v_next_status = 'seen' and v_attention_status <> 'acknowledged' then
      raise exception 'seen request must map to acknowledged attention';
    end if;

    if v_next_status = 'dismissed' and v_attention_status <> 'resolved' then
      raise exception 'dismissed request must map to resolved attention';
    end if;
  end if;

  select p.status, p.selected_option_id, j.stage
  into
    v_after_proposal_status,
    v_after_selected_option_id,
    v_after_job_stage
  from public.proposals p
  join public.jobs j
    on j.id = p.job_id
   and j.company_id = p.company_id
  where p.id = v_request.proposal_id
    and p.company_id = v_request.company_id;

  if v_after_proposal_status is distinct from v_before_proposal_status
    or v_after_selected_option_id is distinct from v_before_selected_option_id
    or v_after_job_stage is distinct from v_before_job_stage
  then
    raise exception 'request attention update must not mutate proposal/job/package/lifecycle truth';
  end if;

  return jsonb_build_object(
    'ok', true,
    'request_id', v_request.id,
    'attention_id', v_attention_id,
    'attention_status', v_attention_status,
    'status', v_next_status,
    'previous_status', v_request.status,
    'proposal_id', v_request.proposal_id,
    'proposal_version_id', v_request.proposal_version_id,
    'proposal_status_unchanged', v_after_proposal_status,
    'selected_option_id_unchanged', v_after_selected_option_id,
    'job_stage_unchanged', v_after_job_stage
  );
end;
$$;


ALTER FUNCTION "public"."update_proposal_customer_request_status_v1"("p_request_id" "uuid", "p_status" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_proposal_customer_request_status_v1"("p_request_id" "uuid", "p_status" "text") IS 'R3B3 — Authenticated company member marks a customer package request seen/dismissed. Does not mutate proposals.status, jobs.stage, selected_option_id, options/upgrades, or proposal_events. Never exposes raw tokens.';



CREATE OR REPLACE FUNCTION "public"."upsert_company_payment_account_from_provider_v1"("p_payload" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_company_id uuid;
  v_account_id text;
  v_charges boolean;
  v_payouts boolean;
  v_details boolean;
  v_status text;
  v_row public.company_payment_accounts%rowtype;
  v_existing public.company_payment_accounts%rowtype;
begin
  begin
    v_company_id := nullif(p_payload->>'company_id', '')::uuid;
    v_account_id := nullif(trim(p_payload->>'provider_account_id'), '');
    v_charges := coalesce((p_payload->>'charges_enabled')::boolean, false);
    v_payouts := coalesce((p_payload->>'payouts_enabled')::boolean, false);
    v_details := coalesce((p_payload->>'details_submitted')::boolean, false);
  exception when others then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end;

  if v_account_id is null or v_account_id !~ '^acct_' then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  if v_charges then
    v_status := 'complete';
  elsif v_details then
    v_status := 'restricted';
  else
    v_status := 'pending';
  end if;
  if coalesce((p_payload->>'disabled')::boolean, false) then
    v_status := 'disabled';
  end if;

  select a.*
  into v_existing
  from public.company_payment_accounts a
  where a.provider = 'stripe'
    and a.provider_account_id = v_account_id
  for update;

  if found then
    if v_company_id is not null and v_existing.company_id is distinct from v_company_id then
      return jsonb_build_object('ok', false, 'code', 'account_company_mismatch');
    end if;
    update public.company_payment_accounts
    set
      onboarding_status = v_status,
      charges_enabled = v_charges,
      payouts_enabled = v_payouts,
      details_submitted = v_details
    where id = v_existing.id
    returning * into v_row;
  else
    if v_company_id is null then
      return jsonb_build_object('ok', false, 'code', 'not_found');
    end if;
    begin
      insert into public.company_payment_accounts (
        company_id,
        provider,
        provider_account_id,
        onboarding_status,
        charges_enabled,
        payouts_enabled,
        details_submitted
      )
      values (
        v_company_id,
        'stripe',
        v_account_id,
        v_status,
        v_charges,
        v_payouts,
        v_details
      )
      returning * into v_row;
    exception
      when unique_violation then
        return jsonb_build_object('ok', false, 'code', 'account_conflict');
    end;
  end if;

  if v_row.charges_enabled then
    update public.job_attention_items
    set
      status = 'resolved',
      resolved_at = now(),
      resolution_reason = 'charges_enabled'
    where company_id = v_row.company_id
      and attention_type = 'payments_not_connected'
      and status in ('open', 'acknowledged');
  end if;

  return jsonb_build_object(
    'ok', true,
    'id', v_row.id,
    'company_id', v_row.company_id,
    'provider_account_id', v_row.provider_account_id,
    'onboarding_status', v_row.onboarding_status,
    'charges_enabled', v_row.charges_enabled,
    'payouts_enabled', v_row.payouts_enabled,
    'details_submitted', v_row.details_submitted
  );
end;
$$;


ALTER FUNCTION "public"."upsert_company_payment_account_from_provider_v1"("p_payload" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_company_payment_settings_v1"("p_payload" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_company_id uuid;
  v_mode text;
  v_bps integer;
  v_fixed integer;
  v_row public.company_payment_settings%rowtype;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;

  begin
    v_company_id := nullif(p_payload->>'company_id', '')::uuid;
    v_mode := nullif(trim(p_payload->>'default_deposit_mode'), '');
    v_bps := nullif(p_payload->>'default_deposit_percent_bps', '')::integer;
    v_fixed := nullif(p_payload->>'default_deposit_fixed_cents', '')::integer;
  exception when others then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end;

  if v_company_id is null or v_mode is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  if not exists (
    select 1 from public.company_memberships cm
    where cm.company_id = v_company_id and cm.user_id = v_uid
  ) then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;

  if v_mode = 'none' then
    v_bps := null;
    v_fixed := null;
  elsif v_mode = 'percent' then
    v_fixed := null;
  elsif v_mode = 'fixed' then
    v_bps := null;
  else
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  insert into public.company_payment_settings (
    company_id,
    default_deposit_mode,
    default_deposit_percent_bps,
    default_deposit_fixed_cents
  )
  values (v_company_id, v_mode, v_bps, v_fixed)
  on conflict (company_id) do update
    set default_deposit_mode = excluded.default_deposit_mode,
        default_deposit_percent_bps = excluded.default_deposit_percent_bps,
        default_deposit_fixed_cents = excluded.default_deposit_fixed_cents
  returning * into v_row;

  return jsonb_build_object(
    'ok', true,
    'company_id', v_row.company_id,
    'default_deposit_mode', v_row.default_deposit_mode,
    'default_deposit_percent_bps', v_row.default_deposit_percent_bps,
    'default_deposit_fixed_cents', v_row.default_deposit_fixed_cents
  );
end;
$$;


ALTER FUNCTION "public"."upsert_company_payment_settings_v1"("p_payload" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_draft_proposal_payment_terms_v1"("p_payload" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_company_id uuid;
  v_proposal_id uuid;
  v_mode text;
  v_bps integer;
  v_fixed integer;
  v_version public.proposal_versions%rowtype;
  v_row public.proposal_version_payment_terms%rowtype;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;

  begin
    v_company_id := nullif(p_payload->>'company_id', '')::uuid;
    v_proposal_id := nullif(p_payload->>'proposal_id', '')::uuid;
    v_mode := nullif(trim(p_payload->>'deposit_mode'), '');
    v_bps := nullif(p_payload->>'deposit_percent_bps', '')::integer;
    v_fixed := nullif(p_payload->>'deposit_fixed_cents', '')::integer;
  exception when others then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end;

  if v_company_id is null or v_proposal_id is null or v_mode is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  if v_mode = 'none' then
    v_bps := null;
    v_fixed := null;
  elsif v_mode = 'percent' then
    v_fixed := null;
    if v_bps is null or v_bps < 1 or v_bps > 10000 then
      return jsonb_build_object('ok', false, 'code', 'invalid_payload');
    end if;
  elsif v_mode = 'fixed' then
    v_bps := null;
    if v_fixed is null or v_fixed < 100 then
      return jsonb_build_object('ok', false, 'code', 'invalid_payload');
    end if;
  else
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  if not exists (
    select 1 from public.company_memberships cm
    where cm.company_id = v_company_id and cm.user_id = v_uid
  ) then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;

  select v.*
  into v_version
  from public.proposal_versions v
  join public.proposals p on p.id = v.proposal_id and p.company_id = v.company_id
  where p.id = v_proposal_id
    and p.company_id = v_company_id
    and v.id = p.current_draft_version_id
    and v.version_kind = 'draft'
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  insert into public.proposal_version_payment_terms (
    proposal_version_id,
    company_id,
    proposal_id,
    deposit_mode,
    deposit_percent_bps,
    deposit_fixed_cents,
    updated_at
  )
  values (
    v_version.id,
    v_company_id,
    v_proposal_id,
    v_mode,
    v_bps,
    v_fixed,
    now()
  )
  on conflict (proposal_version_id) do update
    set
      deposit_mode = excluded.deposit_mode,
      deposit_percent_bps = excluded.deposit_percent_bps,
      deposit_fixed_cents = excluded.deposit_fixed_cents,
      updated_at = now()
  returning * into v_row;

  return jsonb_build_object(
    'ok', true,
    'proposal_version_id', v_row.proposal_version_id,
    'deposit_mode', v_row.deposit_mode,
    'deposit_percent_bps', v_row.deposit_percent_bps,
    'deposit_fixed_cents', v_row.deposit_fixed_cents
  );
end;
$$;


ALTER FUNCTION "public"."upsert_draft_proposal_payment_terms_v1"("p_payload" "jsonb") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."catalog_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "customer_name" "text",
    "description" "text",
    "item_type" "text" NOT NULL,
    "unit" "text" NOT NULL,
    "quantity_source" "text" NOT NULL,
    "default_quantity" numeric,
    "coverage_rate" numeric,
    "waste_applies" boolean DEFAULT false NOT NULL,
    "unit_cost_cents" bigint,
    "unit_price_cents" bigint,
    "labor_unit_cost_cents" bigint,
    "pricing_basis" "text" DEFAULT 'unit_price'::"text" NOT NULL,
    "customer_visibility" "text" DEFAULT 'customer_visible'::"text" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "sort_order" integer,
    "metadata" "jsonb",
    "created_by" "uuid",
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "waste_pct" numeric,
    "coverage_basis" "text",
    "sales_tax_rate_pct" numeric,
    "purchase_tax_rate_pct" numeric,
    "abc_sku" "text",
    "qxo_sku" "text",
    "srs_sku" "text",
    "composition_role" "text",
    CONSTRAINT "catalog_items_abc_sku_check" CHECK ((("abc_sku" IS NULL) OR (("char_length"("abc_sku") >= 1) AND ("char_length"("abc_sku") <= 128)))),
    CONSTRAINT "catalog_items_composition_role_slug_check" CHECK ((("composition_role" IS NULL) OR ("composition_role" ~ '^[a-z][a-z0-9_]*$'::"text"))),
    CONSTRAINT "catalog_items_coverage_basis_check" CHECK ((("coverage_basis" IS NULL) OR ("coverage_basis" = ANY (ARRAY['roof_square'::"text", 'square_feet'::"text", 'linear_feet'::"text", 'each'::"text", 'tons'::"text"])))),
    CONSTRAINT "catalog_items_coverage_rate_check" CHECK ((("coverage_rate" IS NULL) OR ("coverage_rate" > (0)::numeric))),
    CONSTRAINT "catalog_items_customer_visibility_check" CHECK (("customer_visibility" = ANY (ARRAY['customer_visible'::"text", 'internal_only'::"text", 'grouped'::"text"]))),
    CONSTRAINT "catalog_items_default_quantity_check" CHECK ((("default_quantity" IS NULL) OR ("default_quantity" >= (0)::numeric))),
    CONSTRAINT "catalog_items_item_type_check" CHECK (("item_type" = ANY (ARRAY['material'::"text", 'labor'::"text", 'service'::"text", 'fee'::"text", 'discount'::"text", 'package'::"text"]))),
    CONSTRAINT "catalog_items_labor_unit_cost_cents_check" CHECK ((("labor_unit_cost_cents" IS NULL) OR ("labor_unit_cost_cents" >= 0))),
    CONSTRAINT "catalog_items_name_not_empty" CHECK (("length"(TRIM(BOTH FROM "name")) > 0)),
    CONSTRAINT "catalog_items_pricing_basis_check" CHECK (("pricing_basis" = ANY (ARRAY['unit_price'::"text", 'cost_plus_margin'::"text", 'fixed_price'::"text", 'included'::"text"]))),
    CONSTRAINT "catalog_items_purchase_tax_rate_pct_check" CHECK ((("purchase_tax_rate_pct" IS NULL) OR (("purchase_tax_rate_pct" >= (0)::numeric) AND ("purchase_tax_rate_pct" <= (100)::numeric)))),
    CONSTRAINT "catalog_items_quantity_source_check" CHECK (("quantity_source" = ANY (ARRAY['roof_squares'::"text", 'adjusted_roof_squares'::"text", 'roof_area_sqft'::"text", 'eaves_lf'::"text", 'rakes_lf'::"text", 'ridges_lf'::"text", 'hips_lf'::"text", 'valleys_lf'::"text", 'wall_flashing_lf'::"text", 'step_flashing_lf'::"text", 'transitions_lf'::"text", 'parapet_wall_lf'::"text", 'drip_edge_lf'::"text", 'starter_lf'::"text", 'ridge_cap_lf'::"text", 'pipe_boots_count'::"text", 'vents_count'::"text", 'skylights_count'::"text", 'chimneys_count'::"text", 'satellite_dishes_count'::"text", 'debris_tons'::"text", 'tear_off_squares'::"text", 'labor_multiplier'::"text", 'fixed'::"text", 'custom'::"text"]))),
    CONSTRAINT "catalog_items_qxo_sku_check" CHECK ((("qxo_sku" IS NULL) OR (("char_length"("qxo_sku") >= 1) AND ("char_length"("qxo_sku") <= 128)))),
    CONSTRAINT "catalog_items_sales_tax_rate_pct_check" CHECK ((("sales_tax_rate_pct" IS NULL) OR (("sales_tax_rate_pct" >= (0)::numeric) AND ("sales_tax_rate_pct" <= (100)::numeric)))),
    CONSTRAINT "catalog_items_srs_sku_check" CHECK ((("srs_sku" IS NULL) OR (("char_length"("srs_sku") >= 1) AND ("char_length"("srs_sku") <= 128)))),
    CONSTRAINT "catalog_items_unit_check" CHECK (("unit" = ANY (ARRAY['square'::"text", 'sqft'::"text", 'linear_foot'::"text", 'each'::"text", 'bundle'::"text", 'hour'::"text", 'day'::"text", 'fixed'::"text", 'allowance'::"text"]))),
    CONSTRAINT "catalog_items_unit_cost_cents_check" CHECK ((("unit_cost_cents" IS NULL) OR ("unit_cost_cents" >= 0))),
    CONSTRAINT "catalog_items_unit_price_cents_check" CHECK ((("unit_price_cents" IS NULL) OR ("unit_price_cents" >= 0))),
    CONSTRAINT "catalog_items_waste_pct_check" CHECK ((("waste_pct" IS NULL) OR (("waste_pct" >= (0)::numeric) AND (("waste_pct")::"text" <> ALL (ARRAY['NaN'::"text", 'Infinity'::"text", '-Infinity'::"text"])))))
);


ALTER TABLE "public"."catalog_items" OWNER TO "postgres";


COMMENT ON COLUMN "public"."catalog_items"."coverage_rate" IS 'Future quantity driver: source measurement units covered by one catalog purchase unit. NULL means no conversion (1:1). Non-authoritative until separately approved resolver and snapshot integration exists.';



COMMENT ON COLUMN "public"."catalog_items"."waste_applies" IS 'Future quantity gate. When false, catalog waste_pct must not be applied. adjusted_measurement mode must never apply catalog waste.';



COMMENT ON COLUMN "public"."catalog_items"."waste_pct" IS 'Future raw_plus_waste driver expressed in percent points (10 means 10%). NULL means no catalog waste percentage. Non-authoritative until separately approved production wiring exists.';



COMMENT ON COLUMN "public"."catalog_items"."coverage_basis" IS 'Measurement-side unit of the coverage divisor (what coverage_rate measures): null | roof_square | square_feet | linear_feet | each | tons. NOT the purchase/sell unit (see unit). Existing rows with coverage_rate set and coverage_basis null remain not_verified until a user sets a basis. adjusted_measurement ignores coverage/waste. raw_plus_waste mode switch remains blocked until source/basis compatibility is proven. Non-authoritative for app wiring until separately approved types/UI/classifier gates.';



COMMENT ON COLUMN "public"."catalog_items"."sales_tax_rate_pct" IS 'Customer-facing item sales tax rate capture (percent points; 8.25 = 8.25%). Nullable; no default; no backfill. Source-of-truth for future proposal line-tax math — this migration does not change proposal pricing math.';



COMMENT ON COLUMN "public"."catalog_items"."purchase_tax_rate_pct" IS 'Internal supplier/material purchase tax rate capture (percent points). Nullable; no default; no backfill. For future true-cost / material-order / job-costing. Must never be shown to customers. This migration does not change proposal pricing math.';



COMMENT ON COLUMN "public"."catalog_items"."abc_sku" IS 'Contractor/internal ABC supplier SKU for this catalog item. Nullable; no default; no backfill. Does not imply supplier sync is active. Does not change pricing or material ordering. Not customer-facing.';



COMMENT ON COLUMN "public"."catalog_items"."qxo_sku" IS 'Contractor/internal QXO (Beacon) supplier SKU for this catalog item. Nullable; no default; no backfill. Does not imply supplier sync is active. Does not change pricing or material ordering. Not customer-facing.';



COMMENT ON COLUMN "public"."catalog_items"."srs_sku" IS 'Contractor/internal SRS supplier SKU for this catalog item. Nullable; no default; no backfill. Does not imply supplier sync is active. Does not change pricing or material ordering. Not customer-facing.';



COMMENT ON COLUMN "public"."catalog_items"."composition_role" IS 'Default functional family for this Catalog product (internal composition identity). Not customer-facing.';



COMMENT ON CONSTRAINT "catalog_items_abc_sku_check" ON "public"."catalog_items" IS 'Allows null or text length 1..128. No default. No backfill. Internal catalog metadata only.';



COMMENT ON CONSTRAINT "catalog_items_coverage_basis_check" ON "public"."catalog_items" IS 'Allows null or approved coverage_basis enum values only. No default. No backfill. Does not enable mode switch, classifier production wiring, or purchase-unit proxying.';



COMMENT ON CONSTRAINT "catalog_items_purchase_tax_rate_pct_check" ON "public"."catalog_items" IS 'Allows null or 0..100 inclusive. No default. No backfill. Internal-only field; never customer-facing.';



COMMENT ON CONSTRAINT "catalog_items_qxo_sku_check" ON "public"."catalog_items" IS 'Allows null or text length 1..128. No default. No backfill. Internal catalog metadata only.';



COMMENT ON CONSTRAINT "catalog_items_sales_tax_rate_pct_check" ON "public"."catalog_items" IS 'Allows null or 0..100 inclusive. No default. No backfill. Does not enable proposal line-tax application.';



COMMENT ON CONSTRAINT "catalog_items_srs_sku_check" ON "public"."catalog_items" IS 'Allows null or text length 1..128. No default. No backfill. Internal catalog metadata only.';



CREATE TABLE IF NOT EXISTS "public"."companies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text",
    "owner_email" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "owner_user_id" "uuid",
    "phone" "text",
    "license" "text",
    "logo_url" "text",
    "notifications_email" "text",
    "timezone" "text"
);


ALTER TABLE "public"."companies" OWNER TO "postgres";


COMMENT ON COLUMN "public"."companies"."timezone" IS 'IANA timezone for operational scheduling. Null until the contractor saves one. Never inferred from browser locale. job_schedules copies this value at insert.';



CREATE TABLE IF NOT EXISTS "public"."company_branding_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "address" "text",
    "website" "text",
    "brand_primary_color" "text",
    "brand_secondary_color" "text",
    "show_license_on_cover" boolean DEFAULT false NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."company_branding_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_memberships" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "company_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'owner'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."company_memberships" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_payment_accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "provider" "text" DEFAULT 'stripe'::"text" NOT NULL,
    "provider_account_id" "text" NOT NULL,
    "onboarding_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "charges_enabled" boolean DEFAULT false NOT NULL,
    "payouts_enabled" boolean DEFAULT false NOT NULL,
    "details_submitted" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "company_payment_accounts_onboarding_status_check" CHECK (("onboarding_status" = ANY (ARRAY['pending'::"text", 'complete'::"text", 'restricted'::"text", 'disabled'::"text"]))),
    CONSTRAINT "company_payment_accounts_provider_account_id_check" CHECK ((("char_length"("provider_account_id") >= 4) AND ("char_length"("provider_account_id") <= 128) AND ("provider_account_id" ~ '^acct_'::"text"))),
    CONSTRAINT "company_payment_accounts_provider_check" CHECK (("provider" = 'stripe'::"text"))
);


ALTER TABLE "public"."company_payment_accounts" OWNER TO "postgres";


COMMENT ON TABLE "public"."company_payment_accounts" IS 'R3E contractor Stripe connected-account status. No secrets, bank data, cards, or KYC documents.';



COMMENT ON COLUMN "public"."company_payment_accounts"."provider_account_id" IS 'Stripe connected account id (acct_…). Not a FieldDive business-type label.';



CREATE TABLE IF NOT EXISTS "public"."company_payment_settings" (
    "company_id" "uuid" NOT NULL,
    "default_deposit_mode" "text" DEFAULT 'none'::"text" NOT NULL,
    "default_deposit_percent_bps" integer,
    "default_deposit_fixed_cents" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "company_payment_settings_fixed_cents_check" CHECK ((("default_deposit_fixed_cents" IS NULL) OR ("default_deposit_fixed_cents" >= 100))),
    CONSTRAINT "company_payment_settings_mode_check" CHECK (("default_deposit_mode" = ANY (ARRAY['none'::"text", 'percent'::"text", 'fixed'::"text"]))),
    CONSTRAINT "company_payment_settings_mode_values_check" CHECK (((("default_deposit_mode" = 'none'::"text") AND ("default_deposit_percent_bps" IS NULL) AND ("default_deposit_fixed_cents" IS NULL)) OR (("default_deposit_mode" = 'percent'::"text") AND ("default_deposit_percent_bps" IS NOT NULL) AND ("default_deposit_fixed_cents" IS NULL)) OR (("default_deposit_mode" = 'fixed'::"text") AND ("default_deposit_fixed_cents" IS NOT NULL) AND ("default_deposit_percent_bps" IS NULL)))),
    CONSTRAINT "company_payment_settings_percent_bps_check" CHECK ((("default_deposit_percent_bps" IS NULL) OR (("default_deposit_percent_bps" >= 1) AND ("default_deposit_percent_bps" <= 10000))))
);


ALTER TABLE "public"."company_payment_settings" OWNER TO "postgres";


COMMENT ON TABLE "public"."company_payment_settings" IS 'R3E company deposit prefill. Changing defaults never rewrites existing payment requests.';



CREATE TABLE IF NOT EXISTS "public"."company_pricing_policies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "profitability_type" "text" DEFAULT 'margin'::"text" NOT NULL,
    "default_profitability_pct" numeric NOT NULL,
    "minimum_profitability_pct" numeric NOT NULL,
    "quantity_rounding" "text" DEFAULT 'exact'::"text" NOT NULL,
    "waste_model" "text" DEFAULT 'adjusted_measurement'::"text" NOT NULL,
    "sales_tax_rate_pct" numeric DEFAULT 0 NOT NULL,
    "material_purchase_tax_rate_pct" numeric,
    "metadata" "jsonb",
    "created_by" "uuid",
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "company_pricing_policies_default_pct_check" CHECK (("default_profitability_pct" >= (0)::numeric)),
    CONSTRAINT "company_pricing_policies_margin_default_lt_100_check" CHECK ((("profitability_type" <> 'margin'::"text") OR ("default_profitability_pct" < (100)::numeric))),
    CONSTRAINT "company_pricing_policies_margin_minimum_lt_100_check" CHECK ((("profitability_type" <> 'margin'::"text") OR ("minimum_profitability_pct" < (100)::numeric))),
    CONSTRAINT "company_pricing_policies_material_tax_check" CHECK ((("material_purchase_tax_rate_pct" IS NULL) OR ("material_purchase_tax_rate_pct" >= (0)::numeric))),
    CONSTRAINT "company_pricing_policies_minimum_le_default_check" CHECK (("minimum_profitability_pct" <= "default_profitability_pct")),
    CONSTRAINT "company_pricing_policies_minimum_pct_check" CHECK (("minimum_profitability_pct" >= (0)::numeric)),
    CONSTRAINT "company_pricing_policies_profitability_type_check" CHECK (("profitability_type" = ANY (ARRAY['margin'::"text", 'markup'::"text"]))),
    CONSTRAINT "company_pricing_policies_quantity_rounding_check" CHECK (("quantity_rounding" = 'exact'::"text")),
    CONSTRAINT "company_pricing_policies_sales_tax_check" CHECK (("sales_tax_rate_pct" >= (0)::numeric)),
    CONSTRAINT "company_pricing_policies_waste_model_check" CHECK (("waste_model" = ANY (ARRAY['adjusted_measurement'::"text", 'raw_plus_waste'::"text"])))
);


ALTER TABLE "public"."company_pricing_policies" OWNER TO "postgres";


COMMENT ON COLUMN "public"."company_pricing_policies"."waste_model" IS 'Company quantity/waste policy mode. Default and production path remain adjusted_measurement. raw_plus_waste is a staged future policy mode allowed by CHECK only after explicit migration apply; production quantity resolver, pricing engine, and UI must not treat it as live until separately approved gates. whole rounding remains unsupported (quantity_rounding CHECK unchanged).';



COMMENT ON CONSTRAINT "company_pricing_policies_waste_model_check" ON "public"."company_pricing_policies" IS 'Allows adjusted_measurement (default) and staged raw_plus_waste. Does not enable quantity-layer production wiring, UI controls, or whole rounding.';



CREATE TABLE IF NOT EXISTS "public"."company_template_preferences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "module_key" "text" NOT NULL,
    "workflow_key" "text" NOT NULL,
    "preference_kind" "text" NOT NULL,
    "template_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "company_template_preferences_kind_check" CHECK (("preference_kind" = 'preferred_setup'::"text")),
    CONSTRAINT "company_template_preferences_kind_not_empty" CHECK (("length"(TRIM(BOTH FROM "preference_kind")) > 0)),
    CONSTRAINT "company_template_preferences_module_key_not_empty" CHECK (("length"(TRIM(BOTH FROM "module_key")) > 0)),
    CONSTRAINT "company_template_preferences_workflow_key_not_empty" CHECK (("length"(TRIM(BOTH FROM "workflow_key")) > 0))
);


ALTER TABLE "public"."company_template_preferences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid",
    "name" "text",
    "email" "text",
    "phone" "text",
    "address" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."customers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."estimates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid",
    "customer_id" "uuid",
    "job_name" "text",
    "roof_area_sqft" numeric,
    "roof_pitch" "text",
    "materials_cost" numeric,
    "labor_cost" numeric,
    "tearoff_cost" numeric,
    "margin_percent" numeric,
    "job_cost" numeric,
    "suggested_price" numeric,
    "status" "text" DEFAULT 'estimate'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "snapshot" "jsonb",
    "job_id" "uuid"
);


ALTER TABLE "public"."estimates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_activity_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "job_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "actor_user_id" "uuid",
    "payload_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "job_activity_events_type_check" CHECK (("event_type" = ANY (ARRAY['job_created'::"text", 'stage_changed'::"text", 'disposition_changed'::"text", 'job_scheduled'::"text", 'job_rescheduled'::"text", 'job_unscheduled'::"text", 'job_work_started'::"text", 'job_work_completed'::"text"])))
);


ALTER TABLE "public"."job_activity_events" OWNER TO "postgres";


COMMENT ON TABLE "public"."job_activity_events" IS 'Job-native durable Activity facts only (created, stage, disposition). Proposal sent/requests are composed from their native owners. Not event sourcing.';



CREATE TABLE IF NOT EXISTS "public"."job_attachments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "job_id" "uuid" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "kind" "text" NOT NULL,
    "mime_type" "text" NOT NULL,
    "byte_size" bigint NOT NULL,
    "original_filename" "text" NOT NULL,
    "storage_bucket" "text" DEFAULT 'job-attachments'::"text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "width_px" integer,
    "height_px" integer,
    "capture_source" "text" DEFAULT 'unknown'::"text" NOT NULL,
    "job_stage_at_upload" "text",
    "caption" "text",
    "visibility" "text" DEFAULT 'internal'::"text" NOT NULL,
    "listed_in_job_gallery" boolean DEFAULT true NOT NULL,
    CONSTRAINT "job_attachments_byte_size_check" CHECK (("byte_size" >= 0)),
    CONSTRAINT "job_attachments_caption_check" CHECK ((("caption" IS NULL) OR ("char_length"("caption") <= 500))),
    CONSTRAINT "job_attachments_filename_check" CHECK ((("char_length"("original_filename") >= 1) AND ("char_length"("original_filename") <= 255))),
    CONSTRAINT "job_attachments_kind_check" CHECK (("kind" = ANY (ARRAY['image'::"text", 'document'::"text"]))),
    CONSTRAINT "job_attachments_storage_bucket_check" CHECK (("storage_bucket" = 'job-attachments'::"text")),
    CONSTRAINT "job_attachments_visibility_check" CHECK (("visibility" = 'internal'::"text"))
);


ALTER TABLE "public"."job_attachments" OWNER TO "postgres";


COMMENT ON TABLE "public"."job_attachments" IS 'Generic private job file metadata. Documentation gallery uses listed_in_job_gallery. Not measurement acquisition.';



COMMENT ON COLUMN "public"."job_attachments"."capture_source" IS 'Extensible text. V1: camera | library | file | unknown.';



COMMENT ON COLUMN "public"."job_attachments"."job_stage_at_upload" IS 'Optional snapshot of jobs.stage at upload. Not live stage authority.';



COMMENT ON COLUMN "public"."job_attachments"."visibility" IS 'V1 internal only. Customer/proposal publish is a later explicit association.';



COMMENT ON COLUMN "public"."job_attachments"."listed_in_job_gallery" IS 'When true and not deleted, file appears in Job Photos gallery. Measurement-source imagery stays false later.';



CREATE TABLE IF NOT EXISTS "public"."job_attention_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "job_id" "uuid" NOT NULL,
    "proposal_id" "uuid",
    "proposal_version_id" "uuid",
    "attention_type" "text" NOT NULL,
    "source_type" "text" NOT NULL,
    "source_id" "uuid" NOT NULL,
    "source_occurred_at" timestamp with time zone NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "base_severity" "text" DEFAULT 'high'::"text" NOT NULL,
    "opened_at" timestamp with time zone NOT NULL,
    "due_at" timestamp with time zone,
    "next_escalation_at" timestamp with time zone,
    "acknowledged_at" timestamp with time zone,
    "acknowledged_by" "uuid",
    "assigned_to_user_id" "uuid",
    "resolved_at" timestamp with time zone,
    "resolved_by" "uuid",
    "resolution_reason" "text",
    "dedupe_key" "text" NOT NULL,
    "destination_kind" "text" NOT NULL,
    "destination_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "policy_version" "text" DEFAULT 'r3b4a-v1'::"text" NOT NULL,
    "metadata_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "job_attention_items_acknowledgement_state_check" CHECK (((("status" = 'open'::"text") AND ("acknowledged_at" IS NULL) AND ("acknowledged_by" IS NULL)) OR (("status" = 'acknowledged'::"text") AND ("acknowledged_at" IS NOT NULL)) OR ("status" = 'resolved'::"text"))),
    CONSTRAINT "job_attention_items_attention_type_check" CHECK (("attention_type" = ANY (ARRAY['customer_package_request'::"text", 'customer_question'::"text", 'acceptance_confirmation_required'::"text", 'payments_not_connected'::"text", 'payment_failed'::"text"]))),
    CONSTRAINT "job_attention_items_base_severity_check" CHECK (("base_severity" = ANY (ARRAY['normal'::"text", 'high'::"text", 'critical'::"text"]))),
    CONSTRAINT "job_attention_items_dedupe_key_not_empty" CHECK ((("length"(TRIM(BOTH FROM "dedupe_key")) > 0) AND ("char_length"("dedupe_key") <= 240))),
    CONSTRAINT "job_attention_items_destination_kind_check" CHECK (("destination_kind" = 'job_card_proposals'::"text")),
    CONSTRAINT "job_attention_items_destination_object_check" CHECK (("jsonb_typeof"("destination_json") = 'object'::"text")),
    CONSTRAINT "job_attention_items_metadata_object_check" CHECK (("jsonb_typeof"("metadata_json") = 'object'::"text")),
    CONSTRAINT "job_attention_items_policy_version_not_empty" CHECK ((("length"(TRIM(BOTH FROM "policy_version")) > 0) AND ("char_length"("policy_version") <= 80))),
    CONSTRAINT "job_attention_items_resolution_state_check" CHECK (((("status" <> 'resolved'::"text") AND ("resolved_at" IS NULL) AND ("resolved_by" IS NULL) AND ("resolution_reason" IS NULL)) OR (("status" = 'resolved'::"text") AND ("resolved_at" IS NOT NULL) AND ("resolution_reason" IS NOT NULL)))),
    CONSTRAINT "job_attention_items_source_type_check" CHECK (("source_type" = ANY (ARRAY['proposal_customer_requests'::"text", 'proposal_acceptances'::"text", 'jobs'::"text", 'job_payment_requests'::"text"]))),
    CONSTRAINT "job_attention_items_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'acknowledged'::"text", 'resolved'::"text"])))
);


ALTER TABLE "public"."job_attention_items" OWNER TO "postgres";


COMMENT ON TABLE "public"."job_attention_items" IS 'R3B4A company-level operational attention projection. Source truth remains in domain tables. Attention status never changes proposal or job lifecycle truth.';



COMMENT ON COLUMN "public"."job_attention_items"."destination_kind" IS 'Structured navigation target. R3B4A uses job_card_proposals because the existing Job Card Proposals tab is the canonical actionable request-review context.';



CREATE TABLE IF NOT EXISTS "public"."job_attention_user_state" (
    "company_id" "uuid" NOT NULL,
    "attention_item_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "read_at" timestamp with time zone,
    "last_viewed_at" timestamp with time zone,
    "last_notified_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "job_attention_user_state_read_view_check" CHECK ((("read_at" IS NULL) OR ("last_viewed_at" IS NOT NULL)))
);


ALTER TABLE "public"."job_attention_user_state" OWNER TO "postgres";


COMMENT ON TABLE "public"."job_attention_user_state" IS 'R3B4A per-user consumption state only. Reading an item does not acknowledge or resolve company-level attention and does not change proposal_customer_requests.status.';



CREATE TABLE IF NOT EXISTS "public"."job_payment_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "payment_request_id" "uuid" NOT NULL,
    "provider" "text" DEFAULT 'stripe'::"text" NOT NULL,
    "provider_event_id" "text" NOT NULL,
    "provider_payment_intent_id" "text",
    "provider_charge_id" "text",
    "amount_cents" integer NOT NULL,
    "currency" "text" DEFAULT 'usd'::"text" NOT NULL,
    "kind" "text" NOT NULL,
    "status" "text" NOT NULL,
    "occurred_at" timestamp with time zone NOT NULL,
    "raw_type" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "job_payment_transactions_amount_cents_check" CHECK (("amount_cents" >= 0)),
    CONSTRAINT "job_payment_transactions_currency_check" CHECK (("currency" = 'usd'::"text")),
    CONSTRAINT "job_payment_transactions_event_id_check" CHECK ((("length"(TRIM(BOTH FROM "provider_event_id")) > 0) AND ("char_length"("provider_event_id") <= 255))),
    CONSTRAINT "job_payment_transactions_kind_check" CHECK (("kind" = ANY (ARRAY['capture'::"text", 'failure'::"text", 'refund'::"text"]))),
    CONSTRAINT "job_payment_transactions_kind_status_check" CHECK (((("kind" = 'capture'::"text") AND ("status" = 'succeeded'::"text")) OR (("kind" = 'failure'::"text") AND ("status" = 'failed'::"text")) OR (("kind" = 'refund'::"text") AND ("status" = 'refunded'::"text")))),
    CONSTRAINT "job_payment_transactions_provider_check" CHECK (("provider" = 'stripe'::"text")),
    CONSTRAINT "job_payment_transactions_raw_type_check" CHECK ((("length"(TRIM(BOTH FROM "raw_type")) > 0) AND ("char_length"("raw_type") <= 120))),
    CONSTRAINT "job_payment_transactions_status_check" CHECK (("status" = ANY (ARRAY['succeeded'::"text", 'failed'::"text", 'refunded'::"text"])))
);


ALTER TABLE "public"."job_payment_transactions" OWNER TO "postgres";


COMMENT ON TABLE "public"."job_payment_transactions" IS 'R3E append-only Stripe settlement events. Request = contractor intent. Transaction = provider settlement.';



CREATE OR REPLACE VIEW "public"."job_payment_legacy_refund_review_v1" WITH ("security_invoker"='true') AS
 SELECT "t"."id" AS "legacy_transaction_id",
    "t"."company_id",
    "r"."job_id",
    "t"."payment_request_id",
    "t"."provider",
    "t"."provider_event_id",
    "t"."provider_payment_intent_id",
    "t"."provider_charge_id",
    "t"."amount_cents",
    "t"."currency",
    "t"."occurred_at",
    "t"."raw_type",
    'ambiguous_missing_provider_refund_id'::"text" AS "review_classification",
    'job_payment_transactions has no Stripe Refund id; event delivery cannot prove logical refund identity'::"text" AS "review_reason"
   FROM ("public"."job_payment_transactions" "t"
     JOIN "public"."job_payment_requests" "r" ON ((("r"."id" = "t"."payment_request_id") AND ("r"."company_id" = "t"."company_id"))))
  WHERE ("t"."kind" = 'refund'::"text");


ALTER VIEW "public"."job_payment_legacy_refund_review_v1" OWNER TO "postgres";


COMMENT ON VIEW "public"."job_payment_legacy_refund_review_v1" IS 'Read-only review of untouched legacy refund transactions. All are ambiguous because the historical schema cannot store Stripe Refund ids.';



CREATE TABLE IF NOT EXISTS "public"."job_payment_refund_event_receipts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid",
    "refund_id" "uuid",
    "provider" "text" DEFAULT 'stripe'::"text" NOT NULL,
    "provider_account_id" "text" NOT NULL,
    "provider_event_id" "text" NOT NULL,
    "raw_type" "text" NOT NULL,
    "provider_event_created_at" timestamp with time zone NOT NULL,
    "provider_refund_id" "text",
    "metadata_refund_command_id" "uuid",
    "provider_payment_intent_id" "text",
    "provider_charge_id" "text",
    "amount_cents" integer,
    "provider_status_raw" "text",
    "refund_status" "text",
    "correlation_method" "text" NOT NULL,
    "disposition" "text" NOT NULL,
    "received_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "job_payment_refund_events_account_check" CHECK (((("char_length"("provider_account_id") >= 6) AND ("char_length"("provider_account_id") <= 128)) AND ("provider_account_id" ~ '^acct_[A-Za-z0-9]+$'::"text"))),
    CONSTRAINT "job_payment_refund_events_amount_check" CHECK ((("amount_cents" IS NULL) OR ("amount_cents" > 0))),
    CONSTRAINT "job_payment_refund_events_binding_shape_check" CHECK (((("refund_id" IS NULL) AND ("company_id" IS NULL)) OR (("refund_id" IS NOT NULL) AND ("company_id" IS NOT NULL)))),
    CONSTRAINT "job_payment_refund_events_charge_check" CHECK ((("provider_charge_id" IS NULL) OR ((("char_length"("provider_charge_id") >= 4) AND ("char_length"("provider_charge_id") <= 255)) AND ("provider_charge_id" ~ '^ch_[A-Za-z0-9]+$'::"text")))),
    CONSTRAINT "job_payment_refund_events_correlation_check" CHECK (("correlation_method" = ANY (ARRAY['provider_refund_id'::"text", 'metadata_command_id'::"text", 'payment_intent'::"text", 'charge'::"text", 'none'::"text"]))),
    CONSTRAINT "job_payment_refund_events_disposition_check" CHECK (("disposition" = ANY (ARRAY['applied'::"text", 'stale'::"text", 'unbound'::"text", 'identity_mismatch'::"text", 'overrefund_conflict'::"text", 'unsupported'::"text"]))),
    CONSTRAINT "job_payment_refund_events_event_id_check" CHECK ((("provider_event_id" = TRIM(BOTH FROM "provider_event_id")) AND (("char_length"("provider_event_id") >= 4) AND ("char_length"("provider_event_id") <= 255)))),
    CONSTRAINT "job_payment_refund_events_payment_intent_check" CHECK ((("provider_payment_intent_id" IS NULL) OR ((("char_length"("provider_payment_intent_id") >= 4) AND ("char_length"("provider_payment_intent_id") <= 255)) AND ("provider_payment_intent_id" ~ '^pi_[A-Za-z0-9]+$'::"text")))),
    CONSTRAINT "job_payment_refund_events_provider_check" CHECK (("provider" = 'stripe'::"text")),
    CONSTRAINT "job_payment_refund_events_provider_status_raw_check" CHECK ((("provider_status_raw" IS NULL) OR (("char_length"("provider_status_raw") >= 1) AND ("char_length"("provider_status_raw") <= 120)))),
    CONSTRAINT "job_payment_refund_events_raw_type_check" CHECK ((("raw_type" = TRIM(BOTH FROM "raw_type")) AND (("char_length"("raw_type") >= 1) AND ("char_length"("raw_type") <= 120)))),
    CONSTRAINT "job_payment_refund_events_refund_id_check" CHECK ((("provider_refund_id" IS NULL) OR ((("char_length"("provider_refund_id") >= 4) AND ("char_length"("provider_refund_id") <= 255)) AND ("provider_refund_id" ~ '^re_[A-Za-z0-9]+$'::"text")))),
    CONSTRAINT "job_payment_refund_events_status_check" CHECK ((("refund_status" IS NULL) OR ("refund_status" = ANY (ARRAY['initiating'::"text", 'pending'::"text", 'requires_action'::"text", 'succeeded'::"text", 'failed'::"text", 'canceled'::"text"]))))
);


ALTER TABLE "public"."job_payment_refund_event_receipts" OWNER TO "postgres";


COMMENT ON TABLE "public"."job_payment_refund_event_receipts" IS 'Append-only Stripe refund event delivery receipts. Unbound deliveries retain account/event audit truth without inventing a company binding.';



CREATE TABLE IF NOT EXISTS "public"."job_payment_refunds" (
    "id" "uuid" NOT NULL,
    "company_id" "uuid" NOT NULL,
    "job_id" "uuid" NOT NULL,
    "payment_request_id" "uuid" NOT NULL,
    "canonical_capture_transaction_id" "uuid" NOT NULL,
    "provider" "text" DEFAULT 'stripe'::"text" NOT NULL,
    "provider_account_id" "text" NOT NULL,
    "provider_payment_intent_id" "text" NOT NULL,
    "provider_charge_id" "text",
    "provider_refund_id" "text",
    "amount_cents" integer NOT NULL,
    "currency" "text" DEFAULT 'usd'::"text" NOT NULL,
    "origin" "text" NOT NULL,
    "created_by_user_id" "uuid",
    "internal_reason" "text",
    "idempotency_key" "text" NOT NULL,
    "status" "text" NOT NULL,
    "provider_reason_code" "text",
    "provider_reason_message" "text",
    "provider_created_at" timestamp with time zone,
    "provider_updated_at" timestamp with time zone,
    "last_provider_event_created_at" timestamp with time zone,
    "initiated_at" timestamp with time zone,
    "pending_at" timestamp with time zone,
    "requires_action_at" timestamp with time zone,
    "succeeded_at" timestamp with time zone,
    "failed_at" timestamp with time zone,
    "canceled_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "job_payment_refunds_account_check" CHECK (((("char_length"("provider_account_id") >= 6) AND ("char_length"("provider_account_id") <= 128)) AND ("provider_account_id" ~ '^acct_[A-Za-z0-9]+$'::"text"))),
    CONSTRAINT "job_payment_refunds_actor_check" CHECK (((("origin" = 'fielddive'::"text") AND ("created_by_user_id" IS NOT NULL)) OR (("origin" = 'stripe_dashboard'::"text") AND ("created_by_user_id" IS NULL)))),
    CONSTRAINT "job_payment_refunds_amount_check" CHECK (("amount_cents" > 0)),
    CONSTRAINT "job_payment_refunds_canceled_at_check" CHECK ((("status" <> 'canceled'::"text") OR ("canceled_at" IS NOT NULL))),
    CONSTRAINT "job_payment_refunds_charge_check" CHECK ((("provider_charge_id" IS NULL) OR ((("char_length"("provider_charge_id") >= 4) AND ("char_length"("provider_charge_id") <= 255)) AND ("provider_charge_id" ~ '^ch_[A-Za-z0-9]+$'::"text")))),
    CONSTRAINT "job_payment_refunds_currency_check" CHECK (("currency" = 'usd'::"text")),
    CONSTRAINT "job_payment_refunds_failed_at_check" CHECK ((("status" <> 'failed'::"text") OR ("failed_at" IS NOT NULL))),
    CONSTRAINT "job_payment_refunds_idempotency_key_check" CHECK ((("idempotency_key" = TRIM(BOTH FROM "idempotency_key")) AND (("char_length"("idempotency_key") >= 8) AND ("char_length"("idempotency_key") <= 255)))),
    CONSTRAINT "job_payment_refunds_initiated_at_check" CHECK ((("origin" = 'fielddive'::"text") = ("initiated_at" IS NOT NULL))),
    CONSTRAINT "job_payment_refunds_origin_check" CHECK (("origin" = ANY (ARRAY['fielddive'::"text", 'stripe_dashboard'::"text"]))),
    CONSTRAINT "job_payment_refunds_payment_intent_check" CHECK (((("char_length"("provider_payment_intent_id") >= 4) AND ("char_length"("provider_payment_intent_id") <= 255)) AND ("provider_payment_intent_id" ~ '^pi_[A-Za-z0-9]+$'::"text"))),
    CONSTRAINT "job_payment_refunds_pending_at_check" CHECK ((("status" <> 'pending'::"text") OR ("pending_at" IS NOT NULL))),
    CONSTRAINT "job_payment_refunds_provider_check" CHECK (("provider" = 'stripe'::"text")),
    CONSTRAINT "job_payment_refunds_provider_refund_id_check" CHECK ((("provider_refund_id" IS NOT NULL) OR ("status" = ANY (ARRAY['initiating'::"text", 'failed'::"text"])))),
    CONSTRAINT "job_payment_refunds_reason_check" CHECK ((("internal_reason" IS NULL) OR (("internal_reason" = TRIM(BOTH FROM "internal_reason")) AND (("char_length"("internal_reason") >= 1) AND ("char_length"("internal_reason") <= 500))))),
    CONSTRAINT "job_payment_refunds_reason_code_check" CHECK ((("provider_reason_code" IS NULL) OR (("char_length"("provider_reason_code") >= 1) AND ("char_length"("provider_reason_code") <= 120)))),
    CONSTRAINT "job_payment_refunds_reason_message_check" CHECK ((("provider_reason_message" IS NULL) OR (("char_length"("provider_reason_message") >= 1) AND ("char_length"("provider_reason_message") <= 1000)))),
    CONSTRAINT "job_payment_refunds_refund_check" CHECK ((("provider_refund_id" IS NULL) OR ((("char_length"("provider_refund_id") >= 4) AND ("char_length"("provider_refund_id") <= 255)) AND ("provider_refund_id" ~ '^re_[A-Za-z0-9]+$'::"text")))),
    CONSTRAINT "job_payment_refunds_requires_action_at_check" CHECK ((("status" <> 'requires_action'::"text") OR ("requires_action_at" IS NOT NULL))),
    CONSTRAINT "job_payment_refunds_status_check" CHECK (("status" = ANY (ARRAY['initiating'::"text", 'pending'::"text", 'requires_action'::"text", 'succeeded'::"text", 'failed'::"text", 'canceled'::"text"]))),
    CONSTRAINT "job_payment_refunds_succeeded_at_check" CHECK ((("status" <> 'succeeded'::"text") OR ("succeeded_at" IS NOT NULL)))
);


ALTER TABLE "public"."job_payment_refunds" OWNER TO "postgres";


COMMENT ON TABLE "public"."job_payment_refunds" IS 'Refunds V1 financial truth: one immutable logical/Stripe refund bound to one canonical successful Stripe capture.';



CREATE TABLE IF NOT EXISTS "public"."job_tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "job_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "notes" "text",
    "status" "text" NOT NULL,
    "due_on" "date",
    "created_by" "uuid",
    "completed_at" timestamp with time zone,
    "completed_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    CONSTRAINT "job_tasks_completion_check" CHECK (((("status" = 'open'::"text") AND ("completed_at" IS NULL) AND ("completed_by" IS NULL)) OR (("status" = 'complete'::"text") AND ("completed_at" IS NOT NULL)))),
    CONSTRAINT "job_tasks_notes_check" CHECK ((("notes" IS NULL) OR ("char_length"("notes") <= 500))),
    CONSTRAINT "job_tasks_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'complete'::"text"]))),
    CONSTRAINT "job_tasks_title_check" CHECK ((("char_length"("title") >= 1) AND ("char_length"("title") <= 120)))
);


ALTER TABLE "public"."job_tasks" OWNER TO "postgres";


COMMENT ON TABLE "public"."job_tasks" IS 'Optional job-scoped contractor memory/coordination. Not workflow, Calendar, or Attention.';



COMMENT ON COLUMN "public"."job_tasks"."status" IS 'open | complete only. Open tasks do not block Job Complete.';



COMMENT ON COLUMN "public"."job_tasks"."due_on" IS 'Civil due date. Calendar owns scheduled occurrence/time. Null is valid.';



COMMENT ON COLUMN "public"."job_tasks"."completed_at" IS 'Server-authoritative completion instant. Cleared on reopen. Not client-supplied.';



CREATE TABLE IF NOT EXISTS "public"."jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "customer_id" "uuid",
    "job_name" "text",
    "stage" "text" DEFAULT 'intake'::"text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "source" "text" DEFAULT 'manual'::"text" NOT NULL,
    "priority" "text" DEFAULT 'normal'::"text",
    "customer_name" "text",
    "customer_email" "text",
    "customer_phone" "text",
    "address_line1" "text",
    "address_line2" "text",
    "address_city" "text",
    "address_state" "text",
    "address_zip" "text",
    "address_country" "text" DEFAULT 'US'::"text",
    "address_formatted" "text",
    "assigned_to" "uuid",
    "created_by" "uuid",
    "updated_by" "uuid",
    "notes" "text",
    "summary" "text",
    "last_activity_at" timestamp with time zone,
    "archived" boolean DEFAULT false NOT NULL,
    "deleted_at" timestamp with time zone,
    "selected_measurement_id" "uuid",
    "active_proposal_id" "uuid",
    "latest_estimate_id" "text",
    "latest_proposal_id" "uuid",
    "source_metadata" "jsonb",
    "custom_fields" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "stage_entered_at" timestamp with time zone,
    "production_started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "property_id" "uuid",
    CONSTRAINT "jobs_completed_at_stage_check" CHECK (((("stage" = 'complete'::"text") AND ("completed_at" IS NOT NULL) AND ("production_started_at" IS NOT NULL) AND ("completed_at" >= "production_started_at")) OR (("stage" IS DISTINCT FROM 'complete'::"text") AND ("completed_at" IS NULL)))),
    CONSTRAINT "jobs_priority_check" CHECK (("priority" = ANY (ARRAY['low'::"text", 'normal'::"text", 'high'::"text", 'urgent'::"text"]))),
    CONSTRAINT "jobs_production_started_at_stage_check" CHECK (((("stage" = ANY (ARRAY['production'::"text", 'complete'::"text"])) AND ("production_started_at" IS NOT NULL)) OR (("stage" <> ALL (ARRAY['production'::"text", 'complete'::"text"])) AND ("production_started_at" IS NULL)))),
    CONSTRAINT "jobs_source_check" CHECK (("source" = ANY (ARRAY['manual'::"text", 'intake'::"text", 'referral'::"text", 'website'::"text", 'phone'::"text", 'email'::"text", 'campaign'::"text", 'external_import'::"text", 'unknown'::"text"]))),
    CONSTRAINT "jobs_stage_check" CHECK (("stage" = ANY (ARRAY['intake'::"text", 'measurement'::"text", 'estimating'::"text", 'proposal'::"text", 'approved'::"text", 'scheduled'::"text", 'production'::"text", 'complete'::"text", 'archived'::"text"]))),
    CONSTRAINT "jobs_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'on_hold'::"text", 'won'::"text", 'lost'::"text", 'closed'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."jobs" OWNER TO "postgres";


COMMENT ON COLUMN "public"."jobs"."stage_entered_at" IS 'Trustworthy canonical stage-entry clock. Null means Time in stage must be omitted. Never backfilled from created_at, sent, payment, or schedule stamps.';



COMMENT ON COLUMN "public"."jobs"."production_started_at" IS 'R3G immutable actual work-start instant. Stamped by start_job_work_v1 from DB transaction time; never schedule/browser time.';



COMMENT ON COLUMN "public"."jobs"."completed_at" IS 'R3H immutable actual Job-completion instant. Stamped by complete_job_work_v1 from DB transaction time; never schedule/browser/payment time.';



COMMENT ON CONSTRAINT "jobs_stage_check" ON "public"."jobs" IS 'Canonical writes: intake, proposal, approved, scheduled, production, complete. Legacy readable: measurement, estimating, archived. scheduled is write-banned until R3F.';



CREATE TABLE IF NOT EXISTS "public"."measurement_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "job_id" "uuid",
    "estimate_id" "uuid",
    "created_by" "uuid",
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "is_selected" boolean DEFAULT false NOT NULL,
    "source_type" "text" DEFAULT 'manual'::"text" NOT NULL,
    "source_provider" "text",
    "source_report_id" "text",
    "source_file_id" "text",
    "source_url" "text",
    "source_created_at" timestamp with time zone,
    "imported_at" timestamp with time zone,
    "model_version" "text",
    "source_metadata" "jsonb",
    "is_verified" boolean DEFAULT false NOT NULL,
    "verified_by" "uuid",
    "verified_at" timestamp with time zone,
    "verification_notes" "text",
    "confidence_score" numeric(4,3),
    "confidence_label" "text",
    "field_confidence" "jsonb",
    "roof_area_sqft" numeric,
    "roof_squares" numeric,
    "adjusted_roof_squares" numeric,
    "waste_percent" numeric,
    "predominant_pitch" "text",
    "pitch_label" "text",
    "pitch_segments" "jsonb",
    "stories" "text",
    "roof_complexity" "text",
    "roof_type" "text",
    "structure_count" integer,
    "roof_facets_count" integer,
    "eaves_lf" numeric,
    "rakes_lf" numeric,
    "ridges_lf" numeric,
    "hips_lf" numeric,
    "valleys_lf" numeric,
    "wall_flashing_lf" numeric,
    "step_flashing_lf" numeric,
    "transitions_lf" numeric,
    "parapet_wall_lf" numeric,
    "drip_edge_lf" numeric,
    "starter_lf" numeric,
    "ridge_cap_lf" numeric,
    "pipe_boots_count" integer,
    "vents_count" integer,
    "skylights_count" integer,
    "chimneys_count" integer,
    "satellite_dishes_count" integer,
    "other_penetrations" "jsonb",
    "existing_layers_count" integer,
    "tear_off_required" boolean,
    "debris_tons_estimate" numeric,
    "disposal_notes" "text",
    "report_attached" boolean DEFAULT false NOT NULL,
    "diagram_available" boolean DEFAULT false NOT NULL,
    "report_file_id" "text",
    "report_type" "text",
    "report_source" "text",
    "report_status" "text",
    "report_last_updated_at" timestamp with time zone,
    "raw_measurements" "jsonb",
    "assumptions" "jsonb",
    "warnings" "jsonb",
    "missing_fields" "jsonb",
    "quantity_map" "jsonb",
    "measurement_readiness_score" integer,
    "estimate_ready" boolean DEFAULT false NOT NULL,
    "production_ready" boolean DEFAULT false NOT NULL,
    CONSTRAINT "measurement_records_confidence_label_check" CHECK ((("confidence_label" IS NULL) OR ("confidence_label" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'verified'::"text"])))),
    CONSTRAINT "measurement_records_confidence_score_check" CHECK ((("confidence_score" IS NULL) OR (("confidence_score" >= (0)::numeric) AND ("confidence_score" <= (1)::numeric)))),
    CONSTRAINT "measurement_records_source_type_check" CHECK (("source_type" = ANY (ARRAY['manual'::"text", 'report_import'::"text", 'provider_report'::"text", 'satellite'::"text", 'aerial'::"text", 'photo_ai'::"text", 'address_ai'::"text", 'contractor_verified'::"text", 'external_import'::"text"]))),
    CONSTRAINT "measurement_records_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'needs_review'::"text", 'incomplete'::"text", 'measured'::"text", 'verified'::"text", 'rejected'::"text", 'stale'::"text"])))
);


ALTER TABLE "public"."measurement_records" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid",
    "estimate_id" "uuid",
    "payment_type" "text",
    "amount" numeric,
    "status" "text" DEFAULT 'pending'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "method" "text",
    "notes" "text",
    "stage" "text"
);


ALTER TABLE "public"."payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text",
    "full_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."properties" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "address_line1" "text",
    "address_line2" "text",
    "address_city" "text",
    "address_state" "text",
    "address_zip" "text",
    "address_country" "text" DEFAULT 'US'::"text",
    "address_formatted" "text",
    "address_normalized" "text" NOT NULL,
    "places_place_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "properties_address_normalized_check" CHECK (("length"(TRIM(BOTH FROM "address_normalized")) > 0))
);


ALTER TABLE "public"."properties" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."proposal_acceptances" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "job_id" "uuid" NOT NULL,
    "proposal_id" "uuid" NOT NULL,
    "proposal_version_id" "uuid" NOT NULL,
    "proposal_option_id" "uuid" NOT NULL,
    "public_access_token_id" "uuid" NOT NULL,
    "accepted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "accepted_by_name" "text",
    "accepted_by_email" "text",
    "source" "text" DEFAULT 'public_token'::"text" NOT NULL,
    "method" "text" DEFAULT 'formal_accept'::"text" NOT NULL,
    "accepted_option_label" "text" NOT NULL,
    "accepted_total_cents" integer NOT NULL,
    "guard_result" "text" NOT NULL,
    "ambiguity_reason" "text",
    "confirmed_at" timestamp with time zone,
    "confirmed_by_user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "customer_chosen_option_id" "uuid",
    "customer_chosen_option_label" "text",
    "customer_chosen_total_cents" integer,
    CONSTRAINT "proposal_acceptances_ambiguity_reason_check" CHECK (((("guard_result" = 'valid_clean'::"text") AND ("ambiguity_reason" IS NULL)) OR (("guard_result" = 'valid_review_required'::"text") AND ("ambiguity_reason" = ANY (ARRAY['older_sent_version'::"text", 'dirty_revision'::"text", 'proposal_lineage_conflict'::"text", 'version_pointer_conflict'::"text", 'on_hold'::"text", 'lost'::"text", 'closed'::"text", 'conflicting_acceptance'::"text", 'job_not_in_proposal'::"text", 'job_already_approved'::"text"]))))),
    CONSTRAINT "proposal_acceptances_confirmation_state_check" CHECK (((("confirmed_at" IS NULL) AND ("confirmed_by_user_id" IS NULL)) OR (("confirmed_at" IS NOT NULL) AND ("confirmed_by_user_id" IS NOT NULL)))),
    CONSTRAINT "proposal_acceptances_customer_choice_complete_check" CHECK (((("customer_chosen_option_id" IS NULL) AND ("customer_chosen_option_label" IS NULL) AND ("customer_chosen_total_cents" IS NULL)) OR (("customer_chosen_option_id" IS NOT NULL) AND ("customer_chosen_option_label" IS NOT NULL) AND ("customer_chosen_total_cents" IS NOT NULL) AND ("customer_chosen_total_cents" >= 0)))),
    CONSTRAINT "proposal_acceptances_email_length_check" CHECK ((("accepted_by_email" IS NULL) OR ("char_length"("accepted_by_email") <= 254))),
    CONSTRAINT "proposal_acceptances_guard_result_check" CHECK (("guard_result" = ANY (ARRAY['valid_clean'::"text", 'valid_review_required'::"text"]))),
    CONSTRAINT "proposal_acceptances_method_check" CHECK (("method" = 'formal_accept'::"text")),
    CONSTRAINT "proposal_acceptances_name_length_check" CHECK ((("accepted_by_name" IS NULL) OR ("char_length"("accepted_by_name") <= 120))),
    CONSTRAINT "proposal_acceptances_option_label_length_check" CHECK ((("length"(TRIM(BOTH FROM "accepted_option_label")) > 0) AND ("char_length"("accepted_option_label") <= 120))),
    CONSTRAINT "proposal_acceptances_source_check" CHECK (("source" = 'public_token'::"text")),
    CONSTRAINT "proposal_acceptances_total_cents_check" CHECK (("accepted_total_cents" >= 0))
);


ALTER TABLE "public"."proposal_acceptances" OWNER TO "postgres";


COMMENT ON TABLE "public"."proposal_acceptances" IS 'R3C append-only formal customer acceptance. Binds to one frozen sent version and that version''s selected package. Not a signature, payment, or schedule. Does not mutate Proposal V2 frozen truth or proposals.selected_option_id.';



COMMENT ON COLUMN "public"."proposal_acceptances"."proposal_version_id" IS 'Exact frozen sent/signed version the customer accepted. Never rewritten to latest.';



COMMENT ON COLUMN "public"."proposal_acceptances"."proposal_option_id" IS 'Frozen selected package on the accepted version (selected_at / default). Not live proposals.selected_option_id.';



COMMENT ON COLUMN "public"."proposal_acceptances"."public_access_token_id" IS 'First public-access token that recorded this logical acceptance. Evidence only — not the uniqueness key. Same-version resend tokens reuse this row.';



COMMENT ON COLUMN "public"."proposal_acceptances"."accepted_at" IS 'Customer accepted this frozen proposal. Immutable.';



COMMENT ON COLUMN "public"."proposal_acceptances"."accepted_total_cents" IS 'Snapshot of frozen proposal_options.customer_total_cents at acceptance. Not a payment field.';



COMMENT ON COLUMN "public"."proposal_acceptances"."guard_result" IS 'Frozen classifier outcome at insert: valid_clean or valid_review_required. Neither value authorizes Job stage movement.';



COMMENT ON COLUMN "public"."proposal_acceptances"."confirmed_at" IS 'Contractor approved operational progression (Approve job). Not a second customer acceptance.';



COMMENT ON COLUMN "public"."proposal_acceptances"."confirmed_by_user_id" IS 'Authenticated contractor who clicked Approve job.';



COMMENT ON COLUMN "public"."proposal_acceptances"."customer_chosen_option_id" IS 'Frozen package the CUSTOMER chose on the accepted version. NULL means the customer made no explicit choice (single-option proposal or pre-049 row) and proposal_option_id governs. Never rewritten after insert.';



COMMENT ON COLUMN "public"."proposal_acceptances"."customer_chosen_option_label" IS 'Snapshot of the chosen frozen option label at acceptance. Evidence only.';



COMMENT ON COLUMN "public"."proposal_acceptances"."customer_chosen_total_cents" IS 'Snapshot of the chosen frozen proposal_options.customer_total_cents at acceptance. Contractual total when present. Not a payment field.';



CREATE TABLE IF NOT EXISTS "public"."proposal_customer_activity" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "proposal_id" "uuid" NOT NULL,
    "proposal_version_id" "uuid" NOT NULL,
    "token_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ip_hash" "text",
    "user_agent" "text",
    "referrer_host" "text",
    "payload_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "proposal_customer_activity_event_type_check" CHECK (("event_type" = ANY (ARRAY['first_view'::"text", 'view'::"text"]))),
    CONSTRAINT "proposal_customer_activity_ip_hash_format_check" CHECK ((("ip_hash" IS NULL) OR (("length"("ip_hash") = 64) AND ("ip_hash" ~ '^[0-9a-f]+$'::"text")))),
    CONSTRAINT "proposal_customer_activity_payload_object_check" CHECK (("jsonb_typeof"("payload_json") = 'object'::"text")),
    CONSTRAINT "proposal_customer_activity_referrer_host_check" CHECK ((("referrer_host" IS NULL) OR (("length"(TRIM(BOTH FROM "referrer_host")) > 0) AND ("referrer_host" !~ '[?#]'::"text") AND ("referrer_host" !~ '^https?://'::"text"))))
);


ALTER TABLE "public"."proposal_customer_activity" OWNER TO "postgres";


COMMENT ON TABLE "public"."proposal_customer_activity" IS 'R18C2A — Append-only customer proposal view/activity log. No raw token or raw IP. Does not mutate proposals.status or proposal_events (lifecycle deferred R18E+).';



COMMENT ON COLUMN "public"."proposal_customer_activity"."ip_hash" IS 'SHA-256(server_salt || client_ip) or equivalent; raw IP must never be stored.';



COMMENT ON COLUMN "public"."proposal_customer_activity"."referrer_host" IS 'Parsed referrer hostname only; no path, query params, or full URL.';



CREATE TABLE IF NOT EXISTS "public"."proposal_customer_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "proposal_id" "uuid" NOT NULL,
    "proposal_version_id" "uuid" NOT NULL,
    "public_access_token_id" "uuid" NOT NULL,
    "intent" "text" NOT NULL,
    "requested_option_id" "uuid",
    "requested_option_label" "text",
    "message" "text",
    "customer_name" "text",
    "customer_email" "text",
    "customer_phone" "text",
    "status" "text" DEFAULT 'new'::"text" NOT NULL,
    "payload_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "submission_key" "uuid",
    CONSTRAINT "proposal_customer_requests_customer_email_length_check" CHECK ((("customer_email" IS NULL) OR ("char_length"("customer_email") <= 254))),
    CONSTRAINT "proposal_customer_requests_customer_name_length_check" CHECK ((("customer_name" IS NULL) OR ("char_length"("customer_name") <= 120))),
    CONSTRAINT "proposal_customer_requests_customer_phone_length_check" CHECK ((("customer_phone" IS NULL) OR ("char_length"("customer_phone") <= 40))),
    CONSTRAINT "proposal_customer_requests_intent_check" CHECK (("intent" = ANY (ARRAY['request_package'::"text", 'ask_question'::"text", 'ask_about_package'::"text"]))),
    CONSTRAINT "proposal_customer_requests_message_length_check" CHECK ((("message" IS NULL) OR ("char_length"("message") <= 2000))),
    CONSTRAINT "proposal_customer_requests_option_label_length_check" CHECK ((("requested_option_label" IS NULL) OR ("char_length"("requested_option_label") <= 120))),
    CONSTRAINT "proposal_customer_requests_payload_object_check" CHECK (("jsonb_typeof"("payload_json") = 'object'::"text")),
    CONSTRAINT "proposal_customer_requests_request_package_option_check" CHECK ((("intent" <> 'request_package'::"text") OR (("requested_option_id" IS NOT NULL) AND ("requested_option_label" IS NOT NULL)))),
    CONSTRAINT "proposal_customer_requests_status_check" CHECK (("status" = ANY (ARRAY['new'::"text", 'seen'::"text", 'dismissed'::"text"])))
);


ALTER TABLE "public"."proposal_customer_requests" OWNER TO "postgres";


COMMENT ON TABLE "public"."proposal_customer_requests" IS 'R3B1 — Append-only non-binding customer package requests from public proposal links. Does not mutate proposals.status, selected_option_id, frozen options, upgrades, or proposal_events. Not a formal customer commitment or payment action.';



COMMENT ON COLUMN "public"."proposal_customer_requests"."requested_option_id" IS 'Frozen proposal_options.id on the bound proposal_version_id at submit time.';



COMMENT ON COLUMN "public"."proposal_customer_requests"."status" IS 'Contractor review workflow only (new/seen/dismissed). Never a formal commitment status.';



COMMENT ON COLUMN "public"."proposal_customer_requests"."submission_key" IS 'R3B4A client-generated idempotency key. Scoped to the bound public token. Null only for requests created before R3B4A. Never derived from request content.';



CREATE TABLE IF NOT EXISTS "public"."proposal_delivery_attempts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "proposal_id" "uuid" NOT NULL,
    "proposal_version_id" "uuid" NOT NULL,
    "proposal_public_access_token_id" "uuid",
    "channel" "text" DEFAULT 'email'::"text" NOT NULL,
    "provider" "text" DEFAULT 'resend'::"text" NOT NULL,
    "recipient_email_hash" "text" NOT NULL,
    "recipient_email_redacted" "text",
    "token_prefix" "text",
    "idempotency_key" "text" NOT NULL,
    "status" "text" NOT NULL,
    "subject_snapshot" "text" NOT NULL,
    "body_snapshot" "text" NOT NULL,
    "provider_message_id" "text",
    "error_code" "text",
    "error_message_safe" "text",
    "metadata_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "attempted_at" timestamp with time zone,
    "provider_accepted_at" timestamp with time zone,
    "failed_at" timestamp with time zone,
    "delivered_at" timestamp with time zone,
    "bounced_at" timestamp with time zone,
    "complained_at" timestamp with time zone,
    CONSTRAINT "proposal_delivery_attempts_channel_check" CHECK (("channel" = 'email'::"text")),
    CONSTRAINT "proposal_delivery_attempts_payload_object_check" CHECK (("jsonb_typeof"("metadata_json") = 'object'::"text")),
    CONSTRAINT "proposal_delivery_attempts_provider_check" CHECK (("provider" = 'resend'::"text")),
    CONSTRAINT "proposal_delivery_attempts_recipient_hash_format_check" CHECK ((("length"("recipient_email_hash") = 64) AND ("recipient_email_hash" ~ '^[0-9a-f]+$'::"text"))),
    CONSTRAINT "proposal_delivery_attempts_status_check" CHECK (("status" = ANY (ARRAY['prepared'::"text", 'attempted'::"text", 'provider_accepted'::"text", 'failed'::"text", 'delivered'::"text", 'bounced'::"text", 'complained'::"text"]))),
    CONSTRAINT "proposal_delivery_attempts_token_prefix_length_check" CHECK ((("token_prefix" IS NULL) OR (("length"("token_prefix") >= 6) AND ("length"("token_prefix") <= 16))))
);


ALTER TABLE "public"."proposal_delivery_attempts" OWNER TO "postgres";


COMMENT ON TABLE "public"."proposal_delivery_attempts" IS 'R18D3A — Audit trail for contractor-initiated customer email delivery attempts. Does not mutate proposals.status, proposal_events, or job board stage.';



COMMENT ON COLUMN "public"."proposal_delivery_attempts"."recipient_email_hash" IS 'SHA-256 hex of normalized recipient email. Raw email must never be stored.';



COMMENT ON COLUMN "public"."proposal_delivery_attempts"."token_prefix" IS 'Non-secret token prefix for support correlation. Never store raw token or token_hash.';



CREATE TABLE IF NOT EXISTS "public"."proposal_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "proposal_id" "uuid" NOT NULL,
    "proposal_version_id" "uuid",
    "event_type" "text" NOT NULL,
    "actor_user_id" "uuid",
    "payload_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "proposal_events_event_type_check" CHECK (("event_type" = ANY (ARRAY['created'::"text", 'draft_saved'::"text", 'previewed'::"text", 'sent'::"text", 'viewed'::"text", 'signed'::"text", 'declined'::"text", 'revised'::"text", 'archived'::"text", 'payment_requested'::"text", 'payment_recorded'::"text", 'snapshot_frozen'::"text"]))),
    CONSTRAINT "proposal_events_payload_object_check" CHECK (("jsonb_typeof"("payload_json") = 'object'::"text"))
);


ALTER TABLE "public"."proposal_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."proposal_internal_summaries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "proposal_option_id" "uuid" NOT NULL,
    "internal_cost_cents" integer,
    "internal_profit_cents" integer,
    "effective_margin_pct" numeric,
    "policy_echo_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "computed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "proposal_internal_summaries_effective_margin_pct_check" CHECK ((("effective_margin_pct" IS NULL) OR (("effective_margin_pct" >= (0)::numeric) AND ("effective_margin_pct" < (100)::numeric)))),
    CONSTRAINT "proposal_internal_summaries_internal_cost_cents_check" CHECK ((("internal_cost_cents" IS NULL) OR ("internal_cost_cents" >= 0))),
    CONSTRAINT "proposal_internal_summaries_policy_echo_object_check" CHECK (("jsonb_typeof"("policy_echo_json") = 'object'::"text"))
);


ALTER TABLE "public"."proposal_internal_summaries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."proposal_line_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "proposal_option_id" "uuid" NOT NULL,
    "source_template_item_id" "uuid",
    "catalog_item_id" "uuid",
    "catalog_seed_key" "text",
    "section_id" "uuid",
    "page_id" "uuid",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "customer_name" "text" NOT NULL,
    "description" "text",
    "role" "text",
    "quantity" numeric,
    "quantity_display_label" "text",
    "quantity_source_label" "text",
    "unit" "text",
    "customer_unit_price_cents" integer,
    "customer_line_total_cents" integer,
    "pricing_status" "text" DEFAULT 'needs_quantity'::"text" NOT NULL,
    "visible_to_customer" boolean DEFAULT true NOT NULL,
    "measurement_quantity_key" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "quantity_resolution_echo" "jsonb",
    "upgrade_selection_state" "text",
    "upgrade_effect" "text",
    "replaces_source_template_item_id" "uuid",
    "composition_role" "text",
    "composition_slot_key" "text",
    CONSTRAINT "proposal_line_items_composition_role_slug_check" CHECK ((("composition_role" IS NULL) OR ("composition_role" ~ '^[a-z][a-z0-9_]*$'::"text"))),
    CONSTRAINT "proposal_line_items_composition_slot_key_slug_check" CHECK ((("composition_slot_key" IS NULL) OR ("composition_slot_key" ~ '^[a-z][a-z0-9_]*(\.[a-z0-9_]+)*$'::"text"))),
    CONSTRAINT "proposal_line_items_composition_slot_requires_role_check" CHECK ((("composition_slot_key" IS NULL) OR ("composition_role" IS NOT NULL))),
    CONSTRAINT "proposal_line_items_customer_line_total_cents_check" CHECK ((("customer_line_total_cents" IS NULL) OR ("customer_line_total_cents" >= 0))),
    CONSTRAINT "proposal_line_items_customer_name_not_empty" CHECK (("length"(TRIM(BOTH FROM "customer_name")) > 0)),
    CONSTRAINT "proposal_line_items_customer_unit_price_cents_check" CHECK ((("customer_unit_price_cents" IS NULL) OR ("customer_unit_price_cents" >= 0))),
    CONSTRAINT "proposal_line_items_pricing_status_check" CHECK (("pricing_status" = ANY (ARRAY['priced'::"text", 'included'::"text", 'grouped'::"text", 'needs_quantity'::"text", 'not_priced'::"text", 'omitted'::"text"]))),
    CONSTRAINT "proposal_line_items_quantity_check" CHECK ((("quantity" IS NULL) OR ("quantity" >= (0)::numeric))),
    CONSTRAINT "proposal_line_items_quantity_resolution_echo_object_check" CHECK ((("quantity_resolution_echo" IS NULL) OR ("jsonb_typeof"("quantity_resolution_echo") = 'object'::"text"))),
    CONSTRAINT "proposal_line_items_role_check" CHECK ((("role" IS NULL) OR ("role" = ANY (ARRAY['standard'::"text", 'included'::"text", 'upgrade'::"text", 'optional_addon'::"text", 'fee'::"text", 'discount'::"text"])))),
    CONSTRAINT "proposal_line_items_sort_order_check" CHECK (("sort_order" >= 0)),
    CONSTRAINT "proposal_line_items_upgrade_echo_check" CHECK ((((("upgrade_effect" IS NULL) OR ("upgrade_effect" = 'additive'::"text")) AND ("replaces_source_template_item_id" IS NULL)) OR (("upgrade_effect" = 'replacement'::"text") AND ("replaces_source_template_item_id" IS NOT NULL)))),
    CONSTRAINT "proposal_line_items_upgrade_effect_check" CHECK ((("upgrade_effect" IS NULL) OR ("upgrade_effect" = ANY (ARRAY['additive'::"text", 'replacement'::"text"])))),
    CONSTRAINT "proposal_line_items_upgrade_selection_state_check" CHECK ((("upgrade_selection_state" IS NULL) OR ("upgrade_selection_state" = ANY (ARRAY['selected'::"text", 'not_selected'::"text"]))))
);


ALTER TABLE "public"."proposal_line_items" OWNER TO "postgres";


COMMENT ON COLUMN "public"."proposal_line_items"."section_id" IS 'Denormalized proposal_template_sections.id echo at snapshot time for estimate section rollups (see app/lib/proposalLineSnapshotTypes.ts). Distinct from page_id (runtime proposal_pages placement). Nullable when line has no template section source.';



COMMENT ON COLUMN "public"."proposal_line_items"."quantity_resolution_echo" IS 'Future frozen quantity-resolution drivers: quantity_mode, source_measurement_key, source_measurement_value, coverage_rate_used, waste_pct_used, rounding_mode_used, and resolved_purchase_quantity. NULL is valid for historical proposals.';



COMMENT ON COLUMN "public"."proposal_line_items"."upgrade_selection_state" IS 'Display echo of Optional Upgrade Truth selection. Authoritative selection lives in proposal_option_upgrade_choices.';



COMMENT ON COLUMN "public"."proposal_line_items"."upgrade_effect" IS 'Display echo of upgrade effect (additive|replacement). Definition truth is template; selection truth is choices table.';



COMMENT ON COLUMN "public"."proposal_line_items"."replaces_source_template_item_id" IS 'Display echo of replacement target template item id when upgrade_effect=replacement.';



COMMENT ON COLUMN "public"."proposal_line_items"."composition_role" IS 'Proposal-owned copy of composition role, captured at create. Refresh/freeze must preserve. Not customer-facing.';



COMMENT ON COLUMN "public"."proposal_line_items"."composition_slot_key" IS 'Proposal-owned copy of composition slot, captured at create. Refresh/freeze must preserve. Not customer-facing.';



CREATE TABLE IF NOT EXISTS "public"."proposal_option_scope_decisions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "proposal_id" "uuid" NOT NULL,
    "proposal_version_id" "uuid" NOT NULL,
    "proposal_option_id" "uuid" NOT NULL,
    "decision_type" "text" NOT NULL,
    "source_template_item_id" "uuid",
    "instance_line_key" "text",
    "payload_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "proposal_option_scope_decisions_decision_type_check" CHECK (("decision_type" = ANY (ARRAY['manual_quantity'::"text", 'excluded'::"text", 'not_applicable'::"text", 'visibility_override'::"text", 'role_override'::"text", 'added_catalog'::"text", 'added_custom'::"text", 'quantity_source_override'::"text"]))),
    CONSTRAINT "proposal_option_scope_decisions_payload_object_check" CHECK (("jsonb_typeof"("payload_json") = 'object'::"text")),
    CONSTRAINT "proposal_option_scope_decisions_target_shape_check" CHECK (((("source_template_item_id" IS NOT NULL) AND ("instance_line_key" IS NULL) AND ("decision_type" = ANY (ARRAY['manual_quantity'::"text", 'excluded'::"text", 'not_applicable'::"text", 'visibility_override'::"text", 'role_override'::"text", 'quantity_source_override'::"text"]))) OR (("instance_line_key" IS NOT NULL) AND ("length"(TRIM(BOTH FROM "instance_line_key")) > 0) AND ("source_template_item_id" IS NULL) AND ("decision_type" = ANY (ARRAY['added_catalog'::"text", 'added_custom'::"text"])))))
);


ALTER TABLE "public"."proposal_option_scope_decisions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."proposal_option_upgrade_choices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "proposal_id" "uuid" NOT NULL,
    "proposal_version_id" "uuid" NOT NULL,
    "proposal_option_id" "uuid" NOT NULL,
    "source_template_item_id" "uuid" NOT NULL,
    "selection_state" "text" NOT NULL,
    "upgrade_effect" "text" NOT NULL,
    "replaces_source_template_item_id" "uuid",
    "created_by" "uuid",
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "proposal_option_upgrade_choices_replacement_target_check" CHECK (((("upgrade_effect" = 'additive'::"text") AND ("replaces_source_template_item_id" IS NULL)) OR (("upgrade_effect" = 'replacement'::"text") AND ("replaces_source_template_item_id" IS NOT NULL)))),
    CONSTRAINT "proposal_option_upgrade_choices_selection_state_check" CHECK (("selection_state" = ANY (ARRAY['selected'::"text", 'not_selected'::"text"]))),
    CONSTRAINT "proposal_option_upgrade_choices_upgrade_effect_check" CHECK (("upgrade_effect" = ANY (ARRAY['additive'::"text", 'replacement'::"text"])))
);


ALTER TABLE "public"."proposal_option_upgrade_choices" OWNER TO "postgres";


COMMENT ON TABLE "public"."proposal_option_upgrade_choices" IS 'Optional Upgrade Truth selections. First-class proposal-version truth; proposal_line_items.upgrade_* columns are display echoes only.';



CREATE TABLE IF NOT EXISTS "public"."proposal_options" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "proposal_version_id" "uuid" NOT NULL,
    "source_template_option_id" "uuid",
    "name" "text" NOT NULL,
    "customer_label" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "visible_to_customer" boolean DEFAULT true NOT NULL,
    "customer_subtotal_cents" integer,
    "discount_cents" integer,
    "sales_tax_cents" integer,
    "customer_total_cents" integer,
    "pricing_complete" boolean DEFAULT false NOT NULL,
    "blocking_line_count" integer DEFAULT 0 NOT NULL,
    "guardrail_outcome" "text" DEFAULT 'block'::"text" NOT NULL,
    "selected_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "description" "text",
    CONSTRAINT "proposal_options_blocking_line_count_check" CHECK (("blocking_line_count" >= 0)),
    CONSTRAINT "proposal_options_customer_subtotal_cents_check" CHECK ((("customer_subtotal_cents" IS NULL) OR ("customer_subtotal_cents" >= 0))),
    CONSTRAINT "proposal_options_customer_total_cents_check" CHECK ((("customer_total_cents" IS NULL) OR ("customer_total_cents" >= 0))),
    CONSTRAINT "proposal_options_discount_cents_check" CHECK ((("discount_cents" IS NULL) OR ("discount_cents" >= 0))),
    CONSTRAINT "proposal_options_guardrail_outcome_check" CHECK (("guardrail_outcome" = ANY (ARRAY['pass'::"text", 'warn'::"text", 'block'::"text"]))),
    CONSTRAINT "proposal_options_name_not_empty" CHECK (("length"(TRIM(BOTH FROM "name")) > 0)),
    CONSTRAINT "proposal_options_sales_tax_cents_check" CHECK ((("sales_tax_cents" IS NULL) OR ("sales_tax_cents" >= 0))),
    CONSTRAINT "proposal_options_sort_order_check" CHECK (("sort_order" >= 0))
);


ALTER TABLE "public"."proposal_options" OWNER TO "postgres";


COMMENT ON COLUMN "public"."proposal_options"."description" IS 'Authored package description snapshotted from the template option; customer-facing package copy source of truth when present.';



CREATE TABLE IF NOT EXISTS "public"."proposal_pages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "proposal_version_id" "uuid" NOT NULL,
    "page_type" "text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "title" "text" NOT NULL,
    "customer_title" "text",
    "visible_to_customer" boolean DEFAULT true NOT NULL,
    "source_template_section_id" "uuid",
    "content_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "settings_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "proposal_pages_content_object_check" CHECK (("jsonb_typeof"("content_json") = 'object'::"text")),
    CONSTRAINT "proposal_pages_page_type_check" CHECK (("page_type" = ANY (ARRAY['cover'::"text", 'estimate'::"text", 'terms'::"text", 'warranty'::"text", 'project_overview'::"text", 'photos'::"text", 'pdf_attachment'::"text", 'custom_text'::"text", 'payment_schedule'::"text", 'signature'::"text"]))),
    CONSTRAINT "proposal_pages_settings_object_check" CHECK (("jsonb_typeof"("settings_json") = 'object'::"text")),
    CONSTRAINT "proposal_pages_sort_order_check" CHECK (("sort_order" >= 0)),
    CONSTRAINT "proposal_pages_title_not_empty" CHECK (("length"(TRIM(BOTH FROM "title")) > 0))
);


ALTER TABLE "public"."proposal_pages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."proposal_public_access_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "proposal_id" "uuid" NOT NULL,
    "proposal_version_id" "uuid" NOT NULL,
    "token_hash" "text" NOT NULL,
    "token_prefix" "text" NOT NULL,
    "purpose" "text" DEFAULT 'customer_view'::"text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "revoked_at" timestamp with time zone,
    "revoked_reason" "text",
    "superseded_by_token_id" "uuid",
    "recipient_email_hash" "text",
    "recipient_phone_hash" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_viewed_at" timestamp with time zone,
    "metadata_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "token_category" "text",
    CONSTRAINT "proposal_public_access_tokens_expires_at_future_at_create" CHECK (("expires_at" > "created_at")),
    CONSTRAINT "proposal_public_access_tokens_metadata_object_check" CHECK (("jsonb_typeof"("metadata_json") = 'object'::"text")),
    CONSTRAINT "proposal_public_access_tokens_purpose_check" CHECK (("purpose" = 'customer_view'::"text")),
    CONSTRAINT "proposal_public_access_tokens_recipient_hash_format_check" CHECK (((("recipient_email_hash" IS NULL) OR (("length"("recipient_email_hash") = 64) AND ("recipient_email_hash" ~ '^[0-9a-f]+$'::"text"))) AND (("recipient_phone_hash" IS NULL) OR (("length"("recipient_phone_hash") = 64) AND ("recipient_phone_hash" ~ '^[0-9a-f]+$'::"text"))))),
    CONSTRAINT "proposal_public_access_tokens_revoked_consistency_check" CHECK (((("status" = 'revoked'::"text") AND ("revoked_at" IS NOT NULL)) OR (("status" <> 'revoked'::"text") AND ("revoked_at" IS NULL)))),
    CONSTRAINT "proposal_public_access_tokens_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'revoked'::"text", 'superseded'::"text"]))),
    CONSTRAINT "proposal_public_access_tokens_superseded_consistency_check" CHECK (((("status" = 'superseded'::"text") AND ("superseded_by_token_id" IS NOT NULL)) OR (("status" <> 'superseded'::"text") AND ("superseded_by_token_id" IS NULL)))),
    CONSTRAINT "proposal_public_access_tokens_token_category_check" CHECK ((("token_category" IS NULL) OR ("token_category" = ANY (ARRAY['contractor_preview_qa'::"text", 'contractor_send_prep'::"text", 'contractor_email_send'::"text"])))),
    CONSTRAINT "proposal_public_access_tokens_token_hash_format_check" CHECK ((("length"(TRIM(BOTH FROM "token_hash")) = 64) AND ("token_hash" ~ '^[0-9a-f]+$'::"text"))),
    CONSTRAINT "proposal_public_access_tokens_token_prefix_check" CHECK ((("length"(TRIM(BOTH FROM "token_prefix")) >= 6) AND ("length"(TRIM(BOTH FROM "token_prefix")) <= 16)))
);


ALTER TABLE "public"."proposal_public_access_tokens" OWNER TO "postgres";


COMMENT ON TABLE "public"."proposal_public_access_tokens" IS 'R18C2A — Hash-only public customer access tokens bound to immutable sent/signed proposal_version_id. Raw token must never be stored. No anon table access; public resolve is server-side RPC only (R18C2B+).';



COMMENT ON COLUMN "public"."proposal_public_access_tokens"."proposal_version_id" IS 'Immutable customer snapshot. Must be proposal_versions.version_kind sent or signed at insert time.';



COMMENT ON COLUMN "public"."proposal_public_access_tokens"."token_hash" IS 'SHA-256 hex digest of high-entropy public token. Global lookup key. Never store raw token.';



COMMENT ON COLUMN "public"."proposal_public_access_tokens"."token_prefix" IS 'Non-secret prefix of raw token for support/log correlation (e.g. first 8 chars). Not sufficient for auth.';



COMMENT ON COLUMN "public"."proposal_public_access_tokens"."superseded_by_token_id" IS 'Revision chain pointer when status=superseded: replacement token for a newer sent version.';



COMMENT ON COLUMN "public"."proposal_public_access_tokens"."token_category" IS 'Stage C4 durable access category. Current values: contractor_preview_qa, contractor_send_prep, contractor_email_send. Null is legacy compatibility for historical rows whose metadata source cannot be classified safely.';



CREATE TABLE IF NOT EXISTS "public"."proposal_public_option_choices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "proposal_id" "uuid" NOT NULL,
    "proposal_version_id" "uuid" NOT NULL,
    "public_access_token_id" "uuid" NOT NULL,
    "chosen_option_id" "uuid" NOT NULL,
    "chosen_option_key" "text" NOT NULL,
    "chosen_option_label" "text" NOT NULL,
    "chosen_total_cents" integer NOT NULL,
    "chosen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "proposal_public_option_choices_key_length" CHECK (("char_length"("chosen_option_key") <= 200)),
    CONSTRAINT "proposal_public_option_choices_key_not_empty" CHECK (("length"(TRIM(BOTH FROM "chosen_option_key")) > 0)),
    CONSTRAINT "proposal_public_option_choices_label_length" CHECK ((("char_length"("chosen_option_label") >= 1) AND ("char_length"("chosen_option_label") <= 120))),
    CONSTRAINT "proposal_public_option_choices_total_nonnegative" CHECK (("chosen_total_cents" >= 0))
);


ALTER TABLE "public"."proposal_public_option_choices" OWNER TO "postgres";


COMMENT ON TABLE "public"."proposal_public_option_choices" IS '052 — One provisional customer package choice per frozen sent proposal version. Does not mutate frozen options, contractor selected_option_id, or jobs.stage. Mutable until a proposal_acceptances row exists for the same version.';



COMMENT ON COLUMN "public"."proposal_public_option_choices"."public_access_token_id" IS 'Last public token that wrote this choice. Uniqueness is version-scoped, not token-scoped.';



COMMENT ON COLUMN "public"."proposal_public_option_choices"."chosen_option_id" IS 'Frozen proposal_options.id on the bound sent version. Never a client price.';



COMMENT ON COLUMN "public"."proposal_public_option_choices"."chosen_option_key" IS 'Stable source_template_option_id used by the public packet.';



CREATE TABLE IF NOT EXISTS "public"."proposal_signatures" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "job_id" "uuid" NOT NULL,
    "proposal_id" "uuid" NOT NULL,
    "proposal_version_id" "uuid" NOT NULL,
    "proposal_option_id" "uuid" NOT NULL,
    "proposal_acceptance_id" "uuid" NOT NULL,
    "public_access_token_id" "uuid" NOT NULL,
    "signer_slot" "text" DEFAULT 'customer_primary'::"text" NOT NULL,
    "signer_printed_name" "text" NOT NULL,
    "signer_email" "text",
    "typed_name_echo" "text" NOT NULL,
    "drawn_mark_json" "jsonb" NOT NULL,
    "acknowledgement_key" "text" NOT NULL,
    "acknowledgement_text" "text" NOT NULL,
    "signed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "source" "text" DEFAULT 'public_token'::"text" NOT NULL,
    "method" "text" DEFAULT 'drawn_signature'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "proposal_signatures_ack_key_check" CHECK (("acknowledgement_key" = 'fielddive_proposal_signature_v1'::"text")),
    CONSTRAINT "proposal_signatures_ack_text_check" CHECK (("acknowledgement_text" = 'I accept and sign this proposal as shown, including the selected package and total.'::"text")),
    CONSTRAINT "proposal_signatures_email_length_check" CHECK ((("signer_email" IS NULL) OR ("char_length"("signer_email") <= 254))),
    CONSTRAINT "proposal_signatures_mark_object_check" CHECK (("jsonb_typeof"("drawn_mark_json") = 'object'::"text")),
    CONSTRAINT "proposal_signatures_method_check" CHECK (("method" = 'drawn_signature'::"text")),
    CONSTRAINT "proposal_signatures_name_length_check" CHECK ((("length"(TRIM(BOTH FROM "signer_printed_name")) > 0) AND ("char_length"("signer_printed_name") <= 120))),
    CONSTRAINT "proposal_signatures_signer_slot_check" CHECK (("signer_slot" = 'customer_primary'::"text")),
    CONSTRAINT "proposal_signatures_source_check" CHECK (("source" = 'public_token'::"text")),
    CONSTRAINT "proposal_signatures_typed_echo_length_check" CHECK ((("length"(TRIM(BOTH FROM "typed_name_echo")) > 0) AND ("char_length"("typed_name_echo") <= 120)))
);


ALTER TABLE "public"."proposal_signatures" OWNER TO "postgres";


COMMENT ON TABLE "public"."proposal_signatures" IS 'R3D append-only customer signature evidence. Binds to one proposal_acceptances row (frozen sent version + selected option). Not payment, schedule, or Job stage. Does not write proposals.signed_version_id.';



COMMENT ON COLUMN "public"."proposal_signatures"."public_access_token_id" IS 'Access evidence only. Logical identity is (company, acceptance, signer_slot).';



COMMENT ON COLUMN "public"."proposal_signatures"."signer_slot" IS 'V1 only customer_primary. Future slots are deferred.';



COMMENT ON COLUMN "public"."proposal_signatures"."drawn_mark_json" IS 'Compact versioned stroke JSON. No Storage object.';



CREATE TABLE IF NOT EXISTS "public"."proposal_template_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "template_id" "uuid" NOT NULL,
    "option_id" "uuid" NOT NULL,
    "section_id" "uuid" NOT NULL,
    "catalog_item_id" "uuid",
    "catalog_seed_key" "text",
    "item_role" "text" DEFAULT 'standard'::"text" NOT NULL,
    "customer_name_override" "text",
    "description_override" "text",
    "customer_visibility" "text" DEFAULT 'inherit_catalog'::"text" NOT NULL,
    "quantity_rule" "jsonb",
    "sort_order" integer,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "upgrade_effect" "text",
    "replaces_template_item_id" "uuid",
    "default_selected" boolean DEFAULT false NOT NULL,
    "composition_role" "text",
    "composition_slot_key" "text",
    CONSTRAINT "proposal_template_items_catalog_reference_check" CHECK ((("catalog_item_id" IS NOT NULL) OR (("catalog_seed_key" IS NOT NULL) AND ("length"(TRIM(BOTH FROM "catalog_seed_key")) > 0)))),
    CONSTRAINT "proposal_template_items_composition_role_slug_check" CHECK ((("composition_role" IS NULL) OR ("composition_role" ~ '^[a-z][a-z0-9_]*$'::"text"))),
    CONSTRAINT "proposal_template_items_composition_slot_key_slug_check" CHECK ((("composition_slot_key" IS NULL) OR ("composition_slot_key" ~ '^[a-z][a-z0-9_]*(\.[a-z0-9_]+)*$'::"text"))),
    CONSTRAINT "proposal_template_items_composition_slot_requires_role_check" CHECK ((("composition_slot_key" IS NULL) OR ("composition_role" IS NOT NULL))),
    CONSTRAINT "proposal_template_items_customer_visibility_check" CHECK (("customer_visibility" = ANY (ARRAY['inherit_catalog'::"text", 'customer_visible'::"text", 'internal_only'::"text", 'grouped'::"text"]))),
    CONSTRAINT "proposal_template_items_item_role_check" CHECK (("item_role" = ANY (ARRAY['standard'::"text", 'included'::"text", 'upgrade'::"text", 'optional_addon'::"text", 'fee'::"text", 'discount'::"text"]))),
    CONSTRAINT "proposal_template_items_metadata_object_check" CHECK (("jsonb_typeof"("metadata") = 'object'::"text")),
    CONSTRAINT "proposal_template_items_quantity_rule_object_check" CHECK ((("quantity_rule" IS NULL) OR ("jsonb_typeof"("quantity_rule") = 'object'::"text"))),
    CONSTRAINT "proposal_template_items_upgrade_definition_check" CHECK (((("item_role" = ANY (ARRAY['upgrade'::"text", 'optional_addon'::"text"])) AND (((("upgrade_effect" IS NULL) OR ("upgrade_effect" = 'additive'::"text")) AND ("replaces_template_item_id" IS NULL)) OR (("upgrade_effect" = 'replacement'::"text") AND ("replaces_template_item_id" IS NOT NULL)))) OR (("item_role" <> ALL (ARRAY['upgrade'::"text", 'optional_addon'::"text"])) AND ("upgrade_effect" IS NULL) AND ("replaces_template_item_id" IS NULL) AND ("default_selected" = false)))),
    CONSTRAINT "proposal_template_items_upgrade_effect_check" CHECK ((("upgrade_effect" IS NULL) OR ("upgrade_effect" = ANY (ARRAY['additive'::"text", 'replacement'::"text"]))))
);


ALTER TABLE "public"."proposal_template_items" OWNER TO "postgres";


COMMENT ON COLUMN "public"."proposal_template_items"."upgrade_effect" IS 'Optional Upgrade Truth definition: additive or replacement. NULL / only meaningful for upgrade|optional_addon roles.';



COMMENT ON COLUMN "public"."proposal_template_items"."replaces_template_item_id" IS 'When upgrade_effect=replacement, the same-option template item suppressed while this upgrade is selected. ON DELETE SET NULL.';



COMMENT ON COLUMN "public"."proposal_template_items"."default_selected" IS 'Initial selection when a draft instantiates this upgrade. V1 product default is false (not_selected).';



COMMENT ON COLUMN "public"."proposal_template_items"."composition_role" IS 'Copied functional family used by reusable package composition. Not customer-facing.';



COMMENT ON COLUMN "public"."proposal_template_items"."composition_slot_key" IS 'Authoritative package slot instance of composition_role within included vs optional group. Not customer-facing.';



CREATE TABLE IF NOT EXISTS "public"."proposal_template_options" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "template_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "customer_label" "text",
    "description" "text",
    "selection_mode" "text" DEFAULT 'included'::"text" NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "visible_to_customer" boolean DEFAULT true NOT NULL,
    "sort_order" integer,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "removed_at" timestamp with time zone,
    CONSTRAINT "proposal_template_options_metadata_object_check" CHECK (("jsonb_typeof"("metadata") = 'object'::"text")),
    CONSTRAINT "proposal_template_options_name_not_empty" CHECK (("length"(TRIM(BOTH FROM "name")) > 0)),
    CONSTRAINT "proposal_template_options_selection_mode_check" CHECK (("selection_mode" = ANY (ARRAY['single'::"text", 'multi'::"text", 'included'::"text"])))
);


ALTER TABLE "public"."proposal_template_options" OWNER TO "postgres";


COMMENT ON COLUMN "public"."proposal_template_options"."removed_at" IS 'Soft-remove timestamp. Null = active package for future proposal creation. Preserves row for historical proposal_options.source_template_option_id.';



CREATE TABLE IF NOT EXISTS "public"."proposal_template_sections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "template_id" "uuid" NOT NULL,
    "option_id" "uuid" NOT NULL,
    "kind" "text" NOT NULL,
    "name" "text" NOT NULL,
    "customer_title" "text",
    "customer_visibility" "text" DEFAULT 'customer_visible'::"text" NOT NULL,
    "sort_order" integer,
    "content" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "proposal_template_sections_content_object_check" CHECK (("jsonb_typeof"("content") = 'object'::"text")),
    CONSTRAINT "proposal_template_sections_customer_visibility_check" CHECK (("customer_visibility" = ANY (ARRAY['customer_visible'::"text", 'internal_only'::"text", 'grouped'::"text"]))),
    CONSTRAINT "proposal_template_sections_kind_check" CHECK (("kind" = ANY (ARRAY['line_items'::"text", 'text'::"text", 'upgrade_group'::"text", 'terms'::"text", 'warranty'::"text", 'image'::"text", 'signature_placeholder'::"text"]))),
    CONSTRAINT "proposal_template_sections_metadata_object_check" CHECK (("jsonb_typeof"("metadata") = 'object'::"text")),
    CONSTRAINT "proposal_template_sections_name_not_empty" CHECK (("length"(TRIM(BOTH FROM "name")) > 0))
);


ALTER TABLE "public"."proposal_template_sections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."proposal_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "sort_order" integer,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "proposal_templates_metadata_object_check" CHECK (("jsonb_typeof"("metadata") = 'object'::"text")),
    CONSTRAINT "proposal_templates_name_not_empty" CHECK (("length"(TRIM(BOTH FROM "name")) > 0)),
    CONSTRAINT "proposal_templates_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'active'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."proposal_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."proposal_version_payment_terms" (
    "proposal_version_id" "uuid" NOT NULL,
    "company_id" "uuid" NOT NULL,
    "proposal_id" "uuid" NOT NULL,
    "deposit_mode" "text" DEFAULT 'none'::"text" NOT NULL,
    "deposit_percent_bps" integer,
    "deposit_fixed_cents" integer,
    "deposit_due_trigger" "text" DEFAULT 'on_acceptance'::"text" NOT NULL,
    "balance_due_trigger" "text" DEFAULT 'on_completion'::"text" NOT NULL,
    "collection_channel" "text" DEFAULT 'online_stripe'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "proposal_version_payment_terms_balance_due_check" CHECK (("balance_due_trigger" = 'on_completion'::"text")),
    CONSTRAINT "proposal_version_payment_terms_collection_check" CHECK (("collection_channel" = 'online_stripe'::"text")),
    CONSTRAINT "proposal_version_payment_terms_deposit_due_check" CHECK (("deposit_due_trigger" = 'on_acceptance'::"text")),
    CONSTRAINT "proposal_version_payment_terms_deposit_mode_check" CHECK (("deposit_mode" = ANY (ARRAY['none'::"text", 'percent'::"text", 'fixed'::"text"]))),
    CONSTRAINT "proposal_version_payment_terms_mode_values_check" CHECK (((("deposit_mode" = 'none'::"text") AND ("deposit_percent_bps" IS NULL) AND ("deposit_fixed_cents" IS NULL)) OR (("deposit_mode" = 'percent'::"text") AND ("deposit_percent_bps" IS NOT NULL) AND ("deposit_percent_bps" >= 1) AND ("deposit_percent_bps" <= 10000) AND ("deposit_fixed_cents" IS NULL)) OR (("deposit_mode" = 'fixed'::"text") AND ("deposit_fixed_cents" IS NOT NULL) AND ("deposit_fixed_cents" >= 100) AND ("deposit_percent_bps" IS NULL))))
);


ALTER TABLE "public"."proposal_version_payment_terms" OWNER TO "postgres";


COMMENT ON TABLE "public"."proposal_version_payment_terms" IS 'Payment Stage 1 frozen-or-draft payment terms per proposal version. Settings never rewrite sent rows.';



CREATE TABLE IF NOT EXISTS "public"."proposal_versions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "proposal_id" "uuid" NOT NULL,
    "version_number" integer NOT NULL,
    "version_kind" "text" DEFAULT 'draft'::"text" NOT NULL,
    "parent_version_id" "uuid",
    "frozen_at" timestamp with time zone,
    "context_echo" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "policy_echo" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "proposal_versions_context_echo_object_check" CHECK (("jsonb_typeof"("context_echo") = 'object'::"text")),
    CONSTRAINT "proposal_versions_frozen_at_check" CHECK (((("version_kind" = 'draft'::"text") AND ("frozen_at" IS NULL)) OR (("version_kind" = ANY (ARRAY['sent'::"text", 'signed'::"text", 'superseded'::"text"])) AND ("frozen_at" IS NOT NULL)))),
    CONSTRAINT "proposal_versions_policy_echo_object_check" CHECK (("jsonb_typeof"("policy_echo") = 'object'::"text")),
    CONSTRAINT "proposal_versions_version_kind_check" CHECK (("version_kind" = ANY (ARRAY['draft'::"text", 'sent'::"text", 'signed'::"text", 'superseded'::"text"]))),
    CONSTRAINT "proposal_versions_version_number_positive" CHECK (("version_number" > 0))
);


ALTER TABLE "public"."proposal_versions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."proposals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "job_id" "uuid",
    "customer_id" "uuid",
    "template_id" "uuid",
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "current_draft_version_id" "uuid",
    "latest_sent_version_id" "uuid",
    "signed_version_id" "uuid",
    "selected_option_id" "uuid",
    "measurement_record_id" "uuid",
    "pricing_policy_id" "uuid",
    "proposal_number" "text",
    "title" "text",
    "created_by" "uuid",
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "archived_at" timestamp with time zone,
    "deleted_at" timestamp with time zone,
    "draft_content_changed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "proposals_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'previewed'::"text", 'sent'::"text", 'viewed'::"text", 'signed'::"text", 'declined'::"text", 'revised'::"text", 'archived'::"text", 'deleted'::"text"])))
);


ALTER TABLE "public"."proposals" OWNER TO "postgres";


COMMENT ON COLUMN "public"."proposals"."draft_content_changed_at" IS 'Latest time authoritative mutable customer-facing proposal content changed. Not send, token, delivery, acceptance, Attention, or generic header touch. Dirty vs latest sent freeze uses this clock, not updated_at.';



CREATE TABLE IF NOT EXISTS "public"."service_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "name" "text",
    "category" "text",
    "unit_cost_cents" numeric,
    "unit_price_cents" numeric,
    "unit_label" "text",
    "company_id" "uuid"
);


ALTER TABLE "public"."service_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid",
    "plan_name" "text",
    "status" "text" DEFAULT 'inactive'::"text",
    "stripe_customer_id" "text",
    "stripe_subscription_id" "text",
    "current_period_end" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."subscriptions" OWNER TO "postgres";


ALTER TABLE ONLY "public"."catalog_items"
    ADD CONSTRAINT "catalog_items_id_company_unique" UNIQUE ("id", "company_id");



ALTER TABLE ONLY "public"."catalog_items"
    ADD CONSTRAINT "catalog_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_branding_profiles"
    ADD CONSTRAINT "company_branding_profiles_company_id_unique" UNIQUE ("company_id");



ALTER TABLE ONLY "public"."company_branding_profiles"
    ADD CONSTRAINT "company_branding_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_memberships"
    ADD CONSTRAINT "company_memberships_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_memberships"
    ADD CONSTRAINT "company_memberships_user_id_company_id_key" UNIQUE ("user_id", "company_id");



ALTER TABLE ONLY "public"."company_payment_accounts"
    ADD CONSTRAINT "company_payment_accounts_company_provider_unique" UNIQUE ("company_id", "provider");



ALTER TABLE ONLY "public"."company_payment_accounts"
    ADD CONSTRAINT "company_payment_accounts_id_company_unique" UNIQUE ("id", "company_id");



ALTER TABLE ONLY "public"."company_payment_accounts"
    ADD CONSTRAINT "company_payment_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_payment_accounts"
    ADD CONSTRAINT "company_payment_accounts_provider_account_unique" UNIQUE ("provider", "provider_account_id");



ALTER TABLE ONLY "public"."company_payment_settings"
    ADD CONSTRAINT "company_payment_settings_pkey" PRIMARY KEY ("company_id");



ALTER TABLE ONLY "public"."company_pricing_policies"
    ADD CONSTRAINT "company_pricing_policies_company_id_unique" UNIQUE ("company_id");



ALTER TABLE ONLY "public"."company_pricing_policies"
    ADD CONSTRAINT "company_pricing_policies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_template_preferences"
    ADD CONSTRAINT "company_template_preferences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_template_preferences"
    ADD CONSTRAINT "company_template_preferences_unique_slot" UNIQUE ("company_id", "module_key", "workflow_key", "preference_kind");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."estimates"
    ADD CONSTRAINT "estimates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_activity_events"
    ADD CONSTRAINT "job_activity_events_id_company_unique" UNIQUE ("id", "company_id");



ALTER TABLE ONLY "public"."job_activity_events"
    ADD CONSTRAINT "job_activity_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_attachments"
    ADD CONSTRAINT "job_attachments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_attention_items"
    ADD CONSTRAINT "job_attention_items_dedupe_unique" UNIQUE ("company_id", "dedupe_key");



ALTER TABLE ONLY "public"."job_attention_items"
    ADD CONSTRAINT "job_attention_items_id_company_unique" UNIQUE ("id", "company_id");



ALTER TABLE ONLY "public"."job_attention_items"
    ADD CONSTRAINT "job_attention_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_attention_items"
    ADD CONSTRAINT "job_attention_items_source_unique" UNIQUE ("company_id", "source_type", "source_id");



ALTER TABLE ONLY "public"."job_attention_user_state"
    ADD CONSTRAINT "job_attention_user_state_pkey" PRIMARY KEY ("company_id", "attention_item_id", "user_id");



ALTER TABLE ONLY "public"."job_payment_refund_event_receipts"
    ADD CONSTRAINT "job_payment_refund_event_receipts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_payment_refund_event_receipts"
    ADD CONSTRAINT "job_payment_refund_events_delivery_unique" UNIQUE ("provider_account_id", "provider_event_id");



ALTER TABLE ONLY "public"."job_payment_refunds"
    ADD CONSTRAINT "job_payment_refunds_id_company_unique" UNIQUE ("id", "company_id");



ALTER TABLE ONLY "public"."job_payment_refunds"
    ADD CONSTRAINT "job_payment_refunds_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_payment_requests"
    ADD CONSTRAINT "job_payment_requests_id_company_unique" UNIQUE ("id", "company_id");



ALTER TABLE ONLY "public"."job_payment_requests"
    ADD CONSTRAINT "job_payment_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_payment_transactions"
    ADD CONSTRAINT "job_payment_transactions_id_company_request_unique" UNIQUE ("id", "company_id", "payment_request_id");



ALTER TABLE ONLY "public"."job_payment_transactions"
    ADD CONSTRAINT "job_payment_transactions_id_company_unique" UNIQUE ("id", "company_id");



ALTER TABLE ONLY "public"."job_payment_transactions"
    ADD CONSTRAINT "job_payment_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_payment_transactions"
    ADD CONSTRAINT "job_payment_transactions_provider_event_unique" UNIQUE ("provider", "provider_event_id");



ALTER TABLE ONLY "public"."job_schedules"
    ADD CONSTRAINT "job_schedules_id_company_unique" UNIQUE ("id", "company_id");



ALTER TABLE ONLY "public"."job_schedules"
    ADD CONSTRAINT "job_schedules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_tasks"
    ADD CONSTRAINT "job_tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."measurement_records"
    ADD CONSTRAINT "measurement_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."properties"
    ADD CONSTRAINT "properties_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."proposal_acceptances"
    ADD CONSTRAINT "proposal_acceptances_id_company_unique" UNIQUE ("id", "company_id");



ALTER TABLE ONLY "public"."proposal_acceptances"
    ADD CONSTRAINT "proposal_acceptances_logical_unique" UNIQUE ("company_id", "proposal_id", "proposal_version_id", "proposal_option_id");



ALTER TABLE ONLY "public"."proposal_acceptances"
    ADD CONSTRAINT "proposal_acceptances_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."proposal_customer_activity"
    ADD CONSTRAINT "proposal_customer_activity_id_company_unique" UNIQUE ("id", "company_id");



ALTER TABLE ONLY "public"."proposal_customer_activity"
    ADD CONSTRAINT "proposal_customer_activity_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."proposal_customer_requests"
    ADD CONSTRAINT "proposal_customer_requests_id_company_unique" UNIQUE ("id", "company_id");



ALTER TABLE ONLY "public"."proposal_customer_requests"
    ADD CONSTRAINT "proposal_customer_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."proposal_delivery_attempts"
    ADD CONSTRAINT "proposal_delivery_attempts_id_company_unique" UNIQUE ("id", "company_id");



ALTER TABLE ONLY "public"."proposal_delivery_attempts"
    ADD CONSTRAINT "proposal_delivery_attempts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."proposal_events"
    ADD CONSTRAINT "proposal_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."proposal_internal_summaries"
    ADD CONSTRAINT "proposal_internal_summaries_id_company_unique" UNIQUE ("id", "company_id");



ALTER TABLE ONLY "public"."proposal_internal_summaries"
    ADD CONSTRAINT "proposal_internal_summaries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."proposal_internal_summaries"
    ADD CONSTRAINT "proposal_internal_summaries_unique_option" UNIQUE ("company_id", "proposal_option_id");



ALTER TABLE ONLY "public"."proposal_line_items"
    ADD CONSTRAINT "proposal_line_items_id_company_unique" UNIQUE ("id", "company_id");



ALTER TABLE ONLY "public"."proposal_line_items"
    ADD CONSTRAINT "proposal_line_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."proposal_option_scope_decisions"
    ADD CONSTRAINT "proposal_option_scope_decisions_id_company_unique" UNIQUE ("id", "company_id");



ALTER TABLE ONLY "public"."proposal_option_scope_decisions"
    ADD CONSTRAINT "proposal_option_scope_decisions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."proposal_option_upgrade_choices"
    ADD CONSTRAINT "proposal_option_upgrade_choices_id_company_unique" UNIQUE ("id", "company_id");



ALTER TABLE ONLY "public"."proposal_option_upgrade_choices"
    ADD CONSTRAINT "proposal_option_upgrade_choices_option_source_unique" UNIQUE ("company_id", "proposal_option_id", "source_template_item_id");



ALTER TABLE ONLY "public"."proposal_option_upgrade_choices"
    ADD CONSTRAINT "proposal_option_upgrade_choices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."proposal_options"
    ADD CONSTRAINT "proposal_options_id_company_unique" UNIQUE ("id", "company_id");



ALTER TABLE ONLY "public"."proposal_options"
    ADD CONSTRAINT "proposal_options_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."proposal_pages"
    ADD CONSTRAINT "proposal_pages_id_company_unique" UNIQUE ("id", "company_id");



ALTER TABLE ONLY "public"."proposal_pages"
    ADD CONSTRAINT "proposal_pages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."proposal_public_access_tokens"
    ADD CONSTRAINT "proposal_public_access_tokens_id_company_unique" UNIQUE ("id", "company_id");



ALTER TABLE ONLY "public"."proposal_public_access_tokens"
    ADD CONSTRAINT "proposal_public_access_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."proposal_public_option_choices"
    ADD CONSTRAINT "proposal_public_option_choices_id_company_unique" UNIQUE ("id", "company_id");



ALTER TABLE ONLY "public"."proposal_public_option_choices"
    ADD CONSTRAINT "proposal_public_option_choices_offer_unique" UNIQUE ("company_id", "proposal_id", "proposal_version_id");



ALTER TABLE ONLY "public"."proposal_public_option_choices"
    ADD CONSTRAINT "proposal_public_option_choices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."proposal_signatures"
    ADD CONSTRAINT "proposal_signatures_id_company_unique" UNIQUE ("id", "company_id");



ALTER TABLE ONLY "public"."proposal_signatures"
    ADD CONSTRAINT "proposal_signatures_logical_unique" UNIQUE ("company_id", "proposal_acceptance_id", "signer_slot");



ALTER TABLE ONLY "public"."proposal_signatures"
    ADD CONSTRAINT "proposal_signatures_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."proposal_template_items"
    ADD CONSTRAINT "proposal_template_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."proposal_template_options"
    ADD CONSTRAINT "proposal_template_options_id_company_unique" UNIQUE ("id", "company_id");



ALTER TABLE ONLY "public"."proposal_template_options"
    ADD CONSTRAINT "proposal_template_options_id_template_company_unique" UNIQUE ("id", "template_id", "company_id");



ALTER TABLE ONLY "public"."proposal_template_options"
    ADD CONSTRAINT "proposal_template_options_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."proposal_template_sections"
    ADD CONSTRAINT "proposal_template_sections_id_company_unique" UNIQUE ("id", "company_id");



ALTER TABLE ONLY "public"."proposal_template_sections"
    ADD CONSTRAINT "proposal_template_sections_id_option_template_company_unique" UNIQUE ("id", "option_id", "template_id", "company_id");



ALTER TABLE ONLY "public"."proposal_template_sections"
    ADD CONSTRAINT "proposal_template_sections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."proposal_templates"
    ADD CONSTRAINT "proposal_templates_id_company_unique" UNIQUE ("id", "company_id");



ALTER TABLE ONLY "public"."proposal_templates"
    ADD CONSTRAINT "proposal_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."proposal_version_payment_terms"
    ADD CONSTRAINT "proposal_version_payment_terms_pkey" PRIMARY KEY ("proposal_version_id");



ALTER TABLE ONLY "public"."proposal_versions"
    ADD CONSTRAINT "proposal_versions_id_company_unique" UNIQUE ("id", "company_id");



ALTER TABLE ONLY "public"."proposal_versions"
    ADD CONSTRAINT "proposal_versions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."proposal_versions"
    ADD CONSTRAINT "proposal_versions_unique_number" UNIQUE ("company_id", "proposal_id", "version_number");



ALTER TABLE ONLY "public"."proposals"
    ADD CONSTRAINT "proposals_id_company_unique" UNIQUE ("id", "company_id");



ALTER TABLE ONLY "public"."proposals"
    ADD CONSTRAINT "proposals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_items"
    ADD CONSTRAINT "service_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_catalog_items_company_active" ON "public"."catalog_items" USING "btree" ("company_id", "sort_order") WHERE ("active" = true);



CREATE INDEX "idx_catalog_items_company_id" ON "public"."catalog_items" USING "btree" ("company_id");



CREATE INDEX "idx_catalog_items_company_item_type" ON "public"."catalog_items" USING "btree" ("company_id", "item_type") WHERE ("active" = true);



CREATE INDEX "idx_catalog_items_company_quantity_source" ON "public"."catalog_items" USING "btree" ("company_id", "quantity_source");



CREATE INDEX "idx_catalog_items_created_at" ON "public"."catalog_items" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_company_branding_profiles_company_id" ON "public"."company_branding_profiles" USING "btree" ("company_id");



CREATE INDEX "idx_company_payment_accounts_company" ON "public"."company_payment_accounts" USING "btree" ("company_id");



CREATE INDEX "idx_company_pricing_policies_company_id" ON "public"."company_pricing_policies" USING "btree" ("company_id");



CREATE INDEX "idx_company_template_preferences_company_id" ON "public"."company_template_preferences" USING "btree" ("company_id");



CREATE INDEX "idx_company_template_preferences_template_id" ON "public"."company_template_preferences" USING "btree" ("template_id");



CREATE INDEX "idx_customers_company_id_email_lower" ON "public"."customers" USING "btree" ("company_id", "lower"("email"));



CREATE INDEX "idx_customers_company_id_name_lower" ON "public"."customers" USING "btree" ("company_id", "lower"("name"));



CREATE INDEX "idx_estimates_company_job" ON "public"."estimates" USING "btree" ("company_id", "job_id") WHERE ("job_id" IS NOT NULL);



CREATE INDEX "idx_estimates_job_id" ON "public"."estimates" USING "btree" ("job_id") WHERE ("job_id" IS NOT NULL);



CREATE INDEX "idx_job_activity_events_company_occurred" ON "public"."job_activity_events" USING "btree" ("company_id", "occurred_at" DESC);



CREATE INDEX "idx_job_activity_events_job_occurred" ON "public"."job_activity_events" USING "btree" ("company_id", "job_id", "occurred_at" DESC);



CREATE INDEX "idx_job_attachments_company_id" ON "public"."job_attachments" USING "btree" ("company_id");



CREATE INDEX "idx_job_attachments_job_created" ON "public"."job_attachments" USING "btree" ("job_id", "created_at" DESC) WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_job_attachments_job_gallery" ON "public"."job_attachments" USING "btree" ("job_id", "created_at" DESC) WHERE (("deleted_at" IS NULL) AND ("listed_in_job_gallery" = true));



CREATE UNIQUE INDEX "idx_job_attachments_storage_path" ON "public"."job_attachments" USING "btree" ("storage_path");



CREATE INDEX "idx_job_attention_items_company_active" ON "public"."job_attention_items" USING "btree" ("company_id", "status", "base_severity", "opened_at" DESC);



CREATE INDEX "idx_job_attention_items_company_job_active" ON "public"."job_attention_items" USING "btree" ("company_id", "job_id", "base_severity", "opened_at" DESC) WHERE ("status" = ANY (ARRAY['open'::"text", 'acknowledged'::"text"]));



CREATE INDEX "idx_job_attention_items_company_proposal" ON "public"."job_attention_items" USING "btree" ("company_id", "proposal_id", "opened_at" DESC) WHERE ("proposal_id" IS NOT NULL);



CREATE INDEX "idx_job_attention_items_company_version" ON "public"."job_attention_items" USING "btree" ("company_id", "proposal_version_id") WHERE ("proposal_version_id" IS NOT NULL);



CREATE INDEX "idx_job_attention_user_state_attention" ON "public"."job_attention_user_state" USING "btree" ("attention_item_id", "user_id");



CREATE INDEX "idx_job_attention_user_state_user_unread" ON "public"."job_attention_user_state" USING "btree" ("company_id", "user_id", "attention_item_id") WHERE ("read_at" IS NULL);



CREATE INDEX "idx_job_payment_refund_events_company" ON "public"."job_payment_refund_event_receipts" USING "btree" ("company_id", "provider_event_created_at" DESC) WHERE ("company_id" IS NOT NULL);



CREATE INDEX "idx_job_payment_refund_events_refund" ON "public"."job_payment_refund_event_receipts" USING "btree" ("refund_id", "provider_event_created_at") WHERE ("refund_id" IS NOT NULL);



CREATE INDEX "idx_job_payment_refunds_capture_status" ON "public"."job_payment_refunds" USING "btree" ("canonical_capture_transaction_id", "status", "created_at");



CREATE INDEX "idx_job_payment_refunds_company_job" ON "public"."job_payment_refunds" USING "btree" ("company_id", "job_id", "created_at" DESC);



CREATE UNIQUE INDEX "idx_job_payment_refunds_idempotency" ON "public"."job_payment_refunds" USING "btree" ("provider_account_id", "idempotency_key");



CREATE INDEX "idx_job_payment_refunds_payment_intent" ON "public"."job_payment_refunds" USING "btree" ("provider_account_id", "provider_payment_intent_id");



CREATE UNIQUE INDEX "idx_job_payment_refunds_provider_refund" ON "public"."job_payment_refunds" USING "btree" ("provider_account_id", "provider_refund_id") WHERE ("provider_refund_id" IS NOT NULL);



CREATE INDEX "idx_job_payment_requests_acceptance" ON "public"."job_payment_requests" USING "btree" ("company_id", "proposal_acceptance_id");



CREATE UNIQUE INDEX "idx_job_payment_requests_checkout_session" ON "public"."job_payment_requests" USING "btree" ("provider", "provider_checkout_session_id") WHERE ("provider_checkout_session_id" IS NOT NULL);



CREATE INDEX "idx_job_payment_requests_company_job" ON "public"."job_payment_requests" USING "btree" ("company_id", "job_id", "requested_at" DESC);



CREATE UNIQUE INDEX "idx_job_payment_requests_one_active_per_job" ON "public"."job_payment_requests" USING "btree" ("company_id", "job_id") WHERE ("status" = ANY (ARRAY['open'::"text", 'processing'::"text"]));



COMMENT ON INDEX "public"."idx_job_payment_requests_one_active_per_job" IS 'V1: at most one open or processing payment request per job, regardless of kind. Paid/failed/cancelled/expired history is unrestricted.';



CREATE INDEX "idx_job_payment_transactions_canonical_capture_pi" ON "public"."job_payment_transactions" USING "btree" ("company_id", "provider", "provider_payment_intent_id") WHERE (("kind" = 'capture'::"text") AND ("status" = 'succeeded'::"text") AND ("provider_payment_intent_id" IS NOT NULL));



CREATE INDEX "idx_job_payment_transactions_request" ON "public"."job_payment_transactions" USING "btree" ("company_id", "payment_request_id", "occurred_at" DESC);



CREATE INDEX "idx_job_tasks_company_id" ON "public"."job_tasks" USING "btree" ("company_id");



CREATE INDEX "idx_job_tasks_job_active" ON "public"."job_tasks" USING "btree" ("job_id", "status", "due_on", "created_at") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_jobs_active" ON "public"."jobs" USING "btree" ("company_id", "created_at" DESC) WHERE (("archived" = false) AND ("deleted_at" IS NULL));



CREATE INDEX "idx_jobs_assigned_to" ON "public"."jobs" USING "btree" ("assigned_to") WHERE ("assigned_to" IS NOT NULL);



CREATE INDEX "idx_jobs_company_id" ON "public"."jobs" USING "btree" ("company_id");



CREATE INDEX "idx_jobs_company_stage_entered_at" ON "public"."jobs" USING "btree" ("company_id", "stage_entered_at" DESC NULLS LAST) WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_jobs_created_at" ON "public"."jobs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_jobs_customer_id" ON "public"."jobs" USING "btree" ("customer_id");



CREATE UNIQUE INDEX "idx_jobs_id_company_unique" ON "public"."jobs" USING "btree" ("id", "company_id");



CREATE INDEX "idx_jobs_last_activity_at" ON "public"."jobs" USING "btree" ("last_activity_at" DESC NULLS LAST);



CREATE INDEX "idx_jobs_property_id" ON "public"."jobs" USING "btree" ("property_id");



CREATE INDEX "idx_jobs_stage" ON "public"."jobs" USING "btree" ("stage");



CREATE INDEX "idx_jobs_status" ON "public"."jobs" USING "btree" ("status");



CREATE INDEX "idx_jobs_updated_at" ON "public"."jobs" USING "btree" ("updated_at" DESC);



CREATE INDEX "idx_measurement_records_company_id" ON "public"."measurement_records" USING "btree" ("company_id");



CREATE INDEX "idx_measurement_records_created_at" ON "public"."measurement_records" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_measurement_records_estimate_id" ON "public"."measurement_records" USING "btree" ("estimate_id") WHERE ("estimate_id" IS NOT NULL);



CREATE INDEX "idx_measurement_records_estimate_ready" ON "public"."measurement_records" USING "btree" ("company_id", "estimate_ready") WHERE ("estimate_ready" = true);



CREATE INDEX "idx_measurement_records_job_id" ON "public"."measurement_records" USING "btree" ("job_id") WHERE ("job_id" IS NOT NULL);



CREATE UNIQUE INDEX "idx_measurement_records_one_selected_per_estimate" ON "public"."measurement_records" USING "btree" ("estimate_id") WHERE (("is_selected" = true) AND ("estimate_id" IS NOT NULL));



CREATE UNIQUE INDEX "idx_measurement_records_one_selected_per_job" ON "public"."measurement_records" USING "btree" ("job_id") WHERE (("is_selected" = true) AND ("job_id" IS NOT NULL));



CREATE INDEX "idx_measurement_records_production_ready" ON "public"."measurement_records" USING "btree" ("company_id", "production_ready") WHERE ("production_ready" = true);



CREATE INDEX "idx_measurement_records_report_file_id" ON "public"."measurement_records" USING "btree" ("report_file_id") WHERE ("report_file_id" IS NOT NULL);



CREATE INDEX "idx_measurement_records_selected" ON "public"."measurement_records" USING "btree" ("company_id", "is_selected") WHERE ("is_selected" = true);



CREATE INDEX "idx_measurement_records_source_type" ON "public"."measurement_records" USING "btree" ("source_type");



CREATE INDEX "idx_measurement_records_status" ON "public"."measurement_records" USING "btree" ("status");



CREATE INDEX "idx_properties_company_id" ON "public"."properties" USING "btree" ("company_id");



CREATE INDEX "idx_properties_company_normalized" ON "public"."properties" USING "btree" ("company_id", "address_normalized");



CREATE INDEX "idx_properties_company_updated" ON "public"."properties" USING "btree" ("company_id", "updated_at" DESC);



CREATE INDEX "idx_proposal_acceptances_company_job_accepted" ON "public"."proposal_acceptances" USING "btree" ("company_id", "job_id", "accepted_at" DESC);



CREATE INDEX "idx_proposal_acceptances_company_proposal_version" ON "public"."proposal_acceptances" USING "btree" ("company_id", "proposal_id", "proposal_version_id");



CREATE INDEX "idx_proposal_acceptances_customer_choice" ON "public"."proposal_acceptances" USING "btree" ("company_id", "customer_chosen_option_id") WHERE ("customer_chosen_option_id" IS NOT NULL);



CREATE INDEX "idx_proposal_acceptances_token" ON "public"."proposal_acceptances" USING "btree" ("public_access_token_id");



CREATE INDEX "idx_proposal_acceptances_unconfirmed" ON "public"."proposal_acceptances" USING "btree" ("company_id", "job_id", "accepted_at" DESC) WHERE ("confirmed_at" IS NULL);



CREATE INDEX "idx_proposal_customer_activity_company_proposal_occurred" ON "public"."proposal_customer_activity" USING "btree" ("company_id", "proposal_id", "occurred_at" DESC);



CREATE INDEX "idx_proposal_customer_activity_company_version_occurred" ON "public"."proposal_customer_activity" USING "btree" ("company_id", "proposal_version_id", "occurred_at" DESC);



CREATE INDEX "idx_proposal_customer_activity_token_occurred" ON "public"."proposal_customer_activity" USING "btree" ("token_id", "occurred_at" DESC);



CREATE INDEX "idx_proposal_customer_requests_company_proposal_created" ON "public"."proposal_customer_requests" USING "btree" ("company_id", "proposal_id", "created_at" DESC);



CREATE INDEX "idx_proposal_customer_requests_company_status_created" ON "public"."proposal_customer_requests" USING "btree" ("company_id", "status", "created_at" DESC);



CREATE INDEX "idx_proposal_customer_requests_company_version_created" ON "public"."proposal_customer_requests" USING "btree" ("company_id", "proposal_version_id", "created_at" DESC);



CREATE INDEX "idx_proposal_customer_requests_token_created" ON "public"."proposal_customer_requests" USING "btree" ("public_access_token_id", "created_at" DESC);



CREATE UNIQUE INDEX "idx_proposal_customer_requests_token_submission_key" ON "public"."proposal_customer_requests" USING "btree" ("public_access_token_id", "submission_key") WHERE ("submission_key" IS NOT NULL);



CREATE UNIQUE INDEX "idx_proposal_delivery_attempts_company_idempotency" ON "public"."proposal_delivery_attempts" USING "btree" ("company_id", "idempotency_key");



CREATE INDEX "idx_proposal_delivery_attempts_company_proposal_created" ON "public"."proposal_delivery_attempts" USING "btree" ("company_id", "proposal_id", "created_at" DESC);



CREATE INDEX "idx_proposal_delivery_attempts_company_proposal_status" ON "public"."proposal_delivery_attempts" USING "btree" ("company_id", "proposal_id", "status");



CREATE INDEX "idx_proposal_delivery_attempts_company_version" ON "public"."proposal_delivery_attempts" USING "btree" ("company_id", "proposal_version_id");



CREATE UNIQUE INDEX "idx_proposal_delivery_attempts_provider_message" ON "public"."proposal_delivery_attempts" USING "btree" ("provider", "provider_message_id") WHERE ("provider_message_id" IS NOT NULL);



CREATE INDEX "idx_proposal_delivery_attempts_token_prefix" ON "public"."proposal_delivery_attempts" USING "btree" ("token_prefix") WHERE ("token_prefix" IS NOT NULL);



CREATE INDEX "idx_proposal_events_company_proposal_occurred" ON "public"."proposal_events" USING "btree" ("company_id", "proposal_id", "occurred_at" DESC);



CREATE INDEX "idx_proposal_internal_summaries_company_option" ON "public"."proposal_internal_summaries" USING "btree" ("company_id", "proposal_option_id");



CREATE INDEX "idx_proposal_line_items_company_option_sort" ON "public"."proposal_line_items" USING "btree" ("company_id", "proposal_option_id", "sort_order");



CREATE INDEX "idx_proposal_line_items_company_page_sort" ON "public"."proposal_line_items" USING "btree" ("company_id", "page_id", "sort_order") WHERE ("page_id" IS NOT NULL);



CREATE UNIQUE INDEX "idx_proposal_option_scope_decisions_active_instance_line" ON "public"."proposal_option_scope_decisions" USING "btree" ("company_id", "proposal_option_id", "instance_line_key", "decision_type") WHERE (("active" = true) AND ("instance_line_key" IS NOT NULL));



CREATE UNIQUE INDEX "idx_proposal_option_scope_decisions_active_template_target" ON "public"."proposal_option_scope_decisions" USING "btree" ("company_id", "proposal_option_id", "source_template_item_id", "decision_type") WHERE (("active" = true) AND ("source_template_item_id" IS NOT NULL));



CREATE INDEX "idx_proposal_option_scope_decisions_company_option" ON "public"."proposal_option_scope_decisions" USING "btree" ("company_id", "proposal_option_id") WHERE ("active" = true);



CREATE INDEX "idx_proposal_option_scope_decisions_company_proposal" ON "public"."proposal_option_scope_decisions" USING "btree" ("company_id", "proposal_id") WHERE ("active" = true);



CREATE INDEX "idx_proposal_option_scope_decisions_company_version" ON "public"."proposal_option_scope_decisions" USING "btree" ("company_id", "proposal_version_id") WHERE ("active" = true);



CREATE INDEX "idx_proposal_option_upgrade_choices_company_option" ON "public"."proposal_option_upgrade_choices" USING "btree" ("company_id", "proposal_option_id");



CREATE INDEX "idx_proposal_option_upgrade_choices_company_proposal" ON "public"."proposal_option_upgrade_choices" USING "btree" ("company_id", "proposal_id");



CREATE INDEX "idx_proposal_option_upgrade_choices_company_version" ON "public"."proposal_option_upgrade_choices" USING "btree" ("company_id", "proposal_version_id");



CREATE INDEX "idx_proposal_options_company_version_sort" ON "public"."proposal_options" USING "btree" ("company_id", "proposal_version_id", "sort_order");



CREATE INDEX "idx_proposal_pages_company_version_sort" ON "public"."proposal_pages" USING "btree" ("company_id", "proposal_version_id", "sort_order");



CREATE INDEX "idx_proposal_public_access_tokens_category_status" ON "public"."proposal_public_access_tokens" USING "btree" ("company_id", "proposal_id", "token_category", "status");



CREATE INDEX "idx_proposal_public_access_tokens_company_proposal" ON "public"."proposal_public_access_tokens" USING "btree" ("company_id", "proposal_id");



CREATE INDEX "idx_proposal_public_access_tokens_company_status_expires" ON "public"."proposal_public_access_tokens" USING "btree" ("company_id", "status", "expires_at");



CREATE INDEX "idx_proposal_public_access_tokens_company_version" ON "public"."proposal_public_access_tokens" USING "btree" ("company_id", "proposal_version_id");



CREATE INDEX "idx_proposal_public_access_tokens_prefix" ON "public"."proposal_public_access_tokens" USING "btree" ("token_prefix");



CREATE UNIQUE INDEX "idx_proposal_public_access_tokens_token_hash" ON "public"."proposal_public_access_tokens" USING "btree" ("token_hash");



CREATE INDEX "idx_proposal_public_option_choices_version" ON "public"."proposal_public_option_choices" USING "btree" ("company_id", "proposal_version_id");



CREATE INDEX "idx_proposal_signatures_acceptance" ON "public"."proposal_signatures" USING "btree" ("company_id", "proposal_acceptance_id");



CREATE INDEX "idx_proposal_signatures_company_job_signed" ON "public"."proposal_signatures" USING "btree" ("company_id", "job_id", "signed_at" DESC);



CREATE INDEX "idx_proposal_signatures_company_proposal_version" ON "public"."proposal_signatures" USING "btree" ("company_id", "proposal_id", "proposal_version_id");



CREATE INDEX "idx_proposal_template_items_catalog_item_id" ON "public"."proposal_template_items" USING "btree" ("catalog_item_id") WHERE ("catalog_item_id" IS NOT NULL);



CREATE INDEX "idx_proposal_template_items_company_id" ON "public"."proposal_template_items" USING "btree" ("company_id");



CREATE INDEX "idx_proposal_template_items_option_id" ON "public"."proposal_template_items" USING "btree" ("option_id");



CREATE UNIQUE INDEX "idx_proposal_template_items_section_seed_key" ON "public"."proposal_template_items" USING "btree" ("section_id", (("metadata" ->> 'seed_key'::"text"))) WHERE (("metadata" ? 'seed_key'::"text") AND ("length"(TRIM(BOTH FROM ("metadata" ->> 'seed_key'::"text"))) > 0));



CREATE INDEX "idx_proposal_template_items_section_sort" ON "public"."proposal_template_items" USING "btree" ("section_id", "sort_order");



CREATE INDEX "idx_proposal_template_items_template_id" ON "public"."proposal_template_items" USING "btree" ("template_id");



CREATE INDEX "idx_proposal_template_options_company_id" ON "public"."proposal_template_options" USING "btree" ("company_id");



CREATE UNIQUE INDEX "idx_proposal_template_options_one_default_per_template" ON "public"."proposal_template_options" USING "btree" ("template_id") WHERE ("is_default" = true);



CREATE INDEX "idx_proposal_template_options_template_active_sort" ON "public"."proposal_template_options" USING "btree" ("template_id", "sort_order") WHERE ("removed_at" IS NULL);



CREATE INDEX "idx_proposal_template_options_template_removed_at" ON "public"."proposal_template_options" USING "btree" ("template_id", "removed_at") WHERE ("removed_at" IS NOT NULL);



CREATE UNIQUE INDEX "idx_proposal_template_options_template_seed_key" ON "public"."proposal_template_options" USING "btree" ("template_id", (("metadata" ->> 'seed_key'::"text"))) WHERE (("metadata" ? 'seed_key'::"text") AND ("length"(TRIM(BOTH FROM ("metadata" ->> 'seed_key'::"text"))) > 0));



CREATE INDEX "idx_proposal_template_options_template_sort" ON "public"."proposal_template_options" USING "btree" ("template_id", "sort_order");



CREATE INDEX "idx_proposal_template_sections_company_id" ON "public"."proposal_template_sections" USING "btree" ("company_id");



CREATE UNIQUE INDEX "idx_proposal_template_sections_option_seed_key" ON "public"."proposal_template_sections" USING "btree" ("option_id", (("metadata" ->> 'seed_key'::"text"))) WHERE (("metadata" ? 'seed_key'::"text") AND ("length"(TRIM(BOTH FROM ("metadata" ->> 'seed_key'::"text"))) > 0));



CREATE INDEX "idx_proposal_template_sections_option_sort" ON "public"."proposal_template_sections" USING "btree" ("option_id", "sort_order");



CREATE INDEX "idx_proposal_template_sections_template_option" ON "public"."proposal_template_sections" USING "btree" ("template_id", "option_id");



CREATE INDEX "idx_proposal_templates_company_active_sort" ON "public"."proposal_templates" USING "btree" ("company_id", "sort_order") WHERE ("active" = true);



CREATE INDEX "idx_proposal_templates_company_id" ON "public"."proposal_templates" USING "btree" ("company_id");



CREATE UNIQUE INDEX "idx_proposal_templates_company_seed_key" ON "public"."proposal_templates" USING "btree" ("company_id", (("metadata" ->> 'seed_key'::"text"))) WHERE (("metadata" ? 'seed_key'::"text") AND ("length"(TRIM(BOTH FROM ("metadata" ->> 'seed_key'::"text"))) > 0));



CREATE INDEX "idx_proposal_templates_company_status" ON "public"."proposal_templates" USING "btree" ("company_id", "status");



CREATE INDEX "idx_proposal_templates_created_at" ON "public"."proposal_templates" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_proposal_version_payment_terms_company_proposal" ON "public"."proposal_version_payment_terms" USING "btree" ("company_id", "proposal_id");



CREATE INDEX "idx_proposal_versions_company_kind" ON "public"."proposal_versions" USING "btree" ("company_id", "version_kind");



CREATE INDEX "idx_proposal_versions_company_proposal_id" ON "public"."proposal_versions" USING "btree" ("company_id", "proposal_id");



CREATE INDEX "idx_proposal_versions_company_proposal_version_number" ON "public"."proposal_versions" USING "btree" ("company_id", "proposal_id", "version_number");



CREATE INDEX "idx_proposals_company_current_draft_version" ON "public"."proposals" USING "btree" ("company_id", "current_draft_version_id") WHERE ("current_draft_version_id" IS NOT NULL);



CREATE INDEX "idx_proposals_company_id" ON "public"."proposals" USING "btree" ("company_id");



CREATE INDEX "idx_proposals_company_job_id" ON "public"."proposals" USING "btree" ("company_id", "job_id") WHERE ("job_id" IS NOT NULL);



CREATE UNIQUE INDEX "idx_proposals_company_proposal_number" ON "public"."proposals" USING "btree" ("company_id", "proposal_number") WHERE (("proposal_number" IS NOT NULL) AND ("length"(TRIM(BOTH FROM "proposal_number")) > 0));



CREATE INDEX "idx_proposals_company_status" ON "public"."proposals" USING "btree" ("company_id", "status");



CREATE INDEX "job_schedules_company_job_created" ON "public"."job_schedules" USING "btree" ("company_id", "job_id", "created_at" DESC);



CREATE INDEX "job_schedules_company_status_range" ON "public"."job_schedules" USING "btree" ("company_id", "status", "range_start_at", "range_end_at") WHERE (("kind" = 'work'::"text") AND ("status" = 'scheduled'::"text"));



CREATE UNIQUE INDEX "job_schedules_one_active_work" ON "public"."job_schedules" USING "btree" ("job_id") WHERE (("kind" = 'work'::"text") AND ("status" = 'scheduled'::"text"));



CREATE INDEX "service_items_company_id_idx" ON "public"."service_items" USING "btree" ("company_id");



CREATE OR REPLACE TRIGGER "catalog_items_set_updated_at" BEFORE UPDATE ON "public"."catalog_items" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "companies_timezone_guard" BEFORE INSERT OR UPDATE OF "timezone" ON "public"."companies" FOR EACH ROW EXECUTE FUNCTION "public"."companies_timezone_guard"();



CREATE OR REPLACE TRIGGER "company_branding_profiles_set_updated_at" BEFORE UPDATE ON "public"."company_branding_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "company_payment_accounts_row_guard" BEFORE INSERT OR DELETE OR UPDATE ON "public"."company_payment_accounts" FOR EACH ROW EXECUTE FUNCTION "public"."company_payment_accounts_row_guard"();



CREATE OR REPLACE TRIGGER "company_payment_settings_row_guard" BEFORE INSERT OR DELETE OR UPDATE ON "public"."company_payment_settings" FOR EACH ROW EXECUTE FUNCTION "public"."company_payment_settings_row_guard"();



CREATE OR REPLACE TRIGGER "company_pricing_policies_set_updated_at" BEFORE UPDATE ON "public"."company_pricing_policies" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "company_template_preferences_set_updated_at" BEFORE UPDATE ON "public"."company_template_preferences" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "customers_prevent_company_id_change" BEFORE UPDATE ON "public"."customers" FOR EACH ROW EXECUTE FUNCTION "public"."customers_prevent_company_id_change"();



CREATE OR REPLACE TRIGGER "job_attachments_before_write" BEFORE INSERT OR UPDATE ON "public"."job_attachments" FOR EACH ROW EXECUTE FUNCTION "public"."job_attachments_before_write"();



CREATE OR REPLACE TRIGGER "job_attachments_set_updated_at" BEFORE UPDATE ON "public"."job_attachments" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "job_attention_items_row_guard" BEFORE INSERT OR DELETE OR UPDATE ON "public"."job_attention_items" FOR EACH ROW EXECUTE FUNCTION "public"."job_attention_items_row_guard"();



CREATE OR REPLACE TRIGGER "job_attention_items_set_updated_at" BEFORE UPDATE ON "public"."job_attention_items" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "job_attention_user_state_set_updated_at" BEFORE UPDATE ON "public"."job_attention_user_state" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "job_payment_refund_events_row_guard" BEFORE DELETE OR UPDATE ON "public"."job_payment_refund_event_receipts" FOR EACH ROW EXECUTE FUNCTION "public"."job_payment_refund_events_row_guard_v1"();



CREATE OR REPLACE TRIGGER "job_payment_refunds_row_guard" BEFORE INSERT OR DELETE OR UPDATE ON "public"."job_payment_refunds" FOR EACH ROW EXECUTE FUNCTION "public"."job_payment_refunds_row_guard_v1"();



CREATE OR REPLACE TRIGGER "job_payment_requests_row_guard" BEFORE INSERT OR DELETE OR UPDATE ON "public"."job_payment_requests" FOR EACH ROW EXECUTE FUNCTION "public"."job_payment_requests_row_guard"();



CREATE OR REPLACE TRIGGER "job_payment_transactions_row_guard" BEFORE INSERT OR DELETE OR UPDATE ON "public"."job_payment_transactions" FOR EACH ROW EXECUTE FUNCTION "public"."job_payment_transactions_row_guard"();



CREATE OR REPLACE TRIGGER "job_schedules_before_write" BEFORE INSERT OR UPDATE ON "public"."job_schedules" FOR EACH ROW EXECUTE FUNCTION "public"."job_schedules_before_write"();



CREATE OR REPLACE TRIGGER "job_tasks_before_write" BEFORE INSERT OR UPDATE ON "public"."job_tasks" FOR EACH ROW EXECUTE FUNCTION "public"."job_tasks_before_write"();



CREATE OR REPLACE TRIGGER "job_tasks_set_updated_at" BEFORE UPDATE ON "public"."job_tasks" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "jobs_job_complete_guard" BEFORE INSERT OR UPDATE OF "stage", "completed_at", "production_started_at" ON "public"."jobs" FOR EACH ROW EXECUTE FUNCTION "public"."jobs_job_complete_guard"();



CREATE OR REPLACE TRIGGER "jobs_lifecycle_after_insert" AFTER INSERT ON "public"."jobs" FOR EACH ROW EXECUTE FUNCTION "public"."jobs_lifecycle_after_insert"();



CREATE OR REPLACE TRIGGER "jobs_lifecycle_after_update" AFTER UPDATE ON "public"."jobs" FOR EACH ROW EXECUTE FUNCTION "public"."jobs_lifecycle_after_update"();



CREATE OR REPLACE TRIGGER "jobs_lifecycle_before_insert" BEFORE INSERT ON "public"."jobs" FOR EACH ROW EXECUTE FUNCTION "public"."jobs_lifecycle_before_insert"();



CREATE OR REPLACE TRIGGER "jobs_lifecycle_before_update" BEFORE UPDATE ON "public"."jobs" FOR EACH ROW EXECUTE FUNCTION "public"."jobs_lifecycle_before_update"();



CREATE OR REPLACE TRIGGER "jobs_production_start_guard" BEFORE INSERT OR UPDATE OF "stage", "production_started_at" ON "public"."jobs" FOR EACH ROW EXECUTE FUNCTION "public"."jobs_production_start_guard"();



CREATE OR REPLACE TRIGGER "jobs_set_updated_at" BEFORE UPDATE ON "public"."jobs" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "measurement_records_set_updated_at" BEFORE UPDATE ON "public"."measurement_records" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "payments_prevent_company_id_change" BEFORE UPDATE ON "public"."payments" FOR EACH ROW EXECUTE FUNCTION "public"."payments_prevent_company_id_change"();



CREATE OR REPLACE TRIGGER "properties_prevent_company_id_change" BEFORE UPDATE ON "public"."properties" FOR EACH ROW EXECUTE FUNCTION "public"."properties_prevent_company_id_change"();



CREATE OR REPLACE TRIGGER "properties_set_updated_at" BEFORE UPDATE ON "public"."properties" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "proposal_acceptances_row_guard" BEFORE INSERT OR DELETE OR UPDATE ON "public"."proposal_acceptances" FOR EACH ROW EXECUTE FUNCTION "public"."proposal_acceptances_row_guard"();



CREATE OR REPLACE TRIGGER "proposal_customer_activity_row_guard" BEFORE INSERT OR DELETE OR UPDATE ON "public"."proposal_customer_activity" FOR EACH ROW EXECUTE FUNCTION "public"."proposal_customer_activity_row_guard"();



CREATE OR REPLACE TRIGGER "proposal_customer_requests_row_guard" BEFORE INSERT OR DELETE OR UPDATE ON "public"."proposal_customer_requests" FOR EACH ROW EXECUTE FUNCTION "public"."proposal_customer_requests_row_guard"();



CREATE OR REPLACE TRIGGER "proposal_delivery_attempts_row_guard" BEFORE INSERT OR UPDATE ON "public"."proposal_delivery_attempts" FOR EACH ROW EXECUTE FUNCTION "public"."proposal_delivery_attempt_row_guard"();



CREATE OR REPLACE TRIGGER "proposal_delivery_attempts_set_updated_at" BEFORE UPDATE ON "public"."proposal_delivery_attempts" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "proposal_internal_summaries_immutable_version_guard" BEFORE DELETE OR UPDATE ON "public"."proposal_internal_summaries" FOR EACH ROW EXECUTE FUNCTION "public"."proposal_immutable_version_child_guard"();



CREATE OR REPLACE TRIGGER "proposal_internal_summaries_set_updated_at" BEFORE UPDATE ON "public"."proposal_internal_summaries" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "proposal_line_items_immutable_version_guard" BEFORE DELETE OR UPDATE ON "public"."proposal_line_items" FOR EACH ROW EXECUTE FUNCTION "public"."proposal_immutable_version_child_guard"();



CREATE OR REPLACE TRIGGER "proposal_line_items_set_updated_at" BEFORE UPDATE ON "public"."proposal_line_items" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "proposal_line_items_touch_draft_content" AFTER INSERT OR DELETE OR UPDATE ON "public"."proposal_line_items" FOR EACH ROW EXECUTE FUNCTION "public"."proposal_line_items_touch_draft_content_v1"();



CREATE OR REPLACE TRIGGER "proposal_option_upgrade_choices_immutable_version_guard" BEFORE DELETE OR UPDATE ON "public"."proposal_option_upgrade_choices" FOR EACH ROW EXECUTE FUNCTION "public"."proposal_immutable_version_child_guard"();



CREATE OR REPLACE TRIGGER "proposal_options_immutable_version_guard" BEFORE DELETE OR UPDATE ON "public"."proposal_options" FOR EACH ROW EXECUTE FUNCTION "public"."proposal_immutable_version_child_guard"();



CREATE OR REPLACE TRIGGER "proposal_options_set_updated_at" BEFORE UPDATE ON "public"."proposal_options" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "proposal_options_touch_draft_content" AFTER INSERT OR DELETE OR UPDATE ON "public"."proposal_options" FOR EACH ROW EXECUTE FUNCTION "public"."proposal_options_touch_draft_content_v1"();



CREATE OR REPLACE TRIGGER "proposal_pages_immutable_version_guard" BEFORE DELETE OR UPDATE ON "public"."proposal_pages" FOR EACH ROW EXECUTE FUNCTION "public"."proposal_immutable_version_child_guard"();



CREATE OR REPLACE TRIGGER "proposal_pages_set_updated_at" BEFORE UPDATE ON "public"."proposal_pages" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "proposal_pages_touch_draft_content" AFTER INSERT OR DELETE OR UPDATE ON "public"."proposal_pages" FOR EACH ROW EXECUTE FUNCTION "public"."proposal_pages_touch_draft_content_v1"();



CREATE OR REPLACE TRIGGER "proposal_public_access_tokens_row_guard" BEFORE INSERT OR UPDATE ON "public"."proposal_public_access_tokens" FOR EACH ROW EXECUTE FUNCTION "public"."proposal_public_access_token_row_guard"();



CREATE OR REPLACE TRIGGER "proposal_public_option_choices_row_guard" BEFORE INSERT OR DELETE OR UPDATE ON "public"."proposal_public_option_choices" FOR EACH ROW EXECUTE FUNCTION "public"."proposal_public_option_choices_row_guard"();



CREATE OR REPLACE TRIGGER "proposal_scope_decisions_touch_draft_content" AFTER INSERT OR DELETE OR UPDATE ON "public"."proposal_option_scope_decisions" FOR EACH ROW EXECUTE FUNCTION "public"."proposal_scope_decisions_touch_draft_content_v1"();



CREATE OR REPLACE TRIGGER "proposal_signatures_row_guard" BEFORE INSERT OR DELETE OR UPDATE ON "public"."proposal_signatures" FOR EACH ROW EXECUTE FUNCTION "public"."proposal_signatures_row_guard"();



CREATE OR REPLACE TRIGGER "proposal_template_items_set_updated_at" BEFORE UPDATE ON "public"."proposal_template_items" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "proposal_template_options_set_updated_at" BEFORE UPDATE ON "public"."proposal_template_options" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "proposal_template_sections_set_updated_at" BEFORE UPDATE ON "public"."proposal_template_sections" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "proposal_templates_set_updated_at" BEFORE UPDATE ON "public"."proposal_templates" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "proposal_upgrade_choices_touch_draft_content" AFTER INSERT OR DELETE OR UPDATE ON "public"."proposal_option_upgrade_choices" FOR EACH ROW EXECUTE FUNCTION "public"."proposal_upgrade_choices_touch_draft_content_v1"();



CREATE OR REPLACE TRIGGER "proposal_versions_immutable_row_guard" BEFORE DELETE OR UPDATE ON "public"."proposal_versions" FOR EACH ROW EXECUTE FUNCTION "public"."proposal_immutable_version_row_guard"();



CREATE OR REPLACE TRIGGER "proposal_versions_touch_draft_content" AFTER UPDATE OF "context_echo", "policy_echo" ON "public"."proposal_versions" FOR EACH ROW EXECUTE FUNCTION "public"."proposal_versions_touch_draft_content_v1"();



CREATE OR REPLACE TRIGGER "proposals_guard_draft_content_changed_at" BEFORE INSERT OR UPDATE ON "public"."proposals" FOR EACH ROW EXECUTE FUNCTION "public"."proposals_guard_draft_content_changed_at_v1"();



CREATE OR REPLACE TRIGGER "proposals_set_updated_at" BEFORE UPDATE ON "public"."proposals" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_proposal_payment_terms_immutable" BEFORE DELETE OR UPDATE ON "public"."proposal_version_payment_terms" FOR EACH ROW EXECUTE FUNCTION "public"."proposal_payment_terms_guard_immutable_v1"();



CREATE OR REPLACE TRIGGER "trg_proposal_payment_terms_on_version_insert" AFTER INSERT ON "public"."proposal_versions" FOR EACH ROW EXECUTE FUNCTION "public"."proposal_payment_terms_on_version_insert_v1"();



ALTER TABLE ONLY "public"."catalog_items"
    ADD CONSTRAINT "catalog_items_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_branding_profiles"
    ADD CONSTRAINT "company_branding_profiles_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_memberships"
    ADD CONSTRAINT "company_memberships_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_memberships"
    ADD CONSTRAINT "company_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_payment_accounts"
    ADD CONSTRAINT "company_payment_accounts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."company_payment_settings"
    ADD CONSTRAINT "company_payment_settings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."company_pricing_policies"
    ADD CONSTRAINT "company_pricing_policies_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_template_preferences"
    ADD CONSTRAINT "company_template_preferences_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_template_preferences"
    ADD CONSTRAINT "company_template_preferences_template_company_fk" FOREIGN KEY ("template_id", "company_id") REFERENCES "public"."proposal_templates"("id", "company_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."estimates"
    ADD CONSTRAINT "estimates_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."estimates"
    ADD CONSTRAINT "estimates_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."estimates"
    ADD CONSTRAINT "estimates_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."job_activity_events"
    ADD CONSTRAINT "job_activity_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."job_activity_events"
    ADD CONSTRAINT "job_activity_events_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."job_activity_events"
    ADD CONSTRAINT "job_activity_events_job_company_fkey" FOREIGN KEY ("job_id", "company_id") REFERENCES "public"."jobs"("id", "company_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."job_attachments"
    ADD CONSTRAINT "job_attachments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_attachments"
    ADD CONSTRAINT "job_attachments_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_attention_items"
    ADD CONSTRAINT "job_attention_items_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."job_attention_items"
    ADD CONSTRAINT "job_attention_items_job_company_fkey" FOREIGN KEY ("job_id", "company_id") REFERENCES "public"."jobs"("id", "company_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."job_attention_items"
    ADD CONSTRAINT "job_attention_items_proposal_company_fkey" FOREIGN KEY ("proposal_id", "company_id") REFERENCES "public"."proposals"("id", "company_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."job_attention_items"
    ADD CONSTRAINT "job_attention_items_version_company_fkey" FOREIGN KEY ("proposal_version_id", "company_id") REFERENCES "public"."proposal_versions"("id", "company_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."job_attention_user_state"
    ADD CONSTRAINT "job_attention_user_state_attention_company_fkey" FOREIGN KEY ("attention_item_id", "company_id") REFERENCES "public"."job_attention_items"("id", "company_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_attention_user_state"
    ADD CONSTRAINT "job_attention_user_state_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_attention_user_state"
    ADD CONSTRAINT "job_attention_user_state_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_payment_refund_event_receipts"
    ADD CONSTRAINT "job_payment_refund_event_receipts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."job_payment_refund_event_receipts"
    ADD CONSTRAINT "job_payment_refund_events_refund_company_fkey" FOREIGN KEY ("refund_id", "company_id") REFERENCES "public"."job_payment_refunds"("id", "company_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."job_payment_refunds"
    ADD CONSTRAINT "job_payment_refunds_capture_binding_fkey" FOREIGN KEY ("canonical_capture_transaction_id", "company_id", "payment_request_id") REFERENCES "public"."job_payment_transactions"("id", "company_id", "payment_request_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."job_payment_refunds"
    ADD CONSTRAINT "job_payment_refunds_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."job_payment_refunds"
    ADD CONSTRAINT "job_payment_refunds_job_company_fkey" FOREIGN KEY ("job_id", "company_id") REFERENCES "public"."jobs"("id", "company_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."job_payment_refunds"
    ADD CONSTRAINT "job_payment_refunds_request_company_fkey" FOREIGN KEY ("payment_request_id", "company_id") REFERENCES "public"."job_payment_requests"("id", "company_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."job_payment_requests"
    ADD CONSTRAINT "job_payment_requests_acceptance_company_fkey" FOREIGN KEY ("proposal_acceptance_id", "company_id") REFERENCES "public"."proposal_acceptances"("id", "company_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."job_payment_requests"
    ADD CONSTRAINT "job_payment_requests_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."job_payment_requests"
    ADD CONSTRAINT "job_payment_requests_job_company_fkey" FOREIGN KEY ("job_id", "company_id") REFERENCES "public"."jobs"("id", "company_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."job_payment_requests"
    ADD CONSTRAINT "job_payment_requests_option_company_fkey" FOREIGN KEY ("proposal_option_id", "company_id") REFERENCES "public"."proposal_options"("id", "company_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."job_payment_requests"
    ADD CONSTRAINT "job_payment_requests_proposal_company_fkey" FOREIGN KEY ("proposal_id", "company_id") REFERENCES "public"."proposals"("id", "company_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."job_payment_requests"
    ADD CONSTRAINT "job_payment_requests_signature_company_fkey" FOREIGN KEY ("proposal_signature_id", "company_id") REFERENCES "public"."proposal_signatures"("id", "company_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."job_payment_requests"
    ADD CONSTRAINT "job_payment_requests_version_company_fkey" FOREIGN KEY ("proposal_version_id", "company_id") REFERENCES "public"."proposal_versions"("id", "company_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."job_payment_transactions"
    ADD CONSTRAINT "job_payment_transactions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."job_payment_transactions"
    ADD CONSTRAINT "job_payment_transactions_request_company_fkey" FOREIGN KEY ("payment_request_id", "company_id") REFERENCES "public"."job_payment_requests"("id", "company_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."job_schedules"
    ADD CONSTRAINT "job_schedules_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."job_schedules"
    ADD CONSTRAINT "job_schedules_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."job_schedules"
    ADD CONSTRAINT "job_schedules_job_company_fkey" FOREIGN KEY ("job_id", "company_id") REFERENCES "public"."jobs"("id", "company_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."job_schedules"
    ADD CONSTRAINT "job_schedules_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."job_tasks"
    ADD CONSTRAINT "job_tasks_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_tasks"
    ADD CONSTRAINT "job_tasks_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."measurement_records"
    ADD CONSTRAINT "measurement_records_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."measurement_records"
    ADD CONSTRAINT "measurement_records_estimate_id_fkey" FOREIGN KEY ("estimate_id") REFERENCES "public"."estimates"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."measurement_records"
    ADD CONSTRAINT "measurement_records_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_estimate_id_fkey" FOREIGN KEY ("estimate_id") REFERENCES "public"."estimates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."properties"
    ADD CONSTRAINT "properties_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proposal_acceptances"
    ADD CONSTRAINT "proposal_acceptances_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."proposal_acceptances"
    ADD CONSTRAINT "proposal_acceptances_confirmed_by_user_id_fkey" FOREIGN KEY ("confirmed_by_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."proposal_acceptances"
    ADD CONSTRAINT "proposal_acceptances_customer_choice_option_fkey" FOREIGN KEY ("customer_chosen_option_id", "company_id") REFERENCES "public"."proposal_options"("id", "company_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."proposal_acceptances"
    ADD CONSTRAINT "proposal_acceptances_job_company_fkey" FOREIGN KEY ("job_id", "company_id") REFERENCES "public"."jobs"("id", "company_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."proposal_acceptances"
    ADD CONSTRAINT "proposal_acceptances_option_company_fkey" FOREIGN KEY ("proposal_option_id", "company_id") REFERENCES "public"."proposal_options"("id", "company_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."proposal_acceptances"
    ADD CONSTRAINT "proposal_acceptances_proposal_company_fkey" FOREIGN KEY ("proposal_id", "company_id") REFERENCES "public"."proposals"("id", "company_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."proposal_acceptances"
    ADD CONSTRAINT "proposal_acceptances_token_company_fkey" FOREIGN KEY ("public_access_token_id", "company_id") REFERENCES "public"."proposal_public_access_tokens"("id", "company_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."proposal_acceptances"
    ADD CONSTRAINT "proposal_acceptances_version_company_fkey" FOREIGN KEY ("proposal_version_id", "company_id") REFERENCES "public"."proposal_versions"("id", "company_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."proposal_customer_activity"
    ADD CONSTRAINT "proposal_customer_activity_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proposal_customer_activity"
    ADD CONSTRAINT "proposal_customer_activity_proposal_company_fkey" FOREIGN KEY ("proposal_id", "company_id") REFERENCES "public"."proposals"("id", "company_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proposal_customer_activity"
    ADD CONSTRAINT "proposal_customer_activity_token_company_fkey" FOREIGN KEY ("token_id", "company_id") REFERENCES "public"."proposal_public_access_tokens"("id", "company_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proposal_customer_activity"
    ADD CONSTRAINT "proposal_customer_activity_version_company_fkey" FOREIGN KEY ("proposal_version_id", "company_id") REFERENCES "public"."proposal_versions"("id", "company_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."proposal_customer_requests"
    ADD CONSTRAINT "proposal_customer_requests_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proposal_customer_requests"
    ADD CONSTRAINT "proposal_customer_requests_proposal_company_fkey" FOREIGN KEY ("proposal_id", "company_id") REFERENCES "public"."proposals"("id", "company_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proposal_customer_requests"
    ADD CONSTRAINT "proposal_customer_requests_token_company_fkey" FOREIGN KEY ("public_access_token_id", "company_id") REFERENCES "public"."proposal_public_access_tokens"("id", "company_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proposal_customer_requests"
    ADD CONSTRAINT "proposal_customer_requests_version_company_fkey" FOREIGN KEY ("proposal_version_id", "company_id") REFERENCES "public"."proposal_versions"("id", "company_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."proposal_delivery_attempts"
    ADD CONSTRAINT "proposal_delivery_attempts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proposal_delivery_attempts"
    ADD CONSTRAINT "proposal_delivery_attempts_proposal_company_fkey" FOREIGN KEY ("proposal_id", "company_id") REFERENCES "public"."proposals"("id", "company_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proposal_delivery_attempts"
    ADD CONSTRAINT "proposal_delivery_attempts_token_company_fkey" FOREIGN KEY ("proposal_public_access_token_id", "company_id") REFERENCES "public"."proposal_public_access_tokens"("id", "company_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."proposal_delivery_attempts"
    ADD CONSTRAINT "proposal_delivery_attempts_version_company_fkey" FOREIGN KEY ("proposal_version_id", "company_id") REFERENCES "public"."proposal_versions"("id", "company_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."proposal_events"
    ADD CONSTRAINT "proposal_events_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proposal_events"
    ADD CONSTRAINT "proposal_events_proposal_company_fk" FOREIGN KEY ("proposal_id", "company_id") REFERENCES "public"."proposals"("id", "company_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proposal_events"
    ADD CONSTRAINT "proposal_events_version_company_fk" FOREIGN KEY ("proposal_version_id", "company_id") REFERENCES "public"."proposal_versions"("id", "company_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."proposal_internal_summaries"
    ADD CONSTRAINT "proposal_internal_summaries_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proposal_internal_summaries"
    ADD CONSTRAINT "proposal_internal_summaries_option_company_fkey" FOREIGN KEY ("proposal_option_id", "company_id") REFERENCES "public"."proposal_options"("id", "company_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proposal_line_items"
    ADD CONSTRAINT "proposal_line_items_catalog_company_fkey" FOREIGN KEY ("catalog_item_id", "company_id") REFERENCES "public"."catalog_items"("id", "company_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."proposal_line_items"
    ADD CONSTRAINT "proposal_line_items_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proposal_line_items"
    ADD CONSTRAINT "proposal_line_items_option_company_fkey" FOREIGN KEY ("proposal_option_id", "company_id") REFERENCES "public"."proposal_options"("id", "company_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proposal_line_items"
    ADD CONSTRAINT "proposal_line_items_page_company_fkey" FOREIGN KEY ("page_id", "company_id") REFERENCES "public"."proposal_pages"("id", "company_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."proposal_line_items"
    ADD CONSTRAINT "proposal_line_items_section_company_fkey" FOREIGN KEY ("section_id", "company_id") REFERENCES "public"."proposal_template_sections"("id", "company_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."proposal_line_items"
    ADD CONSTRAINT "proposal_line_items_source_template_item_id_fkey" FOREIGN KEY ("source_template_item_id") REFERENCES "public"."proposal_template_items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."proposal_option_scope_decisions"
    ADD CONSTRAINT "proposal_option_scope_decisions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proposal_option_scope_decisions"
    ADD CONSTRAINT "proposal_option_scope_decisions_option_company_fk" FOREIGN KEY ("proposal_option_id", "company_id") REFERENCES "public"."proposal_options"("id", "company_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proposal_option_scope_decisions"
    ADD CONSTRAINT "proposal_option_scope_decisions_proposal_company_fk" FOREIGN KEY ("proposal_id", "company_id") REFERENCES "public"."proposals"("id", "company_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proposal_option_scope_decisions"
    ADD CONSTRAINT "proposal_option_scope_decisions_source_template_item_id_fkey" FOREIGN KEY ("source_template_item_id") REFERENCES "public"."proposal_template_items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."proposal_option_scope_decisions"
    ADD CONSTRAINT "proposal_option_scope_decisions_version_company_fk" FOREIGN KEY ("proposal_version_id", "company_id") REFERENCES "public"."proposal_versions"("id", "company_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proposal_option_upgrade_choices"
    ADD CONSTRAINT "proposal_option_upgrade_choic_replaces_source_template_ite_fkey" FOREIGN KEY ("replaces_source_template_item_id") REFERENCES "public"."proposal_template_items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."proposal_option_upgrade_choices"
    ADD CONSTRAINT "proposal_option_upgrade_choices_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proposal_option_upgrade_choices"
    ADD CONSTRAINT "proposal_option_upgrade_choices_option_company_fk" FOREIGN KEY ("proposal_option_id", "company_id") REFERENCES "public"."proposal_options"("id", "company_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proposal_option_upgrade_choices"
    ADD CONSTRAINT "proposal_option_upgrade_choices_proposal_company_fk" FOREIGN KEY ("proposal_id", "company_id") REFERENCES "public"."proposals"("id", "company_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proposal_option_upgrade_choices"
    ADD CONSTRAINT "proposal_option_upgrade_choices_source_template_item_id_fkey" FOREIGN KEY ("source_template_item_id") REFERENCES "public"."proposal_template_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proposal_option_upgrade_choices"
    ADD CONSTRAINT "proposal_option_upgrade_choices_version_company_fk" FOREIGN KEY ("proposal_version_id", "company_id") REFERENCES "public"."proposal_versions"("id", "company_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proposal_options"
    ADD CONSTRAINT "proposal_options_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proposal_options"
    ADD CONSTRAINT "proposal_options_source_template_option_id_fkey" FOREIGN KEY ("source_template_option_id") REFERENCES "public"."proposal_template_options"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."proposal_options"
    ADD CONSTRAINT "proposal_options_version_company_fkey" FOREIGN KEY ("proposal_version_id", "company_id") REFERENCES "public"."proposal_versions"("id", "company_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proposal_pages"
    ADD CONSTRAINT "proposal_pages_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proposal_pages"
    ADD CONSTRAINT "proposal_pages_source_template_section_id_fkey" FOREIGN KEY ("source_template_section_id") REFERENCES "public"."proposal_template_sections"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."proposal_pages"
    ADD CONSTRAINT "proposal_pages_version_company_fkey" FOREIGN KEY ("proposal_version_id", "company_id") REFERENCES "public"."proposal_versions"("id", "company_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proposal_public_access_tokens"
    ADD CONSTRAINT "proposal_public_access_tokens_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proposal_public_access_tokens"
    ADD CONSTRAINT "proposal_public_access_tokens_proposal_company_fkey" FOREIGN KEY ("proposal_id", "company_id") REFERENCES "public"."proposals"("id", "company_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proposal_public_access_tokens"
    ADD CONSTRAINT "proposal_public_access_tokens_superseded_by_company_fkey" FOREIGN KEY ("superseded_by_token_id", "company_id") REFERENCES "public"."proposal_public_access_tokens"("id", "company_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."proposal_public_access_tokens"
    ADD CONSTRAINT "proposal_public_access_tokens_version_company_fkey" FOREIGN KEY ("proposal_version_id", "company_id") REFERENCES "public"."proposal_versions"("id", "company_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."proposal_public_option_choices"
    ADD CONSTRAINT "proposal_public_option_choices_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proposal_public_option_choices"
    ADD CONSTRAINT "proposal_public_option_choices_option_company_fkey" FOREIGN KEY ("chosen_option_id", "company_id") REFERENCES "public"."proposal_options"("id", "company_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."proposal_public_option_choices"
    ADD CONSTRAINT "proposal_public_option_choices_proposal_company_fkey" FOREIGN KEY ("proposal_id", "company_id") REFERENCES "public"."proposals"("id", "company_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proposal_public_option_choices"
    ADD CONSTRAINT "proposal_public_option_choices_token_company_fkey" FOREIGN KEY ("public_access_token_id", "company_id") REFERENCES "public"."proposal_public_access_tokens"("id", "company_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proposal_public_option_choices"
    ADD CONSTRAINT "proposal_public_option_choices_version_company_fkey" FOREIGN KEY ("proposal_version_id", "company_id") REFERENCES "public"."proposal_versions"("id", "company_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."proposal_signatures"
    ADD CONSTRAINT "proposal_signatures_acceptance_company_fkey" FOREIGN KEY ("proposal_acceptance_id", "company_id") REFERENCES "public"."proposal_acceptances"("id", "company_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."proposal_signatures"
    ADD CONSTRAINT "proposal_signatures_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."proposal_signatures"
    ADD CONSTRAINT "proposal_signatures_job_company_fkey" FOREIGN KEY ("job_id", "company_id") REFERENCES "public"."jobs"("id", "company_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."proposal_signatures"
    ADD CONSTRAINT "proposal_signatures_option_company_fkey" FOREIGN KEY ("proposal_option_id", "company_id") REFERENCES "public"."proposal_options"("id", "company_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."proposal_signatures"
    ADD CONSTRAINT "proposal_signatures_proposal_company_fkey" FOREIGN KEY ("proposal_id", "company_id") REFERENCES "public"."proposals"("id", "company_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."proposal_signatures"
    ADD CONSTRAINT "proposal_signatures_token_company_fkey" FOREIGN KEY ("public_access_token_id", "company_id") REFERENCES "public"."proposal_public_access_tokens"("id", "company_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."proposal_signatures"
    ADD CONSTRAINT "proposal_signatures_version_company_fkey" FOREIGN KEY ("proposal_version_id", "company_id") REFERENCES "public"."proposal_versions"("id", "company_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."proposal_template_items"
    ADD CONSTRAINT "proposal_template_items_catalog_item_company_fkey" FOREIGN KEY ("catalog_item_id", "company_id") REFERENCES "public"."catalog_items"("id", "company_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."proposal_template_items"
    ADD CONSTRAINT "proposal_template_items_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proposal_template_items"
    ADD CONSTRAINT "proposal_template_items_option_template_company_fkey" FOREIGN KEY ("option_id", "template_id", "company_id") REFERENCES "public"."proposal_template_options"("id", "template_id", "company_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proposal_template_items"
    ADD CONSTRAINT "proposal_template_items_replaces_template_item_id_fkey" FOREIGN KEY ("replaces_template_item_id") REFERENCES "public"."proposal_template_items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."proposal_template_items"
    ADD CONSTRAINT "proposal_template_items_section_option_template_company_fkey" FOREIGN KEY ("section_id", "option_id", "template_id", "company_id") REFERENCES "public"."proposal_template_sections"("id", "option_id", "template_id", "company_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proposal_template_items"
    ADD CONSTRAINT "proposal_template_items_template_company_fkey" FOREIGN KEY ("template_id", "company_id") REFERENCES "public"."proposal_templates"("id", "company_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proposal_template_options"
    ADD CONSTRAINT "proposal_template_options_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proposal_template_options"
    ADD CONSTRAINT "proposal_template_options_template_company_fkey" FOREIGN KEY ("template_id", "company_id") REFERENCES "public"."proposal_templates"("id", "company_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proposal_template_sections"
    ADD CONSTRAINT "proposal_template_sections_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proposal_template_sections"
    ADD CONSTRAINT "proposal_template_sections_option_template_company_fkey" FOREIGN KEY ("option_id", "template_id", "company_id") REFERENCES "public"."proposal_template_options"("id", "template_id", "company_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proposal_template_sections"
    ADD CONSTRAINT "proposal_template_sections_template_company_fkey" FOREIGN KEY ("template_id", "company_id") REFERENCES "public"."proposal_templates"("id", "company_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proposal_templates"
    ADD CONSTRAINT "proposal_templates_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proposal_version_payment_terms"
    ADD CONSTRAINT "proposal_version_payment_terms_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."proposal_version_payment_terms"
    ADD CONSTRAINT "proposal_version_payment_terms_proposal_company_fkey" FOREIGN KEY ("proposal_id", "company_id") REFERENCES "public"."proposals"("id", "company_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."proposal_version_payment_terms"
    ADD CONSTRAINT "proposal_version_payment_terms_version_company_fkey" FOREIGN KEY ("proposal_version_id", "company_id") REFERENCES "public"."proposal_versions"("id", "company_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."proposal_versions"
    ADD CONSTRAINT "proposal_versions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proposal_versions"
    ADD CONSTRAINT "proposal_versions_parent_version_fkey" FOREIGN KEY ("parent_version_id") REFERENCES "public"."proposal_versions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."proposal_versions"
    ADD CONSTRAINT "proposal_versions_proposal_company_fkey" FOREIGN KEY ("proposal_id", "company_id") REFERENCES "public"."proposals"("id", "company_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proposals"
    ADD CONSTRAINT "proposals_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proposals"
    ADD CONSTRAINT "proposals_current_draft_version_company_fkey" FOREIGN KEY ("current_draft_version_id", "company_id") REFERENCES "public"."proposal_versions"("id", "company_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."proposals"
    ADD CONSTRAINT "proposals_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."proposals"
    ADD CONSTRAINT "proposals_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."proposals"
    ADD CONSTRAINT "proposals_latest_sent_version_company_fkey" FOREIGN KEY ("latest_sent_version_id", "company_id") REFERENCES "public"."proposal_versions"("id", "company_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."proposals"
    ADD CONSTRAINT "proposals_measurement_record_id_fkey" FOREIGN KEY ("measurement_record_id") REFERENCES "public"."measurement_records"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."proposals"
    ADD CONSTRAINT "proposals_pricing_policy_id_fkey" FOREIGN KEY ("pricing_policy_id") REFERENCES "public"."company_pricing_policies"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."proposals"
    ADD CONSTRAINT "proposals_selected_option_company_fkey" FOREIGN KEY ("selected_option_id", "company_id") REFERENCES "public"."proposal_options"("id", "company_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."proposals"
    ADD CONSTRAINT "proposals_signed_version_company_fkey" FOREIGN KEY ("signed_version_id", "company_id") REFERENCES "public"."proposal_versions"("id", "company_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."proposals"
    ADD CONSTRAINT "proposals_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."proposal_templates"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."service_items"
    ADD CONSTRAINT "service_items_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



CREATE POLICY "Owners can update company" ON "public"."companies" FOR UPDATE USING (("owner_user_id" = "auth"."uid"()));



CREATE POLICY "Users can delete their company estimates" ON "public"."estimates" FOR DELETE USING (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can insert estimates for their company" ON "public"."estimates" FOR INSERT WITH CHECK (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can insert own profile" ON "public"."profiles" FOR INSERT WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "Users can insert their membership" ON "public"."company_memberships" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE USING (("id" = "auth"."uid"()));



CREATE POLICY "Users can update their company estimates" ON "public"."estimates" FOR UPDATE USING (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view own profile" ON "public"."profiles" FOR SELECT USING (("id" = "auth"."uid"()));



CREATE POLICY "Users can view their company" ON "public"."companies" FOR SELECT USING (("id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view their company estimates" ON "public"."estimates" FOR SELECT USING (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view their memberships" ON "public"."company_memberships" FOR SELECT USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."catalog_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "catalog_items_delete_company_scope" ON "public"."catalog_items" FOR DELETE USING (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))));



CREATE POLICY "catalog_items_insert_company_scope" ON "public"."catalog_items" FOR INSERT WITH CHECK (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))));



CREATE POLICY "catalog_items_select_company_scope" ON "public"."catalog_items" FOR SELECT USING (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))));



CREATE POLICY "catalog_items_update_company_scope" ON "public"."catalog_items" FOR UPDATE USING (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"())))) WITH CHECK (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."companies" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."company_branding_profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_branding_profiles_insert_company_scope" ON "public"."company_branding_profiles" FOR INSERT WITH CHECK (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))));



CREATE POLICY "company_branding_profiles_select_company_scope" ON "public"."company_branding_profiles" FOR SELECT USING (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))));



CREATE POLICY "company_branding_profiles_update_company_scope" ON "public"."company_branding_profiles" FOR UPDATE USING (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"())))) WITH CHECK (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."company_memberships" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."company_payment_accounts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_payment_accounts_select_company_scope" ON "public"."company_payment_accounts" FOR SELECT USING (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."company_payment_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_payment_settings_select_company_scope" ON "public"."company_payment_settings" FOR SELECT USING (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."company_pricing_policies" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_pricing_policies_delete_company_scope" ON "public"."company_pricing_policies" FOR DELETE USING (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))));



CREATE POLICY "company_pricing_policies_insert_company_scope" ON "public"."company_pricing_policies" FOR INSERT WITH CHECK (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))));



CREATE POLICY "company_pricing_policies_select_company_scope" ON "public"."company_pricing_policies" FOR SELECT USING (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))));



CREATE POLICY "company_pricing_policies_update_company_scope" ON "public"."company_pricing_policies" FOR UPDATE USING (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"())))) WITH CHECK (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."company_template_preferences" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_template_preferences_delete_company_scope" ON "public"."company_template_preferences" FOR DELETE USING (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))));



CREATE POLICY "company_template_preferences_insert_company_scope" ON "public"."company_template_preferences" FOR INSERT WITH CHECK (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))));



CREATE POLICY "company_template_preferences_select_company_scope" ON "public"."company_template_preferences" FOR SELECT USING (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))));



CREATE POLICY "company_template_preferences_update_company_scope" ON "public"."company_template_preferences" FOR UPDATE USING (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"())))) WITH CHECK (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."customers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "customers_delete_company_scope" ON "public"."customers" FOR DELETE USING (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))));



CREATE POLICY "customers_insert_company_scope" ON "public"."customers" FOR INSERT WITH CHECK ((("company_id" IS NOT NULL) AND ("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"())))));



CREATE POLICY "customers_select_company_scope" ON "public"."customers" FOR SELECT USING (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))));



CREATE POLICY "customers_update_company_scope" ON "public"."customers" FOR UPDATE USING (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"())))) WITH CHECK ((("company_id" IS NOT NULL) AND ("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."estimates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."job_activity_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "job_activity_events_select_company_scope" ON "public"."job_activity_events" FOR SELECT USING (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."job_attachments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "job_attachments_insert_company_scope" ON "public"."job_attachments" FOR INSERT WITH CHECK ((("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))) AND (EXISTS ( SELECT 1
   FROM "public"."jobs" "j"
  WHERE (("j"."id" = "job_attachments"."job_id") AND ("j"."company_id" = "job_attachments"."company_id"))))));



CREATE POLICY "job_attachments_select_company_scope" ON "public"."job_attachments" FOR SELECT USING (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))));



CREATE POLICY "job_attachments_update_company_scope" ON "public"."job_attachments" FOR UPDATE USING (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"())))) WITH CHECK ((("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))) AND (EXISTS ( SELECT 1
   FROM "public"."jobs" "j"
  WHERE (("j"."id" = "job_attachments"."job_id") AND ("j"."company_id" = "job_attachments"."company_id"))))));



ALTER TABLE "public"."job_attention_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "job_attention_items_select_company_scope" ON "public"."job_attention_items" FOR SELECT USING (("company_id" IN ( SELECT "cm"."company_id"
   FROM "public"."company_memberships" "cm"
  WHERE ("cm"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."job_attention_user_state" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "job_attention_user_state_select_own" ON "public"."job_attention_user_state" FOR SELECT USING ((("user_id" = "auth"."uid"()) AND ("company_id" IN ( SELECT "cm"."company_id"
   FROM "public"."company_memberships" "cm"
  WHERE ("cm"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."job_payment_refund_event_receipts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "job_payment_refund_events_select_company_scope" ON "public"."job_payment_refund_event_receipts" FOR SELECT USING (("company_id" IN ( SELECT "cm"."company_id"
   FROM "public"."company_memberships" "cm"
  WHERE ("cm"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."job_payment_refunds" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "job_payment_refunds_select_company_scope" ON "public"."job_payment_refunds" FOR SELECT USING (("company_id" IN ( SELECT "cm"."company_id"
   FROM "public"."company_memberships" "cm"
  WHERE ("cm"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."job_payment_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "job_payment_requests_select_company_scope" ON "public"."job_payment_requests" FOR SELECT USING (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."job_payment_transactions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "job_payment_transactions_select_company_scope" ON "public"."job_payment_transactions" FOR SELECT USING (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."job_schedules" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "job_schedules_select_company_scope" ON "public"."job_schedules" FOR SELECT USING (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."job_tasks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "job_tasks_insert_company_scope" ON "public"."job_tasks" FOR INSERT WITH CHECK ((("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))) AND (EXISTS ( SELECT 1
   FROM "public"."jobs" "j"
  WHERE (("j"."id" = "job_tasks"."job_id") AND ("j"."company_id" = "job_tasks"."company_id"))))));



CREATE POLICY "job_tasks_select_company_scope" ON "public"."job_tasks" FOR SELECT USING (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))));



CREATE POLICY "job_tasks_update_company_scope" ON "public"."job_tasks" FOR UPDATE USING (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"())))) WITH CHECK ((("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))) AND (EXISTS ( SELECT 1
   FROM "public"."jobs" "j"
  WHERE (("j"."id" = "job_tasks"."job_id") AND ("j"."company_id" = "job_tasks"."company_id"))))));



ALTER TABLE "public"."jobs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "jobs_delete_company_scope" ON "public"."jobs" FOR DELETE USING (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))));



CREATE POLICY "jobs_insert_company_scope" ON "public"."jobs" FOR INSERT WITH CHECK (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))));



CREATE POLICY "jobs_select_company_scope" ON "public"."jobs" FOR SELECT USING (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))));



CREATE POLICY "jobs_update_company_scope" ON "public"."jobs" FOR UPDATE USING (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"())))) WITH CHECK (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."measurement_records" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "measurement_records_delete_company_scope" ON "public"."measurement_records" FOR DELETE USING (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))));



CREATE POLICY "measurement_records_insert_company_scope" ON "public"."measurement_records" FOR INSERT WITH CHECK ((("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))) AND (("job_id" IS NULL) OR (EXISTS ( SELECT 1
   FROM "public"."jobs" "j"
  WHERE (("j"."id" = "measurement_records"."job_id") AND ("j"."company_id" = "measurement_records"."company_id"))))) AND (("estimate_id" IS NULL) OR (EXISTS ( SELECT 1
   FROM "public"."estimates" "e"
  WHERE (("e"."id" = "measurement_records"."estimate_id") AND ("e"."company_id" = "measurement_records"."company_id")))))));



CREATE POLICY "measurement_records_select_company_scope" ON "public"."measurement_records" FOR SELECT USING (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))));



CREATE POLICY "measurement_records_update_company_scope" ON "public"."measurement_records" FOR UPDATE USING (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"())))) WITH CHECK ((("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))) AND (("job_id" IS NULL) OR (EXISTS ( SELECT 1
   FROM "public"."jobs" "j"
  WHERE (("j"."id" = "measurement_records"."job_id") AND ("j"."company_id" = "measurement_records"."company_id"))))) AND (("estimate_id" IS NULL) OR (EXISTS ( SELECT 1
   FROM "public"."estimates" "e"
  WHERE (("e"."id" = "measurement_records"."estimate_id") AND ("e"."company_id" = "measurement_records"."company_id")))))));



ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payments_insert_company_scope" ON "public"."payments" FOR INSERT WITH CHECK ((("company_id" IS NOT NULL) AND ("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"())))));



CREATE POLICY "payments_select_company_scope" ON "public"."payments" FOR SELECT USING ((("company_id" IS NOT NULL) AND ("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."properties" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "properties_delete_company_scope" ON "public"."properties" FOR DELETE USING (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))));



CREATE POLICY "properties_insert_company_scope" ON "public"."properties" FOR INSERT WITH CHECK ((("company_id" IS NOT NULL) AND ("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"())))));



CREATE POLICY "properties_select_company_scope" ON "public"."properties" FOR SELECT USING (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))));



CREATE POLICY "properties_update_company_scope" ON "public"."properties" FOR UPDATE USING (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"())))) WITH CHECK ((("company_id" IS NOT NULL) AND ("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."proposal_acceptances" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "proposal_acceptances_select_company_scope" ON "public"."proposal_acceptances" FOR SELECT USING (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."proposal_customer_activity" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "proposal_customer_activity_select_company_scope" ON "public"."proposal_customer_activity" FOR SELECT TO "authenticated" USING (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."proposal_customer_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "proposal_customer_requests_select_company_scope" ON "public"."proposal_customer_requests" FOR SELECT USING (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."proposal_delivery_attempts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "proposal_delivery_attempts_select_company_scope" ON "public"."proposal_delivery_attempts" FOR SELECT TO "authenticated" USING (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."proposal_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "proposal_events_insert_company_scope" ON "public"."proposal_events" FOR INSERT WITH CHECK (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))));



CREATE POLICY "proposal_events_select_company_scope" ON "public"."proposal_events" FOR SELECT USING (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."proposal_internal_summaries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "proposal_internal_summaries_delete_company_scope" ON "public"."proposal_internal_summaries" FOR DELETE USING (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))));



CREATE POLICY "proposal_internal_summaries_insert_company_scope" ON "public"."proposal_internal_summaries" FOR INSERT WITH CHECK (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))));



CREATE POLICY "proposal_internal_summaries_select_company_scope" ON "public"."proposal_internal_summaries" FOR SELECT USING (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))));



CREATE POLICY "proposal_internal_summaries_update_company_scope" ON "public"."proposal_internal_summaries" FOR UPDATE USING (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"())))) WITH CHECK (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."proposal_line_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "proposal_line_items_delete_company_scope" ON "public"."proposal_line_items" FOR DELETE USING (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))));



CREATE POLICY "proposal_line_items_insert_company_scope" ON "public"."proposal_line_items" FOR INSERT WITH CHECK (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))));



CREATE POLICY "proposal_line_items_select_company_scope" ON "public"."proposal_line_items" FOR SELECT USING (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))));



CREATE POLICY "proposal_line_items_update_company_scope" ON "public"."proposal_line_items" FOR UPDATE USING (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"())))) WITH CHECK (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."proposal_option_scope_decisions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "proposal_option_scope_decisions_delete_company_scope" ON "public"."proposal_option_scope_decisions" FOR DELETE USING (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))));



CREATE POLICY "proposal_option_scope_decisions_insert_company_scope" ON "public"."proposal_option_scope_decisions" FOR INSERT WITH CHECK (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))));



CREATE POLICY "proposal_option_scope_decisions_select_company_scope" ON "public"."proposal_option_scope_decisions" FOR SELECT USING (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))));



CREATE POLICY "proposal_option_scope_decisions_update_company_scope" ON "public"."proposal_option_scope_decisions" FOR UPDATE USING (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"())))) WITH CHECK (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."proposal_option_upgrade_choices" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "proposal_option_upgrade_choices_delete_company_scope" ON "public"."proposal_option_upgrade_choices" FOR DELETE USING (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))));



CREATE POLICY "proposal_option_upgrade_choices_insert_company_scope" ON "public"."proposal_option_upgrade_choices" FOR INSERT WITH CHECK (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))));



CREATE POLICY "proposal_option_upgrade_choices_select_company_scope" ON "public"."proposal_option_upgrade_choices" FOR SELECT USING (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))));



CREATE POLICY "proposal_option_upgrade_choices_update_company_scope" ON "public"."proposal_option_upgrade_choices" FOR UPDATE USING (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"())))) WITH CHECK (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."proposal_options" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "proposal_options_delete_company_scope" ON "public"."proposal_options" FOR DELETE USING (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))));



CREATE POLICY "proposal_options_insert_company_scope" ON "public"."proposal_options" FOR INSERT WITH CHECK (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))));



CREATE POLICY "proposal_options_select_company_scope" ON "public"."proposal_options" FOR SELECT USING (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))));



CREATE POLICY "proposal_options_update_company_scope" ON "public"."proposal_options" FOR UPDATE USING (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"())))) WITH CHECK (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."proposal_pages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "proposal_pages_delete_company_scope" ON "public"."proposal_pages" FOR DELETE USING (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))));



CREATE POLICY "proposal_pages_insert_company_scope" ON "public"."proposal_pages" FOR INSERT WITH CHECK (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))));



CREATE POLICY "proposal_pages_select_company_scope" ON "public"."proposal_pages" FOR SELECT USING (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))));



CREATE POLICY "proposal_pages_update_company_scope" ON "public"."proposal_pages" FOR UPDATE USING (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"())))) WITH CHECK (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."proposal_public_access_tokens" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "proposal_public_access_tokens_select_company_scope" ON "public"."proposal_public_access_tokens" FOR SELECT TO "authenticated" USING (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."proposal_public_option_choices" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "proposal_public_option_choices_select_company_scope" ON "public"."proposal_public_option_choices" FOR SELECT USING (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."proposal_signatures" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "proposal_signatures_select_company_scope" ON "public"."proposal_signatures" FOR SELECT USING (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."proposal_template_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "proposal_template_items_delete_company_scope" ON "public"."proposal_template_items" FOR DELETE USING (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))));



CREATE POLICY "proposal_template_items_insert_company_scope" ON "public"."proposal_template_items" FOR INSERT WITH CHECK ((("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))) AND (EXISTS ( SELECT 1
   FROM "public"."proposal_template_sections" "s"
  WHERE (("s"."id" = "proposal_template_items"."section_id") AND ("s"."option_id" = "proposal_template_items"."option_id") AND ("s"."template_id" = "proposal_template_items"."template_id") AND ("s"."company_id" = "proposal_template_items"."company_id")))) AND (("catalog_item_id" IS NULL) OR (EXISTS ( SELECT 1
   FROM "public"."catalog_items" "c"
  WHERE (("c"."id" = "proposal_template_items"."catalog_item_id") AND ("c"."company_id" = "proposal_template_items"."company_id")))))));



CREATE POLICY "proposal_template_items_select_company_scope" ON "public"."proposal_template_items" FOR SELECT USING (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))));



CREATE POLICY "proposal_template_items_update_company_scope" ON "public"."proposal_template_items" FOR UPDATE USING (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"())))) WITH CHECK ((("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))) AND (EXISTS ( SELECT 1
   FROM "public"."proposal_template_sections" "s"
  WHERE (("s"."id" = "proposal_template_items"."section_id") AND ("s"."option_id" = "proposal_template_items"."option_id") AND ("s"."template_id" = "proposal_template_items"."template_id") AND ("s"."company_id" = "proposal_template_items"."company_id")))) AND (("catalog_item_id" IS NULL) OR (EXISTS ( SELECT 1
   FROM "public"."catalog_items" "c"
  WHERE (("c"."id" = "proposal_template_items"."catalog_item_id") AND ("c"."company_id" = "proposal_template_items"."company_id")))))));



ALTER TABLE "public"."proposal_template_options" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "proposal_template_options_delete_company_scope" ON "public"."proposal_template_options" FOR DELETE USING (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))));



CREATE POLICY "proposal_template_options_insert_company_scope" ON "public"."proposal_template_options" FOR INSERT WITH CHECK ((("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))) AND (EXISTS ( SELECT 1
   FROM "public"."proposal_templates" "t"
  WHERE (("t"."id" = "proposal_template_options"."template_id") AND ("t"."company_id" = "proposal_template_options"."company_id"))))));



CREATE POLICY "proposal_template_options_select_company_scope" ON "public"."proposal_template_options" FOR SELECT USING (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))));



CREATE POLICY "proposal_template_options_update_company_scope" ON "public"."proposal_template_options" FOR UPDATE USING (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"())))) WITH CHECK ((("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))) AND (EXISTS ( SELECT 1
   FROM "public"."proposal_templates" "t"
  WHERE (("t"."id" = "proposal_template_options"."template_id") AND ("t"."company_id" = "proposal_template_options"."company_id"))))));



ALTER TABLE "public"."proposal_template_sections" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "proposal_template_sections_delete_company_scope" ON "public"."proposal_template_sections" FOR DELETE USING (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))));



CREATE POLICY "proposal_template_sections_insert_company_scope" ON "public"."proposal_template_sections" FOR INSERT WITH CHECK ((("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))) AND (EXISTS ( SELECT 1
   FROM "public"."proposal_template_options" "o"
  WHERE (("o"."id" = "proposal_template_sections"."option_id") AND ("o"."template_id" = "proposal_template_sections"."template_id") AND ("o"."company_id" = "proposal_template_sections"."company_id"))))));



CREATE POLICY "proposal_template_sections_select_company_scope" ON "public"."proposal_template_sections" FOR SELECT USING (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))));



CREATE POLICY "proposal_template_sections_update_company_scope" ON "public"."proposal_template_sections" FOR UPDATE USING (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"())))) WITH CHECK ((("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))) AND (EXISTS ( SELECT 1
   FROM "public"."proposal_template_options" "o"
  WHERE (("o"."id" = "proposal_template_sections"."option_id") AND ("o"."template_id" = "proposal_template_sections"."template_id") AND ("o"."company_id" = "proposal_template_sections"."company_id"))))));



ALTER TABLE "public"."proposal_templates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "proposal_templates_delete_company_scope" ON "public"."proposal_templates" FOR DELETE USING (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))));



CREATE POLICY "proposal_templates_insert_company_scope" ON "public"."proposal_templates" FOR INSERT WITH CHECK (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))));



CREATE POLICY "proposal_templates_select_company_scope" ON "public"."proposal_templates" FOR SELECT USING (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))));



CREATE POLICY "proposal_templates_update_company_scope" ON "public"."proposal_templates" FOR UPDATE USING (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"())))) WITH CHECK (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."proposal_version_payment_terms" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "proposal_version_payment_terms_select_company_scope" ON "public"."proposal_version_payment_terms" FOR SELECT TO "authenticated" USING (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))));



CREATE POLICY "proposal_version_payment_terms_write_deny" ON "public"."proposal_version_payment_terms" TO "authenticated" USING (false) WITH CHECK (false);



ALTER TABLE "public"."proposal_versions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "proposal_versions_delete_company_scope" ON "public"."proposal_versions" FOR DELETE USING (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))));



CREATE POLICY "proposal_versions_insert_company_scope" ON "public"."proposal_versions" FOR INSERT WITH CHECK (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))));



CREATE POLICY "proposal_versions_select_company_scope" ON "public"."proposal_versions" FOR SELECT USING (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))));



CREATE POLICY "proposal_versions_update_company_scope" ON "public"."proposal_versions" FOR UPDATE USING (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"())))) WITH CHECK (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."proposals" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "proposals_delete_company_scope" ON "public"."proposals" FOR DELETE USING (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))));



CREATE POLICY "proposals_insert_company_scope" ON "public"."proposals" FOR INSERT WITH CHECK ((("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))) AND (("job_id" IS NULL) OR (EXISTS ( SELECT 1
   FROM "public"."jobs" "j"
  WHERE (("j"."id" = "proposals"."job_id") AND ("j"."company_id" = "proposals"."company_id"))))) AND (("template_id" IS NULL) OR (EXISTS ( SELECT 1
   FROM "public"."proposal_templates" "t"
  WHERE (("t"."id" = "proposals"."template_id") AND ("t"."company_id" = "proposals"."company_id"))))) AND (("measurement_record_id" IS NULL) OR (EXISTS ( SELECT 1
   FROM "public"."measurement_records" "m"
  WHERE (("m"."id" = "proposals"."measurement_record_id") AND ("m"."company_id" = "proposals"."company_id"))))) AND (("pricing_policy_id" IS NULL) OR (EXISTS ( SELECT 1
   FROM "public"."company_pricing_policies" "p"
  WHERE (("p"."id" = "proposals"."pricing_policy_id") AND ("p"."company_id" = "proposals"."company_id")))))));



CREATE POLICY "proposals_select_company_scope" ON "public"."proposals" FOR SELECT USING (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))));



CREATE POLICY "proposals_update_company_scope" ON "public"."proposals" FOR UPDATE USING (("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"())))) WITH CHECK ((("company_id" IN ( SELECT "company_memberships"."company_id"
   FROM "public"."company_memberships"
  WHERE ("company_memberships"."user_id" = "auth"."uid"()))) AND (("job_id" IS NULL) OR (EXISTS ( SELECT 1
   FROM "public"."jobs" "j"
  WHERE (("j"."id" = "proposals"."job_id") AND ("j"."company_id" = "proposals"."company_id"))))) AND (("template_id" IS NULL) OR (EXISTS ( SELECT 1
   FROM "public"."proposal_templates" "t"
  WHERE (("t"."id" = "proposals"."template_id") AND ("t"."company_id" = "proposals"."company_id"))))) AND (("measurement_record_id" IS NULL) OR (EXISTS ( SELECT 1
   FROM "public"."measurement_records" "m"
  WHERE (("m"."id" = "proposals"."measurement_record_id") AND ("m"."company_id" = "proposals"."company_id"))))) AND (("pricing_policy_id" IS NULL) OR (EXISTS ( SELECT 1
   FROM "public"."company_pricing_policies" "p"
  WHERE (("p"."id" = "proposals"."pricing_policy_id") AND ("p"."company_id" = "proposals"."company_id")))))));



ALTER TABLE "public"."service_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "service_items_delete_own_company" ON "public"."service_items" FOR DELETE TO "authenticated" USING (("company_id" IN ( SELECT "cm"."company_id"
   FROM "public"."company_memberships" "cm"
  WHERE ("cm"."user_id" = "auth"."uid"()))));



CREATE POLICY "service_items_insert_own_company" ON "public"."service_items" FOR INSERT TO "authenticated" WITH CHECK (("company_id" IN ( SELECT "cm"."company_id"
   FROM "public"."company_memberships" "cm"
  WHERE ("cm"."user_id" = "auth"."uid"()))));



CREATE POLICY "service_items_select_own_company" ON "public"."service_items" FOR SELECT TO "authenticated" USING (("company_id" IN ( SELECT "cm"."company_id"
   FROM "public"."company_memberships" "cm"
  WHERE ("cm"."user_id" = "auth"."uid"()))));



CREATE POLICY "service_items_update_own_company" ON "public"."service_items" FOR UPDATE TO "authenticated" USING (("company_id" IN ( SELECT "cm"."company_id"
   FROM "public"."company_memberships" "cm"
  WHERE ("cm"."user_id" = "auth"."uid"())))) WITH CHECK (("company_id" IN ( SELECT "cm"."company_id"
   FROM "public"."company_memberships" "cm"
  WHERE ("cm"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."subscriptions" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































REVOKE ALL ON FUNCTION "public"."acknowledge_proposal_acceptance_attention_v1"("p_payload" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."acknowledge_proposal_acceptance_attention_v1"("p_payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."acknowledge_proposal_acceptance_attention_v1"("p_payload" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."bind_job_payment_checkout_session_v1"("p_payload" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."bind_job_payment_checkout_session_v1"("p_payload" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."cancel_job_payment_request_v1"("p_payload" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cancel_job_payment_request_v1"("p_payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cancel_job_payment_request_v1"("p_payload" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."canonical_job_stage_from_row"("p_stage" "text", "p_status" "text", "p_archived" boolean, "p_active_proposal_id" "uuid", "p_latest_proposal_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."canonical_job_stage_from_row"("p_stage" "text", "p_status" "text", "p_archived" boolean, "p_active_proposal_id" "uuid", "p_latest_proposal_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."canonical_job_stage_from_row"("p_stage" "text", "p_status" "text", "p_archived" boolean, "p_active_proposal_id" "uuid", "p_latest_proposal_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."canonical_job_stage_from_row"("p_stage" "text", "p_status" "text", "p_archived" boolean, "p_active_proposal_id" "uuid", "p_latest_proposal_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."change_job_disposition_v1"("p_payload" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."change_job_disposition_v1"("p_payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."change_job_disposition_v1"("p_payload" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."classify_proposal_acceptance_guard_v1"("p_company_id" "uuid", "p_job_id" "uuid", "p_proposal_id" "uuid", "p_proposal_version_id" "uuid", "p_proposal_option_id" "uuid", "p_acceptance_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."classify_proposal_acceptance_guard_v1"("p_company_id" "uuid", "p_job_id" "uuid", "p_proposal_id" "uuid", "p_proposal_version_id" "uuid", "p_proposal_option_id" "uuid", "p_acceptance_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."collect_job_payment_v1"("p_payload" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."collect_job_payment_v1"("p_payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."collect_job_payment_v1"("p_payload" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."companies_timezone_guard"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."companies_timezone_guard"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."company_payment_accounts_row_guard"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."company_payment_accounts_row_guard"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."company_payment_settings_row_guard"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."company_payment_settings_row_guard"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."complete_job_work_v1"("p_payload" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."complete_job_work_v1"("p_payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."complete_job_work_v1"("p_payload" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."confirm_proposal_acceptance_v1"("p_payload" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."confirm_proposal_acceptance_v1"("p_payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."confirm_proposal_acceptance_v1"("p_payload" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_job_payment_request_v1"("p_payload" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_job_payment_request_v1"("p_payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_job_payment_request_v1"("p_payload" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."customers_prevent_company_id_change"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."customers_prevent_company_id_change"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."ensure_company_payment_settings_v1"("p_company_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ensure_company_payment_settings_v1"("p_company_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_company_payment_settings_v1"("p_company_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."job_attachments_before_write"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."job_attachments_before_write"() TO "service_role";



GRANT ALL ON FUNCTION "public"."job_attention_items_row_guard"() TO "anon";
GRANT ALL ON FUNCTION "public"."job_attention_items_row_guard"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."job_attention_items_row_guard"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."job_lifecycle_apply_approved_from_unschedule_v1"("p_company_id" "uuid", "p_job_id" "uuid", "p_actor_user_id" "uuid", "p_schedule_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."job_lifecycle_apply_approved_from_unschedule_v1"("p_company_id" "uuid", "p_job_id" "uuid", "p_actor_user_id" "uuid", "p_schedule_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."job_lifecycle_apply_proposal_approved_from_acceptance_v1"("p_company_id" "uuid", "p_job_id" "uuid", "p_acceptance_id" "uuid", "p_actor_user_id" "uuid", "p_mode" "text", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."job_lifecycle_apply_proposal_approved_from_acceptance_v1"("p_company_id" "uuid", "p_job_id" "uuid", "p_acceptance_id" "uuid", "p_actor_user_id" "uuid", "p_mode" "text", "p_reason" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."job_lifecycle_apply_scheduled_from_work_v1"("p_company_id" "uuid", "p_job_id" "uuid", "p_actor_user_id" "uuid", "p_schedule_id" "uuid", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."job_lifecycle_apply_scheduled_from_work_v1"("p_company_id" "uuid", "p_job_id" "uuid", "p_actor_user_id" "uuid", "p_schedule_id" "uuid", "p_reason" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."job_lifecycle_has_proposal_truth"("p_company_id" "uuid", "p_job_id" "uuid", "p_proposal_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."job_lifecycle_has_proposal_truth"("p_company_id" "uuid", "p_job_id" "uuid", "p_proposal_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."job_lifecycle_insert_activity"("p_company_id" "uuid", "p_job_id" "uuid", "p_event_type" "text", "p_actor_user_id" "uuid", "p_payload" "jsonb", "p_occurred_at" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."job_lifecycle_insert_activity"("p_company_id" "uuid", "p_job_id" "uuid", "p_event_type" "text", "p_actor_user_id" "uuid", "p_payload" "jsonb", "p_occurred_at" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."job_payment_additional_deposit_cents_v1"("p_mode" "text", "p_percent_bps" integer, "p_fixed_cents" integer, "p_accepted_total_cents" integer, "p_net_received_cents" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."job_payment_additional_deposit_cents_v1"("p_mode" "text", "p_percent_bps" integer, "p_fixed_cents" integer, "p_accepted_total_cents" integer, "p_net_received_cents" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."job_payment_additional_deposit_cents_v1"("p_mode" "text", "p_percent_bps" integer, "p_fixed_cents" integer, "p_accepted_total_cents" integer, "p_net_received_cents" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."job_payment_canonical_capture_identity_v1"("p_provider" "text", "p_provider_payment_intent_id" "text", "p_provider_event_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."job_payment_canonical_capture_identity_v1"("p_provider" "text", "p_provider_payment_intent_id" "text", "p_provider_event_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."job_payment_canonical_capture_identity_v1"("p_provider" "text", "p_provider_payment_intent_id" "text", "p_provider_event_id" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."job_payment_capture_refundable_cents_v1"("p_company_id" "uuid", "p_canonical_capture_transaction_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."job_payment_capture_refundable_cents_v1"("p_company_id" "uuid", "p_canonical_capture_transaction_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."job_payment_capture_refundable_cents_v1"("p_company_id" "uuid", "p_canonical_capture_transaction_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."job_payment_collectible_cents_v1"("p_company_id" "uuid", "p_job_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."job_payment_collectible_cents_v1"("p_company_id" "uuid", "p_job_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."job_payment_collectible_cents_v1"("p_company_id" "uuid", "p_job_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."job_payment_current_contractual_total_cents_v1"("p_company_id" "uuid", "p_job_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."job_payment_current_contractual_total_cents_v1"("p_company_id" "uuid", "p_job_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."job_payment_current_contractual_total_cents_v1"("p_company_id" "uuid", "p_job_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."job_payment_gross_received_cents_v1"("p_company_id" "uuid", "p_job_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."job_payment_gross_received_cents_v1"("p_company_id" "uuid", "p_job_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."job_payment_gross_received_cents_v1"("p_company_id" "uuid", "p_job_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."job_payment_kind_net_paid_cents_v1"("p_company_id" "uuid", "p_acceptance_id" "uuid", "p_kind" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."job_payment_kind_net_paid_cents_v1"("p_company_id" "uuid", "p_acceptance_id" "uuid", "p_kind" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."job_payment_kind_net_paid_cents_v1"("p_company_id" "uuid", "p_acceptance_id" "uuid", "p_kind" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."job_payment_net_paid_cents_v1"("p_company_id" "uuid", "p_acceptance_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."job_payment_net_paid_cents_v1"("p_company_id" "uuid", "p_acceptance_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."job_payment_net_paid_cents_v1"("p_company_id" "uuid", "p_acceptance_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."job_payment_net_received_cents_v1"("p_company_id" "uuid", "p_job_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."job_payment_net_received_cents_v1"("p_company_id" "uuid", "p_job_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."job_payment_net_received_cents_v1"("p_company_id" "uuid", "p_job_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."job_payment_requests" TO "service_role";
GRANT SELECT ON TABLE "public"."job_payment_requests" TO "authenticated";



REVOKE ALL ON FUNCTION "public"."job_payment_open_failed_attention_v1"("p_request" "public"."job_payment_requests") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."job_payment_open_failed_attention_v1"("p_request" "public"."job_payment_requests") TO "service_role";



REVOKE ALL ON FUNCTION "public"."job_payment_open_not_connected_attention_v1"("p_company_id" "uuid", "p_job_id" "uuid", "p_proposal_id" "uuid", "p_proposal_version_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."job_payment_open_not_connected_attention_v1"("p_company_id" "uuid", "p_job_id" "uuid", "p_proposal_id" "uuid", "p_proposal_version_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."job_payment_refund_events_row_guard_v1"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."job_payment_refund_events_row_guard_v1"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."job_payment_refund_status_rank_v1"("p_status" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."job_payment_refund_status_rank_v1"("p_status" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."job_payment_refunded_cents_v1"("p_company_id" "uuid", "p_job_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."job_payment_refunded_cents_v1"("p_company_id" "uuid", "p_job_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."job_payment_refunded_cents_v1"("p_company_id" "uuid", "p_job_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."job_payment_refunds_row_guard_v1"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."job_payment_refunds_row_guard_v1"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."job_payment_remaining_cents_v1"("p_company_id" "uuid", "p_job_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."job_payment_remaining_cents_v1"("p_company_id" "uuid", "p_job_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."job_payment_remaining_cents_v1"("p_company_id" "uuid", "p_job_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."job_payment_requests_row_guard"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."job_payment_requests_row_guard"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."job_payment_resolve_attention_v1"("p_company_id" "uuid", "p_dedupe_key" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."job_payment_resolve_attention_v1"("p_company_id" "uuid", "p_dedupe_key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."job_payment_resolve_deposit_obligation_cents_v1"("p_mode" "text", "p_percent_bps" integer, "p_fixed_cents" integer, "p_accepted_total_cents" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."job_payment_resolve_deposit_obligation_cents_v1"("p_mode" "text", "p_percent_bps" integer, "p_fixed_cents" integer, "p_accepted_total_cents" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."job_payment_resolve_deposit_obligation_cents_v1"("p_mode" "text", "p_percent_bps" integer, "p_fixed_cents" integer, "p_accepted_total_cents" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."job_payment_snapshot_stage_v1"("p_company_id" "uuid", "p_job_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."job_payment_snapshot_stage_v1"("p_company_id" "uuid", "p_job_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."job_payment_snapshot_stage_v1"("p_company_id" "uuid", "p_job_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."job_payment_transactions_row_guard"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."job_payment_transactions_row_guard"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."job_payment_uncovered_deposit_cents_v1"("p_company_id" "uuid", "p_job_id" "uuid", "p_mode" "text", "p_percent_bps" integer, "p_fixed_cents" integer, "p_canonical_total_cents" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."job_payment_uncovered_deposit_cents_v1"("p_company_id" "uuid", "p_job_id" "uuid", "p_mode" "text", "p_percent_bps" integer, "p_fixed_cents" integer, "p_canonical_total_cents" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."job_payment_uncovered_deposit_cents_v1"("p_company_id" "uuid", "p_job_id" "uuid", "p_mode" "text", "p_percent_bps" integer, "p_fixed_cents" integer, "p_canonical_total_cents" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."job_schedule_derive_range"("p_timezone" "text", "p_all_day" boolean, "p_starts_on" "date", "p_ends_on" "date", "p_start_local_time" time without time zone, "p_end_local_time" time without time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."job_schedule_derive_range"("p_timezone" "text", "p_all_day" boolean, "p_starts_on" "date", "p_ends_on" "date", "p_start_local_time" time without time zone, "p_end_local_time" time without time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."job_schedule_derive_range"("p_timezone" "text", "p_all_day" boolean, "p_starts_on" "date", "p_ends_on" "date", "p_start_local_time" time without time zone, "p_end_local_time" time without time zone) TO "service_role";



REVOKE ALL ON FUNCTION "public"."job_schedule_is_iana_timezone"("p_tz" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."job_schedule_is_iana_timezone"("p_tz" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."job_schedule_is_iana_timezone"("p_tz" "text") TO "service_role";



GRANT ALL ON TABLE "public"."job_schedules" TO "service_role";
GRANT SELECT ON TABLE "public"."job_schedules" TO "authenticated";



REVOKE ALL ON FUNCTION "public"."job_schedule_row_json"("p_row" "public"."job_schedules") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."job_schedule_row_json"("p_row" "public"."job_schedules") TO "service_role";



REVOKE ALL ON FUNCTION "public"."job_schedule_validate_window"("p_timezone" "text", "p_all_day" boolean, "p_starts_on" "date", "p_ends_on" "date", "p_start_local_time" time without time zone, "p_end_local_time" time without time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."job_schedule_validate_window"("p_timezone" "text", "p_all_day" boolean, "p_starts_on" "date", "p_ends_on" "date", "p_start_local_time" time without time zone, "p_end_local_time" time without time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."job_schedule_validate_window"("p_timezone" "text", "p_all_day" boolean, "p_starts_on" "date", "p_ends_on" "date", "p_start_local_time" time without time zone, "p_end_local_time" time without time zone) TO "service_role";



REVOKE ALL ON FUNCTION "public"."job_schedule_window_json"("p_all_day" boolean, "p_starts_on" "date", "p_ends_on" "date", "p_start_local_time" time without time zone, "p_end_local_time" time without time zone, "p_timezone" "text", "p_notes" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."job_schedule_window_json"("p_all_day" boolean, "p_starts_on" "date", "p_ends_on" "date", "p_start_local_time" time without time zone, "p_end_local_time" time without time zone, "p_timezone" "text", "p_notes" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."job_schedule_windows_equal"("p_a" "public"."job_schedules", "p_all_day" boolean, "p_starts_on" "date", "p_ends_on" "date", "p_start_local_time" time without time zone, "p_end_local_time" time without time zone, "p_notes" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."job_schedule_windows_equal"("p_a" "public"."job_schedules", "p_all_day" boolean, "p_starts_on" "date", "p_ends_on" "date", "p_start_local_time" time without time zone, "p_end_local_time" time without time zone, "p_notes" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."job_schedules_before_write"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."job_schedules_before_write"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."job_tasks_before_write"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."job_tasks_before_write"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."jobs_job_complete_guard"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."jobs_job_complete_guard"() TO "service_role";



GRANT ALL ON FUNCTION "public"."jobs_lifecycle_after_insert"() TO "anon";
GRANT ALL ON FUNCTION "public"."jobs_lifecycle_after_insert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."jobs_lifecycle_after_insert"() TO "service_role";



GRANT ALL ON FUNCTION "public"."jobs_lifecycle_after_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."jobs_lifecycle_after_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."jobs_lifecycle_after_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."jobs_lifecycle_before_insert"() TO "anon";
GRANT ALL ON FUNCTION "public"."jobs_lifecycle_before_insert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."jobs_lifecycle_before_insert"() TO "service_role";



GRANT ALL ON FUNCTION "public"."jobs_lifecycle_before_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."jobs_lifecycle_before_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."jobs_lifecycle_before_update"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."jobs_production_start_guard"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."jobs_production_start_guard"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."mark_job_attention_read_v1"("p_attention_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mark_job_attention_read_v1"("p_attention_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_job_attention_read_v1"("p_attention_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."mint_and_supersede_proposal_public_access_token_v1"("p_token_hash" "text", "p_token_prefix" "text", "p_company_id" "uuid", "p_proposal_id" "uuid", "p_proposal_version_id" "uuid", "p_expires_at" timestamp with time zone, "p_recipient_email_hash" "text", "p_recipient_phone_hash" "text", "p_metadata_json" "jsonb", "p_created_by" "uuid", "p_purpose" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mint_and_supersede_proposal_public_access_token_v1"("p_token_hash" "text", "p_token_prefix" "text", "p_company_id" "uuid", "p_proposal_id" "uuid", "p_proposal_version_id" "uuid", "p_expires_at" timestamp with time zone, "p_recipient_email_hash" "text", "p_recipient_phone_hash" "text", "p_metadata_json" "jsonb", "p_created_by" "uuid", "p_purpose" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."mint_proposal_public_access_token_v1"("p_token_hash" "text", "p_token_prefix" "text", "p_company_id" "uuid", "p_proposal_id" "uuid", "p_proposal_version_id" "uuid", "p_expires_at" timestamp with time zone, "p_recipient_email_hash" "text", "p_recipient_phone_hash" "text", "p_metadata_json" "jsonb", "p_created_by" "uuid", "p_purpose" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mint_proposal_public_access_token_v1"("p_token_hash" "text", "p_token_prefix" "text", "p_company_id" "uuid", "p_proposal_id" "uuid", "p_proposal_version_id" "uuid", "p_expires_at" timestamp with time zone, "p_recipient_email_hash" "text", "p_recipient_phone_hash" "text", "p_metadata_json" "jsonb", "p_created_by" "uuid", "p_purpose" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."normalize_property_address_v1"("p_line1" "text", "p_line2" "text", "p_city" "text", "p_state" "text", "p_zip" "text", "p_formatted" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."normalize_property_address_v1"("p_line1" "text", "p_line2" "text", "p_city" "text", "p_state" "text", "p_zip" "text", "p_formatted" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_property_address_v1"("p_line1" "text", "p_line2" "text", "p_city" "text", "p_state" "text", "p_zip" "text", "p_formatted" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."normalize_property_line_v1"("p_line" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."normalize_property_line_v1"("p_line" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_property_line_v1"("p_line" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."normalize_property_token_v1"("p_token" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."normalize_property_token_v1"("p_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_property_token_v1"("p_token" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."open_job_deposit_from_acceptance_v1"("p_payload" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."open_job_deposit_from_acceptance_v1"("p_payload" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."payments_prevent_company_id_change"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."payments_prevent_company_id_change"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."persist_draft_pricing_refresh_v1"("p_payload" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."persist_draft_pricing_refresh_v1"("p_payload" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."persist_draft_pricing_refresh_v1"("p_payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."persist_draft_pricing_refresh_v1"("p_payload" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."persist_draft_proposal_create_v1"("p_payload" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."persist_draft_proposal_create_v1"("p_payload" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."persist_draft_proposal_create_v1"("p_payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."persist_draft_proposal_create_v1"("p_payload" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."persist_proposal_send_freeze_v1"("p_payload" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."persist_proposal_send_freeze_v1"("p_payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."persist_proposal_send_freeze_v1"("p_payload" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."project_proposal_acceptance_attention_v1"("p_acceptance_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."project_proposal_acceptance_attention_v1"("p_acceptance_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."project_proposal_customer_request_attention_v1"("p_request_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."project_proposal_customer_request_attention_v1"("p_request_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."properties_prevent_company_id_change"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."properties_prevent_company_id_change"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."proposal_acceptance_contract_option_v1"("p_company_id" "uuid", "p_acceptance_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."proposal_acceptance_contract_option_v1"("p_company_id" "uuid", "p_acceptance_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."proposal_acceptance_contract_option_v1"("p_company_id" "uuid", "p_acceptance_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."proposal_acceptance_contract_total_cents_v1"("p_company_id" "uuid", "p_acceptance_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."proposal_acceptance_contract_total_cents_v1"("p_company_id" "uuid", "p_acceptance_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."proposal_acceptance_contract_total_cents_v1"("p_company_id" "uuid", "p_acceptance_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."proposal_acceptance_frozen_selected_option_v1"("p_company_id" "uuid", "p_proposal_version_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."proposal_acceptance_frozen_selected_option_v1"("p_company_id" "uuid", "p_proposal_version_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."proposal_acceptances_row_guard"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."proposal_acceptances_row_guard"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."proposal_apply_draft_content_changed_at_backfill_v1"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."proposal_apply_draft_content_changed_at_backfill_v1"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."proposal_assert_public_access_token_active_v1"("p_token_hash" "text") FROM PUBLIC;



GRANT ALL ON FUNCTION "public"."proposal_customer_activity_row_guard"() TO "anon";
GRANT ALL ON FUNCTION "public"."proposal_customer_activity_row_guard"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."proposal_customer_activity_row_guard"() TO "service_role";



GRANT ALL ON FUNCTION "public"."proposal_customer_requests_row_guard"() TO "anon";
GRANT ALL ON FUNCTION "public"."proposal_customer_requests_row_guard"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."proposal_customer_requests_row_guard"() TO "service_role";



GRANT ALL ON FUNCTION "public"."proposal_delivery_attempt_forbidden_metadata_keys"("p_json" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."proposal_delivery_attempt_forbidden_metadata_keys"("p_json" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."proposal_delivery_attempt_forbidden_metadata_keys"("p_json" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."proposal_delivery_attempt_row_guard"() TO "anon";
GRANT ALL ON FUNCTION "public"."proposal_delivery_attempt_row_guard"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."proposal_delivery_attempt_row_guard"() TO "service_role";



GRANT ALL ON FUNCTION "public"."proposal_draft_content_backfill_package_key_v1"("p_source_template_option_id" "uuid", "p_sort_order" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."proposal_draft_content_backfill_package_key_v1"("p_source_template_option_id" "uuid", "p_sort_order" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."proposal_draft_content_backfill_package_key_v1"("p_source_template_option_id" "uuid", "p_sort_order" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."proposal_draft_content_changed_at_backfill_stamp_v1"("p_company_id" "uuid", "p_proposal_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."proposal_draft_content_changed_at_backfill_stamp_v1"("p_company_id" "uuid", "p_proposal_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."proposal_draft_content_identity_echo_slice_v1"("p_echo" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."proposal_draft_content_identity_echo_slice_v1"("p_echo" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."proposal_draft_content_identity_echo_slice_v1"("p_echo" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."proposal_draft_vs_sent_graph_outcome_v1"("p_company_id" "uuid", "p_proposal_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."proposal_draft_vs_sent_graph_outcome_v1"("p_company_id" "uuid", "p_proposal_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."proposal_forbidden_token_json_keys"("p_json" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."proposal_forbidden_token_json_keys"("p_json" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."proposal_forbidden_token_json_keys"("p_json" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."proposal_immutable_version_child_guard"() TO "anon";
GRANT ALL ON FUNCTION "public"."proposal_immutable_version_child_guard"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."proposal_immutable_version_child_guard"() TO "service_role";



GRANT ALL ON FUNCTION "public"."proposal_immutable_version_row_guard"() TO "anon";
GRANT ALL ON FUNCTION "public"."proposal_immutable_version_row_guard"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."proposal_immutable_version_row_guard"() TO "service_role";



GRANT ALL ON FUNCTION "public"."proposal_line_items_touch_draft_content_v1"() TO "anon";
GRANT ALL ON FUNCTION "public"."proposal_line_items_touch_draft_content_v1"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."proposal_line_items_touch_draft_content_v1"() TO "service_role";



GRANT ALL ON FUNCTION "public"."proposal_options_touch_draft_content_v1"() TO "anon";
GRANT ALL ON FUNCTION "public"."proposal_options_touch_draft_content_v1"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."proposal_options_touch_draft_content_v1"() TO "service_role";



GRANT ALL ON FUNCTION "public"."proposal_pages_touch_draft_content_v1"() TO "anon";
GRANT ALL ON FUNCTION "public"."proposal_pages_touch_draft_content_v1"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."proposal_pages_touch_draft_content_v1"() TO "service_role";



GRANT ALL ON FUNCTION "public"."proposal_payment_terms_guard_immutable_v1"() TO "anon";
GRANT ALL ON FUNCTION "public"."proposal_payment_terms_guard_immutable_v1"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."proposal_payment_terms_guard_immutable_v1"() TO "service_role";



GRANT ALL ON FUNCTION "public"."proposal_payment_terms_on_version_insert_v1"() TO "anon";
GRANT ALL ON FUNCTION "public"."proposal_payment_terms_on_version_insert_v1"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."proposal_payment_terms_on_version_insert_v1"() TO "service_role";



GRANT ALL ON FUNCTION "public"."proposal_payment_terms_seed_from_settings_v1"("p_company_id" "uuid", "p_proposal_id" "uuid", "p_version_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."proposal_payment_terms_seed_from_settings_v1"("p_company_id" "uuid", "p_proposal_id" "uuid", "p_version_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."proposal_payment_terms_seed_from_settings_v1"("p_company_id" "uuid", "p_proposal_id" "uuid", "p_version_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."proposal_public_access_token_row_guard"() TO "anon";
GRANT ALL ON FUNCTION "public"."proposal_public_access_token_row_guard"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."proposal_public_access_token_row_guard"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."proposal_public_option_choice_current_v1"("p_company_id" "uuid", "p_proposal_id" "uuid", "p_proposal_version_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."proposal_public_option_choice_current_v1"("p_company_id" "uuid", "p_proposal_id" "uuid", "p_proposal_version_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."proposal_public_option_choices_row_guard"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."proposal_public_option_choices_row_guard"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."proposal_resolve_customer_chosen_option_v1"("p_company_id" "uuid", "p_proposal_version_id" "uuid", "p_option_key" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."proposal_resolve_customer_chosen_option_v1"("p_company_id" "uuid", "p_proposal_version_id" "uuid", "p_option_key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."proposal_scope_decisions_touch_draft_content_v1"() TO "anon";
GRANT ALL ON FUNCTION "public"."proposal_scope_decisions_touch_draft_content_v1"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."proposal_scope_decisions_touch_draft_content_v1"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."proposal_signature_mark_error_v1"("p_mark" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."proposal_signature_mark_error_v1"("p_mark" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."proposal_signatures_row_guard"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."proposal_signatures_row_guard"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."proposal_touch_draft_content_changed_at_internal_v1"("p_company_id" "uuid", "p_proposal_id" "uuid") FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."proposal_touch_draft_content_from_version_id_v1"("p_company_id" "uuid", "p_proposal_version_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."proposal_touch_draft_content_from_version_id_v1"("p_company_id" "uuid", "p_proposal_version_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."proposal_upgrade_choices_touch_draft_content_v1"() TO "anon";
GRANT ALL ON FUNCTION "public"."proposal_upgrade_choices_touch_draft_content_v1"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."proposal_upgrade_choices_touch_draft_content_v1"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."proposal_version_is_current_mutable_draft_v1"("p_company_id" "uuid", "p_proposal_version_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."proposal_version_is_current_mutable_draft_v1"("p_company_id" "uuid", "p_proposal_version_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."proposal_versions_touch_draft_content_v1"() TO "anon";
GRANT ALL ON FUNCTION "public"."proposal_versions_touch_draft_content_v1"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."proposal_versions_touch_draft_content_v1"() TO "service_role";



GRANT ALL ON FUNCTION "public"."proposals_guard_draft_content_changed_at_v1"() TO "anon";
GRANT ALL ON FUNCTION "public"."proposals_guard_draft_content_changed_at_v1"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."proposals_guard_draft_content_changed_at_v1"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."reconcile_job_payment_refund_result_v1"("p_payload" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reconcile_job_payment_refund_result_v1"("p_payload" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."record_job_activity_v1"("p_payload" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."record_job_activity_v1"("p_payload" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."record_job_payment_provider_event_v1"("p_payload" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."record_job_payment_provider_event_v1"("p_payload" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."record_job_payment_refund_event_v1"("p_payload" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."record_job_payment_refund_event_v1"("p_payload" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."record_proposal_acceptance_v1"("p_token_hash" "text", "p_accepted_by_name" "text", "p_accepted_by_email" "text", "p_payload_json" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."record_proposal_acceptance_v1"("p_token_hash" "text", "p_accepted_by_name" "text", "p_accepted_by_email" "text", "p_payload_json" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."record_proposal_customer_request_v1"("p_token_hash" "text", "p_intent" "text", "p_requested_option_id" "uuid", "p_message" "text", "p_customer_name" "text", "p_customer_email" "text", "p_customer_phone" "text", "p_payload_json" "jsonb", "p_submission_key" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."record_proposal_customer_request_v1"("p_token_hash" "text", "p_intent" "text", "p_requested_option_id" "uuid", "p_message" "text", "p_customer_name" "text", "p_customer_email" "text", "p_customer_phone" "text", "p_payload_json" "jsonb", "p_submission_key" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."record_proposal_customer_view_v1"("p_token_hash" "text", "p_ip_hash" "text", "p_user_agent" "text", "p_referrer_host" "text", "p_payload_json" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."record_proposal_customer_view_v1"("p_token_hash" "text", "p_ip_hash" "text", "p_user_agent" "text", "p_referrer_host" "text", "p_payload_json" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."record_proposal_public_option_choice_v1"("p_token_hash" "text", "p_option_key" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."record_proposal_public_option_choice_v1"("p_token_hash" "text", "p_option_key" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."record_proposal_signature_v1"("p_token_hash" "text", "p_signer_printed_name" "text", "p_signer_email" "text", "p_drawn_mark_json" "jsonb", "p_payload_json" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."record_proposal_signature_v1"("p_token_hash" "text", "p_signer_printed_name" "text", "p_signer_email" "text", "p_drawn_mark_json" "jsonb", "p_payload_json" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."reschedule_job_v1"("p_payload" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reschedule_job_v1"("p_payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reschedule_job_v1"("p_payload" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."reserve_job_payment_refund_v1"("p_payload" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reserve_job_payment_refund_v1"("p_payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reserve_job_payment_refund_v1"("p_payload" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."resolve_proposal_public_access_token_v1"("p_token_hash" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."resolve_proposal_public_access_token_v1"("p_token_hash" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."resolve_public_job_payment_checkout_v1"("p_token_hash" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."resolve_public_job_payment_checkout_v1"("p_token_hash" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."schedule_job_v1"("p_payload" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."schedule_job_v1"("p_payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."schedule_job_v1"("p_payload" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."search_company_customers_v1"("p_query" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."search_company_customers_v1"("p_query" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_company_customers_v1"("p_query" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."search_company_jobs_v1"("p_query" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."search_company_jobs_v1"("p_query" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_company_jobs_v1"("p_query" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."search_company_properties_v1"("p_query" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."search_company_properties_v1"("p_query" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_company_properties_v1"("p_query" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."search_company_workspace_v1"("p_query" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."search_company_workspace_v1"("p_query" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_company_workspace_v1"("p_query" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_company_timezone_v1"("p_payload" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_company_timezone_v1"("p_payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_company_timezone_v1"("p_payload" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_job_payment_settled_method_v1"("p_payload" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_job_payment_settled_method_v1"("p_payload" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."start_job_work_v1"("p_payload" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."start_job_work_v1"("p_payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."start_job_work_v1"("p_payload" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."transition_job_stage_v1"("p_payload" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."transition_job_stage_v1"("p_payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."transition_job_stage_v1"("p_payload" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."unschedule_job_v1"("p_payload" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."unschedule_job_v1"("p_payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unschedule_job_v1"("p_payload" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_proposal_customer_request_status_v1"("p_request_id" "uuid", "p_status" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_proposal_customer_request_status_v1"("p_request_id" "uuid", "p_status" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_proposal_customer_request_status_v1"("p_request_id" "uuid", "p_status" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."upsert_company_payment_account_from_provider_v1"("p_payload" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."upsert_company_payment_account_from_provider_v1"("p_payload" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."upsert_company_payment_settings_v1"("p_payload" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."upsert_company_payment_settings_v1"("p_payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_company_payment_settings_v1"("p_payload" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."upsert_draft_proposal_payment_terms_v1"("p_payload" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."upsert_draft_proposal_payment_terms_v1"("p_payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_draft_proposal_payment_terms_v1"("p_payload" "jsonb") TO "service_role";


















GRANT ALL ON TABLE "public"."catalog_items" TO "anon";
GRANT ALL ON TABLE "public"."catalog_items" TO "authenticated";
GRANT ALL ON TABLE "public"."catalog_items" TO "service_role";



GRANT ALL ON TABLE "public"."companies" TO "anon";
GRANT ALL ON TABLE "public"."companies" TO "authenticated";
GRANT ALL ON TABLE "public"."companies" TO "service_role";



GRANT ALL ON TABLE "public"."company_branding_profiles" TO "anon";
GRANT ALL ON TABLE "public"."company_branding_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."company_branding_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."company_memberships" TO "anon";
GRANT ALL ON TABLE "public"."company_memberships" TO "authenticated";
GRANT ALL ON TABLE "public"."company_memberships" TO "service_role";



GRANT ALL ON TABLE "public"."company_payment_accounts" TO "service_role";
GRANT SELECT ON TABLE "public"."company_payment_accounts" TO "authenticated";



GRANT ALL ON TABLE "public"."company_payment_settings" TO "service_role";
GRANT SELECT ON TABLE "public"."company_payment_settings" TO "authenticated";



GRANT ALL ON TABLE "public"."company_pricing_policies" TO "anon";
GRANT ALL ON TABLE "public"."company_pricing_policies" TO "authenticated";
GRANT ALL ON TABLE "public"."company_pricing_policies" TO "service_role";



GRANT ALL ON TABLE "public"."company_template_preferences" TO "anon";
GRANT ALL ON TABLE "public"."company_template_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."company_template_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."customers" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."customers" TO "authenticated";



GRANT ALL ON TABLE "public"."estimates" TO "anon";
GRANT ALL ON TABLE "public"."estimates" TO "authenticated";
GRANT ALL ON TABLE "public"."estimates" TO "service_role";



GRANT ALL ON TABLE "public"."job_activity_events" TO "service_role";
GRANT SELECT ON TABLE "public"."job_activity_events" TO "authenticated";



GRANT ALL ON TABLE "public"."job_attachments" TO "authenticated";
GRANT ALL ON TABLE "public"."job_attachments" TO "service_role";



GRANT ALL ON TABLE "public"."job_attention_items" TO "service_role";
GRANT SELECT ON TABLE "public"."job_attention_items" TO "authenticated";



GRANT ALL ON TABLE "public"."job_attention_user_state" TO "service_role";
GRANT SELECT ON TABLE "public"."job_attention_user_state" TO "authenticated";



GRANT ALL ON TABLE "public"."job_payment_transactions" TO "service_role";
GRANT SELECT ON TABLE "public"."job_payment_transactions" TO "authenticated";



GRANT ALL ON TABLE "public"."job_payment_legacy_refund_review_v1" TO "service_role";
GRANT SELECT ON TABLE "public"."job_payment_legacy_refund_review_v1" TO "authenticated";



GRANT SELECT ON TABLE "public"."job_payment_refund_event_receipts" TO "authenticated";
GRANT SELECT ON TABLE "public"."job_payment_refund_event_receipts" TO "service_role";



GRANT SELECT ON TABLE "public"."job_payment_refunds" TO "authenticated";
GRANT SELECT ON TABLE "public"."job_payment_refunds" TO "service_role";



GRANT ALL ON TABLE "public"."job_tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."job_tasks" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."jobs" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."jobs" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."jobs" TO "service_role";



GRANT UPDATE("id") ON TABLE "public"."jobs" TO "authenticated";
GRANT UPDATE("id") ON TABLE "public"."jobs" TO "service_role";



GRANT UPDATE("company_id") ON TABLE "public"."jobs" TO "authenticated";
GRANT UPDATE("company_id") ON TABLE "public"."jobs" TO "service_role";



GRANT UPDATE("customer_id") ON TABLE "public"."jobs" TO "authenticated";
GRANT UPDATE("customer_id") ON TABLE "public"."jobs" TO "service_role";



GRANT UPDATE("job_name") ON TABLE "public"."jobs" TO "authenticated";
GRANT UPDATE("job_name") ON TABLE "public"."jobs" TO "service_role";



GRANT UPDATE("source") ON TABLE "public"."jobs" TO "authenticated";
GRANT UPDATE("source") ON TABLE "public"."jobs" TO "service_role";



GRANT UPDATE("priority") ON TABLE "public"."jobs" TO "authenticated";
GRANT UPDATE("priority") ON TABLE "public"."jobs" TO "service_role";



GRANT UPDATE("customer_name") ON TABLE "public"."jobs" TO "authenticated";
GRANT UPDATE("customer_name") ON TABLE "public"."jobs" TO "service_role";



GRANT UPDATE("customer_email") ON TABLE "public"."jobs" TO "authenticated";
GRANT UPDATE("customer_email") ON TABLE "public"."jobs" TO "service_role";



GRANT UPDATE("customer_phone") ON TABLE "public"."jobs" TO "authenticated";
GRANT UPDATE("customer_phone") ON TABLE "public"."jobs" TO "service_role";



GRANT UPDATE("address_line1") ON TABLE "public"."jobs" TO "authenticated";
GRANT UPDATE("address_line1") ON TABLE "public"."jobs" TO "service_role";



GRANT UPDATE("address_line2") ON TABLE "public"."jobs" TO "authenticated";
GRANT UPDATE("address_line2") ON TABLE "public"."jobs" TO "service_role";



GRANT UPDATE("address_city") ON TABLE "public"."jobs" TO "authenticated";
GRANT UPDATE("address_city") ON TABLE "public"."jobs" TO "service_role";



GRANT UPDATE("address_state") ON TABLE "public"."jobs" TO "authenticated";
GRANT UPDATE("address_state") ON TABLE "public"."jobs" TO "service_role";



GRANT UPDATE("address_zip") ON TABLE "public"."jobs" TO "authenticated";
GRANT UPDATE("address_zip") ON TABLE "public"."jobs" TO "service_role";



GRANT UPDATE("address_country") ON TABLE "public"."jobs" TO "authenticated";
GRANT UPDATE("address_country") ON TABLE "public"."jobs" TO "service_role";



GRANT UPDATE("address_formatted") ON TABLE "public"."jobs" TO "authenticated";
GRANT UPDATE("address_formatted") ON TABLE "public"."jobs" TO "service_role";



GRANT UPDATE("assigned_to") ON TABLE "public"."jobs" TO "authenticated";
GRANT UPDATE("assigned_to") ON TABLE "public"."jobs" TO "service_role";



GRANT UPDATE("created_by") ON TABLE "public"."jobs" TO "authenticated";
GRANT UPDATE("created_by") ON TABLE "public"."jobs" TO "service_role";



GRANT UPDATE("updated_by") ON TABLE "public"."jobs" TO "authenticated";
GRANT UPDATE("updated_by") ON TABLE "public"."jobs" TO "service_role";



GRANT UPDATE("notes") ON TABLE "public"."jobs" TO "authenticated";
GRANT UPDATE("notes") ON TABLE "public"."jobs" TO "service_role";



GRANT UPDATE("summary") ON TABLE "public"."jobs" TO "authenticated";
GRANT UPDATE("summary") ON TABLE "public"."jobs" TO "service_role";



GRANT UPDATE("last_activity_at") ON TABLE "public"."jobs" TO "authenticated";
GRANT UPDATE("last_activity_at") ON TABLE "public"."jobs" TO "service_role";



GRANT UPDATE("archived") ON TABLE "public"."jobs" TO "authenticated";
GRANT UPDATE("archived") ON TABLE "public"."jobs" TO "service_role";



GRANT UPDATE("deleted_at") ON TABLE "public"."jobs" TO "authenticated";
GRANT UPDATE("deleted_at") ON TABLE "public"."jobs" TO "service_role";



GRANT UPDATE("selected_measurement_id") ON TABLE "public"."jobs" TO "authenticated";
GRANT UPDATE("selected_measurement_id") ON TABLE "public"."jobs" TO "service_role";



GRANT UPDATE("active_proposal_id") ON TABLE "public"."jobs" TO "authenticated";
GRANT UPDATE("active_proposal_id") ON TABLE "public"."jobs" TO "service_role";



GRANT UPDATE("latest_estimate_id") ON TABLE "public"."jobs" TO "authenticated";
GRANT UPDATE("latest_estimate_id") ON TABLE "public"."jobs" TO "service_role";



GRANT UPDATE("latest_proposal_id") ON TABLE "public"."jobs" TO "authenticated";
GRANT UPDATE("latest_proposal_id") ON TABLE "public"."jobs" TO "service_role";



GRANT UPDATE("source_metadata") ON TABLE "public"."jobs" TO "authenticated";
GRANT UPDATE("source_metadata") ON TABLE "public"."jobs" TO "service_role";



GRANT UPDATE("custom_fields") ON TABLE "public"."jobs" TO "authenticated";
GRANT UPDATE("custom_fields") ON TABLE "public"."jobs" TO "service_role";



GRANT UPDATE("created_at") ON TABLE "public"."jobs" TO "authenticated";
GRANT UPDATE("created_at") ON TABLE "public"."jobs" TO "service_role";



GRANT UPDATE("updated_at") ON TABLE "public"."jobs" TO "authenticated";
GRANT UPDATE("updated_at") ON TABLE "public"."jobs" TO "service_role";



GRANT ALL ON TABLE "public"."measurement_records" TO "anon";
GRANT ALL ON TABLE "public"."measurement_records" TO "authenticated";
GRANT ALL ON TABLE "public"."measurement_records" TO "service_role";



GRANT ALL ON TABLE "public"."payments" TO "service_role";
GRANT SELECT,INSERT ON TABLE "public"."payments" TO "authenticated";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."properties" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."properties" TO "authenticated";



GRANT ALL ON TABLE "public"."proposal_acceptances" TO "service_role";
GRANT SELECT ON TABLE "public"."proposal_acceptances" TO "authenticated";



GRANT ALL ON TABLE "public"."proposal_customer_activity" TO "service_role";
GRANT SELECT ON TABLE "public"."proposal_customer_activity" TO "authenticated";



GRANT ALL ON TABLE "public"."proposal_customer_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."proposal_customer_requests" TO "service_role";



GRANT ALL ON TABLE "public"."proposal_delivery_attempts" TO "service_role";
GRANT SELECT ON TABLE "public"."proposal_delivery_attempts" TO "authenticated";



GRANT ALL ON TABLE "public"."proposal_events" TO "anon";
GRANT ALL ON TABLE "public"."proposal_events" TO "authenticated";
GRANT ALL ON TABLE "public"."proposal_events" TO "service_role";



GRANT ALL ON TABLE "public"."proposal_internal_summaries" TO "anon";
GRANT ALL ON TABLE "public"."proposal_internal_summaries" TO "authenticated";
GRANT ALL ON TABLE "public"."proposal_internal_summaries" TO "service_role";



GRANT ALL ON TABLE "public"."proposal_line_items" TO "anon";
GRANT ALL ON TABLE "public"."proposal_line_items" TO "authenticated";
GRANT ALL ON TABLE "public"."proposal_line_items" TO "service_role";



GRANT ALL ON TABLE "public"."proposal_option_scope_decisions" TO "anon";
GRANT ALL ON TABLE "public"."proposal_option_scope_decisions" TO "authenticated";
GRANT ALL ON TABLE "public"."proposal_option_scope_decisions" TO "service_role";



GRANT ALL ON TABLE "public"."proposal_option_upgrade_choices" TO "anon";
GRANT ALL ON TABLE "public"."proposal_option_upgrade_choices" TO "authenticated";
GRANT ALL ON TABLE "public"."proposal_option_upgrade_choices" TO "service_role";



GRANT ALL ON TABLE "public"."proposal_options" TO "anon";
GRANT ALL ON TABLE "public"."proposal_options" TO "authenticated";
GRANT ALL ON TABLE "public"."proposal_options" TO "service_role";



GRANT ALL ON TABLE "public"."proposal_pages" TO "anon";
GRANT ALL ON TABLE "public"."proposal_pages" TO "authenticated";
GRANT ALL ON TABLE "public"."proposal_pages" TO "service_role";



GRANT ALL ON TABLE "public"."proposal_public_access_tokens" TO "service_role";
GRANT SELECT ON TABLE "public"."proposal_public_access_tokens" TO "authenticated";



GRANT ALL ON TABLE "public"."proposal_public_option_choices" TO "authenticated";
GRANT ALL ON TABLE "public"."proposal_public_option_choices" TO "service_role";



GRANT ALL ON TABLE "public"."proposal_signatures" TO "service_role";
GRANT SELECT ON TABLE "public"."proposal_signatures" TO "authenticated";



GRANT ALL ON TABLE "public"."proposal_template_items" TO "anon";
GRANT ALL ON TABLE "public"."proposal_template_items" TO "authenticated";
GRANT ALL ON TABLE "public"."proposal_template_items" TO "service_role";



GRANT ALL ON TABLE "public"."proposal_template_options" TO "anon";
GRANT ALL ON TABLE "public"."proposal_template_options" TO "authenticated";
GRANT ALL ON TABLE "public"."proposal_template_options" TO "service_role";



GRANT ALL ON TABLE "public"."proposal_template_sections" TO "anon";
GRANT ALL ON TABLE "public"."proposal_template_sections" TO "authenticated";
GRANT ALL ON TABLE "public"."proposal_template_sections" TO "service_role";



GRANT ALL ON TABLE "public"."proposal_templates" TO "anon";
GRANT ALL ON TABLE "public"."proposal_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."proposal_templates" TO "service_role";



GRANT ALL ON TABLE "public"."proposal_version_payment_terms" TO "anon";
GRANT ALL ON TABLE "public"."proposal_version_payment_terms" TO "authenticated";
GRANT ALL ON TABLE "public"."proposal_version_payment_terms" TO "service_role";



GRANT ALL ON TABLE "public"."proposal_versions" TO "anon";
GRANT ALL ON TABLE "public"."proposal_versions" TO "authenticated";
GRANT ALL ON TABLE "public"."proposal_versions" TO "service_role";



GRANT ALL ON TABLE "public"."proposals" TO "anon";
GRANT ALL ON TABLE "public"."proposals" TO "authenticated";
GRANT ALL ON TABLE "public"."proposals" TO "service_role";



GRANT ALL ON TABLE "public"."service_items" TO "anon";
GRANT ALL ON TABLE "public"."service_items" TO "authenticated";
GRANT ALL ON TABLE "public"."service_items" TO "service_role";



GRANT ALL ON TABLE "public"."subscriptions" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































