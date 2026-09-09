-- ---------------------------------------------------------------------------
-- 054 — Job payment balance-request lifecycle
-- ---------------------------------------------------------------------------
--
-- WHY THIS MIGRATION EXISTS
--
-- Stage 2B: after Complete, the contractor Collect remaining balance creates
-- one canonical kind=balance payment request. 048 create_job_payment_request_v1
-- still:
--   * amounts balance from job_payment_remaining_cents_v1 (contract − net),
--     which re-opens collectible after a concession refund
--   * returns deposit_required when net ≤ 0, blocking no-deposit jobs
--   * does not require job stage = complete for kind=balance
--   * snapshots contractor accepted_total_cents / proposal_option_id, which
--     050 row-guard rejects when the customer chose a different package
--
-- 044 / 048 / 049 / 050 / 051 / 052 / 053 are not rewritten. Remaining-from-net
-- stays for deposit additional-amount math. Collectible for balance is
-- contract − gross (053 contractual total).
--
-- MODEL
--
--   Collectible = max(0, 053 contract total − canonical gross received).
--   Balance create requires canonical job stage = complete, active
--   disposition, collectible ≥ 100, Stripe charges enabled, and no other
--   open/processing request. Client amount is ignored. Open or processing
--   balance requests replay idempotently. Failed rows are not mutated;
--   a later Collect may insert a new open request. NEVER writes jobs.stage.

-- ---------------------------------------------------------------------------
-- 1. Collectible remaining (contract − gross). Distinct from remaining-from-net.
-- ---------------------------------------------------------------------------

create or replace function public.job_payment_collectible_cents_v1(
  p_company_id uuid,
  p_job_id uuid
)
returns integer
language sql
stable
security invoker
set search_path = public
as $$
  select greatest(
    0,
    public.job_payment_current_contractual_total_cents_v1(p_company_id, p_job_id)
    - public.job_payment_gross_received_cents_v1(p_company_id, p_job_id)
  )::integer;
$$;

revoke all on function public.job_payment_collectible_cents_v1(uuid, uuid)
  from public, anon;
grant execute on function public.job_payment_collectible_cents_v1(uuid, uuid)
  to authenticated, service_role;

comment on function public.job_payment_collectible_cents_v1(uuid, uuid) is
  'Amount due / collectible for a job: max(0, 053 contractual total − canonical '
  'gross received). Refunds do not reopen amount due. Distinct from '
  'job_payment_remaining_cents_v1 (contract − net).';

-- ---------------------------------------------------------------------------
-- 2. create_job_payment_request_v1 — Complete-gated balance, collectible amount
-- ---------------------------------------------------------------------------

create or replace function public.create_job_payment_request_v1(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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
  v_terms public.proposal_version_payment_terms%rowtype;
  v_existing public.job_payment_requests%rowtype;
  v_failed public.job_payment_requests%rowtype;
  v_request public.job_payment_requests%rowtype;
  v_before_stage text;
  v_before_entered timestamptz;
  v_after_stage text;
  v_after_entered timestamptz;
  v_remaining integer;
  v_net integer;
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
    v_amount := nullif(p_payload->>'amount_cents', '')::integer;
    v_signature_id := nullif(p_payload->>'proposal_signature_id', '')::uuid;
  exception when others then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end;

  if v_company_id is null or v_job_id is null or v_kind is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  if v_kind not in ('deposit', 'balance') then
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

  select c.option_id, c.option_label, c.total_cents
  into v_contract_option_id, v_option_label, v_contract_total
  from public.proposal_acceptance_contract_option_v1(v_company_id, v_acceptance.id) c;

  if v_contract_option_id is null then
    v_contract_option_id := v_acceptance.proposal_option_id;
    v_option_label := v_acceptance.accepted_option_label;
    v_contract_total := public.proposal_acceptance_contract_total_cents_v1(
      v_company_id,
      v_acceptance.id
    );
  end if;

  v_option_label := left(trim(coalesce(v_option_label, v_acceptance.accepted_option_label)), 120);
  v_net := public.job_payment_net_received_cents_v1(v_company_id, v_job_id);
  v_remaining := public.job_payment_remaining_cents_v1(v_company_id, v_job_id);
  v_collectible := public.job_payment_collectible_cents_v1(v_company_id, v_job_id);

  if v_kind = 'deposit' then
    select t.*
    into v_terms
    from public.proposal_version_payment_terms t
    where t.proposal_version_id = v_acceptance.proposal_version_id
      and t.company_id = v_company_id;
    v_amount := public.job_payment_additional_deposit_cents_v1(
      coalesce(v_terms.deposit_mode, 'none'),
      v_terms.deposit_percent_bps,
      v_terms.deposit_fixed_cents,
      v_acceptance.accepted_total_cents,
      v_net
    );
  end if;

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

  if v_kind = 'balance' then
    if v_before_stage is distinct from 'complete' then
      return jsonb_build_object('ok', false, 'code', 'not_complete');
    end if;
    v_amount := v_collectible;
    if v_amount is null or v_amount < 100 then
      return jsonb_build_object('ok', false, 'code', 'nothing_due');
    end if;
  else
    if v_amount is null or v_amount < 100 then
      return jsonb_build_object('ok', false, 'code', 'invalid_amount');
    end if;
    if v_amount > v_remaining or v_remaining < 100 then
      return jsonb_build_object('ok', false, 'code', 'invalid_amount');
    end if;
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

  if v_kind = 'deposit' then
    select r.*
    into v_failed
    from public.job_payment_requests r
    where r.company_id = v_company_id
      and r.job_id = v_job_id
      and r.kind = v_kind
      and r.status = 'failed'
      and r.proposal_acceptance_id = v_acceptance.id
    order by r.requested_at desc
    limit 1
    for update;

    if found then
      update public.job_payment_requests
      set
        status = 'open',
        provider_checkout_session_id = null,
        checkout_generation = checkout_generation + 1
      where id = v_failed.id
        and amount_cents = v_amount
      returning * into v_request;

      if found then
        perform public.job_payment_resolve_attention_v1(
          v_company_id,
          'payment_failed:job_payment_requests:' || v_request.id::text
        );
      end if;
    end if;
  end if;

  if v_request.id is null then
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
  end if;

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

revoke all on function public.create_job_payment_request_v1(jsonb) from public, anon;
grant execute on function public.create_job_payment_request_v1(jsonb)
  to authenticated, service_role;

comment on function public.create_job_payment_request_v1(jsonb) is
  'Contractor payment-request writer. kind=balance requires Complete, uses '
  'collectible = contract − gross, ignores client amount, and replays an '
  'existing open/processing request. kind=deposit keeps 048 additional-deposit '
  'math. NEVER writes jobs.stage.';
