-- ---------------------------------------------------------------------------
-- 055 — Payment-domain invariant recovery
-- ---------------------------------------------------------------------------
--
-- WHY THIS MIGRATION EXISTS
--
-- Pre-2C: the live payment domain still allows two active requests of different
-- kinds, public GET can mint a deposit, public resolve can revive failed → open,
-- generic create can manufacture deposit, deposit amount uses net (refunds
-- reopen), and new drafts inherit company Settings 10%/fixed defaults.
--
-- 044 / 048 / 049 / 050 / 051 / 052 / 053 / 054 are not rewritten. 039 remains reserved.
-- This file is the next SQL after 054.
--
-- MODEL
--
--   At most one open|processing payment request per job (any kind).
--   Deposit is owned by canonical latest acceptance + frozen terms.
--   Uncovered deposit = max(0, obligation − gross), capped by collectible.
--   Refunds do not reduce gross and do not reopen deposit.
--   Failed stays failed; retry inserts a new open row.
--   Public resolve never mutates failed → open and never inserts.
--   Processing is not contractor-cancellable.
--   New draft payment terms initialize to none (company defaults become inert).
--   NEVER writes jobs.stage.
--
-- ---------------------------------------------------------------------------
-- A. Fail-closed duplicate-active preflight (must abort; a SELECT does not)
-- ---------------------------------------------------------------------------

do $$
declare
  v_dup_jobs integer;
  v_sample text;
begin
  select count(*) into v_dup_jobs
  from (
    select r.company_id, r.job_id
    from public.job_payment_requests r
    where r.status in ('open', 'processing')
    group by r.company_id, r.job_id
    having count(*) > 1
  ) dupes;

  if v_dup_jobs > 0 then
    select string_agg(x.job_id::text, ', ' order by x.job_id)
    into v_sample
    from (
      select r.job_id
      from public.job_payment_requests r
      where r.status in ('open', 'processing')
      group by r.company_id, r.job_id
      having count(*) > 1
      limit 5
    ) x;

    raise exception
      '055 fail-closed: % job(s) have >1 open/processing payment request. Sample job_id: %. Do not auto-cancel. Resolve duplicates, then retry.',
      v_dup_jobs,
      coalesce(v_sample, '(none)');
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- B. Job-level unique active index, then drop per-kind index
-- ---------------------------------------------------------------------------

create unique index if not exists idx_job_payment_requests_one_active_per_job
  on public.job_payment_requests (company_id, job_id)
  where status in ('open', 'processing');

comment on index public.idx_job_payment_requests_one_active_per_job is
  'V1: at most one open or processing payment request per job, regardless of kind. Paid/failed/cancelled/expired history is unrestricted.';

drop index if exists public.idx_job_payment_requests_one_active_per_kind;

-- ---------------------------------------------------------------------------
-- C. Uncovered deposit helper — obligation − gross, capped by collectible
-- ---------------------------------------------------------------------------

create or replace function public.job_payment_uncovered_deposit_cents_v1(
  p_company_id uuid,
  p_job_id uuid,
  p_mode text,
  p_percent_bps integer,
  p_fixed_cents integer,
  p_canonical_total_cents integer
)
returns integer
language plpgsql
stable
security invoker
set search_path = public
as $$
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

revoke all on function public.job_payment_uncovered_deposit_cents_v1(
  uuid, uuid, text, integer, integer, integer
) from public, anon;
grant execute on function public.job_payment_uncovered_deposit_cents_v1(
  uuid, uuid, text, integer, integer, integer
) to authenticated, service_role;

comment on function public.job_payment_uncovered_deposit_cents_v1(
  uuid, uuid, text, integer, integer, integer
) is
  'Incremental deposit still due: max(0, frozen obligation against 053 canonical '
  'contractual total − 053 gross successful captures), then min(uncovered, 054 '
  'collectible). Returns 0 when the result is under 100 cents. Does not use net '
  'or job_payment_additional_deposit_cents_v1. Refunds do not reopen deposit.';

-- ---------------------------------------------------------------------------
-- D. open_job_deposit_from_acceptance_v1 — sole canonical deposit writer
-- ---------------------------------------------------------------------------

create or replace function public.open_job_deposit_from_acceptance_v1(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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

revoke all on function public.open_job_deposit_from_acceptance_v1(jsonb)
  from public, anon, authenticated;
grant execute on function public.open_job_deposit_from_acceptance_v1(jsonb) to service_role;

comment on function public.open_job_deposit_from_acceptance_v1(jsonb) is
  'Sole canonical deposit writer. Amount = uncovered obligation (053 contract '
  'total, 053 gross, 054 collectible). Failed is not revived in place; a retry '
  'inserts a new open row. Replay open/processing for the same acceptance. '
  'Other active kinds return conflicting_request. NEVER writes jobs.stage.';

-- ---------------------------------------------------------------------------
-- E. create_job_payment_request_v1 — balance only
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

revoke all on function public.create_job_payment_request_v1(jsonb) from public, anon;
grant execute on function public.create_job_payment_request_v1(jsonb)
  to authenticated, service_role;

comment on function public.create_job_payment_request_v1(jsonb) is
  'Contractor payment-request writer. kind=balance only: Complete-gated, amount '
  '= collectible (contract − gross), client amount ignored, open/processing '
  'replay, other active kinds conflict. kind=deposit is rejected '
  '(deposit_not_generic); deposit is owned by open_job_deposit_from_acceptance_v1. '
  'NEVER writes jobs.stage.';

-- ---------------------------------------------------------------------------
-- F. resolve_public_job_payment_checkout_v1 — open|processing only
-- ---------------------------------------------------------------------------

create or replace function public.resolve_public_job_payment_checkout_v1(p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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

revoke all on function public.resolve_public_job_payment_checkout_v1(text)
  from public, anon, authenticated;
grant execute on function public.resolve_public_job_payment_checkout_v1(text)
  to service_role;

comment on function public.resolve_public_job_payment_checkout_v1(text) is
  'Public payment portal resolve. Pays only the current open or processing '
  'request. Failed is inactive and is never mutated to open. No inserts.';

-- ---------------------------------------------------------------------------
-- G. cancel_job_payment_request_v1 — processing is not cancellable
-- ---------------------------------------------------------------------------

create or replace function public.cancel_job_payment_request_v1(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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

revoke all on function public.cancel_job_payment_request_v1(jsonb) from public, anon;
grant execute on function public.cancel_job_payment_request_v1(jsonb)
  to authenticated, service_role;

comment on function public.cancel_job_payment_request_v1(jsonb) is
  'Contractor cancel. open → cancelled. failed may be cancelled for cleanup. '
  'processing is not cancellable (processing_not_cancellable). paid is immutable. '
  'cancelled/expired are idempotent. NEVER writes jobs.stage.';

-- ---------------------------------------------------------------------------
-- H. Draft payment-term seed — new drafts initialize to none
-- ---------------------------------------------------------------------------

create or replace function public.proposal_payment_terms_on_version_insert_v1()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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

comment on function public.proposal_payment_terms_on_version_insert_v1() is
  'New draft payment terms initialize to deposit_mode=none. Does not call '
  'proposal_payment_terms_seed_from_settings_v1. Sent/signed copies frozen parent '
  'terms when a parent exists. Company settings defaults remain stored but inert '
  'for normal new proposal creation.';
