-- Stage 3B: jobs table foundation
-- Schema only. Do not apply until reviewed.
-- No app code writes to this table yet.
-- Job is the operational Job Card record.
-- Estimates/proposals remain contractual/financial records.
-- Payments and approvals stay tied to estimates/proposals, not jobs.

-- ---------------------------------------------------------------------------
-- jobs table
-- ---------------------------------------------------------------------------

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),

  company_id uuid not null references public.companies(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,

  job_name text,

  stage text not null default 'intake',
  status text not null default 'active',
  source text not null default 'manual',
  priority text default 'normal',

  customer_name text,
  customer_email text,
  customer_phone text,

  address_line1 text,
  address_line2 text,
  address_city text,
  address_state text,
  address_zip text,
  address_country text default 'US',
  address_formatted text,

  assigned_to uuid,
  created_by uuid,
  updated_by uuid,

  notes text,
  summary text,
  last_activity_at timestamptz,

  archived boolean not null default false,
  deleted_at timestamptz,

  selected_measurement_id uuid,
  active_proposal_id uuid,
  latest_estimate_id text,
  latest_proposal_id uuid,

  source_metadata jsonb,
  custom_fields jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint jobs_stage_check check (
    stage in (
      'intake',
      'measurement',
      'estimating',
      'proposal',
      'approved',
      'production',
      'complete',
      'archived'
    )
  ),

  constraint jobs_status_check check (
    status in (
      'active',
      'on_hold',
      'won',
      'lost',
      'closed',
      'archived'
    )
  ),

  constraint jobs_source_check check (
    source in (
      'manual',
      'intake',
      'referral',
      'website',
      'phone',
      'email',
      'campaign',
      'external_import',
      'unknown'
    )
  ),

  constraint jobs_priority_check check (
    priority in (
      'low',
      'normal',
      'high',
      'urgent'
    )
  )
);

-- ---------------------------------------------------------------------------
-- indexes
-- ---------------------------------------------------------------------------

create index if not exists idx_jobs_company_id
  on public.jobs(company_id);

create index if not exists idx_jobs_customer_id
  on public.jobs(customer_id);

create index if not exists idx_jobs_stage
  on public.jobs(stage);

create index if not exists idx_jobs_status
  on public.jobs(status);

create index if not exists idx_jobs_created_at
  on public.jobs(created_at desc);

create index if not exists idx_jobs_updated_at
  on public.jobs(updated_at desc);

create index if not exists idx_jobs_last_activity_at
  on public.jobs(last_activity_at desc nulls last);

create index if not exists idx_jobs_assigned_to
  on public.jobs(assigned_to)
  where assigned_to is not null;

create index if not exists idx_jobs_active
  on public.jobs(company_id, created_at desc)
  where archived = false and deleted_at is null;

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists jobs_set_updated_at on public.jobs;

create trigger jobs_set_updated_at
  before update on public.jobs
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.jobs enable row level security;

drop policy if exists "jobs_select_company_scope" on public.jobs;
create policy "jobs_select_company_scope"
  on public.jobs
  for select
  using (
    company_id in (
      select company_id
      from public.company_memberships
      where user_id = auth.uid()
    )
  );

drop policy if exists "jobs_insert_company_scope" on public.jobs;
create policy "jobs_insert_company_scope"
  on public.jobs
  for insert
  with check (
    company_id in (
      select company_id
      from public.company_memberships
      where user_id = auth.uid()
    )
  );

drop policy if exists "jobs_update_company_scope" on public.jobs;
create policy "jobs_update_company_scope"
  on public.jobs
  for update
  using (
    company_id in (
      select company_id
      from public.company_memberships
      where user_id = auth.uid()
    )
  )
  with check (
    company_id in (
      select company_id
      from public.company_memberships
      where user_id = auth.uid()
    )
  );

drop policy if exists "jobs_delete_company_scope" on public.jobs;
create policy "jobs_delete_company_scope"
  on public.jobs
  for delete
  using (
    company_id in (
      select company_id
      from public.company_memberships
      where user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Rollback, if needed before app code depends on jobs:
-- drop trigger if exists jobs_set_updated_at on public.jobs;
-- drop table if exists public.jobs cascade;
-- drop function if exists public.set_updated_at();
