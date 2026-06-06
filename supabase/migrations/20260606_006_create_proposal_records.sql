-- Stage 3J1A: proposal records / versions / pages / options / line items foundation
-- Schema only. Do not apply until reviewed.
--
-- Roofr-style spine: Job → Proposal (draft) → ProposalVersion → Pages/Options/Lines.
-- Matches app/lib/proposalRecordTypes.ts, proposalVersionTypes.ts, proposalPageTypes.ts,
-- proposalLineSnapshotTypes.ts, proposalLifecycleTypes.ts (§6Z).
--
-- This migration intentionally does NOT create:
--   - app stores or snapshot writer logic (3J2+)
--   - PDF/send/sign/payment truth
--   - changes to public.companies, catalog_items, or proposal_template row definitions
--   - unit_cost / profit / margin columns on customer-facing proposal_line_items
--
-- Immutability: version_kind sent/signed/superseded rows are intended immutable at the
-- application layer (3J2 snapshot writer). DB enforcement triggers deferred.
-- No app code should write to these tables until proposalRecordStore (3J2+) is scoped.

-- ---------------------------------------------------------------------------
-- public.proposals — lifecycle header (many per job; mutable pointers)
-- ---------------------------------------------------------------------------

create table if not exists public.proposals (
  id uuid primary key default gen_random_uuid(),

  company_id uuid not null references public.companies(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,

  template_id uuid references public.proposal_templates(id) on delete set null,

  status text not null default 'draft',

  current_draft_version_id uuid,
  latest_sent_version_id uuid,
  signed_version_id uuid,

  selected_option_id uuid,

  measurement_record_id uuid references public.measurement_records(id) on delete set null,
  pricing_policy_id uuid references public.company_pricing_policies(id) on delete set null,

  proposal_number text,
  title text,

  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  deleted_at timestamptz,

  constraint proposals_id_company_unique unique (id, company_id),

  constraint proposals_status_check check (
    status in (
      'draft',
      'previewed',
      'sent',
      'viewed',
      'signed',
      'declined',
      'revised',
      'archived',
      'deleted'
    )
  )
);

create unique index if not exists idx_proposals_company_proposal_number
  on public.proposals(company_id, proposal_number)
  where proposal_number is not null
    and length(trim(proposal_number)) > 0;

create index if not exists idx_proposals_company_id
  on public.proposals(company_id);

create index if not exists idx_proposals_company_job_id
  on public.proposals(company_id, job_id)
  where job_id is not null;

create index if not exists idx_proposals_company_status
  on public.proposals(company_id, status);

create index if not exists idx_proposals_company_current_draft_version
  on public.proposals(company_id, current_draft_version_id)
  where current_draft_version_id is not null;

-- ---------------------------------------------------------------------------
-- public.proposal_versions — draft / sent / signed / superseded snapshots
-- ---------------------------------------------------------------------------

create table if not exists public.proposal_versions (
  id uuid primary key default gen_random_uuid(),

  company_id uuid not null references public.companies(id) on delete cascade,
  proposal_id uuid not null,

  version_number integer not null,
  version_kind text not null default 'draft',
  parent_version_id uuid,

  frozen_at timestamptz,

  context_echo jsonb not null default '{}'::jsonb,
  policy_echo jsonb not null default '{}'::jsonb,

  created_by uuid,
  created_at timestamptz not null default now(),

  constraint proposal_versions_id_company_unique unique (id, company_id),

  constraint proposal_versions_proposal_company_fkey
    foreign key (proposal_id, company_id)
    references public.proposals (id, company_id)
    on delete cascade,

  constraint proposal_versions_version_kind_check check (
    version_kind in ('draft', 'sent', 'signed', 'superseded')
  ),

  constraint proposal_versions_version_number_positive check (version_number > 0),

  constraint proposal_versions_unique_number
    unique (company_id, proposal_id, version_number),

  constraint proposal_versions_context_echo_object_check check (
    jsonb_typeof(context_echo) = 'object'
  ),

  constraint proposal_versions_policy_echo_object_check check (
    jsonb_typeof(policy_echo) = 'object'
  ),

  constraint proposal_versions_frozen_at_check check (
    (version_kind = 'draft' and frozen_at is null)
    or (version_kind in ('sent', 'signed', 'superseded') and frozen_at is not null)
  )
);

alter table public.proposal_versions
  add constraint proposal_versions_parent_version_fkey
  foreign key (parent_version_id)
  references public.proposal_versions (id)
  on delete set null;

create index if not exists idx_proposal_versions_company_proposal_id
  on public.proposal_versions(company_id, proposal_id);

create index if not exists idx_proposal_versions_company_proposal_version_number
  on public.proposal_versions(company_id, proposal_id, version_number);

create index if not exists idx_proposal_versions_company_kind
  on public.proposal_versions(company_id, version_kind);

-- ---------------------------------------------------------------------------
-- public.proposal_pages — Cover / Estimate / Terms / … per version
-- ---------------------------------------------------------------------------

create table if not exists public.proposal_pages (
  id uuid primary key default gen_random_uuid(),

  company_id uuid not null references public.companies(id) on delete cascade,
  proposal_version_id uuid not null,

  page_type text not null,
  sort_order integer not null default 0,

  title text not null,
  customer_title text,
  visible_to_customer boolean not null default true,

  source_template_section_id uuid references public.proposal_template_sections(id) on delete set null,

  content_json jsonb not null default '{}'::jsonb,
  settings_json jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint proposal_pages_id_company_unique unique (id, company_id),

  constraint proposal_pages_version_company_fkey
    foreign key (proposal_version_id, company_id)
    references public.proposal_versions (id, company_id)
    on delete cascade,

  constraint proposal_pages_page_type_check check (
    page_type in (
      'cover',
      'estimate',
      'terms',
      'warranty',
      'project_overview',
      'photos',
      'pdf_attachment',
      'custom_text',
      'payment_schedule',
      'signature'
    )
  ),

  constraint proposal_pages_sort_order_check check (sort_order >= 0),

  constraint proposal_pages_title_not_empty check (length(trim(title)) > 0),

  constraint proposal_pages_content_object_check check (
    jsonb_typeof(content_json) = 'object'
  ),

  constraint proposal_pages_settings_object_check check (
    jsonb_typeof(settings_json) = 'object'
  )
);

create index if not exists idx_proposal_pages_company_version_sort
  on public.proposal_pages(company_id, proposal_version_id, sort_order);

-- ---------------------------------------------------------------------------
-- public.proposal_options — package snapshots (Standard / Enhanced / Premium)
-- ---------------------------------------------------------------------------

create table if not exists public.proposal_options (
  id uuid primary key default gen_random_uuid(),

  company_id uuid not null references public.companies(id) on delete cascade,
  proposal_version_id uuid not null,

  source_template_option_id uuid references public.proposal_template_options(id) on delete set null,

  name text not null,
  customer_label text,
  sort_order integer not null default 0,
  is_default boolean not null default false,
  visible_to_customer boolean not null default true,

  customer_subtotal_cents integer,
  discount_cents integer,
  sales_tax_cents integer,
  customer_total_cents integer,

  pricing_complete boolean not null default false,
  blocking_line_count integer not null default 0,
  guardrail_outcome text not null default 'block',

  selected_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint proposal_options_id_company_unique unique (id, company_id),

  constraint proposal_options_version_company_fkey
    foreign key (proposal_version_id, company_id)
    references public.proposal_versions (id, company_id)
    on delete cascade,

  constraint proposal_options_name_not_empty check (length(trim(name)) > 0),

  constraint proposal_options_sort_order_check check (sort_order >= 0),

  constraint proposal_options_blocking_line_count_check check (blocking_line_count >= 0),

  constraint proposal_options_customer_subtotal_cents_check check (
    customer_subtotal_cents is null or customer_subtotal_cents >= 0
  ),

  constraint proposal_options_discount_cents_check check (
    discount_cents is null or discount_cents >= 0
  ),

  constraint proposal_options_sales_tax_cents_check check (
    sales_tax_cents is null or sales_tax_cents >= 0
  ),

  constraint proposal_options_customer_total_cents_check check (
    customer_total_cents is null or customer_total_cents >= 0
  ),

  constraint proposal_options_guardrail_outcome_check check (
    guardrail_outcome in ('pass', 'warn', 'block')
  )
);

create index if not exists idx_proposal_options_company_version_sort
  on public.proposal_options(company_id, proposal_version_id, sort_order);

-- ---------------------------------------------------------------------------
-- public.proposal_line_items — customer-safe estimate rows (NO internal cost fields)
-- ---------------------------------------------------------------------------

create table if not exists public.proposal_line_items (
  id uuid primary key default gen_random_uuid(),

  company_id uuid not null references public.companies(id) on delete cascade,
  proposal_option_id uuid not null,

  source_template_item_id uuid references public.proposal_template_items(id) on delete set null,
  catalog_item_id uuid references public.catalog_items(id) on delete set null,
  catalog_seed_key text,

  section_id uuid,
  page_id uuid,

  sort_order integer not null default 0,

  customer_name text not null,
  description text,
  role text,

  quantity numeric,
  quantity_display_label text,
  quantity_source_label text,
  unit text,

  customer_unit_price_cents integer,
  customer_line_total_cents integer,

  pricing_status text not null default 'needs_quantity',
  visible_to_customer boolean not null default true,
  measurement_quantity_key text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint proposal_line_items_id_company_unique unique (id, company_id),

  constraint proposal_line_items_option_company_fkey
    foreign key (proposal_option_id, company_id)
    references public.proposal_options (id, company_id)
    on delete cascade,

  constraint proposal_line_items_page_company_fkey
    foreign key (page_id, company_id)
    references public.proposal_pages (id, company_id)
    on delete set null,

  constraint proposal_line_items_customer_name_not_empty check (
    length(trim(customer_name)) > 0
  ),

  constraint proposal_line_items_sort_order_check check (sort_order >= 0),

  constraint proposal_line_items_quantity_check check (
    quantity is null or quantity >= 0
  ),

  constraint proposal_line_items_customer_unit_price_cents_check check (
    customer_unit_price_cents is null or customer_unit_price_cents >= 0
  ),

  constraint proposal_line_items_customer_line_total_cents_check check (
    customer_line_total_cents is null or customer_line_total_cents >= 0
  ),

  constraint proposal_line_items_pricing_status_check check (
    pricing_status in (
      'priced',
      'included',
      'grouped',
      'needs_quantity',
      'not_priced',
      'omitted'
    )
  ),

  constraint proposal_line_items_role_check check (
    role is null
    or role in (
      'standard',
      'included',
      'upgrade',
      'optional_addon',
      'fee',
      'discount'
    )
  )
);

create index if not exists idx_proposal_line_items_company_option_sort
  on public.proposal_line_items(company_id, proposal_option_id, sort_order);

create index if not exists idx_proposal_line_items_company_page_sort
  on public.proposal_line_items(company_id, page_id, sort_order)
  where page_id is not null;

-- ---------------------------------------------------------------------------
-- public.proposal_internal_summaries — contractor-only profitability (never customer)
-- ---------------------------------------------------------------------------

create table if not exists public.proposal_internal_summaries (
  id uuid primary key default gen_random_uuid(),

  company_id uuid not null references public.companies(id) on delete cascade,
  proposal_option_id uuid not null,

  internal_cost_cents integer,
  internal_profit_cents integer,
  effective_margin_pct numeric,

  policy_echo_json jsonb not null default '{}'::jsonb,

  computed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint proposal_internal_summaries_id_company_unique unique (id, company_id),

  constraint proposal_internal_summaries_option_company_fkey
    foreign key (proposal_option_id, company_id)
    references public.proposal_options (id, company_id)
    on delete cascade,

  constraint proposal_internal_summaries_unique_option
    unique (company_id, proposal_option_id),

  constraint proposal_internal_summaries_internal_cost_cents_check check (
    internal_cost_cents is null or internal_cost_cents >= 0
  ),

  constraint proposal_internal_summaries_effective_margin_pct_check check (
    effective_margin_pct is null
    or (effective_margin_pct >= 0 and effective_margin_pct < 100)
  ),

  constraint proposal_internal_summaries_policy_echo_object_check check (
    jsonb_typeof(policy_echo_json) = 'object'
  )
);

create index if not exists idx_proposal_internal_summaries_company_option
  on public.proposal_internal_summaries(company_id, proposal_option_id);

-- ---------------------------------------------------------------------------
-- public.proposal_events — append-only audit log (insert + select only via RLS)
-- ---------------------------------------------------------------------------

create table if not exists public.proposal_events (
  id uuid primary key default gen_random_uuid(),

  company_id uuid not null references public.companies(id) on delete cascade,
  proposal_id uuid not null,
  proposal_version_id uuid,

  event_type text not null,
  actor_user_id uuid,
  payload_json jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),

  constraint proposal_events_proposal_company_fk
    foreign key (proposal_id, company_id)
    references public.proposals (id, company_id)
    on delete cascade,

  constraint proposal_events_version_company_fk
    foreign key (proposal_version_id, company_id)
    references public.proposal_versions (id, company_id)
    on delete set null,

  constraint proposal_events_event_type_check check (
    event_type in (
      'created',
      'draft_saved',
      'previewed',
      'sent',
      'viewed',
      'signed',
      'declined',
      'revised',
      'archived',
      'payment_requested',
      'payment_recorded'
    )
  ),

  constraint proposal_events_payload_object_check check (
    jsonb_typeof(payload_json) = 'object'
  )
);

create index if not exists idx_proposal_events_company_proposal_occurred
  on public.proposal_events(company_id, proposal_id, occurred_at desc);

-- ---------------------------------------------------------------------------
-- Deferred FKs on proposals (circular pointers resolved after child tables exist)
-- ---------------------------------------------------------------------------

alter table public.proposals
  add constraint proposals_current_draft_version_fkey
  foreign key (current_draft_version_id)
  references public.proposal_versions (id)
  on delete set null;

alter table public.proposals
  add constraint proposals_latest_sent_version_fkey
  foreign key (latest_sent_version_id)
  references public.proposal_versions (id)
  on delete set null;

alter table public.proposals
  add constraint proposals_signed_version_fkey
  foreign key (signed_version_id)
  references public.proposal_versions (id)
  on delete set null;

alter table public.proposals
  add constraint proposals_selected_option_fkey
  foreign key (selected_option_id)
  references public.proposal_options (id)
  on delete set null;

-- ---------------------------------------------------------------------------
-- updated_at triggers (reuses public.set_updated_at from jobs migration)
-- ---------------------------------------------------------------------------

drop trigger if exists proposals_set_updated_at on public.proposals;
create trigger proposals_set_updated_at
  before update on public.proposals
  for each row
  execute function public.set_updated_at();

drop trigger if exists proposal_pages_set_updated_at on public.proposal_pages;
create trigger proposal_pages_set_updated_at
  before update on public.proposal_pages
  for each row
  execute function public.set_updated_at();

drop trigger if exists proposal_options_set_updated_at on public.proposal_options;
create trigger proposal_options_set_updated_at
  before update on public.proposal_options
  for each row
  execute function public.set_updated_at();

drop trigger if exists proposal_line_items_set_updated_at on public.proposal_line_items;
create trigger proposal_line_items_set_updated_at
  before update on public.proposal_line_items
  for each row
  execute function public.set_updated_at();

drop trigger if exists proposal_internal_summaries_set_updated_at on public.proposal_internal_summaries;
create trigger proposal_internal_summaries_set_updated_at
  before update on public.proposal_internal_summaries
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS — proposals
-- ---------------------------------------------------------------------------

alter table public.proposals enable row level security;

drop policy if exists "proposals_select_company_scope" on public.proposals;
create policy "proposals_select_company_scope"
  on public.proposals
  for select
  using (
    company_id in (
      select company_id
      from public.company_memberships
      where user_id = auth.uid()
    )
  );

drop policy if exists "proposals_insert_company_scope" on public.proposals;
create policy "proposals_insert_company_scope"
  on public.proposals
  for insert
  with check (
    company_id in (
      select company_id
      from public.company_memberships
      where user_id = auth.uid()
    )
  );

drop policy if exists "proposals_update_company_scope" on public.proposals;
create policy "proposals_update_company_scope"
  on public.proposals
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

drop policy if exists "proposals_delete_company_scope" on public.proposals;
create policy "proposals_delete_company_scope"
  on public.proposals
  for delete
  using (
    company_id in (
      select company_id
      from public.company_memberships
      where user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- RLS — proposal_versions
-- ---------------------------------------------------------------------------

alter table public.proposal_versions enable row level security;

drop policy if exists "proposal_versions_select_company_scope" on public.proposal_versions;
create policy "proposal_versions_select_company_scope"
  on public.proposal_versions
  for select
  using (
    company_id in (
      select company_id
      from public.company_memberships
      where user_id = auth.uid()
    )
  );

drop policy if exists "proposal_versions_insert_company_scope" on public.proposal_versions;
create policy "proposal_versions_insert_company_scope"
  on public.proposal_versions
  for insert
  with check (
    company_id in (
      select company_id
      from public.company_memberships
      where user_id = auth.uid()
    )
  );

drop policy if exists "proposal_versions_update_company_scope" on public.proposal_versions;
create policy "proposal_versions_update_company_scope"
  on public.proposal_versions
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

drop policy if exists "proposal_versions_delete_company_scope" on public.proposal_versions;
create policy "proposal_versions_delete_company_scope"
  on public.proposal_versions
  for delete
  using (
    company_id in (
      select company_id
      from public.company_memberships
      where user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- RLS — proposal_pages
-- ---------------------------------------------------------------------------

alter table public.proposal_pages enable row level security;

drop policy if exists "proposal_pages_select_company_scope" on public.proposal_pages;
create policy "proposal_pages_select_company_scope"
  on public.proposal_pages
  for select
  using (
    company_id in (
      select company_id
      from public.company_memberships
      where user_id = auth.uid()
    )
  );

drop policy if exists "proposal_pages_insert_company_scope" on public.proposal_pages;
create policy "proposal_pages_insert_company_scope"
  on public.proposal_pages
  for insert
  with check (
    company_id in (
      select company_id
      from public.company_memberships
      where user_id = auth.uid()
    )
  );

drop policy if exists "proposal_pages_update_company_scope" on public.proposal_pages;
create policy "proposal_pages_update_company_scope"
  on public.proposal_pages
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

drop policy if exists "proposal_pages_delete_company_scope" on public.proposal_pages;
create policy "proposal_pages_delete_company_scope"
  on public.proposal_pages
  for delete
  using (
    company_id in (
      select company_id
      from public.company_memberships
      where user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- RLS — proposal_options
-- ---------------------------------------------------------------------------

alter table public.proposal_options enable row level security;

drop policy if exists "proposal_options_select_company_scope" on public.proposal_options;
create policy "proposal_options_select_company_scope"
  on public.proposal_options
  for select
  using (
    company_id in (
      select company_id
      from public.company_memberships
      where user_id = auth.uid()
    )
  );

drop policy if exists "proposal_options_insert_company_scope" on public.proposal_options;
create policy "proposal_options_insert_company_scope"
  on public.proposal_options
  for insert
  with check (
    company_id in (
      select company_id
      from public.company_memberships
      where user_id = auth.uid()
    )
  );

drop policy if exists "proposal_options_update_company_scope" on public.proposal_options;
create policy "proposal_options_update_company_scope"
  on public.proposal_options
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

drop policy if exists "proposal_options_delete_company_scope" on public.proposal_options;
create policy "proposal_options_delete_company_scope"
  on public.proposal_options
  for delete
  using (
    company_id in (
      select company_id
      from public.company_memberships
      where user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- RLS — proposal_line_items
-- ---------------------------------------------------------------------------

alter table public.proposal_line_items enable row level security;

drop policy if exists "proposal_line_items_select_company_scope" on public.proposal_line_items;
create policy "proposal_line_items_select_company_scope"
  on public.proposal_line_items
  for select
  using (
    company_id in (
      select company_id
      from public.company_memberships
      where user_id = auth.uid()
    )
  );

drop policy if exists "proposal_line_items_insert_company_scope" on public.proposal_line_items;
create policy "proposal_line_items_insert_company_scope"
  on public.proposal_line_items
  for insert
  with check (
    company_id in (
      select company_id
      from public.company_memberships
      where user_id = auth.uid()
    )
  );

drop policy if exists "proposal_line_items_update_company_scope" on public.proposal_line_items;
create policy "proposal_line_items_update_company_scope"
  on public.proposal_line_items
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

drop policy if exists "proposal_line_items_delete_company_scope" on public.proposal_line_items;
create policy "proposal_line_items_delete_company_scope"
  on public.proposal_line_items
  for delete
  using (
    company_id in (
      select company_id
      from public.company_memberships
      where user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- RLS — proposal_internal_summaries
-- ---------------------------------------------------------------------------

alter table public.proposal_internal_summaries enable row level security;

drop policy if exists "proposal_internal_summaries_select_company_scope" on public.proposal_internal_summaries;
create policy "proposal_internal_summaries_select_company_scope"
  on public.proposal_internal_summaries
  for select
  using (
    company_id in (
      select company_id
      from public.company_memberships
      where user_id = auth.uid()
    )
  );

drop policy if exists "proposal_internal_summaries_insert_company_scope" on public.proposal_internal_summaries;
create policy "proposal_internal_summaries_insert_company_scope"
  on public.proposal_internal_summaries
  for insert
  with check (
    company_id in (
      select company_id
      from public.company_memberships
      where user_id = auth.uid()
    )
  );

drop policy if exists "proposal_internal_summaries_update_company_scope" on public.proposal_internal_summaries;
create policy "proposal_internal_summaries_update_company_scope"
  on public.proposal_internal_summaries
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

drop policy if exists "proposal_internal_summaries_delete_company_scope" on public.proposal_internal_summaries;
create policy "proposal_internal_summaries_delete_company_scope"
  on public.proposal_internal_summaries
  for delete
  using (
    company_id in (
      select company_id
      from public.company_memberships
      where user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- RLS — proposal_events
-- ---------------------------------------------------------------------------

alter table public.proposal_events enable row level security;

drop policy if exists "proposal_events_select_company_scope" on public.proposal_events;
create policy "proposal_events_select_company_scope"
  on public.proposal_events
  for select
  using (
    company_id in (
      select company_id
      from public.company_memberships
      where user_id = auth.uid()
    )
  );

drop policy if exists "proposal_events_insert_company_scope" on public.proposal_events;
create policy "proposal_events_insert_company_scope"
  on public.proposal_events
  for insert
  with check (
    company_id in (
      select company_id
      from public.company_memberships
      where user_id = auth.uid()
    )
  );

-- Append-only: no app-user UPDATE or DELETE policies (service-role cleanup deferred).
drop policy if exists "proposal_events_update_company_scope" on public.proposal_events;
drop policy if exists "proposal_events_delete_company_scope" on public.proposal_events;

-- ---------------------------------------------------------------------------
-- Rollback (if needed before app code depends on proposal tables):
-- drop policy if exists "proposal_events_insert_company_scope" on public.proposal_events;
-- drop policy if exists "proposal_events_select_company_scope" on public.proposal_events;
-- drop policy if exists "proposal_events_update_company_scope" on public.proposal_events;
-- drop policy if exists "proposal_events_delete_company_scope" on public.proposal_events;
-- drop policies on public.proposal_internal_summaries;
-- drop policies on public.proposal_line_items;
-- drop policies on public.proposal_options;
-- drop policies on public.proposal_pages;
-- drop policies on public.proposal_versions;
-- drop policies on public.proposals;
-- drop trigger if exists proposal_internal_summaries_set_updated_at on public.proposal_internal_summaries;
-- drop trigger if exists proposal_line_items_set_updated_at on public.proposal_line_items;
-- drop trigger if exists proposal_options_set_updated_at on public.proposal_options;
-- drop trigger if exists proposal_pages_set_updated_at on public.proposal_pages;
-- drop trigger if exists proposals_set_updated_at on public.proposals;
-- drop table if exists public.proposal_events cascade;
-- drop table if exists public.proposal_internal_summaries cascade;
-- drop table if exists public.proposal_line_items cascade;
-- drop table if exists public.proposal_options cascade;
-- drop table if exists public.proposal_pages cascade;
-- drop table if exists public.proposal_versions cascade;
-- drop table if exists public.proposals cascade;
-- Do not drop public.set_updated_at(); public.jobs and other tables still use it.
