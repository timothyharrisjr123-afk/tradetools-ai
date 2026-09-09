-- R3E — Job payments (Stripe Connect direct charges)
-- AUTHOR ONLY — DO NOT APPLY WITHOUT EXPLICIT LIVE-APPLY APPROVAL.
--
-- Number 044 is the next unused migration after 043.
-- 039 remains reserved for deferred C4 generic-email-mint hardening (NOT this file).
-- Migrations 038–043 are not rewritten here.
--
-- This migration does NOT:
--   - write jobs.stage / stage_entered_at
--   - create or mutate proposal_signatures
--   - extend legacy estimate payments
--   - collect funds onto a FieldDive platform Stripe account
--   - take application fees
--   - encode invoices, tax, scheduling, or Copilot
--
-- Signature is OPTIONAL evidence. Unsigned + Accepted + Approved is a valid
-- payment-request path. Payment NEVER becomes Job stage.

begin;

-- ---------------------------------------------------------------------------
-- 1. company_payment_accounts — Stripe connected-account truth
-- ---------------------------------------------------------------------------

create table if not exists public.company_payment_accounts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  provider text not null default 'stripe',
  provider_account_id text not null,
  onboarding_status text not null default 'pending',
  charges_enabled boolean not null default false,
  payouts_enabled boolean not null default false,
  details_submitted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint company_payment_accounts_id_company_unique
    unique (id, company_id),

  constraint company_payment_accounts_company_provider_unique
    unique (company_id, provider),

  constraint company_payment_accounts_provider_account_unique
    unique (provider, provider_account_id),

  constraint company_payment_accounts_provider_check
    check (provider = 'stripe'),

  constraint company_payment_accounts_onboarding_status_check
    check (onboarding_status in ('pending', 'complete', 'restricted', 'disabled')),

  constraint company_payment_accounts_provider_account_id_check
    check (
      char_length(provider_account_id) >= 4
      and char_length(provider_account_id) <= 128
      and provider_account_id ~ '^acct_'
    )
);

create index if not exists idx_company_payment_accounts_company
  on public.company_payment_accounts (company_id);

comment on table public.company_payment_accounts is
  'R3E contractor Stripe connected-account status. No secrets, bank data, cards, or KYC documents.';

comment on column public.company_payment_accounts.provider_account_id is
  'Stripe connected account id (acct_…). Not a FieldDive business-type label.';

-- ---------------------------------------------------------------------------
-- 2. company_payment_settings — default deposit prefill only
-- ---------------------------------------------------------------------------

create table if not exists public.company_payment_settings (
  company_id uuid primary key references public.companies(id) on delete restrict,
  default_deposit_mode text not null default 'none',
  default_deposit_percent_bps integer null,
  default_deposit_fixed_cents integer null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint company_payment_settings_mode_check
    check (default_deposit_mode in ('none', 'percent', 'fixed')),

  constraint company_payment_settings_percent_bps_check
    check (
      default_deposit_percent_bps is null
      or (
        default_deposit_percent_bps >= 1
        and default_deposit_percent_bps <= 10000
      )
    ),

  constraint company_payment_settings_fixed_cents_check
    check (
      default_deposit_fixed_cents is null
      or default_deposit_fixed_cents >= 100
    ),

  constraint company_payment_settings_mode_values_check
    check (
      (
        default_deposit_mode = 'none'
        and default_deposit_percent_bps is null
        and default_deposit_fixed_cents is null
      )
      or (
        default_deposit_mode = 'percent'
        and default_deposit_percent_bps is not null
        and default_deposit_fixed_cents is null
      )
      or (
        default_deposit_mode = 'fixed'
        and default_deposit_fixed_cents is not null
        and default_deposit_percent_bps is null
      )
    )
);

comment on table public.company_payment_settings is
  'R3E company deposit prefill. Changing defaults never rewrites existing payment requests.';

-- ---------------------------------------------------------------------------
-- 3. job_payment_requests — contractor intent
-- ---------------------------------------------------------------------------

create table if not exists public.job_payment_requests (
  id uuid primary key default gen_random_uuid(),

  company_id uuid not null references public.companies(id) on delete restrict,
  job_id uuid not null,
  proposal_id uuid not null,
  proposal_version_id uuid not null,
  proposal_option_id uuid not null,
  proposal_acceptance_id uuid not null,
  proposal_signature_id uuid null,

  amount_cents integer not null,
  currency text not null default 'usd',
  kind text not null,
  accepted_total_cents_snapshot integer not null,
  option_label_snapshot text not null,

  provider text not null default 'stripe',
  provider_account_id text not null,
  provider_checkout_session_id text null,
  checkout_generation integer not null default 0,

  status text not null default 'open',
  requested_at timestamptz not null default now(),
  expires_at timestamptz null,
  paid_at timestamptz null,
  cancelled_at timestamptz null,

  created_by_user_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint job_payment_requests_id_company_unique
    unique (id, company_id),

  constraint job_payment_requests_job_company_fkey
    foreign key (job_id, company_id)
    references public.jobs (id, company_id)
    on delete restrict,

  constraint job_payment_requests_proposal_company_fkey
    foreign key (proposal_id, company_id)
    references public.proposals (id, company_id)
    on delete restrict,

  constraint job_payment_requests_version_company_fkey
    foreign key (proposal_version_id, company_id)
    references public.proposal_versions (id, company_id)
    on delete restrict,

  constraint job_payment_requests_option_company_fkey
    foreign key (proposal_option_id, company_id)
    references public.proposal_options (id, company_id)
    on delete restrict,

  constraint job_payment_requests_acceptance_company_fkey
    foreign key (proposal_acceptance_id, company_id)
    references public.proposal_acceptances (id, company_id)
    on delete restrict,

  constraint job_payment_requests_signature_company_fkey
    foreign key (proposal_signature_id, company_id)
    references public.proposal_signatures (id, company_id)
    on delete restrict,

  constraint job_payment_requests_kind_check
    check (kind in ('deposit', 'balance')),

  constraint job_payment_requests_status_check
    check (status in ('open', 'processing', 'paid', 'cancelled', 'expired', 'failed')),

  constraint job_payment_requests_provider_check
    check (provider = 'stripe'),

  constraint job_payment_requests_currency_check
    check (currency = 'usd'),

  constraint job_payment_requests_amount_cents_check
    check (amount_cents >= 100),

  constraint job_payment_requests_accepted_total_check
    check (accepted_total_cents_snapshot >= amount_cents),

  constraint job_payment_requests_option_label_check
    check (
      length(trim(option_label_snapshot)) > 0
      and char_length(option_label_snapshot) <= 120
    ),

  constraint job_payment_requests_checkout_generation_check
    check (checkout_generation >= 0),

  constraint job_payment_requests_provider_account_id_check
    check (
      char_length(provider_account_id) >= 4
      and char_length(provider_account_id) <= 128
      and provider_account_id ~ '^acct_'
    ),

  constraint job_payment_requests_paid_at_check
    check ((status = 'paid') = (paid_at is not null)),

  constraint job_payment_requests_cancelled_at_check
    check ((status = 'cancelled') = (cancelled_at is not null))
);

create unique index if not exists idx_job_payment_requests_one_active_per_kind
  on public.job_payment_requests (company_id, job_id, kind)
  where status in ('open', 'processing');

create index if not exists idx_job_payment_requests_company_job
  on public.job_payment_requests (company_id, job_id, requested_at desc);

create index if not exists idx_job_payment_requests_acceptance
  on public.job_payment_requests (company_id, proposal_acceptance_id);

create unique index if not exists idx_job_payment_requests_checkout_session
  on public.job_payment_requests (provider, provider_checkout_session_id)
  where provider_checkout_session_id is not null;

comment on table public.job_payment_requests is
  'R3E contractor payment intent against exact frozen accepted proposal truth. Amount is immutable. Signature id is optional.';

comment on column public.job_payment_requests.proposal_signature_id is
  'Optional matching signature evidence. Null is valid. Payment never creates or mutates signatures.';

comment on column public.job_payment_requests.amount_cents is
  'Integer cents stamped at create from contractor-chosen amount against remaining accepted total. Immutable.';

-- ---------------------------------------------------------------------------
-- 4. job_payment_transactions — provider settlement history
-- ---------------------------------------------------------------------------

create table if not exists public.job_payment_transactions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  payment_request_id uuid not null,
  provider text not null default 'stripe',
  provider_event_id text not null,
  provider_payment_intent_id text null,
  provider_charge_id text null,
  amount_cents integer not null,
  currency text not null default 'usd',
  kind text not null,
  status text not null,
  occurred_at timestamptz not null,
  raw_type text not null,
  created_at timestamptz not null default now(),

  constraint job_payment_transactions_id_company_unique
    unique (id, company_id),

  constraint job_payment_transactions_request_company_fkey
    foreign key (payment_request_id, company_id)
    references public.job_payment_requests (id, company_id)
    on delete restrict,

  constraint job_payment_transactions_provider_event_unique
    unique (provider, provider_event_id),

  constraint job_payment_transactions_provider_check
    check (provider = 'stripe'),

  constraint job_payment_transactions_currency_check
    check (currency = 'usd'),

  constraint job_payment_transactions_amount_cents_check
    check (amount_cents >= 0),

  constraint job_payment_transactions_kind_check
    check (kind in ('capture', 'failure', 'refund')),

  constraint job_payment_transactions_status_check
    check (status in ('succeeded', 'failed', 'refunded')),

  constraint job_payment_transactions_kind_status_check
    check (
      (kind = 'capture' and status = 'succeeded')
      or (kind = 'failure' and status = 'failed')
      or (kind = 'refund' and status = 'refunded')
    ),

  constraint job_payment_transactions_event_id_check
    check (
      length(trim(provider_event_id)) > 0
      and char_length(provider_event_id) <= 255
    ),

  constraint job_payment_transactions_raw_type_check
    check (
      length(trim(raw_type)) > 0
      and char_length(raw_type) <= 120
    )
);

create index if not exists idx_job_payment_transactions_request
  on public.job_payment_transactions (company_id, payment_request_id, occurred_at desc);

comment on table public.job_payment_transactions is
  'R3E append-only Stripe settlement events. Request = contractor intent. Transaction = provider settlement.';

-- ---------------------------------------------------------------------------
-- 5. Immutability guards
-- ---------------------------------------------------------------------------

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

drop trigger if exists company_payment_accounts_row_guard on public.company_payment_accounts;
create trigger company_payment_accounts_row_guard
  before insert or update or delete on public.company_payment_accounts
  for each row
  execute function public.company_payment_accounts_row_guard();

create or replace function public.company_payment_settings_row_guard()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
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

drop trigger if exists company_payment_settings_row_guard on public.company_payment_settings;
create trigger company_payment_settings_row_guard
  before insert or update or delete on public.company_payment_settings
  for each row
  execute function public.company_payment_settings_row_guard();

create or replace function public.job_payment_requests_row_guard()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_acceptance public.proposal_acceptances%rowtype;
  v_signature public.proposal_signatures%rowtype;
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

    if new.job_id is distinct from v_acceptance.job_id
      or new.proposal_id is distinct from v_acceptance.proposal_id
      or new.proposal_version_id is distinct from v_acceptance.proposal_version_id
      or new.proposal_option_id is distinct from v_acceptance.proposal_option_id
    then
      raise exception 'job_payment_requests binding must match the acceptance row';
    end if;

    if new.accepted_total_cents_snapshot is distinct from v_acceptance.accepted_total_cents
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

drop trigger if exists job_payment_requests_row_guard on public.job_payment_requests;
create trigger job_payment_requests_row_guard
  before insert or update or delete on public.job_payment_requests
  for each row
  execute function public.job_payment_requests_row_guard();

create or replace function public.job_payment_transactions_row_guard()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
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

drop trigger if exists job_payment_transactions_row_guard on public.job_payment_transactions;
create trigger job_payment_transactions_row_guard
  before insert or update or delete on public.job_payment_transactions
  for each row
  execute function public.job_payment_transactions_row_guard();

revoke all on function public.company_payment_accounts_row_guard() from public, anon, authenticated;
revoke all on function public.company_payment_settings_row_guard() from public, anon, authenticated;
revoke all on function public.job_payment_requests_row_guard() from public, anon, authenticated;
revoke all on function public.job_payment_transactions_row_guard() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. RLS / grants
-- ---------------------------------------------------------------------------

alter table public.company_payment_accounts enable row level security;
alter table public.company_payment_settings enable row level security;
alter table public.job_payment_requests enable row level security;
alter table public.job_payment_transactions enable row level security;

drop policy if exists "company_payment_accounts_select_company_scope"
  on public.company_payment_accounts;
create policy "company_payment_accounts_select_company_scope"
  on public.company_payment_accounts
  for select
  using (
    company_id in (
      select company_id from public.company_memberships where user_id = auth.uid()
    )
  );

drop policy if exists "company_payment_settings_select_company_scope"
  on public.company_payment_settings;
create policy "company_payment_settings_select_company_scope"
  on public.company_payment_settings
  for select
  using (
    company_id in (
      select company_id from public.company_memberships where user_id = auth.uid()
    )
  );

drop policy if exists "job_payment_requests_select_company_scope"
  on public.job_payment_requests;
create policy "job_payment_requests_select_company_scope"
  on public.job_payment_requests
  for select
  using (
    company_id in (
      select company_id from public.company_memberships where user_id = auth.uid()
    )
  );

drop policy if exists "job_payment_transactions_select_company_scope"
  on public.job_payment_transactions;
create policy "job_payment_transactions_select_company_scope"
  on public.job_payment_transactions
  for select
  using (
    company_id in (
      select company_id from public.company_memberships where user_id = auth.uid()
    )
  );

revoke all on table public.company_payment_accounts from public, anon, authenticated;
revoke all on table public.company_payment_settings from public, anon, authenticated;
revoke all on table public.job_payment_requests from public, anon, authenticated;
revoke all on table public.job_payment_transactions from public, anon, authenticated;

grant select on table public.company_payment_accounts to authenticated;
grant select on table public.company_payment_settings to authenticated;
grant select on table public.job_payment_requests to authenticated;
grant select on table public.job_payment_transactions to authenticated;

grant all on table public.company_payment_accounts to service_role;
grant all on table public.company_payment_settings to service_role;
grant all on table public.job_payment_requests to service_role;
grant all on table public.job_payment_transactions to service_role;

-- ---------------------------------------------------------------------------
-- 7. Attention CHECKs for payment act-now cases
-- ---------------------------------------------------------------------------

alter table public.job_attention_items
  drop constraint if exists job_attention_items_attention_type_check;

alter table public.job_attention_items
  add constraint job_attention_items_attention_type_check
  check (attention_type in (
    'customer_package_request',
    'customer_question',
    'acceptance_confirmation_required',
    'payments_not_connected',
    'payment_failed'
  ));

alter table public.job_attention_items
  drop constraint if exists job_attention_items_source_type_check;

alter table public.job_attention_items
  add constraint job_attention_items_source_type_check
  check (source_type in (
    'proposal_customer_requests',
    'proposal_acceptances',
    'jobs',
    'job_payment_requests'
  ));

create or replace function public.job_attention_items_row_guard()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
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

-- ---------------------------------------------------------------------------
-- 8. Helpers
-- ---------------------------------------------------------------------------

create or replace function public.job_payment_net_paid_cents_v1(
  p_company_id uuid,
  p_acceptance_id uuid
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

create or replace function public.job_payment_kind_net_paid_cents_v1(
  p_company_id uuid,
  p_acceptance_id uuid,
  p_kind text
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

revoke all on function public.job_payment_net_paid_cents_v1(uuid, uuid) from public, anon;
revoke all on function public.job_payment_kind_net_paid_cents_v1(uuid, uuid, text) from public, anon;
grant execute on function public.job_payment_net_paid_cents_v1(uuid, uuid) to authenticated, service_role;
grant execute on function public.job_payment_kind_net_paid_cents_v1(uuid, uuid, text) to authenticated, service_role;

create or replace function public.job_payment_snapshot_stage_v1(
  p_company_id uuid,
  p_job_id uuid
)
returns table (job_stage text, stage_entered_at timestamptz)
language sql
stable
security invoker
set search_path = public
as $$
  select
    public.canonical_job_stage_from_row(
      j.stage, j.status, coalesce(j.archived, false), j.active_proposal_id, j.latest_proposal_id
    ),
    j.stage_entered_at
  from public.jobs j
  where j.id = p_job_id
    and j.company_id = p_company_id;
$$;

create or replace function public.job_payment_open_not_connected_attention_v1(
  p_company_id uuid,
  p_job_id uuid,
  p_proposal_id uuid,
  p_proposal_version_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
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

create or replace function public.job_payment_open_failed_attention_v1(
  p_request public.job_payment_requests
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
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

create or replace function public.job_payment_resolve_attention_v1(
  p_company_id uuid,
  p_dedupe_key text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
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

revoke all on function public.job_payment_open_not_connected_attention_v1(uuid, uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.job_payment_open_failed_attention_v1(public.job_payment_requests) from public, anon, authenticated;
revoke all on function public.job_payment_resolve_attention_v1(uuid, text) from public, anon, authenticated;
grant execute on function public.job_payment_open_not_connected_attention_v1(uuid, uuid, uuid, uuid) to service_role;
grant execute on function public.job_payment_open_failed_attention_v1(public.job_payment_requests) to service_role;
grant execute on function public.job_payment_resolve_attention_v1(uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- 9. Settings + connected-account RPCs
-- ---------------------------------------------------------------------------

create or replace function public.upsert_company_payment_settings_v1(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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

create or replace function public.ensure_company_payment_settings_v1(p_company_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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

revoke all on function public.upsert_company_payment_settings_v1(jsonb) from public, anon;
revoke all on function public.ensure_company_payment_settings_v1(uuid) from public, anon;
revoke all on function public.upsert_company_payment_account_from_provider_v1(jsonb) from public, anon, authenticated;

grant execute on function public.upsert_company_payment_settings_v1(jsonb) to authenticated, service_role;
grant execute on function public.ensure_company_payment_settings_v1(uuid) to authenticated, service_role;
grant execute on function public.upsert_company_payment_account_from_provider_v1(jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- 10. create_job_payment_request_v1
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
  v_failed public.job_payment_requests%rowtype;
  v_request public.job_payment_requests%rowtype;
  v_canonical text;
  v_before_stage text;
  v_before_entered timestamptz;
  v_after_stage text;
  v_after_entered timestamptz;
  v_remaining integer;
  v_kind_paid integer;
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

  if v_company_id is null or v_job_id is null or v_kind is null or v_amount is null then
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

  v_canonical := v_before_stage;

  if coalesce(v_job.archived, false)
    or coalesce(v_job.status, 'active') <> 'active'
  then
    return jsonb_build_object('ok', false, 'code', 'job_not_active');
  end if;

  if v_canonical is distinct from 'approved' then
    return jsonb_build_object('ok', false, 'code', 'job_not_approved');
  end if;

  select a.*
  into v_acceptance
  from public.proposal_acceptances a
  where a.company_id = v_company_id
    and a.job_id = v_job_id
    and a.confirmed_at is not null
  order by a.confirmed_at desc
  limit 1
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'no_acceptance');
  end if;

  v_option_label := left(trim(v_acceptance.accepted_option_label), 120);

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

  v_remaining := v_acceptance.accepted_total_cents
    - public.job_payment_net_paid_cents_v1(v_company_id, v_acceptance.id);
  v_kind_paid := public.job_payment_kind_net_paid_cents_v1(
    v_company_id, v_acceptance.id, v_kind
  );

  if v_kind = 'deposit' and v_kind_paid > 0 then
    return jsonb_build_object('ok', false, 'code', 'deposit_already_paid');
  end if;

  if v_kind = 'balance' and public.job_payment_kind_net_paid_cents_v1(
    v_company_id, v_acceptance.id, 'deposit'
  ) <= 0 then
    return jsonb_build_object('ok', false, 'code', 'deposit_required');
  end if;

  if v_amount < 100 then
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
    if v_amount is distinct from v_failed.amount_cents then
      return jsonb_build_object('ok', false, 'code', 'invalid_amount');
    end if;
    update public.job_payment_requests
    set
      status = 'open',
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

  if v_request.status in ('cancelled', 'expired') then
    return jsonb_build_object(
      'ok', true,
      'id', v_request.id,
      'status', v_request.status,
      'idempotent_replay', true,
      'job_stage_unchanged', true
    );
  end if;

  if v_request.status not in ('open', 'processing', 'failed') then
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

create or replace function public.bind_job_payment_checkout_session_v1(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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
begin
  v_assert := public.proposal_assert_public_access_token_active_v1(p_token_hash);
  if coalesce(v_assert->>'ok', '') <> 'true' then
    return v_assert;
  end if;

  v_company_id := (v_assert->>'company_id')::uuid;
  v_proposal_id := (v_assert->>'proposal_id')::uuid;
  v_version_id := (v_assert->>'proposal_version_id')::uuid;

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

-- ---------------------------------------------------------------------------
-- 11. record_job_payment_provider_event_v1 — webhook owner
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

  if v_txn_kind is not null then
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

revoke all on function public.create_job_payment_request_v1(jsonb) from public, anon;
revoke all on function public.cancel_job_payment_request_v1(jsonb) from public, anon;
revoke all on function public.bind_job_payment_checkout_session_v1(jsonb) from public, anon, authenticated;
revoke all on function public.resolve_public_job_payment_checkout_v1(text) from public, anon, authenticated;
revoke all on function public.record_job_payment_provider_event_v1(jsonb) from public, anon, authenticated;
revoke all on function public.job_payment_snapshot_stage_v1(uuid, uuid) from public, anon;

grant execute on function public.create_job_payment_request_v1(jsonb) to authenticated, service_role;
grant execute on function public.cancel_job_payment_request_v1(jsonb) to authenticated, service_role;
grant execute on function public.bind_job_payment_checkout_session_v1(jsonb) to service_role;
grant execute on function public.resolve_public_job_payment_checkout_v1(text) to service_role;
grant execute on function public.record_job_payment_provider_event_v1(jsonb) to service_role;

comment on function public.create_job_payment_request_v1(jsonb) is
  'R3E contractor payment request. Requires Approved + active + matching formal acceptance + charge-enabled connected account. Signature is optional. NEVER writes jobs.stage or proposal_signatures.';

comment on function public.record_job_payment_provider_event_v1(jsonb) is
  'R3E Stripe Connect webhook settlement. Idempotent on provider_event_id. Paid never regresses. NEVER writes jobs.stage.';

commit;
