-- R11b: company_branding_profiles foundation (Settings branding expansion)
-- Schema only. Do not apply until reviewed.
--
-- Owns company-level proposal/customer-facing branding (address, website, brand
-- colors, CLN-on-cover preference). One row per company.
--
-- Boundaries:
--   - Core account identity remains on public.companies (name, owner_email, phone,
--     license, logo_url, notifications_email).
--   - Pricing/profitability remains in public.company_pricing_policies.
--   - Template content/settings remain in public.proposal_template_* tables.
--   - Job proposal pages remain in public.proposal_pages.
--   - metadata jsonb is for future branding-only extensions (not typed columns).
--
-- Does not alter public.companies, company_pricing_policies, proposal_template_*,
-- proposal_*, jobs, or company_memberships.

-- ---------------------------------------------------------------------------
-- company_branding_profiles table
-- ---------------------------------------------------------------------------

create table if not exists public.company_branding_profiles (
  id uuid primary key default gen_random_uuid(),

  company_id uuid not null references public.companies(id) on delete cascade,

  address text,
  website text,
  brand_primary_color text,
  brand_secondary_color text,
  show_license_on_cover boolean not null default false,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint company_branding_profiles_company_id_unique unique (company_id)
);

-- ---------------------------------------------------------------------------
-- indexes
-- ---------------------------------------------------------------------------

create index if not exists idx_company_branding_profiles_company_id
  on public.company_branding_profiles(company_id);

-- ---------------------------------------------------------------------------
-- updated_at trigger (reuses public.set_updated_at from jobs migration)
-- ---------------------------------------------------------------------------

drop trigger if exists company_branding_profiles_set_updated_at on public.company_branding_profiles;

create trigger company_branding_profiles_set_updated_at
  before update on public.company_branding_profiles
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.company_branding_profiles enable row level security;

drop policy if exists "company_branding_profiles_select_company_scope" on public.company_branding_profiles;
create policy "company_branding_profiles_select_company_scope"
  on public.company_branding_profiles
  for select
  using (
    company_id in (
      select company_id
      from public.company_memberships
      where user_id = auth.uid()
    )
  );

drop policy if exists "company_branding_profiles_insert_company_scope" on public.company_branding_profiles;
create policy "company_branding_profiles_insert_company_scope"
  on public.company_branding_profiles
  for insert
  with check (
    company_id in (
      select company_id
      from public.company_memberships
      where user_id = auth.uid()
    )
  );

drop policy if exists "company_branding_profiles_update_company_scope" on public.company_branding_profiles;
create policy "company_branding_profiles_update_company_scope"
  on public.company_branding_profiles
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

-- ---------------------------------------------------------------------------
-- Rollback, if needed before app code depends on company_branding_profiles:
-- drop trigger if exists company_branding_profiles_set_updated_at on public.company_branding_profiles;
-- drop table if exists public.company_branding_profiles cascade;
-- Do not drop public.set_updated_at(); public.jobs and other tables still use it.
