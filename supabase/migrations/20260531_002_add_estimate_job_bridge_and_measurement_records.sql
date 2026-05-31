-- Stage 3C: estimate job bridge + measurement_records foundation
-- Schema only. Do not apply until reviewed.
-- Adds nullable estimates.job_id bridge to public.jobs.
-- Creates measurement_records as the future roof measurement truth.
-- Measurement records attach to job_id long-term and estimate_id during transition.
-- No app code writes to this table yet.
-- No pricing, payment, approval, PDF, or send truth belongs in measurement_records.

-- ---------------------------------------------------------------------------
-- estimates.job_id bridge
-- ---------------------------------------------------------------------------

alter table public.estimates
  add column if not exists job_id uuid
  references public.jobs(id) on delete set null;

create index if not exists idx_estimates_job_id
  on public.estimates(job_id)
  where job_id is not null;

create index if not exists idx_estimates_company_job
  on public.estimates(company_id, job_id)
  where job_id is not null;

-- ---------------------------------------------------------------------------
-- measurement_records table
-- ---------------------------------------------------------------------------

create table if not exists public.measurement_records (
  id uuid primary key default gen_random_uuid(),

  company_id uuid not null references public.companies(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete cascade,
  estimate_id uuid references public.estimates(id) on delete set null,

  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  status text not null default 'draft',
  is_selected boolean not null default false,

  source_type text not null default 'manual',
  source_provider text,
  source_report_id text,
  source_file_id text,
  source_url text,
  source_created_at timestamptz,
  imported_at timestamptz,
  model_version text,
  source_metadata jsonb,

  is_verified boolean not null default false,
  verified_by uuid,
  verified_at timestamptz,
  verification_notes text,

  confidence_score numeric(4, 3),
  confidence_label text,
  field_confidence jsonb,

  roof_area_sqft numeric,
  roof_squares numeric,
  adjusted_roof_squares numeric,
  waste_percent numeric,
  predominant_pitch text,
  pitch_label text,
  pitch_segments jsonb,
  stories text,
  roof_complexity text,
  roof_type text,
  structure_count int,
  roof_facets_count int,

  eaves_lf numeric,
  rakes_lf numeric,
  ridges_lf numeric,
  hips_lf numeric,
  valleys_lf numeric,
  wall_flashing_lf numeric,
  step_flashing_lf numeric,
  transitions_lf numeric,
  parapet_wall_lf numeric,
  drip_edge_lf numeric,
  starter_lf numeric,
  ridge_cap_lf numeric,

  pipe_boots_count int,
  vents_count int,
  skylights_count int,
  chimneys_count int,
  satellite_dishes_count int,
  other_penetrations jsonb,

  existing_layers_count int,
  tear_off_required boolean,
  debris_tons_estimate numeric,
  disposal_notes text,

  report_attached boolean not null default false,
  diagram_available boolean not null default false,
  report_file_id text,
  report_type text,
  report_source text,
  report_status text,
  report_last_updated_at timestamptz,

  raw_measurements jsonb,
  assumptions jsonb,
  warnings jsonb,
  missing_fields jsonb,
  quantity_map jsonb,

  measurement_readiness_score int,
  estimate_ready boolean not null default false,
  production_ready boolean not null default false,

  constraint measurement_records_source_type_check check (
    source_type in (
      'manual',
      'report_import',
      'provider_report',
      'satellite',
      'aerial',
      'photo_ai',
      'address_ai',
      'contractor_verified',
      'external_import'
    )
  ),

  constraint measurement_records_status_check check (
    status in (
      'draft',
      'needs_review',
      'incomplete',
      'measured',
      'verified',
      'rejected',
      'stale'
    )
  ),

  constraint measurement_records_confidence_label_check check (
    confidence_label is null
    or confidence_label in ('low', 'medium', 'high', 'verified')
  ),

  constraint measurement_records_confidence_score_check check (
    confidence_score is null
    or (confidence_score >= 0 and confidence_score <= 1)
  )
);

-- ---------------------------------------------------------------------------
-- indexes
-- ---------------------------------------------------------------------------

create index if not exists idx_measurement_records_company_id
  on public.measurement_records(company_id);

create index if not exists idx_measurement_records_job_id
  on public.measurement_records(job_id)
  where job_id is not null;

create index if not exists idx_measurement_records_estimate_id
  on public.measurement_records(estimate_id)
  where estimate_id is not null;

create index if not exists idx_measurement_records_source_type
  on public.measurement_records(source_type);

create index if not exists idx_measurement_records_status
  on public.measurement_records(status);

create index if not exists idx_measurement_records_selected
  on public.measurement_records(company_id, is_selected)
  where is_selected = true;

create index if not exists idx_measurement_records_created_at
  on public.measurement_records(created_at desc);

create index if not exists idx_measurement_records_report_file_id
  on public.measurement_records(report_file_id)
  where report_file_id is not null;

create index if not exists idx_measurement_records_estimate_ready
  on public.measurement_records(company_id, estimate_ready)
  where estimate_ready = true;

create index if not exists idx_measurement_records_production_ready
  on public.measurement_records(company_id, production_ready)
  where production_ready = true;

create unique index if not exists idx_measurement_records_one_selected_per_job
  on public.measurement_records(job_id)
  where is_selected = true and job_id is not null;

create unique index if not exists idx_measurement_records_one_selected_per_estimate
  on public.measurement_records(estimate_id)
  where is_selected = true and estimate_id is not null;

-- ---------------------------------------------------------------------------
-- updated_at trigger (reuses public.set_updated_at from jobs migration)
-- ---------------------------------------------------------------------------

drop trigger if exists measurement_records_set_updated_at on public.measurement_records;

create trigger measurement_records_set_updated_at
  before update on public.measurement_records
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.measurement_records enable row level security;

drop policy if exists "measurement_records_select_company_scope" on public.measurement_records;
create policy "measurement_records_select_company_scope"
  on public.measurement_records
  for select
  using (
    company_id in (
      select company_id
      from public.company_memberships
      where user_id = auth.uid()
    )
  );

drop policy if exists "measurement_records_insert_company_scope" on public.measurement_records;
create policy "measurement_records_insert_company_scope"
  on public.measurement_records
  for insert
  with check (
    company_id in (
      select company_id
      from public.company_memberships
      where user_id = auth.uid()
    )
    and (
      job_id is null
      or exists (
        select 1
        from public.jobs j
        where j.id = job_id
          and j.company_id = measurement_records.company_id
      )
    )
    and (
      estimate_id is null
      or exists (
        select 1
        from public.estimates e
        where e.id = estimate_id
          and e.company_id = measurement_records.company_id
      )
    )
  );

drop policy if exists "measurement_records_update_company_scope" on public.measurement_records;
create policy "measurement_records_update_company_scope"
  on public.measurement_records
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
    and (
      job_id is null
      or exists (
        select 1
        from public.jobs j
        where j.id = job_id
          and j.company_id = measurement_records.company_id
      )
    )
    and (
      estimate_id is null
      or exists (
        select 1
        from public.estimates e
        where e.id = estimate_id
          and e.company_id = measurement_records.company_id
      )
    )
  );

drop policy if exists "measurement_records_delete_company_scope" on public.measurement_records;
create policy "measurement_records_delete_company_scope"
  on public.measurement_records
  for delete
  using (
    company_id in (
      select company_id
      from public.company_memberships
      where user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Rollback, if needed before app code depends on measurement_records:
-- drop trigger if exists measurement_records_set_updated_at on public.measurement_records;
-- drop table if exists public.measurement_records cascade;
-- drop index if exists public.idx_estimates_company_job;
-- drop index if exists public.idx_estimates_job_id;
-- alter table public.estimates drop column if exists job_id;
-- Do not drop public.set_updated_at(); public.jobs still uses it.
