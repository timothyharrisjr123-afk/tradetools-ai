/**
 * S3B — catalog store mapper awareness for waste_pct (no DB, no UI).
 *
 * Run: npx tsx --test app/lib/catalogStore.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { CatalogItemDraft } from "./catalogTypes";
import {
  catalogItemDraftToInsertRow,
  catalogItemPatchToUpdateRow,
  rowToCatalogItem,
  type CatalogItemRow,
} from "./catalogStore";

function baseRow(overrides: Partial<CatalogItemRow> = {}): CatalogItemRow {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    company_id: "22222222-2222-4222-8222-222222222222",
    name: "Architectural shingles",
    item_type: "material",
    unit: "square",
    quantity_source: "adjusted_roof_squares",
    waste_applies: false,
    pricing_basis: "unit_price",
    customer_visibility: "customer_visible",
    active: true,
    created_at: "2026-07-16T00:00:00Z",
    updated_at: "2026-07-16T00:00:00Z",
    ...overrides,
  };
}

function baseDraft(overrides: Partial<CatalogItemDraft> = {}): CatalogItemDraft {
  return {
    company_id: "22222222-2222-4222-8222-222222222222",
    name: "Architectural shingles",
    item_type: "material",
    unit: "square",
    quantity_source: "adjusted_roof_squares",
    waste_applies: false,
    pricing_basis: "unit_price",
    customer_visibility: "customer_visible",
    active: true,
    ...overrides,
  };
}

describe("catalogStore waste_pct mapper (S3B)", () => {
  test("rowToCatalogItem maps null waste_pct", () => {
    const item = rowToCatalogItem(baseRow({ waste_pct: null }));
    assert.equal(item.waste_pct, null);
  });

  test("rowToCatalogItem maps missing waste_pct as null", () => {
    const row = baseRow();
    delete row.waste_pct;
    const item = rowToCatalogItem(row);
    assert.equal(item.waste_pct, null);
  });

  test("rowToCatalogItem maps 0 and positive waste_pct", () => {
    assert.equal(rowToCatalogItem(baseRow({ waste_pct: 0 })).waste_pct, 0);
    assert.equal(rowToCatalogItem(baseRow({ waste_pct: 12.5 })).waste_pct, 12.5);
  });

  test("rowToCatalogItem normalizes non-finite waste_pct to null", () => {
    assert.equal(rowToCatalogItem(baseRow({ waste_pct: Number.NaN })).waste_pct, null);
    assert.equal(
      rowToCatalogItem(baseRow({ waste_pct: Number.POSITIVE_INFINITY })).waste_pct,
      null
    );
  });

  test("insert row omits waste_pct when draft does not set it", () => {
    const insert = catalogItemDraftToInsertRow(baseDraft());
    assert.equal("waste_pct" in insert, false);
  });

  test("insert row passes through null and positive waste_pct when set", () => {
    const withNull = catalogItemDraftToInsertRow(baseDraft({ waste_pct: null }));
    assert.equal(withNull.waste_pct, null);

    const withValue = catalogItemDraftToInsertRow(baseDraft({ waste_pct: 10 }));
    assert.equal(withValue.waste_pct, 10);
  });

  test("update patch passes waste_pct only when present", () => {
    const omitted = catalogItemPatchToUpdateRow({ name: "Rename only" });
    assert.equal("waste_pct" in omitted, false);

    const patched = catalogItemPatchToUpdateRow({ waste_pct: 8 });
    assert.equal(patched.waste_pct, 8);
  });
});
