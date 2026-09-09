-- =============================================================================
-- REVIEW ONLY — DO NOT APPLY WITHOUT EXPLICIT APPROVAL.
-- coverage_basis Step B — additive nullable catalog_items.coverage_basis
-- Matches docs/fielddive-global-handoff.md §6BO.13.4.5
-- =============================================================================
--
-- Scope:
--   Add nullable catalog_items.coverage_basis text with CHECK allowing:
--     null | roof_square | square_feet | linear_feet | each | tons
--
-- Authority:
--   coverage_basis is the measurement-side unit of the coverage divisor.
--   coverage_basis is NOT the purchase unit (see catalog_items.unit).
--
-- Explicitly does NOT:
--   - Set a column DEFAULT
--   - UPDATE / backfill / mutate existing rows
--   - Alter proposal tables, pricing policies, or RPCs
--   - Wire app types / store / UI / classifier
--   - Enable Settings raw_plus_waste mode switch
--   - Enable whole rounding
--
-- Existing-row policy (unchanged after apply):
--   Rows with non-null coverage_rate and null coverage_basis remain not_verified
--   until a user sets a basis. adjusted_measurement continues to ignore
--   coverage/waste. raw_plus_waste mode switch remains blocked until
--   compatibility can be proven (compatible).
--
-- Requires: public.catalog_items (20260531_003).
--
-- Rollback (comment only — run manually if needed after an approved apply,
-- and only before app code depends on this column):
--   begin;
--   alter table public.catalog_items
--     drop constraint if exists catalog_items_coverage_basis_check;
--   alter table public.catalog_items
--     drop column if exists coverage_basis;
--   commit;
-- =============================================================================

begin;

alter table public.catalog_items
  add column if not exists coverage_basis text null;

alter table public.catalog_items
  drop constraint if exists catalog_items_coverage_basis_check;

alter table public.catalog_items
  add constraint catalog_items_coverage_basis_check
  check (
    coverage_basis is null
    or coverage_basis in (
      'roof_square',
      'square_feet',
      'linear_feet',
      'each',
      'tons'
    )
  )
  not valid;

alter table public.catalog_items
  validate constraint catalog_items_coverage_basis_check;

comment on column public.catalog_items.coverage_basis is
  'Measurement-side unit of the coverage divisor (what coverage_rate measures): null | roof_square | square_feet | linear_feet | each | tons. NOT the purchase/sell unit (see unit). Existing rows with coverage_rate set and coverage_basis null remain not_verified until a user sets a basis. adjusted_measurement ignores coverage/waste. raw_plus_waste mode switch remains blocked until source/basis compatibility is proven. Non-authoritative for app wiring until separately approved types/UI/classifier gates.';

comment on constraint catalog_items_coverage_basis_check on public.catalog_items is
  'Allows null or approved coverage_basis enum values only. No default. No backfill. Does not enable mode switch, classifier production wiring, or purchase-unit proxying.';

commit;
