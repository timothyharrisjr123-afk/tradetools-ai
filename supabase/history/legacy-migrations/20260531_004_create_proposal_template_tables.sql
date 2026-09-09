-- Stage 3G2: proposal template tables foundation
-- Schema only. Do not apply until reviewed.
--
-- Roofr-style spine: Catalog (catalog_items) → Proposal Templates → Proposal Builder (later).
-- Normalized four-table model matching app/lib/proposalTemplateTypes.ts.
--
-- This migration intentionally does NOT create:
--   - job proposal records or line-item snapshots
--   - pricing totals, unit price overrides, margin/tax fields
--   - send/PDF, approval, payment, or status/pipeline truth
--   - material orders, work orders, or invoices
--   - changes to jobs.active_proposal_id, service_items, or legacy estimates
--
-- Pricing remains on catalog_items and a future deterministic proposal/pricing bridge.
-- No app code should write to these tables until proposalTemplateStore (3G3+) is scoped.

-- ---------------------------------------------------------------------------
-- catalog_items: composite unique for template item FK integrity
-- ---------------------------------------------------------------------------

alter table public.catalog_items
  add constraint catalog_items_id_company_unique unique (id, company_id);

-- ---------------------------------------------------------------------------
-- proposal_templates
-- ---------------------------------------------------------------------------
-- Company-owned reusable internal template package.
-- `name` is internal; customer-facing labels belong on options/sections.

create table if not exists public.proposal_templates (
  id uuid primary key default gen_random_uuid(),

  company_id uuid not null references public.companies(id) on delete cascade,

  name text not null,
  description text,

  status text not null default 'draft',
  active boolean not null default true,
  sort_order int,

  metadata jsonb not null default '{}'::jsonb,

  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint proposal_templates_id_company_unique unique (id, company_id),

  constraint proposal_templates_name_not_empty check (length(trim(name)) > 0),

  constraint proposal_templates_status_check check (
    status in ('draft', 'active', 'archived')
  ),

  constraint proposal_templates_metadata_object_check check (
    jsonb_typeof(metadata) = 'object'
  )
);

-- ---------------------------------------------------------------------------
-- proposal_template_options
-- ---------------------------------------------------------------------------
-- Customer-facing package/choice inside a template (e.g. Good / Better / Best).

create table if not exists public.proposal_template_options (
  id uuid primary key default gen_random_uuid(),

  company_id uuid not null references public.companies(id) on delete cascade,
  template_id uuid not null,

  name text not null,
  customer_label text,
  description text,

  selection_mode text not null default 'included',
  is_default boolean not null default false,
  visible_to_customer boolean not null default true,
  sort_order int,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint proposal_template_options_id_company_unique unique (id, company_id),

  constraint proposal_template_options_id_template_company_unique
    unique (id, template_id, company_id),

  constraint proposal_template_options_template_company_fkey
    foreign key (template_id, company_id)
    references public.proposal_templates (id, company_id)
    on delete cascade,

  constraint proposal_template_options_name_not_empty check (length(trim(name)) > 0),

  constraint proposal_template_options_selection_mode_check check (
    selection_mode in ('single', 'multi', 'included')
  ),

  constraint proposal_template_options_metadata_object_check check (
    jsonb_typeof(metadata) = 'object'
  )
);

-- ---------------------------------------------------------------------------
-- proposal_template_sections
-- ---------------------------------------------------------------------------
-- Ordered content block inside an option.

create table if not exists public.proposal_template_sections (
  id uuid primary key default gen_random_uuid(),

  company_id uuid not null references public.companies(id) on delete cascade,
  template_id uuid not null,
  option_id uuid not null,

  kind text not null,
  name text not null,
  customer_title text,
  customer_visibility text not null default 'customer_visible',
  sort_order int,

  content jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint proposal_template_sections_id_company_unique unique (id, company_id),

  constraint proposal_template_sections_id_option_template_company_unique
    unique (id, option_id, template_id, company_id),

  constraint proposal_template_sections_template_company_fkey
    foreign key (template_id, company_id)
    references public.proposal_templates (id, company_id)
    on delete cascade,

  constraint proposal_template_sections_option_template_company_fkey
    foreign key (option_id, template_id, company_id)
    references public.proposal_template_options (id, template_id, company_id)
    on delete cascade,

  constraint proposal_template_sections_name_not_empty check (length(trim(name)) > 0),

  constraint proposal_template_sections_kind_check check (
    kind in (
      'line_items',
      'text',
      'upgrade_group',
      'terms',
      'warranty',
      'image',
      'signature_placeholder'
    )
  ),

  constraint proposal_template_sections_customer_visibility_check check (
    customer_visibility in (
      'customer_visible',
      'internal_only',
      'grouped'
    )
  ),

  constraint proposal_template_sections_content_object_check check (
    jsonb_typeof(content) = 'object'
  ),

  constraint proposal_template_sections_metadata_object_check check (
    jsonb_typeof(metadata) = 'object'
  )
);

-- ---------------------------------------------------------------------------
-- proposal_template_items
-- ---------------------------------------------------------------------------
-- Catalog-backed line inside a template section.

create table if not exists public.proposal_template_items (
  id uuid primary key default gen_random_uuid(),

  company_id uuid not null references public.companies(id) on delete cascade,
  template_id uuid not null,
  option_id uuid not null,
  section_id uuid not null,

  catalog_item_id uuid,
  catalog_seed_key text,

  item_role text not null default 'standard',
  customer_name_override text,
  description_override text,
  customer_visibility text not null default 'inherit_catalog',

  quantity_rule jsonb,
  sort_order int,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint proposal_template_items_template_company_fkey
    foreign key (template_id, company_id)
    references public.proposal_templates (id, company_id)
    on delete cascade,

  constraint proposal_template_items_option_template_company_fkey
    foreign key (option_id, template_id, company_id)
    references public.proposal_template_options (id, template_id, company_id)
    on delete cascade,

  constraint proposal_template_items_section_option_template_company_fkey
    foreign key (section_id, option_id, template_id, company_id)
    references public.proposal_template_sections (id, option_id, template_id, company_id)
    on delete cascade,

  constraint proposal_template_items_catalog_item_company_fkey
    foreign key (catalog_item_id, company_id)
    references public.catalog_items (id, company_id)
    on delete set null,

  constraint proposal_template_items_catalog_reference_check check (
    catalog_item_id is not null
    or (
      catalog_seed_key is not null
      and length(trim(catalog_seed_key)) > 0
    )
  ),

  constraint proposal_template_items_item_role_check check (
    item_role in (
      'standard',
      'included',
      'upgrade',
      'optional_addon',
      'fee',
      'discount'
    )
  ),

  constraint proposal_template_items_customer_visibility_check check (
    customer_visibility in (
      'inherit_catalog',
      'customer_visible',
      'internal_only',
      'grouped'
    )
  ),

  constraint proposal_template_items_quantity_rule_object_check check (
    quantity_rule is null or jsonb_typeof(quantity_rule) = 'object'
  ),

  constraint proposal_template_items_metadata_object_check check (
    jsonb_typeof(metadata) = 'object'
  )
);

-- ---------------------------------------------------------------------------
-- indexes — proposal_templates
-- ---------------------------------------------------------------------------

create index if not exists idx_proposal_templates_company_id
  on public.proposal_templates(company_id);

create index if not exists idx_proposal_templates_company_active_sort
  on public.proposal_templates(company_id, sort_order)
  where active = true;

create index if not exists idx_proposal_templates_company_status
  on public.proposal_templates(company_id, status);

create index if not exists idx_proposal_templates_created_at
  on public.proposal_templates(created_at desc);

create unique index if not exists idx_proposal_templates_company_seed_key
  on public.proposal_templates(company_id, (metadata->>'seed_key'))
  where metadata ? 'seed_key'
    and length(trim(metadata->>'seed_key')) > 0;

-- ---------------------------------------------------------------------------
-- indexes — proposal_template_options
-- ---------------------------------------------------------------------------

create index if not exists idx_proposal_template_options_company_id
  on public.proposal_template_options(company_id);

create index if not exists idx_proposal_template_options_template_sort
  on public.proposal_template_options(template_id, sort_order);

create unique index if not exists idx_proposal_template_options_one_default_per_template
  on public.proposal_template_options(template_id)
  where is_default = true;

create unique index if not exists idx_proposal_template_options_template_seed_key
  on public.proposal_template_options(template_id, (metadata->>'seed_key'))
  where metadata ? 'seed_key'
    and length(trim(metadata->>'seed_key')) > 0;

-- ---------------------------------------------------------------------------
-- indexes — proposal_template_sections
-- ---------------------------------------------------------------------------

create index if not exists idx_proposal_template_sections_company_id
  on public.proposal_template_sections(company_id);

create index if not exists idx_proposal_template_sections_template_option
  on public.proposal_template_sections(template_id, option_id);

create index if not exists idx_proposal_template_sections_option_sort
  on public.proposal_template_sections(option_id, sort_order);

create unique index if not exists idx_proposal_template_sections_option_seed_key
  on public.proposal_template_sections(option_id, (metadata->>'seed_key'))
  where metadata ? 'seed_key'
    and length(trim(metadata->>'seed_key')) > 0;

-- ---------------------------------------------------------------------------
-- indexes — proposal_template_items
-- ---------------------------------------------------------------------------

create index if not exists idx_proposal_template_items_company_id
  on public.proposal_template_items(company_id);

create index if not exists idx_proposal_template_items_template_id
  on public.proposal_template_items(template_id);

create index if not exists idx_proposal_template_items_option_id
  on public.proposal_template_items(option_id);

create index if not exists idx_proposal_template_items_section_sort
  on public.proposal_template_items(section_id, sort_order);

create index if not exists idx_proposal_template_items_catalog_item_id
  on public.proposal_template_items(catalog_item_id)
  where catalog_item_id is not null;

create unique index if not exists idx_proposal_template_items_section_seed_key
  on public.proposal_template_items(section_id, (metadata->>'seed_key'))
  where metadata ? 'seed_key'
    and length(trim(metadata->>'seed_key')) > 0;

-- ---------------------------------------------------------------------------
-- updated_at triggers (reuses public.set_updated_at from jobs migration)
-- ---------------------------------------------------------------------------

drop trigger if exists proposal_templates_set_updated_at on public.proposal_templates;
create trigger proposal_templates_set_updated_at
  before update on public.proposal_templates
  for each row
  execute function public.set_updated_at();

drop trigger if exists proposal_template_options_set_updated_at on public.proposal_template_options;
create trigger proposal_template_options_set_updated_at
  before update on public.proposal_template_options
  for each row
  execute function public.set_updated_at();

drop trigger if exists proposal_template_sections_set_updated_at on public.proposal_template_sections;
create trigger proposal_template_sections_set_updated_at
  before update on public.proposal_template_sections
  for each row
  execute function public.set_updated_at();

drop trigger if exists proposal_template_items_set_updated_at on public.proposal_template_items;
create trigger proposal_template_items_set_updated_at
  before update on public.proposal_template_items
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS — proposal_templates
-- ---------------------------------------------------------------------------

alter table public.proposal_templates enable row level security;

drop policy if exists "proposal_templates_select_company_scope" on public.proposal_templates;
create policy "proposal_templates_select_company_scope"
  on public.proposal_templates
  for select
  using (
    company_id in (
      select company_id
      from public.company_memberships
      where user_id = auth.uid()
    )
  );

drop policy if exists "proposal_templates_insert_company_scope" on public.proposal_templates;
create policy "proposal_templates_insert_company_scope"
  on public.proposal_templates
  for insert
  with check (
    company_id in (
      select company_id
      from public.company_memberships
      where user_id = auth.uid()
    )
  );

drop policy if exists "proposal_templates_update_company_scope" on public.proposal_templates;
create policy "proposal_templates_update_company_scope"
  on public.proposal_templates
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

drop policy if exists "proposal_templates_delete_company_scope" on public.proposal_templates;
create policy "proposal_templates_delete_company_scope"
  on public.proposal_templates
  for delete
  using (
    company_id in (
      select company_id
      from public.company_memberships
      where user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- RLS — proposal_template_options
-- ---------------------------------------------------------------------------

alter table public.proposal_template_options enable row level security;

drop policy if exists "proposal_template_options_select_company_scope" on public.proposal_template_options;
create policy "proposal_template_options_select_company_scope"
  on public.proposal_template_options
  for select
  using (
    company_id in (
      select company_id
      from public.company_memberships
      where user_id = auth.uid()
    )
  );

drop policy if exists "proposal_template_options_insert_company_scope" on public.proposal_template_options;
create policy "proposal_template_options_insert_company_scope"
  on public.proposal_template_options
  for insert
  with check (
    company_id in (
      select company_id
      from public.company_memberships
      where user_id = auth.uid()
    )
    and exists (
      select 1
      from public.proposal_templates t
      where t.id = template_id
        and t.company_id = proposal_template_options.company_id
    )
  );

drop policy if exists "proposal_template_options_update_company_scope" on public.proposal_template_options;
create policy "proposal_template_options_update_company_scope"
  on public.proposal_template_options
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
    and exists (
      select 1
      from public.proposal_templates t
      where t.id = template_id
        and t.company_id = proposal_template_options.company_id
    )
  );

drop policy if exists "proposal_template_options_delete_company_scope" on public.proposal_template_options;
create policy "proposal_template_options_delete_company_scope"
  on public.proposal_template_options
  for delete
  using (
    company_id in (
      select company_id
      from public.company_memberships
      where user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- RLS — proposal_template_sections
-- ---------------------------------------------------------------------------

alter table public.proposal_template_sections enable row level security;

drop policy if exists "proposal_template_sections_select_company_scope" on public.proposal_template_sections;
create policy "proposal_template_sections_select_company_scope"
  on public.proposal_template_sections
  for select
  using (
    company_id in (
      select company_id
      from public.company_memberships
      where user_id = auth.uid()
    )
  );

drop policy if exists "proposal_template_sections_insert_company_scope" on public.proposal_template_sections;
create policy "proposal_template_sections_insert_company_scope"
  on public.proposal_template_sections
  for insert
  with check (
    company_id in (
      select company_id
      from public.company_memberships
      where user_id = auth.uid()
    )
    and exists (
      select 1
      from public.proposal_template_options o
      where o.id = option_id
        and o.template_id = proposal_template_sections.template_id
        and o.company_id = proposal_template_sections.company_id
    )
  );

drop policy if exists "proposal_template_sections_update_company_scope" on public.proposal_template_sections;
create policy "proposal_template_sections_update_company_scope"
  on public.proposal_template_sections
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
    and exists (
      select 1
      from public.proposal_template_options o
      where o.id = option_id
        and o.template_id = proposal_template_sections.template_id
        and o.company_id = proposal_template_sections.company_id
    )
  );

drop policy if exists "proposal_template_sections_delete_company_scope" on public.proposal_template_sections;
create policy "proposal_template_sections_delete_company_scope"
  on public.proposal_template_sections
  for delete
  using (
    company_id in (
      select company_id
      from public.company_memberships
      where user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- RLS — proposal_template_items
-- ---------------------------------------------------------------------------

alter table public.proposal_template_items enable row level security;

drop policy if exists "proposal_template_items_select_company_scope" on public.proposal_template_items;
create policy "proposal_template_items_select_company_scope"
  on public.proposal_template_items
  for select
  using (
    company_id in (
      select company_id
      from public.company_memberships
      where user_id = auth.uid()
    )
  );

drop policy if exists "proposal_template_items_insert_company_scope" on public.proposal_template_items;
create policy "proposal_template_items_insert_company_scope"
  on public.proposal_template_items
  for insert
  with check (
    company_id in (
      select company_id
      from public.company_memberships
      where user_id = auth.uid()
    )
    and exists (
      select 1
      from public.proposal_template_sections s
      where s.id = section_id
        and s.option_id = proposal_template_items.option_id
        and s.template_id = proposal_template_items.template_id
        and s.company_id = proposal_template_items.company_id
    )
    and (
      catalog_item_id is null
      or exists (
        select 1
        from public.catalog_items c
        where c.id = catalog_item_id
          and c.company_id = proposal_template_items.company_id
      )
    )
  );

drop policy if exists "proposal_template_items_update_company_scope" on public.proposal_template_items;
create policy "proposal_template_items_update_company_scope"
  on public.proposal_template_items
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
    and exists (
      select 1
      from public.proposal_template_sections s
      where s.id = section_id
        and s.option_id = proposal_template_items.option_id
        and s.template_id = proposal_template_items.template_id
        and s.company_id = proposal_template_items.company_id
    )
    and (
      catalog_item_id is null
      or exists (
        select 1
        from public.catalog_items c
        where c.id = catalog_item_id
          and c.company_id = proposal_template_items.company_id
      )
    )
  );

drop policy if exists "proposal_template_items_delete_company_scope" on public.proposal_template_items;
create policy "proposal_template_items_delete_company_scope"
  on public.proposal_template_items
  for delete
  using (
    company_id in (
      select company_id
      from public.company_memberships
      where user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Rollback, if needed before app code depends on proposal template tables:
-- drop trigger if exists proposal_template_items_set_updated_at on public.proposal_template_items;
-- drop trigger if exists proposal_template_sections_set_updated_at on public.proposal_template_sections;
-- drop trigger if exists proposal_template_options_set_updated_at on public.proposal_template_options;
-- drop trigger if exists proposal_templates_set_updated_at on public.proposal_templates;
-- drop table if exists public.proposal_template_items cascade;
-- drop table if exists public.proposal_template_sections cascade;
-- drop table if exists public.proposal_template_options cascade;
-- drop table if exists public.proposal_templates cascade;
-- alter table public.catalog_items drop constraint if exists catalog_items_id_company_unique;
-- Do not drop public.set_updated_at(); public.jobs still uses it.
