-- FD Delivery Completeness D1:
-- Resend webhook event inbox + delayed status + allowed transitions.
-- Does not mutate proposals/acceptance/payment commercial truth.

-- 1) Allow delayed status + delayed_at on attempts
alter table public.proposal_delivery_attempts
  drop constraint if exists proposal_delivery_attempts_status_check;

alter table public.proposal_delivery_attempts
  add constraint proposal_delivery_attempts_status_check
  check (
    status = any (
      array[
        'prepared'::text,
        'attempted'::text,
        'provider_accepted'::text,
        'delayed'::text,
        'failed'::text,
        'delivered'::text,
        'bounced'::text,
        'complained'::text
      ]
    )
  );

alter table public.proposal_delivery_attempts
  add column if not exists delayed_at timestamptz;

comment on column public.proposal_delivery_attempts.delayed_at is
  'Set when provider reports a temporary delivery delay. Soft state; may advance to delivered/bounced/failed.';

-- 2) Replace row-guard transitions for delayed + complaint-after-deliver
create or replace function public.proposal_delivery_attempt_row_guard()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'UPDATE' then
    if new.company_id is distinct from old.company_id
      or new.proposal_id is distinct from old.proposal_id
      or new.proposal_version_id is distinct from old.proposal_version_id
      or new.idempotency_key is distinct from old.idempotency_key
      or new.recipient_email_hash is distinct from old.recipient_email_hash
      or new.subject_snapshot is distinct from old.subject_snapshot
      or new.body_snapshot is distinct from old.body_snapshot
      or new.channel is distinct from old.channel
      or new.provider is distinct from old.provider
      or new.created_by is distinct from old.created_by
      or new.created_at is distinct from old.created_at
    then
      raise exception
        'proposal_delivery_attempts binding and snapshot fields are immutable after insert';
    end if;

    if new.status is distinct from old.status then
      if not (
        (old.status = 'prepared' and new.status = 'attempted')
        or (old.status = 'attempted' and new.status in ('provider_accepted', 'failed'))
        or (
          old.status = 'provider_accepted'
          and new.status in ('delayed', 'delivered', 'bounced', 'failed', 'complained')
        )
        or (
          old.status = 'delayed'
          and new.status in ('delivered', 'bounced', 'failed', 'complained')
        )
        or (old.status = 'delivered' and new.status = 'complained')
      ) then
        raise exception
          'invalid proposal_delivery_attempts status transition from % to %',
          old.status,
          new.status;
      end if;
    end if;
  end if;

  return new;
end;
$$;

-- 3) Durable provider event inbox (svix idempotency + unresolved race retention)
create table if not exists public.proposal_delivery_provider_events (
  id uuid primary key default gen_random_uuid(),
  svix_id text not null,
  provider text not null default 'resend',
  provider_email_id text not null,
  event_type text not null,
  provider_created_at timestamptz null,
  delivery_attempt_id uuid null,
  company_id uuid null,
  apply_state text not null default 'received',
  apply_detail text null,
  safe_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  applied_at timestamptz null,
  constraint proposal_delivery_provider_events_provider_check
    check (provider = 'resend'),
  constraint proposal_delivery_provider_events_event_type_check
    check (
      event_type = any (
        array[
          'email.sent'::text,
          'email.delivered'::text,
          'email.delivery_delayed'::text,
          'email.bounced'::text,
          'email.failed'::text,
          'email.complained'::text
        ]
      )
    ),
  constraint proposal_delivery_provider_events_apply_state_check
    check (
      apply_state = any (
        array[
          'received'::text,
          'applied'::text,
          'ignored'::text,
          'unresolved'::text,
          'duplicate'::text
        ]
      )
    ),
  constraint proposal_delivery_provider_events_metadata_object_check
    check (jsonb_typeof(safe_metadata) = 'object'),
  constraint proposal_delivery_provider_events_svix_unique unique (svix_id)
);

create index if not exists idx_proposal_delivery_provider_events_email_id
  on public.proposal_delivery_provider_events (provider, provider_email_id, created_at desc);

create index if not exists idx_proposal_delivery_provider_events_unresolved
  on public.proposal_delivery_provider_events (apply_state, provider_email_id)
  where apply_state = 'unresolved';

create index if not exists idx_proposal_delivery_provider_events_attempt
  on public.proposal_delivery_provider_events (delivery_attempt_id)
  where delivery_attempt_id is not null;

alter table public.proposal_delivery_provider_events
  add constraint proposal_delivery_provider_events_attempt_fkey
  foreign key (delivery_attempt_id, company_id)
  references public.proposal_delivery_attempts (id, company_id)
  on delete set null;

alter table public.proposal_delivery_provider_events enable row level security;

-- No authenticated access — service-role / server webhook only.
revoke all on table public.proposal_delivery_provider_events from public, anon, authenticated;
grant all on table public.proposal_delivery_provider_events to service_role;

create or replace function public.proposal_delivery_provider_events_set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists proposal_delivery_provider_events_set_updated_at
  on public.proposal_delivery_provider_events;
create trigger proposal_delivery_provider_events_set_updated_at
before update on public.proposal_delivery_provider_events
for each row execute function public.proposal_delivery_provider_events_set_updated_at();

comment on table public.proposal_delivery_provider_events is
  'D1 Resend/Svix webhook inbox. Idempotent on svix_id. Correlates to proposal_delivery_attempts via provider email_id. Unresolved rows retained for race reconciliation. No client company_id authority.';
