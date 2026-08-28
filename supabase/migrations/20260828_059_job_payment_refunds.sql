-- ---------------------------------------------------------------------------
-- 059 — Refunds V1
-- ---------------------------------------------------------------------------
--
-- Refund financial truth is one job_payment_refunds row per Stripe Refund,
-- bound to one canonical successful capture. Stripe event delivery is separate
-- append-only receipt truth. Legacy kind=refund transaction rows are preserved
-- unchanged and are not used by Refunds V1 totals.
--
-- This migration never writes jobs.stage and does not mutate legacy settlement
-- rows. It is authored for review only; application is a separate operation.

begin;

-- A composite target lets the refund FK prove company + request + capture in
-- one constraint. id is already the transaction primary key, so this is safe
-- for existing rows and does not change them.
alter table public.job_payment_transactions
  add constraint job_payment_transactions_id_company_request_unique
  unique (id, company_id, payment_request_id);

create table public.job_payment_refunds (
  id uuid primary key,
  company_id uuid not null references public.companies(id) on delete restrict,
  job_id uuid not null,
  payment_request_id uuid not null,
  canonical_capture_transaction_id uuid not null,

  provider text not null default 'stripe',
  provider_account_id text not null,
  provider_payment_intent_id text not null,
  provider_charge_id text null,
  provider_refund_id text null,

  amount_cents integer not null,
  currency text not null default 'usd',
  origin text not null,
  created_by_user_id uuid null,
  internal_reason text null,
  idempotency_key text not null,

  status text not null,
  provider_reason_code text null,
  provider_reason_message text null,
  provider_created_at timestamptz null,
  provider_updated_at timestamptz null,
  last_provider_event_created_at timestamptz null,

  initiated_at timestamptz null,
  pending_at timestamptz null,
  requires_action_at timestamptz null,
  succeeded_at timestamptz null,
  failed_at timestamptz null,
  canceled_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint job_payment_refunds_id_company_unique
    unique (id, company_id),
  constraint job_payment_refunds_request_company_fkey
    foreign key (payment_request_id, company_id)
    references public.job_payment_requests (id, company_id)
    on delete restrict,
  constraint job_payment_refunds_capture_binding_fkey
    foreign key (
      canonical_capture_transaction_id,
      company_id,
      payment_request_id
    )
    references public.job_payment_transactions (
      id,
      company_id,
      payment_request_id
    )
    on delete restrict,
  constraint job_payment_refunds_job_company_fkey
    foreign key (job_id, company_id)
    references public.jobs (id, company_id)
    on delete restrict,
  constraint job_payment_refunds_provider_check
    check (provider = 'stripe'),
  constraint job_payment_refunds_account_check
    check (
      char_length(provider_account_id) between 6 and 128
      and provider_account_id ~ '^acct_[A-Za-z0-9]+$'
    ),
  constraint job_payment_refunds_payment_intent_check
    check (
      char_length(provider_payment_intent_id) between 4 and 255
      and provider_payment_intent_id ~ '^pi_[A-Za-z0-9]+$'
    ),
  constraint job_payment_refunds_charge_check
    check (
      provider_charge_id is null
      or (
        char_length(provider_charge_id) between 4 and 255
        and provider_charge_id ~ '^ch_[A-Za-z0-9]+$'
      )
    ),
  constraint job_payment_refunds_refund_check
    check (
      provider_refund_id is null
      or (
        char_length(provider_refund_id) between 4 and 255
        and provider_refund_id ~ '^re_[A-Za-z0-9]+$'
      )
    ),
  constraint job_payment_refunds_amount_check
    check (amount_cents > 0),
  constraint job_payment_refunds_currency_check
    check (currency = 'usd'),
  constraint job_payment_refunds_origin_check
    check (origin in ('fielddive', 'stripe_dashboard')),
  constraint job_payment_refunds_actor_check
    check (
      (origin = 'fielddive' and created_by_user_id is not null)
      or (origin = 'stripe_dashboard' and created_by_user_id is null)
    ),
  constraint job_payment_refunds_reason_check
    check (
      internal_reason is null
      or (
        internal_reason = trim(internal_reason)
        and char_length(internal_reason) between 1 and 500
      )
    ),
  constraint job_payment_refunds_idempotency_key_check
    check (
      idempotency_key = trim(idempotency_key)
      and char_length(idempotency_key) between 8 and 255
    ),
  constraint job_payment_refunds_status_check
    check (
      status in (
        'initiating',
        'pending',
        'requires_action',
        'succeeded',
        'failed',
        'canceled'
      )
    ),
  constraint job_payment_refunds_reason_code_check
    check (
      provider_reason_code is null
      or char_length(provider_reason_code) between 1 and 120
    ),
  constraint job_payment_refunds_reason_message_check
    check (
      provider_reason_message is null
      or char_length(provider_reason_message) between 1 and 1000
    ),
  constraint job_payment_refunds_initiated_at_check
    check ((origin = 'fielddive') = (initiated_at is not null)),
  constraint job_payment_refunds_provider_refund_id_check
    check (
      provider_refund_id is not null
      or status in ('initiating', 'failed')
    ),
  constraint job_payment_refunds_succeeded_at_check
    check (status <> 'succeeded' or succeeded_at is not null),
  constraint job_payment_refunds_pending_at_check
    check (status <> 'pending' or pending_at is not null),
  constraint job_payment_refunds_requires_action_at_check
    check (status <> 'requires_action' or requires_action_at is not null),
  constraint job_payment_refunds_failed_at_check
    check (status <> 'failed' or failed_at is not null),
  constraint job_payment_refunds_canceled_at_check
    check (status <> 'canceled' or canceled_at is not null)
);

create unique index idx_job_payment_refunds_provider_refund
  on public.job_payment_refunds (provider_account_id, provider_refund_id)
  where provider_refund_id is not null;

create unique index idx_job_payment_refunds_idempotency
  on public.job_payment_refunds (provider_account_id, idempotency_key);

create index idx_job_payment_refunds_company_job
  on public.job_payment_refunds (company_id, job_id, created_at desc);

create index idx_job_payment_refunds_capture_status
  on public.job_payment_refunds (
    canonical_capture_transaction_id,
    status,
    created_at
  );

create index idx_job_payment_refunds_payment_intent
  on public.job_payment_refunds (
    provider_account_id,
    provider_payment_intent_id
  );

comment on table public.job_payment_refunds is
  'Refunds V1 financial truth: one immutable logical/Stripe refund bound to one canonical successful Stripe capture.';

create table public.job_payment_refund_event_receipts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid null references public.companies(id) on delete restrict,
  refund_id uuid null,
  provider text not null default 'stripe',
  provider_account_id text not null,
  provider_event_id text not null,
  raw_type text not null,
  provider_event_created_at timestamptz not null,
  provider_refund_id text null,
  metadata_refund_command_id uuid null,
  provider_payment_intent_id text null,
  provider_charge_id text null,
  amount_cents integer null,
  provider_status_raw text null,
  refund_status text null,
  correlation_method text not null,
  disposition text not null,
  received_at timestamptz not null default now(),

  constraint job_payment_refund_events_refund_company_fkey
    foreign key (refund_id, company_id)
    references public.job_payment_refunds (id, company_id)
    on delete restrict,
  constraint job_payment_refund_events_delivery_unique
    unique (provider_account_id, provider_event_id),
  constraint job_payment_refund_events_provider_check
    check (provider = 'stripe'),
  constraint job_payment_refund_events_account_check
    check (
      char_length(provider_account_id) between 6 and 128
      and provider_account_id ~ '^acct_[A-Za-z0-9]+$'
    ),
  constraint job_payment_refund_events_event_id_check
    check (
      provider_event_id = trim(provider_event_id)
      and char_length(provider_event_id) between 4 and 255
    ),
  constraint job_payment_refund_events_raw_type_check
    check (
      raw_type = trim(raw_type)
      and char_length(raw_type) between 1 and 120
    ),
  constraint job_payment_refund_events_amount_check
    check (amount_cents is null or amount_cents > 0),
  constraint job_payment_refund_events_refund_id_check
    check (
      provider_refund_id is null
      or (
        char_length(provider_refund_id) between 4 and 255
        and provider_refund_id ~ '^re_[A-Za-z0-9]+$'
      )
    ),
  constraint job_payment_refund_events_payment_intent_check
    check (
      provider_payment_intent_id is null
      or (
        char_length(provider_payment_intent_id) between 4 and 255
        and provider_payment_intent_id ~ '^pi_[A-Za-z0-9]+$'
      )
    ),
  constraint job_payment_refund_events_charge_check
    check (
      provider_charge_id is null
      or (
        char_length(provider_charge_id) between 4 and 255
        and provider_charge_id ~ '^ch_[A-Za-z0-9]+$'
      )
    ),
  constraint job_payment_refund_events_provider_status_raw_check
    check (
      provider_status_raw is null
      or char_length(provider_status_raw) between 1 and 120
    ),
  constraint job_payment_refund_events_status_check
    check (
      refund_status is null
      or refund_status in (
        'initiating',
        'pending',
        'requires_action',
        'succeeded',
        'failed',
        'canceled'
      )
    ),
  constraint job_payment_refund_events_correlation_check
    check (
      correlation_method in (
        'provider_refund_id',
        'metadata_command_id',
        'payment_intent',
        'charge',
        'none'
      )
    ),
  constraint job_payment_refund_events_disposition_check
    check (
      disposition in (
        'applied',
        'stale',
        'unbound',
        'identity_mismatch',
        'overrefund_conflict',
        'unsupported'
      )
    ),
  constraint job_payment_refund_events_binding_shape_check
    check (
      (refund_id is null and company_id is null)
      or (refund_id is not null and company_id is not null)
    )
);

create index idx_job_payment_refund_events_company
  on public.job_payment_refund_event_receipts (
    company_id,
    provider_event_created_at desc
  )
  where company_id is not null;

create index idx_job_payment_refund_events_refund
  on public.job_payment_refund_event_receipts (
    refund_id,
    provider_event_created_at
  )
  where refund_id is not null;

comment on table public.job_payment_refund_event_receipts is
  'Append-only Stripe refund event delivery receipts. Unbound deliveries retain account/event audit truth without inventing a company binding.';

-- ---------------------------------------------------------------------------
-- Guards
-- ---------------------------------------------------------------------------

create or replace function public.job_payment_refund_status_rank_v1(p_status text)
returns integer
language sql
immutable
parallel safe
set search_path = public
as $$
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

create or replace function public.job_payment_refunds_row_guard_v1()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
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

create trigger job_payment_refunds_row_guard
  before insert or update or delete on public.job_payment_refunds
  for each row execute function public.job_payment_refunds_row_guard_v1();

create or replace function public.job_payment_refund_events_row_guard_v1()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    raise exception 'job_payment_refund_event_receipts rows cannot be updated';
  elsif tg_op = 'DELETE' then
    raise exception 'job_payment_refund_event_receipts rows cannot be deleted';
  end if;
  return new;
end;
$$;

create trigger job_payment_refund_events_row_guard
  before update or delete on public.job_payment_refund_event_receipts
  for each row execute function public.job_payment_refund_events_row_guard_v1();

revoke all on function public.job_payment_refund_status_rank_v1(text)
  from public, anon, authenticated;
revoke all on function public.job_payment_refunds_row_guard_v1()
  from public, anon, authenticated;
revoke all on function public.job_payment_refund_events_row_guard_v1()
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- RLS and table grants: members can read company-bound truth; all direct
-- authenticated writes remain denied. Unbound receipts are service-only.
-- ---------------------------------------------------------------------------

alter table public.job_payment_refunds enable row level security;
alter table public.job_payment_refund_event_receipts enable row level security;

create policy "job_payment_refunds_select_company_scope"
  on public.job_payment_refunds
  for select
  using (
    company_id in (
      select cm.company_id
      from public.company_memberships cm
      where cm.user_id = auth.uid()
    )
  );

create policy "job_payment_refund_events_select_company_scope"
  on public.job_payment_refund_event_receipts
  for select
  using (
    company_id in (
      select cm.company_id
      from public.company_memberships cm
      where cm.user_id = auth.uid()
    )
  );

revoke all on table public.job_payment_refunds
  from public, anon, authenticated, service_role;
revoke all on table public.job_payment_refund_event_receipts
  from public, anon, authenticated, service_role;
grant select on table public.job_payment_refunds to authenticated;
grant select on table public.job_payment_refund_event_receipts to authenticated;
grant select on table public.job_payment_refunds to service_role;
grant select on table public.job_payment_refund_event_receipts to service_role;

-- ---------------------------------------------------------------------------
-- Canonical totals and per-capture availability
-- ---------------------------------------------------------------------------

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
  select coalesce(sum(r.amount_cents), 0)::integer
  from public.job_payment_refunds r
  where r.company_id = p_company_id
    and r.job_id = p_job_id
    and r.status = 'succeeded';
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

create or replace function public.job_payment_capture_refundable_cents_v1(
  p_company_id uuid,
  p_canonical_capture_transaction_id uuid
)
returns integer
language sql
stable
security invoker
set search_path = public
as $$
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

revoke all on function public.job_payment_refunded_cents_v1(uuid, uuid)
  from public, anon;
revoke all on function public.job_payment_net_received_cents_v1(uuid, uuid)
  from public, anon;
revoke all on function public.job_payment_capture_refundable_cents_v1(uuid, uuid)
  from public, anon;
grant execute on function public.job_payment_refunded_cents_v1(uuid, uuid)
  to authenticated, service_role;
grant execute on function public.job_payment_net_received_cents_v1(uuid, uuid)
  to authenticated, service_role;
grant execute on function public.job_payment_capture_refundable_cents_v1(uuid, uuid)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Authenticated reservation. The caller chooses a stable command UUID and
-- idempotency key. Replay is accepted only when every immutable identity field
-- is identical. Capture-level advisory + row locks serialize over-refund math.
-- ---------------------------------------------------------------------------

create or replace function public.reserve_job_payment_refund_v1(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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

revoke all on function public.reserve_job_payment_refund_v1(jsonb)
  from public, anon;
grant execute on function public.reserve_job_payment_refund_v1(jsonb)
  to authenticated, service_role;

comment on function public.reserve_job_payment_refund_v1(jsonb) is
  'Authenticated atomic refund reservation. Locks job/request/canonical capture, counts succeeded plus in-flight refunds, rejects over-refund, and proves job stage unchanged.';

-- ---------------------------------------------------------------------------
-- Service-only synchronous Stripe API result / definitive local failure.
-- ---------------------------------------------------------------------------

create or replace function public.reconcile_job_payment_refund_result_v1(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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

revoke all on function public.reconcile_job_payment_refund_result_v1(jsonb)
  from public, anon, authenticated;
grant execute on function public.reconcile_job_payment_refund_result_v1(jsonb)
  to service_role;

-- ---------------------------------------------------------------------------
-- Service-only Stripe refund webhook owner.
--
-- Correlation order:
--   connected account + Refund id
--   connected account + metadata refund command UUID
--   connected account + PaymentIntent / Charge -> canonical capture
--
-- amount_cents is the individual Refund amount. There is intentionally no
-- charge.amount_refunded input or fallback.
-- ---------------------------------------------------------------------------

create or replace function public.record_job_payment_refund_event_v1(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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

revoke all on function public.record_job_payment_refund_event_v1(jsonb)
  from public, anon, authenticated;
grant execute on function public.record_job_payment_refund_event_v1(jsonb)
  to service_role;

comment on function public.record_job_payment_refund_event_v1(jsonb) is
  'Service-only Stripe refund event owner. Dedupes by connected account + event id, correlates Refund/command/canonical capture, uses the individual Refund amount, projects Dashboard refunds, and never reads charge.amount_refunded.';

-- ---------------------------------------------------------------------------
-- Legacy review surface. The old table cannot establish one row per Stripe
-- Refund because it has no Refund id, so every legacy refund is ambiguous.
-- ---------------------------------------------------------------------------

create or replace view public.job_payment_legacy_refund_review_v1
with (security_invoker = true)
as
select
  t.id as legacy_transaction_id,
  t.company_id,
  r.job_id,
  t.payment_request_id,
  t.provider,
  t.provider_event_id,
  t.provider_payment_intent_id,
  t.provider_charge_id,
  t.amount_cents,
  t.currency,
  t.occurred_at,
  t.raw_type,
  'ambiguous_missing_provider_refund_id'::text as review_classification,
  'job_payment_transactions has no Stripe Refund id; event delivery cannot prove logical refund identity'::text
    as review_reason
from public.job_payment_transactions t
join public.job_payment_requests r
  on r.id = t.payment_request_id
 and r.company_id = t.company_id
where t.kind = 'refund';

revoke all on table public.job_payment_legacy_refund_review_v1
  from public, anon, authenticated;
grant select on table public.job_payment_legacy_refund_review_v1
  to authenticated, service_role;

comment on view public.job_payment_legacy_refund_review_v1 is
  'Read-only review of untouched legacy refund transactions. All are ambiguous because the historical schema cannot store Stripe Refund ids.';

commit;
