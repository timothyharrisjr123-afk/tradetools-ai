/**
 * Run: npx tsx --test app/lib/catalogSelection.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  catalogSelectionHeaderState,
  countSelectedAmong,
  formatCatalogSelectedCount,
  pruneCatalogSelection,
  setCatalogVisibleSelection,
  toggleCatalogSelectionId,
} from "./catalogSelection";
import {
  CATALOG_BULK_LIVE_ACTIONS,
  CATALOG_BULK_PLANNED_ACTIONS,
  applyCatalogBulkAction,
  formatCatalogBulkResultMessage,
} from "./catalogBulkActions";

describe("catalogSelection", () => {
  test("toggle adds and removes ids", () => {
    const a = toggleCatalogSelectionId(new Set(), "1");
    assert.deepEqual([...a], ["1"]);
    const b = toggleCatalogSelectionId(a, "1");
    assert.deepEqual([...b], []);
  });

  test("select-all visible preserves other selections", () => {
    const selected = new Set(["x"]);
    const next = setCatalogVisibleSelection(selected, ["a", "b"], true);
    assert.ok(next.has("x"));
    assert.ok(next.has("a"));
    assert.ok(next.has("b"));
    const cleared = setCatalogVisibleSelection(next, ["a", "b"], false);
    assert.ok(cleared.has("x"));
    assert.equal(cleared.has("a"), false);
  });

  test("prune drops missing ids", () => {
    const pruned = pruneCatalogSelection(new Set(["a", "b", "c"]), ["a", "c"]);
    assert.deepEqual([...pruned].sort(), ["a", "c"]);
  });

  test("header state none/some/all", () => {
    assert.equal(catalogSelectionHeaderState(new Set(), ["a", "b"]), "none");
    assert.equal(catalogSelectionHeaderState(new Set(["a"]), ["a", "b"]), "some");
    assert.equal(catalogSelectionHeaderState(new Set(["a", "b"]), ["a", "b"]), "all");
  });

  test("count and format selected", () => {
    assert.equal(countSelectedAmong(new Set(["a", "c"]), ["a", "b", "c"]), 2);
    assert.equal(formatCatalogSelectedCount(1), "1 selected");
    assert.equal(formatCatalogSelectedCount(3), "3 selected");
  });
});

describe("catalogBulkActions", () => {
  test("live and planned action catalogs are disjoint and labeled", () => {
    const liveIds = new Set(CATALOG_BULK_LIVE_ACTIONS.map((a) => a.id));
    for (const planned of CATALOG_BULK_PLANNED_ACTIONS) {
      assert.equal(liveIds.has(planned.id as never), false);
      assert.equal(planned.status, "planned");
      assert.match(planned.detail, /Planned|not available/i);
    }
    for (const live of CATALOG_BULK_LIVE_ACTIONS) {
      assert.equal(live.status, "live");
    }
    assert.ok(liveIds.has("mark_active"));
    assert.ok(liveIds.has("mark_inactive"));
    assert.ok(liveIds.has("proposal_visible"));
    assert.ok(liveIds.has("proposal_hidden"));
  });

  test("applyCatalogBulkAction marks inactive sequentially via adapter", async () => {
    const calls: Array<{ id: string; active: boolean }> = [];
    const result = await applyCatalogBulkAction({
      companyId: "11111111-1111-4111-8111-111111111111",
      actionId: "mark_inactive",
      selectedIds: ["a", "b"],
      adapters: {
        setActive: async (id, active) => {
          calls.push({ id, active });
          return {
            id,
            company_id: "11111111-1111-4111-8111-111111111111",
            name: id,
            item_type: "material",
            unit: "each",
            quantity_source: "fixed",
            pricing_basis: "unit_price",
            customer_visibility: "customer_visible",
            active,
          };
        },
        updateVisibility: async () => null,
      },
    });
    assert.equal(result.ok, true);
    assert.equal(result.successCount, 2);
    assert.deepEqual(calls, [
      { id: "a", active: false },
      { id: "b", active: false },
    ]);
  });

  test("applyCatalogBulkAction stops on first failure", async () => {
    const result = await applyCatalogBulkAction({
      companyId: "11111111-1111-4111-8111-111111111111",
      actionId: "mark_active",
      selectedIds: ["a", "b"],
      adapters: {
        setActive: async (id) => (id === "a" ? null : null),
        updateVisibility: async () => null,
      },
    });
    assert.equal(result.ok, false);
    assert.equal(result.successCount, 0);
    assert.equal(result.failedCount, 1);
    assert.match(formatCatalogBulkResultMessage("mark_active", result), /failed/i);
  });

  test("proposal visibility actions call updateVisibility", async () => {
    const calls: string[] = [];
    const result = await applyCatalogBulkAction({
      companyId: "11111111-1111-4111-8111-111111111111",
      actionId: "proposal_hidden",
      selectedIds: ["x"],
      adapters: {
        setActive: async () => null,
        updateVisibility: async (id, visibility) => {
          calls.push(`${id}:${visibility}`);
          return {
            id,
            company_id: "11111111-1111-4111-8111-111111111111",
            name: "x",
            item_type: "material",
            unit: "each",
            quantity_source: "fixed",
            pricing_basis: "unit_price",
            customer_visibility: visibility,
            active: true,
          };
        },
      },
    });
    assert.equal(result.ok, true);
    assert.deepEqual(calls, ["x:internal_only"]);
  });
});
