-- ---------------------------------------------------------------------------
-- 056 — Flexible Collect payment
-- ---------------------------------------------------------------------------
--
-- WHY THIS MIGRATION EXISTS
--
-- Stage 2C: contractor Collect payment (Remaining / Percentage / Fixed).
-- Server owns amount, kind, eligibility, and the one-active conflict.
-- Collect never mints deposit. Calculation mode ≠ request purpose.
--
-- 044 / 048 / 049 / 050 / 051 / 052 / 053 / 054 / 055 are not rewritten.
-- 039 remains reserved. This file is the next SQL after 055.
--
-- MODEL
--
--   Kinds: deposit | progress | balance.
--   Collect derives progress or balance only.
--   Pre-Complete Collect → progress.
--   Complete + amount = collectible → balance.
--   Complete + amount < collectible → progress.
--   Percentage is floor(contract * bps / 10000) of ORIGINAL contractual total.
--   amount_mode / percentage_bps are explanatory metadata, never recalc authority.
--   amount_cents remains immutable financial authority.
--   055 one-active-per-job index is unchanged.
--   NEVER writes jobs.stage.
--
-- ---------------------------------------------------------------------------
-- A. Kind CHECK — add progress
-- ---------------------------------------------------------------------------

alter table public.job_payment_requests
  drop constraint if exists job_payment_requests_kind_check;

alter table public.job_payment_requests
  add constraint job_payment_requests_kind_check
  check (kind in ('deposit', 'progress', 'balance'));

comment on constraint job_payment_requests_kind_check on public.job_payment_requests is
  'Payment request purpose: deposit (acceptance-owned), progress (contractor Collect), balance (Complete-gated final remaining).';

-- ---------------------------------------------------------------------------
-- B. Explanatory Collect metadata (not recalculation authority)
-- ---------------------------------------------------------------------------

alter table public.job_payment_requests
  add column if not exists amount_mode text null;

alter table public.job_payment_requests
  add column if not exists percentage_bps integer null;

alter table public.job_payment_requests
  drop constraint if exists job_payment_requests_amount_mode_check;

alter table public.job_payment_requests
  add constraint job_payment_requests_amount_mode_check
  check (
    amount_mode is null
    or amount_mode in ('remaining', 'percentage', 'fixed')
  );

alter table public.job_payment_requests
  drop constraint if exists job_payment_requests_percentage_bps_check;

alter table public.job_payment_requests
  add constraint job_payment_requests_percentage_bps_check
  check (
    (
      amount_mode = 'percentage'
      and percentage_bps is not null
      and percentage_bps >= 1
      and percentage_bps <= 10000
    )
    or (
      coalesce(amount_mode, '') is distinct from 'percentage'
      and percentage_bps is null
    )
  );

comment on column public.job_payment_requests.amount_mode is
  'Explanatory Collect calculation mode (remaining|percentage|fixed). Null for deposit and pre-056 rows. Never used to recalculate amount_cents.';

comment on column public.job_payment_requests.percentage_bps is
  'Explanatory Collect percentage in integer basis points (1–10000) when amount_mode=percentage. Never recalculation authority.';

-- ---------------------------------------------------------------------------
-- C. collect_job_payment_v1 — intent-based contractor Collect writer
-- ---------------------------------------------------------------------------

create or replace function public.collect_job_payment_v1(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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

revoke all on function public.collect_job_payment_v1(jsonb) from public, anon;
grant execute on function public.collect_job_payment_v1(jsonb)
  to authenticated, service_role;

comment on function public.collect_job_payment_v1(jsonb) is
  'Contractor Collect writer. Caller supplies amount_mode (remaining|percentage|fixed); '
  'server derives amount and kind (progress|balance). Never deposit. Percentage is '
  'floor(original contract * bps / 10000), not remaining and not cumulative. Over '
  'collectible is amount_exceeds_collectible (no clamp). Complete + exact collectible '
  '→ balance; otherwise progress. One open|processing per job. NEVER writes jobs.stage.';
