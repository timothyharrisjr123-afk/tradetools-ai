-- =============================================================================
-- Catalog item tax capture fields — additive nullable columns.
-- Apply only to approved project rhquhnujjnzjhweypavd with explicit approval.
-- =============================================================================
--
-- Scope:
--   Add nullable catalog_items.sales_tax_rate_pct and
--   catalog_items.purchase_tax_rate_pct (percent points; 8.25 = 8.25%).
--
-- Semantics:
--   sales_tax_rate_pct — customer-facing item sales tax rate capture / source of truth.
--   purchase_tax_rate_pct — internal supplier/material purchase tax capture for future
--     true-cost / material-order / job-costing. Must never be shown to customers.
--
-- Percent bounds:
--   null OR 0..100 inclusive — matches company pricing policy sales-tax validation
--   (isFinitePct) and provides a consistent catalog capture ceiling for both fields.
--
-- Explicitly does NOT:
--   - Set a column DEFAULT
--   - UPDATE / backfill / mutate existing rows
--   - Alter proposal tables, pricing policies, or RPCs
--   - Change proposal pricing math
--   - Enable CSV, supplier integrations, columns, bulk actions, or raw mode switch
--
-- Existing-row policy:
--   Existing catalog rows remain null for both fields until a user sets values.
--
-- Requires: public.catalog_items (20260531_003).
--
-- Rollback (comment only — run manually if needed after an approved apply,
-- and only before app code depends on these columns):
--   begin;
--   alter table public.catalog_items
--     drop constraint if exists catalog_items_sales_tax_rate_pct_check;
--   alter table public.catalog_items
--     drop constraint if exists catalog_items_purchase_tax_rate_pct_check;
--   alter table public.catalog_items
--     drop column if exists sales_tax_rate_pct;
--   alter table public.catalog_items
--     drop column if exists purchase_tax_rate_pct;
--   commit;
-- =============================================================================

begin;

alter table public.catalog_items
  add column if not exists sales_tax_rate_pct numeric null;

alter table public.catalog_items
  add column if not exists purchase_tax_rate_pct numeric null;

alter table public.catalog_items
  drop constraint if exists catalog_items_sales_tax_rate_pct_check;

alter table public.catalog_items
  add constraint catalog_items_sales_tax_rate_pct_check
  check (
    sales_tax_rate_pct is null
    or (sales_tax_rate_pct >= 0 and sales_tax_rate_pct <= 100)
  )
  not valid;

alter table public.catalog_items
  validate constraint catalog_items_sales_tax_rate_pct_check;

alter table public.catalog_items
  drop constraint if exists catalog_items_purchase_tax_rate_pct_check;

alter table public.catalog_items
  add constraint catalog_items_purchase_tax_rate_pct_check
  check (
    purchase_tax_rate_pct is null
    or (purchase_tax_rate_pct >= 0 and purchase_tax_rate_pct <= 100)
  )
  not valid;

alter table public.catalog_items
  validate constraint catalog_items_purchase_tax_rate_pct_check;

comment on column public.catalog_items.sales_tax_rate_pct is
  'Customer-facing item sales tax rate capture (percent points; 8.25 = 8.25%). Nullable; no default; no backfill. Source-of-truth for future proposal line-tax math — this migration does not change proposal pricing math.';

comment on column public.catalog_items.purchase_tax_rate_pct is
  'Internal supplier/material purchase tax rate capture (percent points). Nullable; no default; no backfill. For future true-cost / material-order / job-costing. Must never be shown to customers. This migration does not change proposal pricing math.';

comment on constraint catalog_items_sales_tax_rate_pct_check on public.catalog_items is
  'Allows null or 0..100 inclusive. No default. No backfill. Does not enable proposal line-tax application.';

comment on constraint catalog_items_purchase_tax_rate_pct_check on public.catalog_items is
  'Allows null or 0..100 inclusive. No default. No backfill. Internal-only field; never customer-facing.';

commit;
