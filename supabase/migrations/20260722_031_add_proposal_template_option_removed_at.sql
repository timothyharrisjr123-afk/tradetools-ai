-- =============================================================================
-- 20260722_031_add_proposal_template_option_removed_at.sql
-- =============================================================================
-- R1 package structure: soft-remove for proposal_template_options.
--
-- Why:
--   Hard DELETE of a template option referenced by sent proposal_options fails
--   because ON DELETE SET NULL tries to update historical proposal_options rows,
--   and proposal_options_immutable_version_guard blocks sent/signed/superseded.
--
-- Soft-remove:
--   - Sets removed_at (row preserved for FK / source_template_option_id traceability)
--   - Does NOT mutate proposal_options / proposal_versions / sent snapshots
--   - Does NOT loosen immutability guards
--
-- Default invariant:
--   Existing unique index idx_proposal_template_options_one_default_per_template
--   is (template_id) WHERE is_default = true.
--   Soft-remove MUST clear is_default on the removed row so an active default
--   can be assigned. No index rewrite required when that invariant is enforced
--   in the store action.
-- =============================================================================

alter table public.proposal_template_options
  add column if not exists removed_at timestamptz null;

comment on column public.proposal_template_options.removed_at is
  'Soft-remove timestamp. Null = active package for future proposal creation. '
  'Preserves row for historical proposal_options.source_template_option_id.';

-- Active packages by template (Templates / Job Card / future draft create).
create index if not exists idx_proposal_template_options_template_active_sort
  on public.proposal_template_options (template_id, sort_order)
  where removed_at is null;

-- Optional lookup of removed packages (support / restore).
create index if not exists idx_proposal_template_options_template_removed_at
  on public.proposal_template_options (template_id, removed_at)
  where removed_at is not null;
