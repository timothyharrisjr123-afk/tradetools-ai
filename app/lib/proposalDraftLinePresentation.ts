/**
 * Draft-owned line presentation helpers (V2E1).
 *
 * Preview/Builder customer-facing line labels must resolve from persisted draft
 * truth + Catalog provenance — never from live mutable Template presentation.
 */

import type { CatalogItem } from "@/app/lib/catalogTypes";
import {
  formatCustomerFacingLineLabel,
  looksLikeInternalCatalogKey,
} from "@/app/lib/proposalCustomerFacingLabel";

export type DraftOwnedLineLabelParts = {
  /** Persisted proposal_line_items.customer_name */
  customerName: string | null | undefined;
  /** Persisted proposal_line_items.catalog_seed_key */
  catalogSeedKey?: string | null | undefined;
  /**
   * Optional Catalog row via catalog_item_id.
   * Used only when persisted customer_name is missing or is an internal seed/key.
   */
  catalogItem?: Pick<CatalogItem, "name" | "customer_name"> | null | undefined;
};

/**
 * Resolve the customer-facing line label owned by a draft line.
 *
 * Ownership order:
 * 1. Persisted customer_name when it is already customer-facing
 * 2. Catalog customer_name / name (via catalog_item_id provenance)
 * 3. Humanize persisted name or catalog_seed_key
 * 4. "Line item"
 */
export function resolveDraftOwnedLineCustomerLabel(input: DraftOwnedLineLabelParts): string {
  const persisted = String(input.customerName ?? "").trim();
  const seed = String(input.catalogSeedKey ?? "").trim();
  const catalogCustomer = String(input.catalogItem?.customer_name ?? "").trim();
  const catalogName = String(input.catalogItem?.name ?? "").trim();

  const persistedIsInternal =
    !persisted ||
    looksLikeInternalCatalogKey(persisted) ||
    (seed.length > 0 && persisted === seed);

  if (persisted && !persistedIsInternal) {
    return persisted;
  }

  if (catalogCustomer) return catalogCustomer;
  if (catalogName) return catalogName;

  if (persisted) return formatCustomerFacingLineLabel(persisted);
  if (seed) return formatCustomerFacingLineLabel(seed);
  return "Line item";
}
