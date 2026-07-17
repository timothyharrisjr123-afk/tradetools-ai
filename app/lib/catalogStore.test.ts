/**
 * Catalog store mapper + load-result contracts (no live DB).
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
  type CatalogItemsLoadResult,
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

describe("catalogStore quantity-driver mapper", () => {
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

  test("rowToCatalogItem maps coverage_rate, waste_applies, and waste_pct together", () => {
    const item = rowToCatalogItem(
      baseRow({
        coverage_rate: 5,
        waste_applies: true,
        waste_pct: 10,
      })
    );
    assert.equal(item.coverage_rate, 5);
    assert.equal(item.waste_applies, true);
    assert.equal(item.waste_pct, 10);
  });

  test("rowToCatalogItem maps null coverage_basis", () => {
    assert.equal(rowToCatalogItem(baseRow({ coverage_basis: null })).coverage_basis, null);
    const missing = baseRow();
    delete missing.coverage_basis;
    assert.equal(rowToCatalogItem(missing).coverage_basis, null);
  });

  test("rowToCatalogItem maps each approved coverage_basis value", () => {
    for (const basis of [
      "roof_square",
      "square_feet",
      "linear_feet",
      "each",
      "tons",
    ] as const) {
      assert.equal(
        rowToCatalogItem(baseRow({ coverage_rate: 5, coverage_basis: basis })).coverage_basis,
        basis
      );
    }
  });

  test("rowToCatalogItem rejects invalid coverage_basis as null", () => {
    assert.equal(
      rowToCatalogItem(baseRow({ coverage_basis: "bundle" })).coverage_basis,
      null
    );
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

  test("insert row passes through coverage/waste drivers when set", () => {
    const insert = catalogItemDraftToInsertRow(
      baseDraft({
        coverage_rate: 5,
        coverage_basis: "roof_square",
        waste_applies: true,
        waste_pct: 10,
      })
    );
    assert.equal(insert.coverage_rate, 5);
    assert.equal(insert.coverage_basis, "roof_square");
    assert.equal(insert.waste_applies, true);
    assert.equal(insert.waste_pct, 10);
  });

  test("insert row omits waste_pct when draft does not set it", () => {
    const insert = catalogItemDraftToInsertRow(baseDraft());
    assert.equal("waste_pct" in insert, false);
  });

  test("update patch passes coverage/waste only when present", () => {
    const omitted = catalogItemPatchToUpdateRow({ name: "Rename only" });
    assert.equal("waste_pct" in omitted, false);
    assert.equal("coverage_rate" in omitted, false);
    assert.equal("coverage_basis" in omitted, false);

    const patched = catalogItemPatchToUpdateRow({
      coverage_rate: 7.5,
      coverage_basis: "square_feet",
      waste_applies: false,
      waste_pct: 12,
    });
    assert.equal(patched.coverage_rate, 7.5);
    assert.equal(patched.coverage_basis, "square_feet");
    assert.equal(patched.waste_applies, false);
    assert.equal(patched.waste_pct, 12);
  });

  test("update-to-null clears quantity drivers including coverage_basis", () => {
    const patched = catalogItemPatchToUpdateRow({
      coverage_rate: null,
      coverage_basis: null,
      waste_pct: null,
      waste_applies: false,
    });
    assert.equal(patched.coverage_rate, null);
    assert.equal(patched.coverage_basis, null);
    assert.equal(patched.waste_pct, null);
    assert.equal(patched.waste_applies, false);
  });
});

describe("catalogStore item tax mapper", () => {
  test("rowToCatalogItem maps sales_tax_rate_pct null", () => {
    assert.equal(rowToCatalogItem(baseRow({ sales_tax_rate_pct: null })).sales_tax_rate_pct, null);
    const missing = baseRow();
    delete missing.sales_tax_rate_pct;
    assert.equal(rowToCatalogItem(missing).sales_tax_rate_pct, null);
  });

  test("rowToCatalogItem maps purchase_tax_rate_pct null", () => {
    assert.equal(
      rowToCatalogItem(baseRow({ purchase_tax_rate_pct: null })).purchase_tax_rate_pct,
      null
    );
    const missing = baseRow();
    delete missing.purchase_tax_rate_pct;
    assert.equal(rowToCatalogItem(missing).purchase_tax_rate_pct, null);
  });

  test("rowToCatalogItem maps valid tax values", () => {
    const item = rowToCatalogItem(
      baseRow({ sales_tax_rate_pct: 8.25, purchase_tax_rate_pct: 6.5 })
    );
    assert.equal(item.sales_tax_rate_pct, 8.25);
    assert.equal(item.purchase_tax_rate_pct, 6.5);
  });

  test("create payload includes both tax fields when set", () => {
    const insert = catalogItemDraftToInsertRow(
      baseDraft({ sales_tax_rate_pct: 8.25, purchase_tax_rate_pct: 6.5 })
    );
    assert.equal(insert.sales_tax_rate_pct, 8.25);
    assert.equal(insert.purchase_tax_rate_pct, 6.5);
  });

  test("update payload includes both tax fields when set", () => {
    const patched = catalogItemPatchToUpdateRow({
      sales_tax_rate_pct: 7,
      purchase_tax_rate_pct: 5,
    });
    assert.equal(patched.sales_tax_rate_pct, 7);
    assert.equal(patched.purchase_tax_rate_pct, 5);
  });

  test("existing nulls remain valid on update-to-null", () => {
    const patched = catalogItemPatchToUpdateRow({
      sales_tax_rate_pct: null,
      purchase_tax_rate_pct: null,
    });
    assert.equal(patched.sales_tax_rate_pct, null);
    assert.equal(patched.purchase_tax_rate_pct, null);
  });

  test("insert omits tax fields when draft does not set them", () => {
    const insert = catalogItemDraftToInsertRow(baseDraft());
    assert.equal("sales_tax_rate_pct" in insert, false);
    assert.equal("purchase_tax_rate_pct" in insert, false);
  });
});

describe("CatalogItemsLoadResult contract", () => {
  test("success with rows, success empty, and failed read are distinct shapes", () => {
    const withRows: CatalogItemsLoadResult = {
      ok: true,
      items: [rowToCatalogItem(baseRow())],
    };
    const empty: CatalogItemsLoadResult = { ok: true, items: [] };
    const failed: CatalogItemsLoadResult = {
      ok: false,
      error: "Could not load catalog items.",
    };

    assert.equal(withRows.ok, true);
    if (withRows.ok) assert.equal(withRows.items.length, 1);

    assert.equal(empty.ok, true);
    if (empty.ok) assert.equal(empty.items.length, 0);

    assert.equal(failed.ok, false);
    if (!failed.ok) {
      assert.match(failed.error, /Could not load catalog items/i);
    }

    // Failed must never look like success empty.
    assert.notEqual(failed.ok, empty.ok);
  });
});
