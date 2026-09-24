-- Phase 11 / Astra G10 — payment-request collection communication delivery.
-- Additive only. Does not mutate job_payment_requests money identity.
-- Does not invent due dates. Reuses Resend webhook inbox via extended correlation.

-- ---------------------------------------------------------------------------
-- 1. Activity event types for communication chronology
-- ---------------------------------------------------------------------------

alter table public.job_activity_events
  drop constraint if exists job_activity_events_event_type_check;

alter table public.job_activity_events
  add constraint job_activity_events_event_type_check
  check (
    event_type = any (
      array[
        'job_created'::text,
        'stage_changed'::text,
        'disposition_changed'::text,
        'job_scheduled'::text,
        'job_rescheduled'::text,
        'job_unscheduled'::text,
        'job_work_started'::text,
        'job_work_completed'::text,
        'production_lead_assigned'::text,
        'production_lead_changed'::text,
        'production_lead_cleared'::text,
        'scope_change_created'::text,
        'scope_change_proposed'::text,
        'scope_change_authorized'::text,
        'scope_change_declined'::text,
        'scope_change_voided'::text,
        'payment_request_emailed'::text,
        'payment_request_email_failed'::text
      ]
    )
  );

-- ---------------------------------------------------------------------------
-- 2. job_payment_request_delivery_attempts
-- ---------------------------------------------------------------------------

create table if not exists public.job_payment_request_delivery_attempts (
  id uuid primary key default gen_random_uuid(),

  company_id uuid not null references public.companies(id) on delete cascade,
  job_id uuid not null,
  payment_request_id uuid not null,

  channel text not null default 'email',
  provider text not null default 'resend',

  recipient_email_hash text not null,
  recipient_email_redacted text null,
  contractor_note_snapshot text null,

  token_prefix text null,
  public_access_token_id uuid null,

  idempotency_key text not null,
  attempt_number integer not null,
  status text not null,

  subject_snapshot text not null,
  body_snapshot text not null,

  provider_message_id text null,
  error_code text null,
  error_message_safe text null,

  metadata_json jsonb not null default '{}'::jsonb,

  created_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  attempted_at timestamptz null,
  provider_accepted_at timestamptz null,
  failed_at timestamptz null,
  delayed_at timestamptz null,
  delivered_at timestamptz null,
  bounced_at timestamptz null,
  complained_at timestamptz null,

  constraint job_payment_request_delivery_attempts_id_company_unique
    unique (id, company_id),

  constraint job_payment_request_delivery_attempts_job_company_fkey
    foreign key (job_id, company_id)
    references public.jobs (id, company_id)
    on delete cascade,

  constraint job_payment_request_delivery_attempts_request_company_fkey
    foreign key (payment_request_id, company_id)
    references public.job_payment_requests (id, company_id)
    on delete cascade,

  constraint job_payment_request_delivery_attempts_token_company_fkey
    foreign key (public_access_token_id, company_id)
    references public.proposal_public_access_tokens (id, company_id)
    on delete set null,

  constraint job_payment_request_delivery_attempts_channel_check
    check (channel in ('email')),

  constraint job_payment_request_delivery_attempts_provider_check
    check (provider in ('resend')),

  constraint job_payment_request_delivery_attempts_status_check
    check (status in (
      'prepared',
      'attempted',
      'provider_accepted',
      'delayed',
      'failed',
      'delivered',
      'bounced',
      'complained'
    )),

  constraint job_payment_request_delivery_attempts_attempt_number_check
    check (attempt_number >= 1),

  constraint job_payment_request_delivery_attempts_recipient_hash_format_check
    check (recipient_email_hash ~ '^[0-9a-f]{64}$'),

  constraint job_payment_request_delivery_attempts_token_prefix_check
    check (
      token_prefix is null
      or (char_length(token_prefix) >= 6 and char_length(token_prefix) <= 16)
    ),

  constraint job_payment_request_delivery_attempts_note_len_check
    check (
      contractor_note_snapshot is null
      or char_length(contractor_note_snapshot) <= 500
    ),

  constraint job_payment_request_delivery_attempts_payload_object_check
    check (jsonb_typeof(metadata_json) = 'object'),

  constraint job_payment_request_delivery_attempts_company_idempotency_unique
    unique (company_id, idempotency_key)
);

create unique index if not exists idx_job_payment_request_delivery_provider_msg
  on public.job_payment_request_delivery_attempts (provider, provider_message_id)
  where provider_message_id is not null;

create index if not exists idx_job_payment_request_delivery_request
  on public.job_payment_request_delivery_attempts (
    company_id,
    payment_request_id,
    created_at desc
  );

create index if not exists idx_job_payment_request_delivery_job
  on public.job_payment_request_delivery_attempts (
    company_id,
    job_id,
    created_at desc
  );

comment on table public.job_payment_request_delivery_attempts is
  'Phase 11 / Astra G10 — email delivery attempts for canonical payment requests. Communication only; never mutates money request identity.';

-- Row guard: money-irrelevant identity immutable after insert; status transitions only.
create or replace function public.job_payment_request_delivery_attempts_row_guard()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'job_payment_request_delivery_attempts rows are immutable';
  end if;

  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id
      or new.company_id is distinct from old.company_id
      or new.job_id is distinct from old.job_id
      or new.payment_request_id is distinct from old.payment_request_id
      or new.channel is distinct from old.channel
      or new.provider is distinct from old.provider
      or new.recipient_email_hash is distinct from old.recipient_email_hash
      or new.idempotency_key is distinct from old.idempotency_key
      or new.attempt_number is distinct from old.attempt_number
      or new.subject_snapshot is distinct from old.subject_snapshot
      or new.body_snapshot is distinct from old.body_snapshot
      or new.contractor_note_snapshot is distinct from old.contractor_note_snapshot
      or new.created_by is distinct from old.created_by
      or new.created_at is distinct from old.created_at
    then
      raise exception 'job_payment_request_delivery_attempts identity columns are immutable';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_job_payment_request_delivery_attempts_row_guard
  on public.job_payment_request_delivery_attempts;

create trigger trg_job_payment_request_delivery_attempts_row_guard
  before update or delete on public.job_payment_request_delivery_attempts
  for each row
  execute function public.job_payment_request_delivery_attempts_row_guard();

alter table public.job_payment_request_delivery_attempts enable row level security;

drop policy if exists job_payment_request_delivery_attempts_select_company_scope
  on public.job_payment_request_delivery_attempts;

create policy job_payment_request_delivery_attempts_select_company_scope
  on public.job_payment_request_delivery_attempts
  for select
  to authenticated
  using (
    company_id in (
      select cm.company_id
      from public.company_memberships cm
      where cm.user_id = auth.uid()
    )
  );

revoke all on table public.job_payment_request_delivery_attempts from public;
revoke all on table public.job_payment_request_delivery_attempts from anon;
revoke all on table public.job_payment_request_delivery_attempts from authenticated;
grant select on table public.job_payment_request_delivery_attempts to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Extend provider-event inbox correlation (same webhook, dual match)
-- ---------------------------------------------------------------------------
-- Nullable attempt id only (inbox rows may lack company_id until matched).
-- Application correlation resolves payment attempts by provider_message_id.

alter table public.proposal_delivery_provider_events
  add column if not exists payment_request_delivery_attempt_id uuid null
  references public.job_payment_request_delivery_attempts (id)
  on delete set null;

create index if not exists idx_proposal_delivery_provider_events_payment_attempt
  on public.proposal_delivery_provider_events (payment_request_delivery_attempt_id)
  where payment_request_delivery_attempt_id is not null;

comment on column public.proposal_delivery_provider_events.payment_request_delivery_attempt_id is
  'Phase 11 — optional correlation to payment-request delivery attempts (same Resend inbox).';
