-- Stage 3J1B: harden proposal records before apply (corrective to 006)
-- Schema only. Do not apply until reviewed.
-- Depends on: 20260606_006_create_proposal_records.sql (do not edit 006).
--
-- Addresses pre-apply drift audit findings:
--   1. proposals insert/update RLS parent-company validation
--   2. proposal_line_items.catalog_item_id composite FK
--   3. proposal_line_items.section_id — template-section echo FK + column comment
--   4. proposals header pointers — composite company-scoped FKs
--
-- Intentionally unchanged: table names, event enums, guardrail values, option total
-- column names, customer-safe line columns, internal summaries, pricing logic, app code.
--
-- customer_id: public.customers is referenced by 001/006 FKs but no customers migration
-- exists in this repo bundle — company validation for customer_id is deferred to 3J2+
-- store layer (cannot assume customers.company_id without schema guess).

-- ---------------------------------------------------------------------------
-- 1. proposals — stronger insert/update RLS (parent rows same company)
-- ---------------------------------------------------------------------------

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
    and (
      job_id is null
      or exists (
        select 1
        from public.jobs j
        where j.id = job_id
          and j.company_id = proposals.company_id
      )
    )
    and (
      template_id is null
      or exists (
        select 1
        from public.proposal_templates t
        where t.id = template_id
          and t.company_id = proposals.company_id
      )
    )
    and (
      measurement_record_id is null
      or exists (
        select 1
        from public.measurement_records m
        where m.id = measurement_record_id
          and m.company_id = proposals.company_id
      )
    )
    and (
      pricing_policy_id is null
      or exists (
        select 1
        from public.company_pricing_policies p
        where p.id = pricing_policy_id
          and p.company_id = proposals.company_id
      )
    )
    -- customer_id: deferred — see header comment (no customers DDL in repo bundle)
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
    and (
      job_id is null
      or exists (
        select 1
        from public.jobs j
        where j.id = job_id
          and j.company_id = proposals.company_id
      )
    )
    and (
      template_id is null
      or exists (
        select 1
        from public.proposal_templates t
        where t.id = template_id
          and t.company_id = proposals.company_id
      )
    )
    and (
      measurement_record_id is null
      or exists (
        select 1
        from public.measurement_records m
        where m.id = measurement_record_id
          and m.company_id = proposals.company_id
      )
    )
    and (
      pricing_policy_id is null
      or exists (
        select 1
        from public.company_pricing_policies p
        where p.id = pricing_policy_id
          and p.company_id = proposals.company_id
      )
    )
    -- customer_id: deferred — see header comment
  );

-- ---------------------------------------------------------------------------
-- 2. proposal_line_items — company-scoped catalog_item_id FK
--    catalog_items_id_company_unique added by 004 (id, company_id)
-- ---------------------------------------------------------------------------

alter table public.proposal_line_items
  drop constraint if exists proposal_line_items_catalog_item_id_fkey;

alter table public.proposal_line_items
  add constraint proposal_line_items_catalog_company_fkey
  foreign key (catalog_item_id, company_id)
  references public.catalog_items (id, company_id)
  on delete set null;

-- ---------------------------------------------------------------------------
-- 3. proposal_line_items.section_id — template-section echo (not page_id)
--    Matches ProposalLineItemSnapshot.section_id + mapper sectionId from template.
--    page_id references runtime proposal_pages; section_id echoes
--    proposal_template_sections.id for estimate rollups / grouping at snapshot time.
-- ---------------------------------------------------------------------------

comment on column public.proposal_line_items.section_id is
  'Denormalized proposal_template_sections.id echo at snapshot time for estimate '
  'section rollups (see app/lib/proposalLineSnapshotTypes.ts). Distinct from page_id '
  '(runtime proposal_pages placement). Nullable when line has no template section source.';

alter table public.proposal_line_items
  add constraint proposal_line_items_section_company_fkey
  foreign key (section_id, company_id)
  references public.proposal_template_sections (id, company_id)
  on delete set null;

-- ---------------------------------------------------------------------------
-- 4. proposals — composite company-scoped header pointer FKs
--    Replaces id-only deferred FKs from 006. ON DELETE SET NULL nulls only the
--    nullable pointer column (company_id on proposals stays NOT NULL).
-- ---------------------------------------------------------------------------

alter table public.proposals
  drop constraint if exists proposals_current_draft_version_fkey;

alter table public.proposals
  drop constraint if exists proposals_latest_sent_version_fkey;

alter table public.proposals
  drop constraint if exists proposals_signed_version_fkey;

alter table public.proposals
  drop constraint if exists proposals_selected_option_fkey;

alter table public.proposals
  add constraint proposals_current_draft_version_company_fkey
  foreign key (current_draft_version_id, company_id)
  references public.proposal_versions (id, company_id)
  on delete set null;

alter table public.proposals
  add constraint proposals_latest_sent_version_company_fkey
  foreign key (latest_sent_version_id, company_id)
  references public.proposal_versions (id, company_id)
  on delete set null;

alter table public.proposals
  add constraint proposals_signed_version_company_fkey
  foreign key (signed_version_id, company_id)
  references public.proposal_versions (id, company_id)
  on delete set null;

alter table public.proposals
  add constraint proposals_selected_option_company_fkey
  foreign key (selected_option_id, company_id)
  references public.proposal_options (id, company_id)
  on delete set null;

-- ---------------------------------------------------------------------------
-- Rollback (corrective migration only — do not drop proposal tables):
-- alter table public.proposals drop constraint if exists proposals_selected_option_company_fkey;
-- alter table public.proposals drop constraint if exists proposals_signed_version_company_fkey;
-- alter table public.proposals drop constraint if exists proposals_latest_sent_version_company_fkey;
-- alter table public.proposals drop constraint if exists proposals_current_draft_version_company_fkey;
-- alter table public.proposals add constraint proposals_selected_option_fkey
--   foreign key (selected_option_id) references public.proposal_options (id) on delete set null;
-- alter table public.proposals add constraint proposals_signed_version_fkey
--   foreign key (signed_version_id) references public.proposal_versions (id) on delete set null;
-- alter table public.proposals add constraint proposals_latest_sent_version_fkey
--   foreign key (latest_sent_version_id) references public.proposal_versions (id) on delete set null;
-- alter table public.proposals add constraint proposals_current_draft_version_fkey
--   foreign key (current_draft_version_id) references public.proposal_versions (id) on delete set null;
-- alter table public.proposal_line_items drop constraint if exists proposal_line_items_section_company_fkey;
-- comment on column public.proposal_line_items.section_id is null;
-- alter table public.proposal_line_items drop constraint if exists proposal_line_items_catalog_company_fkey;
-- alter table public.proposal_line_items add constraint proposal_line_items_catalog_item_id_fkey
--   foreign key (catalog_item_id) references public.catalog_items (id) on delete set null;
-- drop policy if exists "proposals_update_company_scope" on public.proposals;
-- drop policy if exists "proposals_insert_company_scope" on public.proposals;
-- (recreate 006 insert/update policies without parent EXISTS checks)
-- Do not drop public.set_updated_at(); do not drop proposal tables from 006.
