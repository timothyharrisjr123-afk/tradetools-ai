/**
 * Run: npx tsx --test app/lib/proposalCatalogEconomicsStaleness.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { CatalogItem } from "@/app/lib/catalogTypes";
import {
  PROPOSAL_SNAPSHOT_FROZEN_HELPER_COPY,
  deriveDraftCatalogEconomicsStale,
  formatDraftCatalogEconomicsStaleBanner,
} from "@/app/lib/proposalCatalogEconomicsStaleness";

function catalog(
  partial: Partial<CatalogItem> & { id: string; name: string }
): CatalogItem {
  return {
    id: partial.id,
    company_id: "co",
    name: partial.name,
    item_type: "material",
    unit: "square",
    quantity_source: "roof_squares",
    pricing_basis: "unit_price",
    customer_visibility: "customer_visible",
    active: partial.active ?? true,
    unit_price_cents: 10000,
    unit_cost_cents: 5000,
    updated_at: partial.updated_at ?? "2026-07-01T00:00:00.000Z",
    ...partial,
  } as CatalogItem;
}

describe("deriveDraftCatalogEconomicsStale", () => {
  test("not stale when catalog unchanged", () => {
    const map = new Map([
      ["c1", catalog({ id: "c1", name: "A", updated_at: "2026-07-01T00:00:00.000Z" })],
    ]);
    const result = deriveDraftCatalogEconomicsStale({
      snapshotLines: [{ catalog_item_id: "c1" }],
      liveCatalogById: map,
      snapshotUpdatedAt: "2026-07-10T00:00:00.000Z",
    });
    assert.equal(result.stale, false);
    assert.equal(result.reason, null);
  });

  test("stale when catalog updated after snapshot", () => {
    const map = new Map([
      ["c1", catalog({ id: "c1", name: "A", updated_at: "2026-07-15T00:00:00.000Z" })],
    ]);
    const result = deriveDraftCatalogEconomicsStale({
      snapshotLines: [{ catalog_item_id: "c1" }],
      liveCatalogById: map,
      snapshotUpdatedAt: "2026-07-10T00:00:00.000Z",
    });
    assert.equal(result.stale, true);
    assert.equal(result.reason, "catalog_items_updated");
    assert.equal(result.updatedCount, 1);
    assert.match(formatDraftCatalogEconomicsStaleBanner(result) ?? "", /refresh draft pricing/i);
  });

  test("missing catalog takes priority over updated", () => {
    const map = new Map([
      ["c2", catalog({ id: "c2", name: "B", updated_at: "2026-07-20T00:00:00.000Z" })],
    ]);
    const result = deriveDraftCatalogEconomicsStale({
      snapshotLines: [{ catalog_item_id: "gone" }, { catalog_item_id: "c2" }],
      liveCatalogById: map,
      snapshotUpdatedAt: "2026-07-01T00:00:00.000Z",
    });
    assert.equal(result.reason, "catalog_item_missing");
    assert.equal(result.missingCount, 1);
  });

  test("inactive catalog detected", () => {
    const map = new Map([
      ["c1", catalog({ id: "c1", name: "A", active: false })],
    ]);
    const result = deriveDraftCatalogEconomicsStale({
      snapshotLines: [{ catalog_item_id: "c1" }],
      liveCatalogById: map,
      snapshotUpdatedAt: "2026-07-10T00:00:00.000Z",
    });
    assert.equal(result.reason, "catalog_item_inactive");
  });

  test("frozen helper copy does not claim live sync", () => {
    assert.match(PROPOSAL_SNAPSHOT_FROZEN_HELPER_COPY, /frozen draft snapshot/i);
    assert.equal(
      /auto-refresh|supplier sync is active|material ordering is live/i.test(
        PROPOSAL_SNAPSHOT_FROZEN_HELPER_COPY
      ),
      false
    );
  });
});
