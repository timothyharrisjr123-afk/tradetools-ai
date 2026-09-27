-- Phase 13B-C — employee SECURITY DEFINER RPCs authorize through the evaluator.
--
-- Each body is the Phase 13B-B definition (20260927181000) with exactly one change:
-- the interim legacy predicate private.role_has_capability_v1(cm.role, '<legacy>')
-- (or the bare role_is_valid_v1 active check) becomes private.member_can_v1 with the
-- canonical capability. The surrounding active-membership EXISTS still pins the
-- payload company to the actor's company; job-scopable operations pass v_job_id so
-- Field job grants and job-level rules are honoured. Codes, locks, and ACLs are
-- unchanged (CREATE OR REPLACE preserves grants).
--
-- Legacy split (blueprint §5.3):
--   payment_admin   -> payments.refund (refund reserve) | payments.configure (settings)
--   proposal_author -> proposals.write (customer requests, draft payment terms)
--                      scope_changes.write (create/update/void/decline)
--                      scope_changes.issue (propose, mint customer link)
-- Scope-change RPCs authorize through job_scope_change_member_ok_v1 (write) and
-- job_scope_change_author_ok_v1 (issue); both helpers are re-pointed below and
-- propose_job_scope_change_v1 moves from the write helper to the issue helper.

-- acknowledge_proposal_acceptance_attention_v1: active membership + jobs.approve
CREATE OR REPLACE FUNCTION public.acknowledge_proposal_acceptance_attention_v1(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      and cm.removed_at is null
      and private.member_can_v1('jobs.approve')
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
$function$;

-- confirm_proposal_acceptance_v1: active membership + jobs.approve
CREATE OR REPLACE FUNCTION public.confirm_proposal_acceptance_v1(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      and cm.removed_at is null
      and private.member_can_v1('jobs.approve')
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
$function$;

-- cancel_job_payment_request_v1: active membership + payments.request
CREATE OR REPLACE FUNCTION public.cancel_job_payment_request_v1(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      and cm.removed_at is null
      and private.member_can_v1('payments.request')
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
$function$;

-- create_job_payment_request_v1: active membership + payments.request
CREATE OR REPLACE FUNCTION public.create_job_payment_request_v1(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      and cm.removed_at is null
      and private.member_can_v1('payments.request')
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
    and a.is_current = true
    and a.connection_status = 'active'
    and a.onboarding_status = 'complete'
    and a.charges_enabled = true
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
$function$;

-- collect_job_payment_v1: active membership + payments.request
CREATE OR REPLACE FUNCTION public.collect_job_payment_v1(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      and cm.removed_at is null
      and private.member_can_v1('payments.request')
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
    and a.is_current = true
    and a.connection_status = 'active'
    and a.onboarding_status = 'complete'
    and a.charges_enabled = true
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
$function$;

-- reserve_job_payment_refund_v1: active membership + payments.refund
CREATE OR REPLACE FUNCTION public.reserve_job_payment_refund_v1(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      and cm.removed_at is null
      and private.member_can_v1('payments.refund')
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
$function$;

-- upsert_company_payment_settings_v1: active membership + payments.configure
CREATE OR REPLACE FUNCTION public.upsert_company_payment_settings_v1(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      and cm.removed_at is null
      and private.member_can_v1('payments.configure')
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
$function$;

-- ensure_company_payment_settings_v1: active membership + payments.configure | payments.request
CREATE OR REPLACE FUNCTION public.ensure_company_payment_settings_v1(p_company_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      and cm.removed_at is null
      and (private.member_can_v1('payments.configure') or private.member_can_v1('payments.request'))
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
$function$;

-- set_company_timezone_v1: active membership + company.manage
CREATE OR REPLACE FUNCTION public.set_company_timezone_v1(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      and cm.removed_at is null
      and private.member_can_v1('company.manage')
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
$function$;

-- schedule_job_v1: active membership + schedule.manage at the job
CREATE OR REPLACE FUNCTION public.schedule_job_v1(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      and cm.removed_at is null
      and private.member_can_v1('schedule.manage', v_job_id)
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
$function$;

-- reschedule_job_v1: active membership + schedule.manage at the job
CREATE OR REPLACE FUNCTION public.reschedule_job_v1(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      and cm.removed_at is null
      and private.member_can_v1('schedule.manage', v_job_id)
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
$function$;

-- unschedule_job_v1: active membership + schedule.manage at the job
CREATE OR REPLACE FUNCTION public.unschedule_job_v1(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      and cm.removed_at is null
      and private.member_can_v1('schedule.manage', v_job_id)
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
$function$;

-- start_job_work_v1: active membership + jobs.progress at the job
CREATE OR REPLACE FUNCTION public.start_job_work_v1(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      and cm.removed_at is null
      and private.member_can_v1('jobs.progress', v_job_id)
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
$function$;

-- complete_job_work_v1: active membership + jobs.progress at the job
CREATE OR REPLACE FUNCTION public.complete_job_work_v1(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      and cm.removed_at is null
      and private.member_can_v1('jobs.progress', v_job_id)
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
$function$;

-- change_job_disposition_v1: active membership + jobs.hold | jobs.finalize (route enforces the exact transition)
CREATE OR REPLACE FUNCTION public.change_job_disposition_v1(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      and cm.removed_at is null
      and (private.member_can_v1('jobs.hold') or private.member_can_v1('jobs.finalize'))
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
$function$;

-- change_job_property_v1: active membership + jobs.manage
CREATE OR REPLACE FUNCTION public.change_job_property_v1(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_company_id uuid;
  v_job_id uuid;
  v_existing_property_id uuid;
  v_line1 text;
  v_line2 text;
  v_city text;
  v_state text;
  v_zip text;
  v_formatted text;
  v_places_place_id text;
  v_member boolean := false;
  v_job public.jobs%rowtype;
  v_property public.properties%rowtype;
  v_resolved record;
  v_resolution text;
  v_now timestamptz := now();
  v_before_property_id uuid;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;

  begin
    v_company_id := nullif(p_payload->>'company_id', '')::uuid;
    v_job_id := nullif(p_payload->>'job_id', '')::uuid;
    v_existing_property_id := nullif(p_payload->>'property_id', '')::uuid;
    v_line1 := nullif(btrim(coalesce(p_payload->>'line1', '')), '');
    v_line2 := nullif(btrim(coalesce(p_payload->>'line2', '')), '');
    v_city := nullif(btrim(coalesce(p_payload->>'city', '')), '');
    v_state := nullif(btrim(coalesce(p_payload->>'state', '')), '');
    v_zip := nullif(btrim(coalesce(p_payload->>'zip', '')), '');
    v_formatted := nullif(btrim(coalesce(p_payload->>'formatted', '')), '');
    v_places_place_id := nullif(btrim(coalesce(p_payload->>'places_place_id', '')), '');
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
      and cm.removed_at is null
      and private.member_can_v1('jobs.manage')
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

  v_before_property_id := v_job.property_id;

  if v_existing_property_id is not null then
    select p.*
    into v_property
    from public.properties p
    where p.id = v_existing_property_id
      and p.company_id = v_company_id
    for share;

    if not found then
      return jsonb_build_object('ok', false, 'code', 'property_not_found');
    end if;

    v_resolution := 'selected';
  else
    if v_line1 is null and v_formatted is null then
      return jsonb_build_object('ok', false, 'code', 'property_address_invalid');
    end if;

    begin
      select *
      into v_resolved
      from public.resolve_company_property_v1(
        v_company_id,
        coalesce(v_line1, v_formatted),
        v_line2,
        v_city,
        v_state,
        v_zip,
        v_formatted,
        v_places_place_id
      );
    exception
      when sqlstate '42501' then
        return jsonb_build_object('ok', false, 'code', 'forbidden');
      when sqlstate '22023' then
        return jsonb_build_object('ok', false, 'code', 'property_address_invalid');
      when sqlstate '23505' then
        return jsonb_build_object('ok', false, 'code', 'property_identity_conflict');
      when others then
        return jsonb_build_object('ok', false, 'code', 'resolve_failed', 'detail', sqlerrm);
    end;

    if v_resolved.property_id is null then
      return jsonb_build_object('ok', false, 'code', 'resolve_failed');
    end if;

    select p.*
    into v_property
    from public.properties p
    where p.id = v_resolved.property_id
      and p.company_id = v_company_id;

    v_resolution := coalesce(v_resolved.resolution, 'resolved');
  end if;

  update public.jobs j
  set
    property_id = v_property.id,
    address_line1 = v_property.address_line1,
    address_line2 = v_property.address_line2,
    address_city = v_property.address_city,
    address_state = v_property.address_state,
    address_zip = v_property.address_zip,
    address_country = coalesce(v_property.address_country, 'US'),
    address_formatted = coalesce(
      nullif(btrim(v_property.address_formatted), ''),
      nullif(
        btrim(
          concat_ws(
            ', ',
            nullif(btrim(coalesce(v_property.address_line1, '')), ''),
            nullif(btrim(coalesce(v_property.address_city, '')), ''),
            nullif(
              btrim(
                concat_ws(
                  ' ',
                  nullif(btrim(coalesce(v_property.address_state, '')), ''),
                  nullif(btrim(coalesce(v_property.address_zip, '')), '')
                )
              ),
              ''
            )
          )
        ),
        ''
      )
    ),
    updated_at = v_now,
    last_activity_at = v_now
  where j.id = v_job.id
    and j.company_id = v_company_id
  returning * into v_job;

  return jsonb_build_object(
    'ok', true,
    'job_id', v_job.id,
    'company_id', v_company_id,
    'property_id', v_property.id,
    'previous_property_id', v_before_property_id,
    'address_line1', v_job.address_line1,
    'address_line2', v_job.address_line2,
    'address_city', v_job.address_city,
    'address_state', v_job.address_state,
    'address_zip', v_job.address_zip,
    'address_country', v_job.address_country,
    'address_formatted', v_job.address_formatted,
    'resolution', coalesce(v_resolution, 'resolved')
  );
end;
$function$;

-- mark_job_attention_read_v1: active membership + jobs.read (company scope)
CREATE OR REPLACE FUNCTION public.mark_job_attention_read_v1(p_attention_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      and cm.removed_at is null
      and private.member_can_v1('jobs.read')
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
$function$;

-- update_proposal_customer_request_status_v1: active membership + proposals.write
CREATE OR REPLACE FUNCTION public.update_proposal_customer_request_status_v1(p_request_id uuid, p_status text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      and cm.removed_at is null
      and private.member_can_v1('proposals.write')
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
$function$;

-- upsert_draft_proposal_payment_terms_v1: active membership + proposals.write
CREATE OR REPLACE FUNCTION public.upsert_draft_proposal_payment_terms_v1(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      and cm.removed_at is null
      and private.member_can_v1('proposals.write')
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
$function$;

-- propose_job_scope_change_v1: active membership + scope_changes.issue
CREATE OR REPLACE FUNCTION public.propose_job_scope_change_v1(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_company_id uuid;
  v_job_id uuid;
  v_scope_change_id uuid;
  v_expected integer;
  v_job public.jobs%rowtype;
  v_change public.job_scope_changes%rowtype;
  v_block text;
  v_live_total integer;
  v_line_count integer;
  v_now timestamptz := now();
  v_activity_id uuid;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;

  begin
    v_company_id := nullif(p_payload->>'company_id', '')::uuid;
    v_job_id := nullif(p_payload->>'job_id', '')::uuid;
    v_scope_change_id := nullif(p_payload->>'scope_change_id', '')::uuid;
    v_expected := nullif(p_payload->>'expected_row_version', '')::integer;
  exception when others then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end;

  if v_company_id is null or v_job_id is null or v_scope_change_id is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  if not public.job_scope_change_author_ok_v1(v_company_id, v_uid) then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;

  perform pg_advisory_xact_lock(
    hashtext('job_scope_change_propose:' || v_company_id::text),
    hashtext(v_job_id::text)
  );

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

  v_block := public.job_scope_change_authoring_blocked_v1(v_job);
  if v_block is not null then
    return jsonb_build_object('ok', false, 'code', v_block);
  end if;

  select sc.*
  into v_change
  from public.job_scope_changes sc
  where sc.id = v_scope_change_id
    and sc.company_id = v_company_id
    and sc.job_id = v_job_id
    and sc.deleted_at is null
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  if v_change.status = 'proposed' then
    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'scope_change', public.job_scope_change_row_json_v1(v_change),
      'lines', public.job_scope_change_lines_json_v1(v_company_id, v_change.id),
      'contract_total_cents', public.job_contract_total_cents_v1(v_company_id, v_job_id),
      'proposed_new_total_cents', public.job_contract_total_cents_v1(v_company_id, v_job_id) + v_change.price_delta_cents,
      'activity_id', null
    );
  end if;

  if v_change.status <> 'draft' then
    return jsonb_build_object('ok', false, 'code', 'illegal_transition');
  end if;

  if v_expected is not null and v_change.row_version is distinct from v_expected then
    return jsonb_build_object(
      'ok', false,
      'code', 'row_version_conflict',
      'row_version', v_change.row_version
    );
  end if;

  select count(*)::integer
  into v_line_count
  from public.job_scope_change_lines l
  where l.company_id = v_company_id
    and l.scope_change_id = v_change.id;

  if v_line_count < 1 then
    return jsonb_build_object('ok', false, 'code', 'scope_change_lines_required');
  end if;

  v_live_total := public.job_contract_total_cents_v1(v_company_id, v_job_id);
  if v_live_total is distinct from v_change.basis_contract_total_cents then
    return jsonb_build_object(
      'ok', false,
      'code', 'stale_basis',
      'basis_contract_total_cents', v_change.basis_contract_total_cents,
      'live_contract_total_cents', v_live_total
    );
  end if;

  if exists (
    select 1
    from public.job_scope_changes sc
    where sc.company_id = v_company_id
      and sc.job_id = v_job_id
      and sc.status = 'proposed'
      and sc.deleted_at is null
      and sc.id <> v_change.id
  ) then
    return jsonb_build_object('ok', false, 'code', 'proposed_already_exists');
  end if;

  update public.job_scope_changes
  set
    status = 'proposed',
    proposed_at = v_now,
    updated_by = v_uid,
    updated_at = v_now,
    row_version = row_version + 1
  where id = v_change.id
    and company_id = v_company_id
  returning * into v_change;

  update public.jobs
  set last_activity_at = v_now
  where id = v_job_id
    and company_id = v_company_id;

  v_activity_id := public.job_lifecycle_insert_activity(
    v_company_id,
    v_job_id,
    'scope_change_proposed',
    v_uid,
    jsonb_build_object(
      'scope_change_id', v_change.id,
      'from_status', 'draft',
      'to_status', 'proposed',
      'price_delta_cents', v_change.price_delta_cents,
      'basis_contract_total_cents', v_change.basis_contract_total_cents,
      'proposed_new_total_cents', v_live_total + v_change.price_delta_cents,
      'base_acceptance_id', v_change.base_acceptance_id,
      'base_proposal_version_id', v_change.base_proposal_version_id
    ),
    v_now
  );

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'scope_change', public.job_scope_change_row_json_v1(v_change),
    'lines', public.job_scope_change_lines_json_v1(v_company_id, v_change.id),
    'contract_total_cents', v_live_total,
    'proposed_new_total_cents', v_live_total + v_change.price_delta_cents,
    'activity_id', v_activity_id
  );
end;
$function$;

-- job_contract_total_cents_v1: a signed-in caller gets a value only for its own
-- active company AND with commercial read authority (proposals.read or
-- payments.summary.read). Field members (job scope only) receive null. Service-role
-- and definer-internal callers (no auth.uid()) are unchanged. Null = unavailable.
CREATE OR REPLACE FUNCTION public.job_contract_total_cents_v1(p_company_id uuid, p_job_id uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case
    when auth.uid() is not null
      and (
        p_company_id is distinct from private.current_active_company_id()
        or not (private.member_can_v1('proposals.read') or private.member_can_v1('payments.summary.read'))
      )
    then null
    else (
      coalesce(
        (
          select public.proposal_acceptance_contract_total_cents_v1(a.company_id, a.id)
          from public.proposal_acceptances a
          where a.company_id = p_company_id
            and a.job_id = p_job_id
          order by a.accepted_at desc, a.created_at desc, a.id desc
          limit 1
        ),
        0
      )
      + coalesce(
        (
          select sum(sc.price_delta_cents)::integer
          from public.job_scope_changes sc
          where sc.company_id = p_company_id
            and sc.job_id = p_job_id
            and sc.status = 'authorized'
            and sc.deleted_at is null
        ),
        0
      )
    )::integer
  end;
$function$;

-- Scope-change helpers (service_role EXECUTE only; called inside definer RPCs).
create or replace function public.job_scope_change_member_ok_v1(
  p_company_id uuid,
  p_user_id uuid
) returns boolean
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select exists (
    select 1
    from private.evaluate_access_v1(p_user_id, 'scope_changes.write') e
    where e.reason = 'allowed' and e.company_id = p_company_id
  );
$fn$;

create or replace function public.job_scope_change_author_ok_v1(
  p_company_id uuid,
  p_user_id uuid
) returns boolean
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select exists (
    select 1
    from private.evaluate_access_v1(p_user_id, 'scope_changes.issue') e
    where e.reason = 'allowed' and e.company_id = p_company_id
  );
$fn$;

alter function public.job_scope_change_member_ok_v1(uuid, uuid) owner to postgres;
alter function public.job_scope_change_author_ok_v1(uuid, uuid) owner to postgres;
revoke all on function public.job_scope_change_member_ok_v1(uuid, uuid) from public, anon, authenticated;
revoke all on function public.job_scope_change_author_ok_v1(uuid, uuid) from public, anon, authenticated;
grant execute on function public.job_scope_change_member_ok_v1(uuid, uuid) to service_role;
grant execute on function public.job_scope_change_author_ok_v1(uuid, uuid) to service_role;
