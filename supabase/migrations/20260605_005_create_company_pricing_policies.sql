-- Stage 3I-3B2A: company_pricing_policies foundation
-- Schema only. Do not apply until reviewed.
-- Company-scoped real pricing policy (precedence layer 1 — see docs §6L/§6M).
-- Matches app/lib/proposalPricingTypes.ts (PricingPolicy) + companyPricingPolicy.ts resolver.
-- No proposal totals, payment truth, approval truth, PDF/send truth, or job status belong here.
-- No app code reads or writes this table yet (store arrives in 3I-3B2B).
-- Does not alter or migrate public.companies.
-- Discount and subtotal-override are deliberately omitted (deferred per resolver contract).

-- ---------------------------------------------------------------------------
-- company_pricing_policies table
-- ---------------------------------------------------------------------------

create table if not exists public.company_pricing_policies (
  id uuid primary key default gen_random_uuid(),

  company_id uuid not null references public.companies(id) on delete cascade,

  profitability_type text not null default 'margin',
  default_profitability_pct numeric not null,
  minimum_profitability_pct numeric not null,

  quantity_rounding text not null default 'exact',
  waste_model text not null default 'adjusted_measurement',

  sales_tax_rate_pct numeric not null default 0,
  material_purchase_tax_rate_pct numeric,

  metadata jsonb,

  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint company_pricing_policies_company_id_unique unique (company_id),

  constraint company_pricing_policies_profitability_type_check check (
    profitability_type in ('margin', 'markup')
  ),

  constraint company_pricing_policies_quantity_rounding_check check (
    quantity_rounding in ('exact')
  ),

  constraint company_pricing_policies_waste_model_check check (
    waste_model in ('adjusted_measurement')
  ),

  constraint company_pricing_policies_default_pct_check check (
    default_profitability_pct >= 0
  ),

  constraint company_pricing_policies_minimum_pct_check check (
    minimum_profitability_pct >= 0
  ),

  constraint company_pricing_policies_minimum_le_default_check check (
    minimum_profitability_pct <= default_profitability_pct
  ),

  constraint company_pricing_policies_sales_tax_check check (
    sales_tax_rate_pct >= 0
  ),

  constraint company_pricing_policies_material_tax_check check (
    material_purchase_tax_rate_pct is null or material_purchase_tax_rate_pct >= 0
  ),

  -- Margin math diverges at 100% (margin >= 100 is unpriced in the engine), so
  -- margin policies must stay strictly below 100; markup has no such ceiling here.
  constraint company_pricing_policies_margin_default_lt_100_check check (
    profitability_type <> 'margin' or default_profitability_pct < 100
  ),

  constraint company_pricing_policies_margin_minimum_lt_100_check check (
    profitability_type <> 'margin' or minimum_profitability_pct < 100
  )
);

-- ---------------------------------------------------------------------------
-- indexes
-- ---------------------------------------------------------------------------

create index if not exists idx_company_pricing_policies_company_id
  on public.company_pricing_policies(company_id);

-- ---------------------------------------------------------------------------
-- updated_at trigger (reuses public.set_updated_at from jobs migration)
-- ---------------------------------------------------------------------------

drop trigger if exists company_pricing_policies_set_updated_at on public.company_pricing_policies;

create trigger company_pricing_policies_set_updated_at
  before update on public.company_pricing_policies
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.company_pricing_policies enable row level security;

drop policy if exists "company_pricing_policies_select_company_scope" on public.company_pricing_policies;
create policy "company_pricing_policies_select_company_scope"
  on public.company_pricing_policies
  for select
  using (
    company_id in (
      select company_id
      from public.company_memberships
      where user_id = auth.uid()
    )
  );

drop policy if exists "company_pricing_policies_insert_company_scope" on public.company_pricing_policies;
create policy "company_pricing_policies_insert_company_scope"
  on public.company_pricing_policies
  for insert
  with check (
    company_id in (
      select company_id
      from public.company_memberships
      where user_id = auth.uid()
    )
  );

drop policy if exists "company_pricing_policies_update_company_scope" on public.company_pricing_policies;
create policy "company_pricing_policies_update_company_scope"
  on public.company_pricing_policies
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

drop policy if exists "company_pricing_policies_delete_company_scope" on public.company_pricing_policies;
create policy "company_pricing_policies_delete_company_scope"
  on public.company_pricing_policies
  for delete
  using (
    company_id in (
      select company_id
      from public.company_memberships
      where user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Rollback, if needed before app code depends on company_pricing_policies:
-- drop trigger if exists company_pricing_policies_set_updated_at on public.company_pricing_policies;
-- drop table if exists public.company_pricing_policies cascade;
-- Do not drop public.set_updated_at(); public.jobs and public.catalog_items still use it.
