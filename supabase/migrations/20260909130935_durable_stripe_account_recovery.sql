-- Durable Stripe connected-account recovery.
-- LOCAL AUTHORING ONLY: do not apply without explicit live-SQL authorization.
-- Historical payment/refund identity and all job lifecycle semantics are unchanged.

begin;

alter table public.company_payment_accounts
  add column if not exists is_current boolean,
  add column if not exists connection_status text,
  add column if not exists ended_at timestamptz;

-- The pre-recovery schema enforces one row per company/provider, so every
-- existing valid row is deterministically the current active relationship.
update public.company_payment_accounts
set
  is_current = true,
  connection_status = 'active',
  ended_at = null
where is_current is null
   or connection_status is null;

alter table public.company_payment_accounts
  alter column is_current set default false,
  alter column is_current set not null,
  alter column connection_status set default 'active',
  alter column connection_status set not null;

alter table public.company_payment_accounts
  drop constraint if exists company_payment_accounts_company_provider_unique;

alter table public.company_payment_accounts
  drop constraint if exists company_payment_accounts_connection_status_check,
  drop constraint if exists company_payment_accounts_connection_lifecycle_check;

alter table public.company_payment_accounts
  add constraint company_payment_accounts_connection_status_check
    check (connection_status in ('active', 'replaced', 'access_lost', 'closed')),
  add constraint company_payment_accounts_connection_lifecycle_check
    check (
      (connection_status = 'active' and ended_at is null)
      or
      (connection_status <> 'active' and is_current = false and ended_at is not null)
    );

create unique index if not exists company_payment_accounts_one_current_idx
  on public.company_payment_accounts (company_id, provider)
  where is_current = true;

-- A single durable onboarding/replacement candidate makes recovery resumable
-- and prevents concurrent Connect attempts from accumulating ambiguous rows.
create unique index if not exists company_payment_accounts_one_active_candidate_idx
  on public.company_payment_accounts (company_id, provider)
  where is_current = false and connection_status = 'active';

create index if not exists company_payment_accounts_company_history_idx
  on public.company_payment_accounts (company_id, provider, created_at desc);

comment on column public.company_payment_accounts.is_current is
  'Sole deterministic pointer for new-money routing. Historical provider events and refunds do not filter on this field.';
comment on column public.company_payment_accounts.connection_status is
  'FieldDive connection relationship: active (current or validated candidate), replaced, access_lost, or closed. Stripe readiness remains onboarding_status.';
comment on column public.company_payment_accounts.ended_at is
  'Relationship end time for replaced, access-lost, or closed historical connections; null for active current/candidate rows.';

create or replace function public.company_payment_accounts_row_guard()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
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

revoke all on function public.company_payment_accounts_row_guard()
  from public, anon, authenticated;

create or replace function public.upsert_company_payment_account_from_provider_v1(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_account_id text;
  v_charges boolean;
  v_payouts boolean;
  v_details boolean;
  v_status text;
  v_row public.company_payment_accounts%rowtype;
  v_existing public.company_payment_accounts%rowtype;
  v_initial_current boolean := false;
begin
  if coalesce(auth.jwt()->>'role', '') <> 'service_role' then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;

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

  -- Serialize exact-account ownership and company current/candidate creation.
  perform pg_advisory_xact_lock(hashtextextended('stripe_account:' || v_account_id, 0));
  if v_company_id is not null then
    perform pg_advisory_xact_lock(
      hashtextextended('company_payment_account:' || v_company_id::text || ':stripe', 0)
    );
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

    v_initial_current := not exists (
      select 1
      from public.company_payment_accounts a
      where a.company_id = v_company_id
        and a.provider = 'stripe'
    );

    begin
      insert into public.company_payment_accounts (
        company_id,
        provider,
        provider_account_id,
        onboarding_status,
        charges_enabled,
        payouts_enabled,
        details_submitted,
        is_current,
        connection_status,
        ended_at
      )
      values (
        v_company_id,
        'stripe',
        v_account_id,
        v_status,
        v_charges,
        v_payouts,
        v_details,
        v_initial_current,
        'active',
        null
      )
      returning * into v_row;
    exception
      when unique_violation then
        return jsonb_build_object('ok', false, 'code', 'account_conflict');
    end;
  end if;

  if v_row.is_current and v_row.charges_enabled then
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
    'details_submitted', v_row.details_submitted,
    'is_current', v_row.is_current,
    'connection_status', v_row.connection_status,
    'ended_at', v_row.ended_at
  );
end;
$$;

revoke all on function public.upsert_company_payment_account_from_provider_v1(jsonb)
  from public, anon, authenticated;
grant execute on function public.upsert_company_payment_account_from_provider_v1(jsonb)
  to service_role;

create or replace function public.replace_company_payment_account_v1(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_expected_current text;
  v_replacement text;
  v_access_validated boolean;
  v_charges boolean;
  v_payouts boolean;
  v_details boolean;
  v_disabled boolean;
  v_current public.company_payment_accounts%rowtype;
  v_next public.company_payment_accounts%rowtype;
  v_now timestamptz := transaction_timestamp();
begin
  if coalesce(auth.jwt()->>'role', '') <> 'service_role' then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;

  begin
    v_company_id := nullif(p_payload->>'company_id', '')::uuid;
    v_expected_current := nullif(trim(p_payload->>'expected_current_provider_account_id'), '');
    v_replacement := nullif(trim(p_payload->>'replacement_provider_account_id'), '');
    v_access_validated := coalesce((p_payload->>'provider_access_validated')::boolean, false);
    v_charges := coalesce((p_payload->>'charges_enabled')::boolean, false);
    v_payouts := coalesce((p_payload->>'payouts_enabled')::boolean, false);
    v_details := coalesce((p_payload->>'details_submitted')::boolean, false);
    v_disabled := coalesce((p_payload->>'disabled')::boolean, false);
  exception when others then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end;

  if v_company_id is null
    or v_replacement is null
    or v_replacement !~ '^acct_'
    or not v_access_validated
  then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('company_payment_account:' || v_company_id::text || ':stripe', 0)
  );

  -- Consistent ordering prevents two candidate replacements from deadlocking.
  perform 1
  from public.company_payment_accounts a
  where a.company_id = v_company_id
    and a.provider = 'stripe'
  order by a.id
  for update;

  select a.*
  into v_next
  from public.company_payment_accounts a
  where a.provider = 'stripe'
    and a.provider_account_id = v_replacement
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'replacement_not_registered');
  end if;
  if v_next.company_id is distinct from v_company_id then
    return jsonb_build_object('ok', false, 'code', 'account_company_mismatch');
  end if;

  select a.*
  into v_current
  from public.company_payment_accounts a
  where a.company_id = v_company_id
    and a.provider = 'stripe'
    and a.is_current = true
  for update;

  if v_disabled or not v_charges then
    return jsonb_build_object('ok', false, 'code', 'replacement_not_usable');
  end if;

  if found and v_current.provider_account_id = v_replacement then
    update public.company_payment_accounts
    set
      onboarding_status = 'complete',
      charges_enabled = v_charges,
      payouts_enabled = v_payouts,
      details_submitted = v_details
    where id = v_current.id;
    return jsonb_build_object(
      'ok', true,
      'idempotent_replay', true,
      'company_id', v_company_id,
      'previous_provider_account_id', v_current.provider_account_id,
      'provider_account_id', v_current.provider_account_id
    );
  end if;

  if (v_current.id is null and v_expected_current is not null)
    or (v_current.id is not null and v_current.provider_account_id is distinct from v_expected_current)
  then
    return jsonb_build_object('ok', false, 'code', 'current_account_changed');
  end if;

  if exists (
    select 1
    from public.company_payment_accounts a
    where a.company_id = v_company_id
      and a.provider = 'stripe'
      and a.is_current = false
      and a.connection_status = 'active'
      and a.id is distinct from v_next.id
  ) then
    return jsonb_build_object('ok', false, 'code', 'replacement_candidate_conflict');
  end if;

  -- Only the server path that just retrieved this exact Stripe account can
  -- reactivate a same-company historical row as the replacement candidate.
  update public.company_payment_accounts
  set
    is_current = false,
    connection_status = 'active',
    ended_at = null,
    onboarding_status = 'complete',
    charges_enabled = v_charges,
    payouts_enabled = v_payouts,
    details_submitted = v_details
  where id = v_next.id
  returning * into v_next;

  if v_current.id is not null then
    update public.company_payment_accounts
    set
      is_current = false,
      connection_status = 'replaced',
      ended_at = v_now
    where id = v_current.id;
  end if;

  update public.company_payment_accounts
  set
    is_current = true,
    connection_status = 'active',
    ended_at = null
  where id = v_next.id
  returning * into v_next;

  return jsonb_build_object(
    'ok', true,
    'idempotent_replay', false,
    'company_id', v_company_id,
    'previous_provider_account_id', v_current.provider_account_id,
    'provider_account_id', v_next.provider_account_id,
    'replaced_at', v_now
  );
end;
$$;

revoke all on function public.replace_company_payment_account_v1(jsonb)
  from public, anon, authenticated;
grant execute on function public.replace_company_payment_account_v1(jsonb)
  to service_role;

comment on function public.replace_company_payment_account_v1(jsonb) is
  'Service-only atomic compare-and-swap for a server-validated, stored, charge-ready replacement Stripe account. Retains all historical rows and financial bindings.';

-- New-money writers resolve only the one current, active, charge-ready account.

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
  if coalesce(auth.jwt()->>'role', '') <> 'service_role' then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;

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
    and a.is_current = true
    and a.connection_status = 'active'
    and a.onboarding_status = 'complete'
    and a.charges_enabled = true
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
$$;

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
  if coalesce(auth.jwt()->>'role', '') <> 'service_role' then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;

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
      and a.provider = 'stripe'
    and a.is_current = true
    and a.connection_status = 'active'
    and a.onboarding_status = 'complete'
    and a.charges_enabled = true;

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
$$;

revoke all on function public.open_job_deposit_from_acceptance_v1(jsonb) from public, anon, authenticated;
revoke all on function public.create_job_payment_request_v1(jsonb) from public, anon;
revoke all on function public.resolve_public_job_payment_checkout_v1(text) from public, anon, authenticated;
revoke all on function public.collect_job_payment_v1(jsonb) from public, anon;
grant execute on function public.open_job_deposit_from_acceptance_v1(jsonb) to service_role;
grant execute on function public.create_job_payment_request_v1(jsonb) to authenticated, service_role;
grant execute on function public.resolve_public_job_payment_checkout_v1(text) to service_role;
grant execute on function public.collect_job_payment_v1(jsonb) to authenticated, service_role;

commit;
