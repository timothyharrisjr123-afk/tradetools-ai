-- =============================================================================
-- REVIEW ONLY — DO NOT APPLY WITHOUT EXPLICIT APPROVAL.
-- raw_plus_waste Phase 3 — company_pricing_policies waste_model CHECK widening
-- =============================================================================
--
-- Scope:
--   Widen company_pricing_policies.waste_model CHECK to allow:
--     - adjusted_measurement  (default; unchanged)
--     - raw_plus_waste        (staged policy mode only)
--
-- Explicitly does NOT:
--   - Widen quantity_rounding CHECK (whole remains unsupported)
--   - Change the column default (remains adjusted_measurement)
--   - Do not UPDATE / backfill existing rows
--   - Alter proposal / catalog / proposal_line_items schema
--   - Enable UI mode switching
--   - Wire production quantity resolver / pricing engine for raw_plus_waste
--
-- After apply (only with explicit approval):
--   Policy rows MAY store waste_model = 'raw_plus_waste'.
--   App validator already stages recognition; quantity-layer production enablement
--   and pricing-engine support remain separate later gates.
--   adjusted_measurement remains the default for new rows and starter policies.
--
-- Rollback (comment only — run manually if needed after an approved apply):
--   begin;
--   alter table public.company_pricing_policies
--     drop constraint if exists company_pricing_policies_waste_model_check;
--   -- Requires no rows with waste_model = 'raw_plus_waste' first, otherwise:
--   -- update public.company_pricing_policies
--   --   set waste_model = 'adjusted_measurement'
--   --   where waste_model = 'raw_plus_waste';
--   alter table public.company_pricing_policies
--     add constraint company_pricing_policies_waste_model_check
--     check (waste_model in ('adjusted_measurement'));
--   commit;
-- =============================================================================

begin;

alter table public.company_pricing_policies
  drop constraint if exists company_pricing_policies_waste_model_check;

alter table public.company_pricing_policies
  add constraint company_pricing_policies_waste_model_check
  check (
    waste_model in ('adjusted_measurement', 'raw_plus_waste')
  );

comment on column public.company_pricing_policies.waste_model is
  'Company quantity/waste policy mode. Default and production path remain adjusted_measurement. raw_plus_waste is a staged future policy mode allowed by CHECK only after explicit migration apply; production quantity resolver, pricing engine, and UI must not treat it as live until separately approved gates. whole rounding remains unsupported (quantity_rounding CHECK unchanged).';

comment on constraint company_pricing_policies_waste_model_check on public.company_pricing_policies is
  'Allows adjusted_measurement (default) and staged raw_plus_waste. Does not enable quantity-layer production wiring, UI controls, or whole rounding.';

commit;
