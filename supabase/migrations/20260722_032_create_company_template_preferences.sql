-- R2B: company_template_preferences
-- Preferred reusable setup per company + module + workflow.
--
-- Schema only until reviewed and explicitly applied.
-- Does not alter proposal_templates columns, proposal_template_options,
-- proposal_versions, proposal_options, proposal_line_items, removed_at,
-- or sent immutability guards.
--
-- Boundaries:
--   - Preference state only (which setup Job Card suggests first for a workflow).
--   - Not package-option is_default (R1).
--   - Not template archive/restore lifecycle (R2A status + active).
--   - Template content/settings remain on proposal_template_* tables.
--
-- Initial app constants (not seed rows):
--   module_key = 'roofing'
--   workflow_key = 'proposal'
--   preference_kind = 'preferred_setup'

-- ---------------------------------------------------------------------------
-- company_template_preferences table
-- ---------------------------------------------------------------------------

create table if not exists public.company_template_preferences (
  id uuid primary key default gen_random_uuid(),

  company_id uuid not null references public.companies(id) on delete cascade,

  module_key text not null,
  workflow_key text not null,
  preference_kind text not null,

  template_id uuid not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint company_template_preferences_module_key_not_empty
    check (length(trim(module_key)) > 0),

  constraint company_template_preferences_workflow_key_not_empty
    check (length(trim(workflow_key)) > 0),

  constraint company_template_preferences_kind_not_empty
    check (length(trim(preference_kind)) > 0),

  constraint company_template_preferences_kind_check
    check (preference_kind in ('preferred_setup')),

  constraint company_template_preferences_unique_slot
    unique (company_id, module_key, workflow_key, preference_kind),

  constraint company_template_preferences_template_company_fk
    foreign key (template_id, company_id)
    references public.proposal_templates (id, company_id)
    on delete cascade
);

-- ---------------------------------------------------------------------------
-- indexes
-- ---------------------------------------------------------------------------

create index if not exists idx_company_template_preferences_company_id
  on public.company_template_preferences(company_id);

create index if not exists idx_company_template_preferences_template_id
  on public.company_template_preferences(template_id);

-- ---------------------------------------------------------------------------
-- updated_at trigger (reuses public.set_updated_at)
-- ---------------------------------------------------------------------------

drop trigger if exists company_template_preferences_set_updated_at
  on public.company_template_preferences;

create trigger company_template_preferences_set_updated_at
  before update on public.company_template_preferences
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS — company membership scope (mirrors company_pricing_policies /
-- company_branding_profiles). DELETE required for clear-preferred and
-- archive-clear under RLS.
-- ---------------------------------------------------------------------------

alter table public.company_template_preferences enable row level security;

drop policy if exists "company_template_preferences_select_company_scope"
  on public.company_template_preferences;
create policy "company_template_preferences_select_company_scope"
  on public.company_template_preferences
  for select
  using (
    company_id in (
      select company_id
      from public.company_memberships
      where user_id = auth.uid()
    )
  );

drop policy if exists "company_template_preferences_insert_company_scope"
  on public.company_template_preferences;
create policy "company_template_preferences_insert_company_scope"
  on public.company_template_preferences
  for insert
  with check (
    company_id in (
      select company_id
      from public.company_memberships
      where user_id = auth.uid()
    )
  );

drop policy if exists "company_template_preferences_update_company_scope"
  on public.company_template_preferences;
create policy "company_template_preferences_update_company_scope"
  on public.company_template_preferences
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

drop policy if exists "company_template_preferences_delete_company_scope"
  on public.company_template_preferences;
create policy "company_template_preferences_delete_company_scope"
  on public.company_template_preferences
  for delete
  using (
    company_id in (
      select company_id
      from public.company_memberships
      where user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Rollback, if needed before app code depends on this table:
-- drop trigger if exists company_template_preferences_set_updated_at
--   on public.company_template_preferences;
-- drop table if exists public.company_template_preferences cascade;
-- Do not drop public.set_updated_at(); other tables still use it.
