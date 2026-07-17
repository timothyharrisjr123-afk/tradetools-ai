-- =============================================================================
-- Catalog item supplier SKU fields — additive nullable columns.
-- Apply only to approved project rhquhnujjnzjhweypavd with explicit approval.
-- =============================================================================
--
-- Scope:
--   Add nullable catalog_items.abc_sku, catalog_items.qxo_sku, and
--   catalog_items.srs_sku (contractor/internal supplier product identifiers).
--
-- Semantics:
--   Supplier SKU fields are contractor/internal catalog metadata — source of
--   truth for future supplier pricing, ordering, and CSV management.
--   SKU fields do not imply supplier sync is active.
--   SKU fields do not change pricing or material ordering.
--   SKU fields are not customer-facing.
--
-- Length bounds:
--   null OR char_length 1..128 — durable capture ceiling for ordinary supplier
--   SKU formats; empty string is not stored (app normalizes blank → null).
--
-- Explicitly does NOT:
--   - Set a column DEFAULT
--   - UPDATE / backfill / mutate existing rows
--   - Alter proposal tables, pricing policies, or RPCs
--   - Change proposal pricing math
--   - Enable supplier API integrations, auth, price sync, or material ordering
--   - Expose SKUs on customer/public surfaces
--
-- Existing-row policy:
--   Existing catalog rows remain null for all three fields until a user sets values.
--
-- Requires: public.catalog_items (20260531_003).
--
-- Rollback (comment only — run manually if needed after an approved apply,
-- and only before app code depends on these columns):
--   begin;
--   alter table public.catalog_items
--     drop constraint if exists catalog_items_abc_sku_check;
--   alter table public.catalog_items
--     drop constraint if exists catalog_items_qxo_sku_check;
--   alter table public.catalog_items
--     drop constraint if exists catalog_items_srs_sku_check;
--   alter table public.catalog_items drop column if exists abc_sku;
--   alter table public.catalog_items drop column if exists qxo_sku;
--   alter table public.catalog_items drop column if exists srs_sku;
--   commit;
-- =============================================================================

begin;

alter table public.catalog_items
  add column if not exists abc_sku text null;

alter table public.catalog_items
  add column if not exists qxo_sku text null;

alter table public.catalog_items
  add column if not exists srs_sku text null;

alter table public.catalog_items
  drop constraint if exists catalog_items_abc_sku_check;

alter table public.catalog_items
  add constraint catalog_items_abc_sku_check
  check (
    abc_sku is null
    or (char_length(abc_sku) >= 1 and char_length(abc_sku) <= 128)
  )
  not valid;

alter table public.catalog_items
  validate constraint catalog_items_abc_sku_check;

alter table public.catalog_items
  drop constraint if exists catalog_items_qxo_sku_check;

alter table public.catalog_items
  add constraint catalog_items_qxo_sku_check
  check (
    qxo_sku is null
    or (char_length(qxo_sku) >= 1 and char_length(qxo_sku) <= 128)
  )
  not valid;

alter table public.catalog_items
  validate constraint catalog_items_qxo_sku_check;

alter table public.catalog_items
  drop constraint if exists catalog_items_srs_sku_check;

alter table public.catalog_items
  add constraint catalog_items_srs_sku_check
  check (
    srs_sku is null
    or (char_length(srs_sku) >= 1 and char_length(srs_sku) <= 128)
  )
  not valid;

alter table public.catalog_items
  validate constraint catalog_items_srs_sku_check;

comment on column public.catalog_items.abc_sku is
  'Contractor/internal ABC supplier SKU for this catalog item. Nullable; no default; no backfill. Does not imply supplier sync is active. Does not change pricing or material ordering. Not customer-facing.';

comment on column public.catalog_items.qxo_sku is
  'Contractor/internal QXO (Beacon) supplier SKU for this catalog item. Nullable; no default; no backfill. Does not imply supplier sync is active. Does not change pricing or material ordering. Not customer-facing.';

comment on column public.catalog_items.srs_sku is
  'Contractor/internal SRS supplier SKU for this catalog item. Nullable; no default; no backfill. Does not imply supplier sync is active. Does not change pricing or material ordering. Not customer-facing.';

comment on constraint catalog_items_abc_sku_check on public.catalog_items is
  'Allows null or text length 1..128. No default. No backfill. Internal catalog metadata only.';

comment on constraint catalog_items_qxo_sku_check on public.catalog_items is
  'Allows null or text length 1..128. No default. No backfill. Internal catalog metadata only.';

comment on constraint catalog_items_srs_sku_check on public.catalog_items is
  'Allows null or text length 1..128. No default. No backfill. Internal catalog metadata only.';

commit;
