-- Payment Stage 1 — proposal payment terms + job-level money ledger
-- Additive. Do not edit 044. 039 remains reserved.
--
-- Terms freeze with sent proposal versions (copied from draft parent).
-- Company payment settings remain draft prefill only.
-- Deposit Checkout is authorized by accepted frozen terms, not jobs.stage.
-- Additional deposit = max(0, current-terms deposit − job net received),
-- capped to remaining contractual total.

begin;

-- ---------------------------------------------------------------------------
-- 1. proposal_version_payment_terms
-- ---------------------------------------------------------------------------

create table if not exists public.proposal_version_payment_terms (
  proposal_version_id uuid primary key,
  company_id uuid not null references public.companies(id) on delete restrict,
  proposal_id uuid not null,
  deposit_mode text not null default 'none',
  deposit_percent_bps integer null,
  deposit_fixed_cents integer null,
  deposit_due_trigger text not null default 'on_acceptance',
  balance_due_trigger text not null default 'on_completion',
  collection_channel text not null default 'online_stripe',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint proposal_version_payment_terms_version_company_fkey
    foreign key (proposal_version_id, company_id)
    references public.proposal_versions (id, company_id)
    on delete restrict,

  constraint proposal_version_payment_terms_proposal_company_fkey
    foreign key (proposal_id, company_id)
    references public.proposals (id, company_id)
    on delete restrict,

  constraint proposal_version_payment_terms_deposit_mode_check
    check (deposit_mode in ('none', 'percent', 'fixed')),

  constraint proposal_version_payment_terms_deposit_due_check
    check (deposit_due_trigger = 'on_acceptance'),

  constraint proposal_version_payment_terms_balance_due_check
    check (balance_due_trigger = 'on_completion'),

  constraint proposal_version_payment_terms_collection_check
    check (collection_channel = 'online_stripe'),

  constraint proposal_version_payment_terms_mode_values_check
    check (
      (
        deposit_mode = 'none'
        and deposit_percent_bps is null
        and deposit_fixed_cents is null
      )
      or (
        deposit_mode = 'percent'
        and deposit_percent_bps is not null
        and deposit_percent_bps >= 1
        and deposit_percent_bps <= 10000
        and deposit_fixed_cents is null
      )
      or (
        deposit_mode = 'fixed'
        and deposit_fixed_cents is not null
        and deposit_fixed_cents >= 100
        and deposit_percent_bps is null
      )
    )
);

create index if not exists idx_proposal_version_payment_terms_company_proposal
  on public.proposal_version_payment_terms (company_id, proposal_id);

comment on table public.proposal_version_payment_terms is
  'Payment Stage 1 frozen-or-draft payment terms per proposal version. Settings never rewrite sent rows.';

alter table public.proposal_version_payment_terms enable row level security;

drop policy if exists "proposal_version_payment_terms_select_company_scope"
  on public.proposal_version_payment_terms;
create policy "proposal_version_payment_terms_select_company_scope"
  on public.proposal_version_payment_terms
  for select
  to authenticated
  using (
    company_id in (
      select company_id from public.company_memberships where user_id = auth.uid()
    )
  );

drop policy if exists "proposal_version_payment_terms_write_deny"
  on public.proposal_version_payment_terms;
create policy "proposal_version_payment_terms_write_deny"
  on public.proposal_version_payment_terms
  for all
  to authenticated
  using (false)
  with check (false);

grant select on table public.proposal_version_payment_terms to authenticated;
grant all on table public.proposal_version_payment_terms to service_role;

-- ---------------------------------------------------------------------------
-- 2. Immutability + draft default + send copy
-- ---------------------------------------------------------------------------

create or replace function public.proposal_payment_terms_guard_immutable_v1()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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

drop trigger if exists trg_proposal_payment_terms_immutable
  on public.proposal_version_payment_terms;
create trigger trg_proposal_payment_terms_immutable
  before update or delete on public.proposal_version_payment_terms
  for each row
  execute function public.proposal_payment_terms_guard_immutable_v1();

create or replace function public.proposal_payment_terms_seed_from_settings_v1(
  p_company_id uuid,
  p_proposal_id uuid,
  p_version_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
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
    perform public.proposal_payment_terms_seed_from_settings_v1(
      new.company_id,
      new.proposal_id,
      new.id
    );
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
      perform public.proposal_payment_terms_seed_from_settings_v1(
        new.company_id,
        new.proposal_id,
        new.id
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_proposal_payment_terms_on_version_insert
  on public.proposal_versions;
create trigger trg_proposal_payment_terms_on_version_insert
  after insert on public.proposal_versions
  for each row
  execute function public.proposal_payment_terms_on_version_insert_v1();

-- ---------------------------------------------------------------------------
-- 3. Job-level ledger
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
  select coalesce(sum(t.amount_cents), 0)::integer
  from public.job_payment_transactions t
  join public.job_payment_requests r
    on r.id = t.payment_request_id
   and r.company_id = t.company_id
  where r.company_id = p_company_id
    and r.job_id = p_job_id
    and t.kind = 'capture'
    and t.status = 'succeeded';
$$;

create or replace function public.job_payment_refunded_cents_v1(
  p_company_id uuid,
  p_job_id uuid
)
returns integer
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(sum(t.amount_cents), 0)::integer
  from public.job_payment_transactions t
  join public.job_payment_requests r
    on r.id = t.payment_request_id
   and r.company_id = t.company_id
  where r.company_id = p_company_id
    and r.job_id = p_job_id
    and t.kind = 'refund'
    and t.status = 'refunded';
$$;

create or replace function public.job_payment_net_received_cents_v1(
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
    public.job_payment_gross_received_cents_v1(p_company_id, p_job_id)
    - public.job_payment_refunded_cents_v1(p_company_id, p_job_id)
  )::integer;
$$;

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
      select a.accepted_total_cents
      from public.proposal_acceptances a
      where a.company_id = p_company_id
        and a.job_id = p_job_id
      order by a.accepted_at desc
      limit 1
    ),
    0
  )::integer;
$$;

create or replace function public.job_payment_remaining_cents_v1(
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
    - public.job_payment_net_received_cents_v1(p_company_id, p_job_id)
  )::integer;
$$;

create or replace function public.job_payment_resolve_deposit_obligation_cents_v1(
  p_mode text,
  p_percent_bps integer,
  p_fixed_cents integer,
  p_accepted_total_cents integer
)
returns integer
language plpgsql
immutable
set search_path = public
as $$
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

create or replace function public.job_payment_additional_deposit_cents_v1(
  p_mode text,
  p_percent_bps integer,
  p_fixed_cents integer,
  p_accepted_total_cents integer,
  p_net_received_cents integer
)
returns integer
language plpgsql
immutable
set search_path = public
as $$
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

revoke all on function public.job_payment_gross_received_cents_v1(uuid, uuid) from public, anon;
revoke all on function public.job_payment_refunded_cents_v1(uuid, uuid) from public, anon;
revoke all on function public.job_payment_net_received_cents_v1(uuid, uuid) from public, anon;
revoke all on function public.job_payment_current_contractual_total_cents_v1(uuid, uuid) from public, anon;
revoke all on function public.job_payment_remaining_cents_v1(uuid, uuid) from public, anon;
grant execute on function public.job_payment_gross_received_cents_v1(uuid, uuid) to authenticated, service_role;
grant execute on function public.job_payment_refunded_cents_v1(uuid, uuid) to authenticated, service_role;
grant execute on function public.job_payment_net_received_cents_v1(uuid, uuid) to authenticated, service_role;
grant execute on function public.job_payment_current_contractual_total_cents_v1(uuid, uuid) to authenticated, service_role;
grant execute on function public.job_payment_remaining_cents_v1(uuid, uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. Draft terms upsert
-- ---------------------------------------------------------------------------

create or replace function public.upsert_draft_proposal_payment_terms_v1(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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

revoke all on function public.upsert_draft_proposal_payment_terms_v1(jsonb) from public, anon;
grant execute on function public.upsert_draft_proposal_payment_terms_v1(jsonb) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. Open deposit from acceptance (service_role) + replace request/checkout
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

  -- Stale open/failed requests on prior acceptances must not collect.
  -- Leave processing in flight until webhook settlement.
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
    v_acceptance.accepted_total_cents,
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
      v_acceptance.proposal_option_id,
      v_acceptance.id,
      v_signature_id,
      v_amount,
      'usd',
      'deposit',
      v_acceptance.accepted_total_cents,
      left(trim(v_acceptance.accepted_option_label), 120),
      'stripe',
      v_account.provider_account_id,
      'open',
      null
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
    'idempotent_replay', false,
    'skipped', false,
    'job_stage_unchanged', true
  );
end;
$$;

revoke all on function public.open_job_deposit_from_acceptance_v1(jsonb) from public, anon, authenticated;
grant execute on function public.open_job_deposit_from_acceptance_v1(jsonb) to service_role;

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

  -- Approve is lifecycle only. Latest customer acceptance authorizes money.
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

  v_option_label := left(trim(v_acceptance.accepted_option_label), 120);
  v_net := public.job_payment_net_received_cents_v1(v_company_id, v_job_id);
  v_remaining := public.job_payment_remaining_cents_v1(v_company_id, v_job_id);

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
    if v_net <= 0 then
      return jsonb_build_object('ok', false, 'code', 'deposit_required');
    end if;
    if v_amount is null then
      v_amount := v_remaining;
    end if;
  end if;

  if v_amount is null or v_amount < 100 then
    return jsonb_build_object('ok', false, 'code', 'invalid_amount');
  end if;

  if v_amount > v_remaining or v_remaining < 100 then
    return jsonb_build_object('ok', false, 'code', 'invalid_amount');
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
    if v_kind = 'balance' and v_amount is distinct from v_failed.amount_cents then
      return jsonb_build_object('ok', false, 'code', 'invalid_amount');
    end if;
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
      v_job_id,
      v_acceptance.proposal_id,
      v_acceptance.proposal_version_id,
      v_acceptance.proposal_option_id,
      v_acceptance.id,
      v_signature_id,
      v_amount,
      'usd',
      v_kind,
      v_acceptance.accepted_total_cents,
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
    and r.status in ('open', 'processing', 'failed')
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
  end if;

  if not found then
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
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  if v_request.status = 'failed' then
    update public.job_payment_requests
    set
      status = 'open',
      provider_checkout_session_id = null,
      checkout_generation = checkout_generation + 1
    where id = v_request.id
    returning * into v_request;
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
end;
$$;

-- Historical versions get terms rows. Sent/signed stay none (never inherit live Settings).
-- Drafts inherit current company default as prefill only.

insert into public.proposal_version_payment_terms (
  proposal_version_id,
  company_id,
  proposal_id,
  deposit_mode,
  deposit_percent_bps,
  deposit_fixed_cents
)
select
  v.id,
  v.company_id,
  v.proposal_id,
  'none',
  null,
  null
from public.proposal_versions v
where v.version_kind in ('sent', 'signed', 'superseded')
  and not exists (
    select 1
    from public.proposal_version_payment_terms t
    where t.proposal_version_id = v.id
  );

insert into public.proposal_version_payment_terms (
  proposal_version_id,
  company_id,
  proposal_id,
  deposit_mode,
  deposit_percent_bps,
  deposit_fixed_cents
)
select
  v.id,
  v.company_id,
  v.proposal_id,
  case
    when coalesce(s.default_deposit_mode, 'none') = 'percent'
      and s.default_deposit_percent_bps between 1 and 10000
      then 'percent'
    when coalesce(s.default_deposit_mode, 'none') = 'fixed'
      and s.default_deposit_fixed_cents >= 100
      then 'fixed'
    else 'none'
  end,
  case
    when coalesce(s.default_deposit_mode, 'none') = 'percent'
      and s.default_deposit_percent_bps between 1 and 10000
      then s.default_deposit_percent_bps
    else null
  end,
  case
    when coalesce(s.default_deposit_mode, 'none') = 'fixed'
      and s.default_deposit_fixed_cents >= 100
      then s.default_deposit_fixed_cents
    else null
  end
from public.proposal_versions v
left join public.company_payment_settings s on s.company_id = v.company_id
where v.version_kind = 'draft'
  and not exists (
    select 1
    from public.proposal_version_payment_terms t
    where t.proposal_version_id = v.id
  );

alter table public.job_payment_requests
  add column if not exists settled_payment_method_label text;

create or replace function public.set_job_payment_settled_method_v1(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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

revoke all on function public.set_job_payment_settled_method_v1(jsonb) from public, anon, authenticated;
grant execute on function public.set_job_payment_settled_method_v1(jsonb) to service_role;

commit;
