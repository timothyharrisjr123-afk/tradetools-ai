/**
 * Run: npx tsx --test app/admin/catalog/catalogAdminUtils.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import type { CatalogItem } from "@/app/lib/catalogTypes";
import {
  buildEditDraftFromItem,
  formatCatalogQuantityDriversLine,
  parseCatalogQuantityDrivers,
  parseCoverageRateOrNull,
  parseWastePctOrNull,
} from "./catalogAdminUtils";

function item(
  overrides: Partial<CatalogItem> & Pick<CatalogItem, "id">
): CatalogItem {
  return {
    id: overrides.id,
    company_id: "00000000-0000-4000-8000-000000000001",
    name: overrides.name ?? "Test item",
    item_type: "material",
    unit: "square",
    quantity_source: "adjusted_roof_squares",
    pricing_basis: "unit_price",
    customer_visibility: "customer_visible",
    active: true,
    unit_price_cents: 25000,
    waste_applies: false,
    ...overrides,
  };
}

describe("parseCoverageRateOrNull", () => {
  test("accepts null/empty as 1:1 coverage", () => {
    assert.deepEqual(parseCoverageRateOrNull(""), { value: null, error: null });
    assert.deepEqual(parseCoverageRateOrNull("   "), { value: null, error: null });
  });

  test("accepts positive coverage", () => {
    assert.deepEqual(parseCoverageRateOrNull("33.3"), { value: 33.3, error: null });
    assert.deepEqual(parseCoverageRateOrNull("1"), { value: 1, error: null });
  });

  test("rejects 0, negative, and non-finite values", () => {
    assert.match(parseCoverageRateOrNull("0").error ?? "", /greater than 0/i);
    assert.match(parseCoverageRateOrNull("-1").error ?? "", /greater than 0/i);
    assert.match(parseCoverageRateOrNull("abc").error ?? "", /valid number/i);
    assert.match(parseCoverageRateOrNull("Infinity").error ?? "", /valid number|greater than 0/i);
  });
});

describe("parseWastePctOrNull", () => {
  test("accepts null/empty as no item waste", () => {
    assert.deepEqual(parseWastePctOrNull(""), { value: null, error: null });
  });

  test("accepts 0 and positive waste percent", () => {
    assert.deepEqual(parseWastePctOrNull("0"), { value: 0, error: null });
    assert.deepEqual(parseWastePctOrNull("10"), { value: 10, error: null });
  });

  test("rejects negative and non-finite values", () => {
    assert.match(parseWastePctOrNull("-1").error ?? "", /cannot be negative/i);
    assert.match(parseWastePctOrNull("nope").error ?? "", /valid number/i);
  });
});

describe("parseCatalogQuantityDrivers", () => {
  test("parses coverage, waste_applies, and waste_pct together", () => {
    const parsed = parseCatalogQuantityDrivers({
      coverage_rate: "33.3",
      waste_applies: true,
      waste_pct: "10",
    });
    assert.equal(parsed.error, null);
    assert.equal(parsed.coverage_rate, 33.3);
    assert.equal(parsed.waste_applies, true);
    assert.equal(parsed.waste_pct, 10);
  });

  test("keeps waste_pct when waste_applies is false (inactive, still stored)", () => {
    const parsed = parseCatalogQuantityDrivers({
      coverage_rate: "",
      waste_applies: false,
      waste_pct: "12",
    });
    assert.equal(parsed.error, null);
    assert.equal(parsed.waste_applies, false);
    assert.equal(parsed.waste_pct, 12);
  });

  test("surfaces coverage validation errors", () => {
    const parsed = parseCatalogQuantityDrivers({
      coverage_rate: "0",
      waste_applies: true,
      waste_pct: "10",
    });
    assert.match(parsed.error ?? "", /Coverage/i);
  });
});

describe("buildEditDraftFromItem / formatCatalogQuantityDriversLine", () => {
  test("edit draft hydrates coverage and waste fields", () => {
    const draft = buildEditDraftFromItem(
      item({
        id: "1",
        coverage_rate: 33.3,
        waste_applies: true,
        waste_pct: 10,
      })
    );
    assert.equal(draft.coverage_rate, "33.3");
    assert.equal(draft.waste_applies, true);
    assert.equal(draft.waste_pct, "10");
  });

  test("quantity drivers line is compact and omitable", () => {
    assert.equal(
      formatCatalogQuantityDriversLine(
        item({ id: "1", coverage_rate: null, waste_applies: false, waste_pct: null })
      ),
      null
    );
    assert.equal(
      formatCatalogQuantityDriversLine(
        item({ id: "2", coverage_rate: 33.3, waste_applies: true, waste_pct: 10 })
      ),
      "Coverage 33.3 · Waste 10%"
    );
    assert.equal(
      formatCatalogQuantityDriversLine(
        item({ id: "3", coverage_rate: null, waste_applies: true, waste_pct: null })
      ),
      "Waste on"
    );
  });
});

describe("Catalog Coverage/Waste UI wiring", () => {
  test("edit and add surfaces include Coverage and Waste fields", () => {
    const edit = readFileSync(
      join(process.cwd(), "app/admin/catalog/components/CatalogItemDetailPanel.tsx"),
      "utf8"
    );
    const add = readFileSync(
      join(process.cwd(), "app/admin/catalog/components/AddCatalogItemModal.tsx"),
      "utf8"
    );
    const setup = readFileSync(
      join(process.cwd(), "app/tools/roofing/catalog/CatalogSetupClient.tsx"),
      "utf8"
    );
    assert.match(edit, /data-catalog-quantity-drivers="edit"/);
    assert.match(add, /data-catalog-quantity-drivers="add"/);
    assert.match(edit, /coverage_rate/);
    assert.match(edit, /waste_applies/);
    assert.match(edit, /waste_pct/);
    assert.match(add, /coverage_rate/);
    assert.match(setup, /parseCatalogQuantityDrivers/);
    assert.match(setup, /coverage_rate: quantityDrivers\.coverage_rate/);
    assert.match(setup, /waste_pct: quantityDrivers\.waste_pct/);
    assert.equal(setup.includes("shouldAutoRefresh"), false);
    assert.equal(/Send block|block send/i.test(setup), false);
  });

  test("table keeps no Coverage/Waste columns; shows secondary detail line", () => {
    const table = readFileSync(
      join(process.cwd(), "app/admin/catalog/components/CatalogItemTable.tsx"),
      "utf8"
    );
    assert.match(table, /formatCatalogQuantityDriversLine/);
    assert.match(table, /data-catalog-quantity-drivers-line/);
    assert.equal(table.includes(">{CATALOG_CONTRACTOR_LABELS.coverage}<"), false);
    assert.equal(table.includes(">{CATALOG_CONTRACTOR_LABELS.waste}<"), false);
  });
});
