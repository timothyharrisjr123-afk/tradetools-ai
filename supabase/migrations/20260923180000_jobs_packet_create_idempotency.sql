-- Phase 6 / Astra G6 — durable packet job create idempotency.
-- Client supplies source_metadata.create_idempotency_key before insert.
-- Lost HTTP responses and concurrent retries converge on one job per company+key.
-- Does not copy job-specific commercial/ops truth.

create unique index if not exists idx_jobs_company_create_idempotency_key
  on public.jobs (
    company_id,
    ((source_metadata ->> 'create_idempotency_key'))
  )
  where coalesce(source_metadata ->> 'create_idempotency_key', '') <> ''
    and deleted_at is null;

comment on index public.idx_jobs_company_create_idempotency_key is
  'Astra G6 packet create idempotency: one live job per company + create_idempotency_key.';
