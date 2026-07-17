/**
 * Draft Catalog economics staleness — pure detection (Integrated Flow P1).
 *
 * Persisted drafts freeze Catalog-derived economics into snapshots. Measurement
 * staleness is handled by `deriveProposalPricingStale`. This helper detects when
 * Catalog rows linked on draft lines changed (or went missing/inactive) after the
 * snapshot was built — without inventing price math or comparing customer line
 * prices to catalog unit prices (unsafe for cost_plus_margin).
 *
 * Action when stale: explicit Refresh draft pricing (reuses existing refresh path).
 * No silent auto-refresh. No pricing formula changes.
 */

import type { CatalogItem } from "@/app/lib/catalogTypes";

export type DraftCatalogEconomicsStaleReason =
  | "catalog_items_updated"
  | "catalog_item_missing"
  | "catalog_item_inactive"
  | null;

export type DraftCatalogLineRef = {
  catalog_item_id: string | null | undefined;
};

export type DeriveDraftCatalogEconomicsStaleInput = {
  snapshotLines: readonly DraftCatalogLineRef[];
  /** Full company catalog (active + inactive) preferred for inactive detection. */
  liveCatalogById: ReadonlyMap<string, CatalogItem>;
  /** Proposal/version updated_at when the snapshot was last written. */
  snapshotUpdatedAt: string | null | undefined;
};

export type DraftCatalogEconomicsStaleResult = {
  stale: boolean;
  reason: DraftCatalogEconomicsStaleReason;
  affectedCount: number;
  updatedCount: number;
  missingCount: number;
  inactiveCount: number;
};

function normalizeId(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseTime(value: string | null | undefined): number | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const ms = Date.parse(trimmed);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Detect Catalog drift for a persisted draft snapshot.
 *
 * Priority of reason when multiple apply:
 * 1. missing catalog row
 * 2. inactive catalog row
 * 3. catalog.updated_at newer than snapshotUpdatedAt
 */
export function deriveDraftCatalogEconomicsStale(
  input: DeriveDraftCatalogEconomicsStaleInput
): DraftCatalogEconomicsStaleResult {
  const snapshotTime = parseTime(input.snapshotUpdatedAt);
  let updatedCount = 0;
  let missingCount = 0;
  let inactiveCount = 0;
  const seen = new Set<string>();

  for (const line of input.snapshotLines) {
    const catalogId = normalizeId(line.catalog_item_id);
    if (!catalogId || seen.has(catalogId)) continue;
    seen.add(catalogId);

    const catalog = input.liveCatalogById.get(catalogId);
    if (!catalog) {
      missingCount += 1;
      continue;
    }
    if (!catalog.active) {
      inactiveCount += 1;
      continue;
    }
    if (snapshotTime != null) {
      const catalogTime = parseTime(catalog.updated_at);
      if (catalogTime != null && catalogTime > snapshotTime) {
        updatedCount += 1;
      }
    }
  }

  const affectedCount = missingCount + inactiveCount + updatedCount;
  if (missingCount > 0) {
    return {
      stale: true,
      reason: "catalog_item_missing",
      affectedCount,
      updatedCount,
      missingCount,
      inactiveCount,
    };
  }
  if (inactiveCount > 0) {
    return {
      stale: true,
      reason: "catalog_item_inactive",
      affectedCount,
      updatedCount,
      missingCount,
      inactiveCount,
    };
  }
  if (updatedCount > 0) {
    return {
      stale: true,
      reason: "catalog_items_updated",
      affectedCount,
      updatedCount,
      missingCount,
      inactiveCount,
    };
  }
  return {
    stale: false,
    reason: null,
    affectedCount: 0,
    updatedCount: 0,
    missingCount: 0,
    inactiveCount: 0,
  };
}

export const PROPOSAL_CATALOG_ECONOMICS_STALE_BANNER_COPY =
  "This draft freezes Catalog pricing from when it was created or last refreshed. Linked Catalog items changed afterward — refresh draft pricing to re-pull live Catalog economics." as const;

export const PROPOSAL_CATALOG_MISSING_BANNER_COPY =
  "This draft references Catalog items that are missing. Refresh draft pricing will re-check live Catalog links; fix or re-link items in Templates/Catalog if lines stay unresolved." as const;

export const PROPOSAL_CATALOG_INACTIVE_BANNER_COPY =
  "This draft references inactive Catalog items. Reactivate them in Catalog or change template links, then refresh draft pricing." as const;

export const PROPOSAL_SNAPSHOT_FROZEN_HELPER_COPY =
  "Builder shows frozen draft snapshot values for this proposal. Catalog and Template edits do not change this draft until you refresh draft pricing." as const;

export function formatDraftCatalogEconomicsStaleBanner(
  result: DraftCatalogEconomicsStaleResult
): string | null {
  if (!result.stale || !result.reason) return null;
  switch (result.reason) {
    case "catalog_item_missing":
      return PROPOSAL_CATALOG_MISSING_BANNER_COPY;
    case "catalog_item_inactive":
      return PROPOSAL_CATALOG_INACTIVE_BANNER_COPY;
    case "catalog_items_updated":
      return PROPOSAL_CATALOG_ECONOMICS_STALE_BANNER_COPY;
    default:
      return null;
  }
}
