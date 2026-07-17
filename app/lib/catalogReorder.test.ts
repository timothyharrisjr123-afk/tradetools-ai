/**
 * Run: npx tsx --test app/lib/catalogReorder.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  CATALOG_REORDER_HELPER_COPY,
  CATALOG_REORDER_UNAVAILABLE_COPY,
  CATALOG_SORT_ORDER_STRIDE,
  applyCatalogSortOrder,
  buildCatalogSortOrderAssignments,
  catalogReorderOrderChanged,
  diffCatalogSortOrderAssignments,
  formatCatalogReorderResultMessage,
  isCatalogReorderAvailable,
  moveCatalogItemInOrder,
} from "./catalogReorder";

describe("catalogReorder", () => {
  test("isCatalogReorderAvailable requires empty search and all type filter", () => {
    assert.equal(isCatalogReorderAvailable({ searchQuery: "", itemTypeFilter: "all" }), true);
    assert.equal(
      isCatalogReorderAvailable({ searchQuery: "shingle", itemTypeFilter: "all" }),
      false
    );
    assert.equal(
      isCatalogReorderAvailable({ searchQuery: "", itemTypeFilter: "material" }),
      false
    );
    assert.match(CATALOG_REORDER_UNAVAILABLE_COPY, /Clear search/i);
    assert.match(CATALOG_REORDER_HELPER_COPY, /display order only/i);
    assert.match(CATALOG_REORDER_HELPER_COPY, /does not change pricing/i);
  });

  test("move up/down/top/bottom", () => {
    const ids = ["a", "b", "c", "d"];
    assert.deepEqual(moveCatalogItemInOrder(ids, "c", "up"), ["a", "c", "b", "d"]);
    assert.deepEqual(moveCatalogItemInOrder(ids, "b", "down"), ["a", "c", "b", "d"]);
    assert.deepEqual(moveCatalogItemInOrder(ids, "d", "top"), ["d", "a", "b", "c"]);
    assert.deepEqual(moveCatalogItemInOrder(ids, "a", "bottom"), ["b", "c", "d", "a"]);
    assert.deepEqual(moveCatalogItemInOrder(ids, "a", "up"), ["a", "b", "c", "d"]);
    assert.deepEqual(moveCatalogItemInOrder(ids, "missing", "up"), ids);
  });

  test("build and diff sort order assignments use stride", () => {
    const built = buildCatalogSortOrderAssignments(["a", "b", "c"]);
    assert.deepEqual(built, [
      { id: "a", sort_order: CATALOG_SORT_ORDER_STRIDE },
      { id: "b", sort_order: CATALOG_SORT_ORDER_STRIDE * 2 },
      { id: "c", sort_order: CATALOG_SORT_ORDER_STRIDE * 3 },
    ]);
    const current = new Map<string, number | null>([
      ["a", 10],
      ["b", 20],
      ["c", null],
    ]);
    const diff = diffCatalogSortOrderAssignments(["a", "b", "c"], current);
    assert.deepEqual(diff, [{ id: "c", sort_order: 30 }]);
  });

  test("catalogReorderOrderChanged detects identity", () => {
    assert.equal(catalogReorderOrderChanged(["a", "b"], ["a", "b"]), false);
    assert.equal(catalogReorderOrderChanged(["a", "b"], ["b", "a"]), true);
  });

  test("applyCatalogSortOrder updates only changed sort_order via adapter", async () => {
    const calls: Array<{ id: string; sort_order: number }> = [];
    const result = await applyCatalogSortOrder({
      companyId: "11111111-1111-4111-8111-111111111111",
      orderedIds: ["a", "b"],
      currentById: new Map([
        ["a", 10],
        ["b", 99],
      ]),
      adapters: {
        updateSortOrder: async (id, sortOrder) => {
          calls.push({ id, sort_order: sortOrder });
          return {
            id,
            company_id: "11111111-1111-4111-8111-111111111111",
            name: id,
            item_type: "material",
            unit: "each",
            quantity_source: "fixed",
            pricing_basis: "unit_price",
            customer_visibility: "customer_visible",
            active: true,
            sort_order: sortOrder,
            sales_tax_rate_pct: 8.25,
            purchase_tax_rate_pct: 2,
            abc_sku: "KEEP",
          };
        },
      },
    });
    assert.equal(result.ok, true);
    assert.deepEqual(calls, [{ id: "b", sort_order: 20 }]);
    assert.match(formatCatalogReorderResultMessage(result), /saved/i);
  });

  test("applyCatalogSortOrder stops on first failure", async () => {
    let calls = 0;
    const result = await applyCatalogSortOrder({
      companyId: "11111111-1111-4111-8111-111111111111",
      orderedIds: ["a", "b"],
      currentById: new Map([
        ["a", null],
        ["b", null],
      ]),
      adapters: {
        updateSortOrder: async () => {
          calls++;
          return null;
        },
      },
    });
    assert.equal(result.ok, false);
    assert.equal(calls, 1);
    assert.match(formatCatalogReorderResultMessage(result), /failed/i);
  });
});
