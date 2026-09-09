-- Stage 3F2: catalog_items foundation
-- Schema only. Do not apply until reviewed.
-- Catalog / Price Book reusable line item definitions and quantity drivers.
-- Matches app/lib/catalogTypes.ts (CatalogItem contract).
-- No proposal totals, payment truth, approval truth, PDF/send truth, or job status belong here.
-- No app code writes to this table yet.
-- Does not alter or migrate public.service_items.

-- ---------------------------------------------------------------------------
-- catalog_items table
-- ---------------------------------------------------------------------------

create table if not exists public.catalog_items (
  id uuid primary key default gen_random_uuid(),

  company_id uuid not null references public.companies(id) on delete cascade,

  name text not null,
  customer_name text,
  description text,

  item_type text not null,
  unit text not null,
  quantity_source text not null,

  default_quantity numeric,
  coverage_rate numeric,
  waste_applies boolean not null default false,

  unit_cost_cents bigint,
  unit_price_cents bigint,
  labor_unit_cost_cents bigint,

  pricing_basis text not null default 'unit_price',
  customer_visibility text not null default 'customer_visible',

  active boolean not null default true,
  sort_order int,
  metadata jsonb,

  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint catalog_items_name_not_empty check (length(trim(name)) > 0),

  constraint catalog_items_item_type_check check (
    item_type in (
      'material',
      'labor',
      'service',
      'fee',
      'discount',
      'package'
    )
  ),

  constraint catalog_items_unit_check check (
    unit in (
      'square',
      'sqft',
      'linear_foot',
      'each',
      'bundle',
      'hour',
      'day',
      'fixed',
      'allowance'
    )
  ),

  constraint catalog_items_quantity_source_check check (
    quantity_source in (
      'roof_squares',
      'adjusted_roof_squares',
      'roof_area_sqft',
      'eaves_lf',
      'rakes_lf',
      'ridges_lf',
      'hips_lf',
      'valleys_lf',
      'wall_flashing_lf',
      'step_flashing_lf',
      'transitions_lf',
      'parapet_wall_lf',
      'drip_edge_lf',
      'starter_lf',
      'ridge_cap_lf',
      'pipe_boots_count',
      'vents_count',
      'skylights_count',
      'chimneys_count',
      'satellite_dishes_count',
      'debris_tons',
      'tear_off_squares',
      'labor_multiplier',
      'fixed',
      'custom'
    )
  ),

  constraint catalog_items_pricing_basis_check check (
    pricing_basis in (
      'unit_price',
      'cost_plus_margin',
      'fixed_price',
      'included'
    )
  ),

  constraint catalog_items_customer_visibility_check check (
    customer_visibility in (
      'customer_visible',
      'internal_only',
      'grouped'
    )
  ),

  constraint catalog_items_default_quantity_check check (
    default_quantity is null or default_quantity >= 0
  ),

  constraint catalog_items_coverage_rate_check check (
    coverage_rate is null or coverage_rate > 0
  ),

  constraint catalog_items_unit_cost_cents_check check (
    unit_cost_cents is null or unit_cost_cents >= 0
  ),

  constraint catalog_items_unit_price_cents_check check (
    unit_price_cents is null or unit_price_cents >= 0
  ),

  constraint catalog_items_labor_unit_cost_cents_check check (
    labor_unit_cost_cents is null or labor_unit_cost_cents >= 0
  )
);

-- ---------------------------------------------------------------------------
-- indexes
-- ---------------------------------------------------------------------------

create index if not exists idx_catalog_items_company_id
  on public.catalog_items(company_id);

create index if not exists idx_catalog_items_company_active
  on public.catalog_items(company_id, sort_order)
  where active = true;

create index if not exists idx_catalog_items_company_item_type
  on public.catalog_items(company_id, item_type)
  where active = true;

create index if not exists idx_catalog_items_company_quantity_source
  on public.catalog_items(company_id, quantity_source);

create index if not exists idx_catalog_items_created_at
  on public.catalog_items(created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at trigger (reuses public.set_updated_at from jobs migration)
-- ---------------------------------------------------------------------------

drop trigger if exists catalog_items_set_updated_at on public.catalog_items;

create trigger catalog_items_set_updated_at
  before update on public.catalog_items
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.catalog_items enable row level security;

drop policy if exists "catalog_items_select_company_scope" on public.catalog_items;
create policy "catalog_items_select_company_scope"
  on public.catalog_items
  for select
  using (
    company_id in (
      select company_id
      from public.company_memberships
      where user_id = auth.uid()
    )
  );

drop policy if exists "catalog_items_insert_company_scope" on public.catalog_items;
create policy "catalog_items_insert_company_scope"
  on public.catalog_items
  for insert
  with check (
    company_id in (
      select company_id
      from public.company_memberships
      where user_id = auth.uid()
    )
  );

drop policy if exists "catalog_items_update_company_scope" on public.catalog_items;
create policy "catalog_items_update_company_scope"
  on public.catalog_items
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

drop policy if exists "catalog_items_delete_company_scope" on public.catalog_items;
create policy "catalog_items_delete_company_scope"
  on public.catalog_items
  for delete
  using (
    company_id in (
      select company_id
      from public.company_memberships
      where user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Rollback, if needed before app code depends on catalog_items:
-- drop trigger if exists catalog_items_set_updated_at on public.catalog_items;
-- drop table if exists public.catalog_items cascade;
-- Do not drop public.set_updated_at(); public.jobs still uses it.
