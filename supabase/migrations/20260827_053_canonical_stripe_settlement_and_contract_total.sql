-- ---------------------------------------------------------------------------
-- 053 — Canonical Stripe settlement + customer contract totals
-- ---------------------------------------------------------------------------
--
-- WHY THIS MIGRATION EXISTS
--
-- Cohesion A live proof showed one Stripe card Checkout payment producing
-- two succeeded `capture` rows: payment_intent.succeeded and
-- checkout.session.completed have different provider_event_id values, and
-- record_job_payment_provider_event_v1 (044) treated event delivery as the
-- financial identity. Gross/net therefore doubled.
--
-- A Stripe EVENT is delivery truth. A PaymentIntent (provider payment object)
-- is financial truth. Two events describing one provider payment must never
-- become two customer payments.
--
-- Separately, job_payment_current_contractual_total_cents_v1 (048) still
-- reads legacy proposal_acceptances.accepted_total_cents (contractor frozen
-- selection). 049 already records customer_chosen_total_cents and
-- proposal_acceptance_contract_option_v1 already prefers it. The job ledger
-- did not. Remaining balance was therefore wrong when the customer chose a
-- different package than the contractor default.
--
-- 049 / 050 / 051 / 052 are not rewritten. Historical transaction rows are
-- not deleted or updated. Uniqueness on (provider, provider_event_id) stays.
-- A UNIQUE capture-per-PaymentIntent index is NOT added because the known
-- duplicate pair would make it invalid.
--
-- MODEL
--
--   Canonical capture identity (when PaymentIntent is present):
--     company_id + provider + kind=capture + provider_payment_intent_id
--   Fallback when PaymentIntent is absent:
--     company_id + provider + kind=capture + provider_event_id
--
--   Write: first paid event may insert the capture. Later events for the
--   same PaymentIntent (or same request once a succeeded capture exists)
--   enrich request status and do not insert another capture.
--
--   Checkout completion with payment_status other than paid still does not
--   mint a capture (044 mapper: processing only). ACH/async remains
--   pending → async_payment_succeeded / payment_intent.succeeded.
--
--   Contract total: customer_chosen_total_cents when present, otherwise
--   accepted_total_cents. Legacy accepted_* columns are not mutated.

-- ---------------------------------------------------------------------------
-- 1. Capture identity + supporting index (not unique)
-- ---------------------------------------------------------------------------

create or replace function public.job_payment_canonical_capture_identity_v1(
  p_provider text,
  p_provider_payment_intent_id text,
  p_provider_event_id text
)
returns text
language sql
immutable
parallel safe
set search_path = public
as $$
  select case
    when nullif(trim(p_provider_payment_intent_id), '') is not null then
      'pi:' || coalesce(nullif(trim(p_provider), ''), 'stripe')
        || ':' || trim(p_provider_payment_intent_id)
    else
      'evt:' || coalesce(nullif(trim(p_provider), ''), 'stripe')
        || ':' || coalesce(nullif(trim(p_provider_event_id), ''), '')
  end;
$$;

revoke all on function public.job_payment_canonical_capture_identity_v1(text, text, text)
  from public, anon;
grant execute on function public.job_payment_canonical_capture_identity_v1(text, text, text)
  to authenticated, service_role;

comment on function public.job_payment_canonical_capture_identity_v1(text, text, text) is
  'Financial capture identity. PaymentIntent when present; otherwise the '
  'provider event id so unknown-PI rows are not collapsed together.';

create index if not exists idx_job_payment_transactions_canonical_capture_pi
  on public.job_payment_transactions (company_id, provider, provider_payment_intent_id)
  where kind = 'capture'
    and status = 'succeeded'
    and provider_payment_intent_id is not null;

-- ---------------------------------------------------------------------------
-- 2. Contract total helper — customer choice wins, legacy accepted_* preserved
-- ---------------------------------------------------------------------------

create or replace function public.proposal_acceptance_contract_total_cents_v1(
  p_company_id uuid,
  p_acceptance_id uuid
)
returns integer
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(
    coalesce(a.customer_chosen_total_cents, a.accepted_total_cents),
    0
  )::integer
  from public.proposal_acceptances a
  where a.company_id = p_company_id
    and a.id = p_acceptance_id;
$$;

revoke all on function public.proposal_acceptance_contract_total_cents_v1(uuid, uuid)
  from public, anon;
grant execute on function public.proposal_acceptance_contract_total_cents_v1(uuid, uuid)
  to authenticated, service_role;

comment on function public.proposal_acceptance_contract_total_cents_v1(uuid, uuid) is
  'Contractual cents for one acceptance. customer_chosen_total_cents when '
  'present; otherwise accepted_total_cents. Does not mutate either column.';

create or replace function public.job_payment_current_contractual_total_cents_v1(
  p_company_id uuid,
  p_job_id uuid
)
returns integer
language sql
stable
security invoker
set search_path = public
as $$
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

comment on function public.job_payment_current_contractual_total_cents_v1(uuid, uuid) is
  'Latest acceptance contractual total for a job. Prefers customer-chosen '
  'cents when present; otherwise contractor accepted_total_cents.';

-- ---------------------------------------------------------------------------
-- 3. Duplicate-safe gross received (canonical capture contribution)
-- ---------------------------------------------------------------------------

create or replace function public.job_payment_gross_received_cents_v1(
  p_company_id uuid,
  p_job_id uuid
)
returns integer
language sql
stable
security invoker
set search_path = public
as $$
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

comment on function public.job_payment_gross_received_cents_v1(uuid, uuid) is
  'Succeeded capture contribution per canonical provider-payment identity. '
  'Duplicate event-derived captures for one PaymentIntent count once. Distinct '
  'PaymentIntents are never collapsed, even at equal amounts.';

-- net_received and remaining already compose gross − refunded and
-- contractual − net. Replacing gross + contractual is sufficient.

-- ---------------------------------------------------------------------------
-- 4. Settlement writer — event delivery vs financial capture
-- ---------------------------------------------------------------------------

create or replace function public.record_job_payment_provider_event_v1(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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

revoke all on function public.record_job_payment_provider_event_v1(jsonb)
  from public, anon, authenticated;
grant execute on function public.record_job_payment_provider_event_v1(jsonb)
  to service_role;

comment on function public.record_job_payment_provider_event_v1(jsonb) is
  'Stripe Connect webhook settlement. Event id is delivery idempotency. '
  'Succeeded capture is canonical per PaymentIntent (and at most one per '
  'request). Paid never regresses. NEVER writes jobs.stage.';
