-- S2 — Additive quantity-resolution schema foundation
-- REVIEW ONLY — DO NOT APPLY WITHOUT EXPLICIT APPROVAL.
--
-- Adds future catalog waste_pct and proposal-line quantity_resolution_echo only.
-- Does not enable raw_plus_waste, whole-unit rounding, UI, or resolver/engine wiring.
-- Does not widen company_pricing_policies waste_model or quantity_rounding CHECKs.
-- No coverage_basis, no catalog_items.quantity_mode, no measurement changes,
-- no invented backfills, and no old-proposal migration/recalculation.
--
-- Requires catalog_items (20260531_003) and proposal_line_items (20260606_006).

begin;

-- ---------------------------------------------------------------------------
-- 1. Future catalog waste driver
-- ---------------------------------------------------------------------------

alter table public.catalog_items
  add column if not exists waste_pct numeric null;

alter table public.catalog_items
  drop constraint if exists catalog_items_waste_pct_check;

alter table public.catalog_items
  add constraint catalog_items_waste_pct_check
  check (
    waste_pct is null
    or (
      waste_pct >= 0
      and waste_pct::text not in ('NaN', 'Infinity', '-Infinity')
    )
  )
  not valid;

alter table public.catalog_items
  validate constraint catalog_items_waste_pct_check;

comment on column public.catalog_items.coverage_rate is
  'Future quantity driver: source measurement units covered by one catalog purchase unit. NULL means no conversion (1:1). Non-authoritative until separately approved resolver and snapshot integration exists.';

comment on column public.catalog_items.waste_applies is
  'Future quantity gate. When false, catalog waste_pct must not be applied. adjusted_measurement mode must never apply catalog waste. Non-authoritative until separately approved production wiring exists.';

comment on column public.catalog_items.waste_pct is
  'Future raw_plus_waste driver expressed in percent points (10 means 10%). NULL means no catalog waste percentage. Non-authoritative until separately approved production wiring exists.';

-- ---------------------------------------------------------------------------
-- 2. Future proposal-line quantity resolution audit echo
-- ---------------------------------------------------------------------------

alter table public.proposal_line_items
  add column if not exists quantity_resolution_echo jsonb null;

alter table public.proposal_line_items
  drop constraint if exists proposal_line_items_quantity_resolution_echo_object_check;

alter table public.proposal_line_items
  add constraint proposal_line_items_quantity_resolution_echo_object_check
  check (
    quantity_resolution_echo is null
    or jsonb_typeof(quantity_resolution_echo) = 'object'
  )
  not valid;

alter table public.proposal_line_items
  validate constraint proposal_line_items_quantity_resolution_echo_object_check;

comment on column public.proposal_line_items.quantity_resolution_echo is
  'Future frozen quantity-resolution drivers: quantity_mode, source_measurement_key, source_measurement_value, coverage_rate_used, waste_pct_used, rounding_mode_used, and resolved_purchase_quantity. NULL is valid for historical proposals. Non-authoritative until separately approved draft-refresh/snapshot writers exist.';

commit;

-- ---------------------------------------------------------------------------
-- Rollback (manual; only before app code depends on these fields):
--
-- begin;
-- comment on column public.catalog_items.coverage_rate is null;
-- comment on column public.catalog_items.waste_applies is null;
-- alter table public.proposal_line_items
--   drop constraint if exists proposal_line_items_quantity_resolution_echo_object_check;
-- alter table public.proposal_line_items
--   drop column if exists quantity_resolution_echo;
-- alter table public.catalog_items
--   drop constraint if exists catalog_items_waste_pct_check;
-- alter table public.catalog_items
--   drop column if exists waste_pct;
-- commit;
-- ---------------------------------------------------------------------------
