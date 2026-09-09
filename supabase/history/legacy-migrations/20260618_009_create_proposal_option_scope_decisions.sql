-- R17D Phase 1: persisted contractor scope decisions (overlay foundation).
-- Decisions merge into pricing input on refresh; proposal_line_items remain derived snapshots.

-- ---------------------------------------------------------------------------
-- public.proposal_option_scope_decisions
-- ---------------------------------------------------------------------------

create table if not exists public.proposal_option_scope_decisions (
  id uuid primary key default gen_random_uuid(),

  company_id uuid not null references public.companies(id) on delete cascade,
  proposal_id uuid not null,
  proposal_version_id uuid not null,
  proposal_option_id uuid not null,

  decision_type text not null,

  source_template_item_id uuid references public.proposal_template_items(id) on delete set null,
  instance_line_key text,

  payload_json jsonb not null default '{}'::jsonb,
  active boolean not null default true,

  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint proposal_option_scope_decisions_id_company_unique unique (id, company_id),

  constraint proposal_option_scope_decisions_proposal_company_fk
    foreign key (proposal_id, company_id)
    references public.proposals (id, company_id)
    on delete cascade,

  constraint proposal_option_scope_decisions_version_company_fk
    foreign key (proposal_version_id, company_id)
    references public.proposal_versions (id, company_id)
    on delete cascade,

  constraint proposal_option_scope_decisions_option_company_fk
    foreign key (proposal_option_id, company_id)
    references public.proposal_options (id, company_id)
    on delete cascade,

  constraint proposal_option_scope_decisions_decision_type_check check (
    decision_type in (
      'manual_quantity',
      'excluded',
      'not_applicable',
      'visibility_override',
      'role_override',
      'added_catalog',
      'added_custom',
      'quantity_source_override'
    )
  ),

  constraint proposal_option_scope_decisions_payload_object_check check (
    jsonb_typeof(payload_json) = 'object'
  ),

  constraint proposal_option_scope_decisions_target_shape_check check (
    (
      source_template_item_id is not null
      and instance_line_key is null
      and decision_type in (
        'manual_quantity',
        'excluded',
        'not_applicable',
        'visibility_override',
        'role_override',
        'quantity_source_override'
      )
    )
    or
    (
      instance_line_key is not null
      and length(trim(instance_line_key)) > 0
      and source_template_item_id is null
      and decision_type in ('added_catalog', 'added_custom')
    )
  )
);

create index if not exists idx_proposal_option_scope_decisions_company_option
  on public.proposal_option_scope_decisions(company_id, proposal_option_id)
  where active = true;

create index if not exists idx_proposal_option_scope_decisions_company_version
  on public.proposal_option_scope_decisions(company_id, proposal_version_id)
  where active = true;

create index if not exists idx_proposal_option_scope_decisions_company_proposal
  on public.proposal_option_scope_decisions(company_id, proposal_id)
  where active = true;

create unique index if not exists idx_proposal_option_scope_decisions_active_template_target
  on public.proposal_option_scope_decisions(
    company_id,
    proposal_option_id,
    source_template_item_id,
    decision_type
  )
  where active = true
    and source_template_item_id is not null;

create unique index if not exists idx_proposal_option_scope_decisions_active_instance_line
  on public.proposal_option_scope_decisions(
    company_id,
    proposal_option_id,
    instance_line_key,
    decision_type
  )
  where active = true
    and instance_line_key is not null;

-- ---------------------------------------------------------------------------
-- RLS — proposal_option_scope_decisions (matches proposal_line_items pattern)
-- ---------------------------------------------------------------------------

alter table public.proposal_option_scope_decisions enable row level security;

drop policy if exists "proposal_option_scope_decisions_select_company_scope"
  on public.proposal_option_scope_decisions;
create policy "proposal_option_scope_decisions_select_company_scope"
  on public.proposal_option_scope_decisions
  for select
  using (
    company_id in (
      select company_id
      from public.company_memberships
      where user_id = auth.uid()
    )
  );

drop policy if exists "proposal_option_scope_decisions_insert_company_scope"
  on public.proposal_option_scope_decisions;
create policy "proposal_option_scope_decisions_insert_company_scope"
  on public.proposal_option_scope_decisions
  for insert
  with check (
    company_id in (
      select company_id
      from public.company_memberships
      where user_id = auth.uid()
    )
  );

drop policy if exists "proposal_option_scope_decisions_update_company_scope"
  on public.proposal_option_scope_decisions;
create policy "proposal_option_scope_decisions_update_company_scope"
  on public.proposal_option_scope_decisions
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

drop policy if exists "proposal_option_scope_decisions_delete_company_scope"
  on public.proposal_option_scope_decisions;
create policy "proposal_option_scope_decisions_delete_company_scope"
  on public.proposal_option_scope_decisions
  for delete
  using (
    company_id in (
      select company_id
      from public.company_memberships
      where user_id = auth.uid()
    )
  );
