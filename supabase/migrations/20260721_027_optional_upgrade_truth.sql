-- Optional Upgrade Truth — schema foundation
-- REVIEW ONLY — DO NOT APPLY WITHOUT EXPLICIT APPROVAL.
--
-- Adds:
--   1) proposal_template_items upgrade definition columns
--   2) proposal_option_upgrade_choices (first-class selection truth)
--   3) proposal_line_items upgrade echo columns (display convenience only)
--
-- TypeScript sequential persistence (USE_CREATE_DRAFT_PROPOSAL_SEQUENTIAL=1 /
-- USE_REFRESH_DRAFT_PRICING_SEQUENTIAL=1) writes the new line columns and
-- upgrade_choices rows. App payloads already include upgrade_choices on options
-- and upgrade_* echoes on line rows.
--
-- RPC FOLLOW-UP (not in this migration — bodies are large; prefer a dedicated
-- CREATE OR REPLACE after schema is applied and reviewed):
--   - persist_draft_proposal_create_v1: INSERT line upgrade_* echoes; INSERT
--     opt->'upgrade_choices' into proposal_option_upgrade_choices after option insert
--   - persist_draft_pricing_refresh_v1: INSERT line upgrade_* echoes; UPSERT
--     opt->'upgrade_choices' (insert missing / update effect+selection; never DELETE)
--   - persist_proposal_send_freeze_v1: INSERT line upgrade_* echoes; INSERT
--     opt->'upgrade_choices' onto the new sent version option ids
-- Until those RPC bodies are extended, use sequential escape hatches for local
-- verification, or accept that RPC path ignores unknown JSONB keys and will not
-- persist upgrade columns/choices.
--
-- Depends on proposal_template_items (004), proposal_records (006),
-- and mirrors proposal_option_scope_decisions (009) company/FK/RLS patterns.

begin;

-- ---------------------------------------------------------------------------
-- 1. Template item upgrade definition columns
-- ---------------------------------------------------------------------------

alter table public.proposal_template_items
  add column if not exists upgrade_effect text null;

alter table public.proposal_template_items
  add column if not exists replaces_template_item_id uuid null;

alter table public.proposal_template_items
  add column if not exists default_selected boolean not null default false;

alter table public.proposal_template_items
  drop constraint if exists proposal_template_items_upgrade_effect_check;

alter table public.proposal_template_items
  add constraint proposal_template_items_upgrade_effect_check
  check (
    upgrade_effect is null
    or upgrade_effect in ('additive', 'replacement')
  );

alter table public.proposal_template_items
  drop constraint if exists proposal_template_items_upgrade_definition_check;

alter table public.proposal_template_items
  add constraint proposal_template_items_upgrade_definition_check
  check (
    (
      item_role in ('upgrade', 'optional_addon')
      and (
        (
          (upgrade_effect is null or upgrade_effect = 'additive')
          and replaces_template_item_id is null
        )
        or (
          upgrade_effect = 'replacement'
          and replaces_template_item_id is not null
        )
      )
    )
    or (
      item_role not in ('upgrade', 'optional_addon')
      and upgrade_effect is null
      and replaces_template_item_id is null
      and default_selected = false
    )
  );

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'proposal_template_items_replaces_template_item_id_fkey'
  ) then
    alter table public.proposal_template_items
      add constraint proposal_template_items_replaces_template_item_id_fkey
      foreign key (replaces_template_item_id)
      references public.proposal_template_items (id)
      on delete set null;
  end if;
end $$;

comment on column public.proposal_template_items.upgrade_effect is
  'Optional Upgrade Truth definition: additive or replacement. NULL / only meaningful for upgrade|optional_addon roles.';

comment on column public.proposal_template_items.replaces_template_item_id is
  'When upgrade_effect=replacement, the same-option template item suppressed while this upgrade is selected. ON DELETE SET NULL.';

comment on column public.proposal_template_items.default_selected is
  'Initial selection when a draft instantiates this upgrade. V1 product default is false (not_selected).';

-- ---------------------------------------------------------------------------
-- 2. proposal_option_upgrade_choices — selection truth
-- ---------------------------------------------------------------------------

create table if not exists public.proposal_option_upgrade_choices (
  id uuid primary key default gen_random_uuid(),

  company_id uuid not null references public.companies(id) on delete cascade,
  proposal_id uuid not null,
  proposal_version_id uuid not null,
  proposal_option_id uuid not null,

  source_template_item_id uuid not null
    references public.proposal_template_items(id) on delete cascade,

  selection_state text not null,
  upgrade_effect text not null,
  replaces_source_template_item_id uuid null
    references public.proposal_template_items(id) on delete set null,

  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint proposal_option_upgrade_choices_id_company_unique unique (id, company_id),

  constraint proposal_option_upgrade_choices_proposal_company_fk
    foreign key (proposal_id, company_id)
    references public.proposals (id, company_id)
    on delete cascade,

  constraint proposal_option_upgrade_choices_version_company_fk
    foreign key (proposal_version_id, company_id)
    references public.proposal_versions (id, company_id)
    on delete cascade,

  constraint proposal_option_upgrade_choices_option_company_fk
    foreign key (proposal_option_id, company_id)
    references public.proposal_options (id, company_id)
    on delete cascade,

  -- Unique per option + source template item (no soft-delete / active flag).
  constraint proposal_option_upgrade_choices_option_source_unique
    unique (company_id, proposal_option_id, source_template_item_id),

  constraint proposal_option_upgrade_choices_selection_state_check check (
    selection_state in ('selected', 'not_selected')
  ),

  constraint proposal_option_upgrade_choices_upgrade_effect_check check (
    upgrade_effect in ('additive', 'replacement')
  ),

  constraint proposal_option_upgrade_choices_replacement_target_check check (
    (
      upgrade_effect = 'additive'
      and replaces_source_template_item_id is null
    )
    or (
      upgrade_effect = 'replacement'
      and replaces_source_template_item_id is not null
    )
  )
);

create index if not exists idx_proposal_option_upgrade_choices_company_option
  on public.proposal_option_upgrade_choices(company_id, proposal_option_id);

create index if not exists idx_proposal_option_upgrade_choices_company_version
  on public.proposal_option_upgrade_choices(company_id, proposal_version_id);

create index if not exists idx_proposal_option_upgrade_choices_company_proposal
  on public.proposal_option_upgrade_choices(company_id, proposal_id);

comment on table public.proposal_option_upgrade_choices is
  'Optional Upgrade Truth selections. First-class proposal-version truth; proposal_line_items.upgrade_* columns are display echoes only.';

alter table public.proposal_option_upgrade_choices enable row level security;

drop policy if exists "proposal_option_upgrade_choices_select_company_scope"
  on public.proposal_option_upgrade_choices;
create policy "proposal_option_upgrade_choices_select_company_scope"
  on public.proposal_option_upgrade_choices
  for select
  using (
    company_id in (
      select company_id
      from public.company_memberships
      where user_id = auth.uid()
    )
  );

drop policy if exists "proposal_option_upgrade_choices_insert_company_scope"
  on public.proposal_option_upgrade_choices;
create policy "proposal_option_upgrade_choices_insert_company_scope"
  on public.proposal_option_upgrade_choices
  for insert
  with check (
    company_id in (
      select company_id
      from public.company_memberships
      where user_id = auth.uid()
    )
  );

drop policy if exists "proposal_option_upgrade_choices_update_company_scope"
  on public.proposal_option_upgrade_choices;
create policy "proposal_option_upgrade_choices_update_company_scope"
  on public.proposal_option_upgrade_choices
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

drop policy if exists "proposal_option_upgrade_choices_delete_company_scope"
  on public.proposal_option_upgrade_choices;
create policy "proposal_option_upgrade_choices_delete_company_scope"
  on public.proposal_option_upgrade_choices
  for delete
  using (
    company_id in (
      select company_id
      from public.company_memberships
      where user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 3. proposal_line_items upgrade echo columns
-- ---------------------------------------------------------------------------

alter table public.proposal_line_items
  add column if not exists upgrade_selection_state text null;

alter table public.proposal_line_items
  add column if not exists upgrade_effect text null;

alter table public.proposal_line_items
  add column if not exists replaces_source_template_item_id uuid null;

alter table public.proposal_line_items
  drop constraint if exists proposal_line_items_upgrade_selection_state_check;

alter table public.proposal_line_items
  add constraint proposal_line_items_upgrade_selection_state_check
  check (
    upgrade_selection_state is null
    or upgrade_selection_state in ('selected', 'not_selected')
  );

alter table public.proposal_line_items
  drop constraint if exists proposal_line_items_upgrade_effect_check;

alter table public.proposal_line_items
  add constraint proposal_line_items_upgrade_effect_check
  check (
    upgrade_effect is null
    or upgrade_effect in ('additive', 'replacement')
  );

alter table public.proposal_line_items
  drop constraint if exists proposal_line_items_upgrade_echo_check;

alter table public.proposal_line_items
  add constraint proposal_line_items_upgrade_echo_check
  check (
    (
      (upgrade_effect is null or upgrade_effect = 'additive')
      and replaces_source_template_item_id is null
    )
    or (
      upgrade_effect = 'replacement'
      and replaces_source_template_item_id is not null
    )
  );

comment on column public.proposal_line_items.upgrade_selection_state is
  'Display echo of Optional Upgrade Truth selection. Authoritative selection lives in proposal_option_upgrade_choices.';

comment on column public.proposal_line_items.upgrade_effect is
  'Display echo of upgrade effect (additive|replacement). Definition truth is template; selection truth is choices table.';

comment on column public.proposal_line_items.replaces_source_template_item_id is
  'Display echo of replacement target template item id when upgrade_effect=replacement.';

commit;

-- ---------------------------------------------------------------------------
-- Rollback (manual; only before app code depends on these fields):
--
-- begin;
-- alter table public.proposal_line_items
--   drop constraint if exists proposal_line_items_upgrade_echo_check;
-- alter table public.proposal_line_items
--   drop constraint if exists proposal_line_items_upgrade_effect_check;
-- alter table public.proposal_line_items
--   drop constraint if exists proposal_line_items_upgrade_selection_state_check;
-- alter table public.proposal_line_items
--   drop column if exists replaces_source_template_item_id;
-- alter table public.proposal_line_items
--   drop column if exists upgrade_effect;
-- alter table public.proposal_line_items
--   drop column if exists upgrade_selection_state;
-- drop table if exists public.proposal_option_upgrade_choices;
-- alter table public.proposal_template_items
--   drop constraint if exists proposal_template_items_replaces_template_item_id_fkey;
-- alter table public.proposal_template_items
--   drop constraint if exists proposal_template_items_upgrade_definition_check;
-- alter table public.proposal_template_items
--   drop constraint if exists proposal_template_items_upgrade_effect_check;
-- alter table public.proposal_template_items
--   drop column if exists default_selected;
-- alter table public.proposal_template_items
--   drop column if exists replaces_template_item_id;
-- alter table public.proposal_template_items
--   drop column if exists upgrade_effect;
-- commit;
