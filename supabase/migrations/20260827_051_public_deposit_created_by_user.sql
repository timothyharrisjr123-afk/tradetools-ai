-- ---------------------------------------------------------------------------
-- 051 — Public deposit requests require created_by_user_id
-- ---------------------------------------------------------------------------
--
-- open_job_deposit_from_acceptance_v1 (049) inserted null created_by_user_id,
-- but job_payment_requests.created_by_user_id is NOT NULL. Public customer
-- checkout therefore could never open a deposit row after acceptance.
--
-- Use confirmed_by_user_id when present, otherwise the earliest company
-- membership user as the server-owned attribution for customer-initiated
-- deposit requests.

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
  v_net integer;
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

  select c.option_id, c.option_label, c.total_cents, c.customer_chose
  into
    v_contract_option_id,
    v_contract_option_label,
    v_contract_total_cents,
    v_contract_customer_chose
  from public.proposal_acceptance_contract_option_v1(v_company_id, v_acceptance_id) c;

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

  update public.job_payment_requests
  set
    status = 'cancelled',
    cancelled_at = coalesce(cancelled_at, now())
  where company_id = v_company_id
    and job_id = v_acceptance.job_id
    and status in ('open', 'failed')
    and proposal_acceptance_id is distinct from v_acceptance.id;

  select t.*
  into v_terms
  from public.proposal_version_payment_terms t
  where t.proposal_version_id = v_acceptance.proposal_version_id
    and t.company_id = v_company_id;

  if not found or v_terms.deposit_mode = 'none' then
    return jsonb_build_object('ok', true, 'skipped', true, 'code', 'no_deposit');
  end if;

  v_net := public.job_payment_net_received_cents_v1(v_company_id, v_acceptance.job_id);
  v_amount := public.job_payment_additional_deposit_cents_v1(
    v_terms.deposit_mode,
    v_terms.deposit_percent_bps,
    v_terms.deposit_fixed_cents,
    v_contract_total_cents,
    v_net
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

  select r.*
  into v_failed
  from public.job_payment_requests r
  where r.company_id = v_company_id
    and r.job_id = v_acceptance.job_id
    and r.kind = 'deposit'
    and r.status = 'failed'
    and r.proposal_acceptance_id = v_acceptance.id
  order by r.requested_at desc
  limit 1
  for update;

  if found then
    update public.job_payment_requests
    set
      status = 'open',
      amount_cents = v_amount,
      provider_checkout_session_id = null,
      checkout_generation = checkout_generation + 1
    where id = v_failed.id
    returning * into v_request;

    perform public.job_payment_resolve_attention_v1(
      v_company_id,
      'payment_failed:job_payment_requests:' || v_request.id::text
    );
  else
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
