/**
 * Run: npx tsx --test app/admin/catalog/catalogAdminUtils.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import type { CatalogItem } from "@/app/lib/catalogTypes";
import {
  EMPTY_ADD_CATALOG_FORM,
  buildCatalogCreateDraft,
  buildCatalogUpdatePatch,
  buildEditDraftFromItem,
  formatCatalogQuantityDriversLine,
  parseCatalogQuantityDrivers,
  parseCoverageBasisOrNull,
  parseCoverageRateOrNull,
  parseDollarsToCentsOrNull,
  parseStrictFiniteNumber,
  parseTaxRatePctOrNull,
  parseWastePctOrNull,
  formatCatalogTaxRateDisplay,
  CATALOG_TAX_RATE_PCT_MAX,
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

describe("parseStrictFiniteNumber", () => {
  test("accepts blank, integers, decimals, and trimmed whitespace", () => {
    assert.deepEqual(parseStrictFiniteNumber(""), { value: null, error: "empty" });
    assert.deepEqual(parseStrictFiniteNumber(" 12 "), { value: 12, error: null });
    assert.deepEqual(parseStrictFiniteNumber("12.5"), { value: 12.5, error: null });
    assert.deepEqual(parseStrictFiniteNumber("0"), { value: 0, error: null });
    assert.deepEqual(parseStrictFiniteNumber("0.00"), { value: 0, error: null });
    assert.deepEqual(parseStrictFiniteNumber("1,234.5"), { value: 1234.5, error: null });
  });

  test("rejects malformed suffixes and non-numbers from the audit", () => {
    for (const bad of ["12abc", "5abc", "10xyz", "NaN", "Infinity", "--1", "1.2.3"]) {
      assert.equal(parseStrictFiniteNumber(bad).error, "invalid", bad);
    }
  });
});

describe("parseCoverageRateOrNull", () => {
  test("accepts null/empty as 1:1 coverage", () => {
    assert.deepEqual(parseCoverageRateOrNull(""), { value: null, error: null });
    assert.deepEqual(parseCoverageRateOrNull("   "), { value: null, error: null });
  });

  test("accepts positive coverage", () => {
    assert.deepEqual(parseCoverageRateOrNull("33.3"), { value: 33.3, error: null });
    assert.deepEqual(parseCoverageRateOrNull("1"), { value: 1, error: null });
  });

  test("rejects 0, negative, non-finite, and malformed suffixes", () => {
    assert.match(parseCoverageRateOrNull("0").error ?? "", /greater than 0/i);
    assert.match(parseCoverageRateOrNull("-1").error ?? "", /greater than 0/i);
    assert.match(parseCoverageRateOrNull("abc").error ?? "", /valid number/i);
    assert.match(parseCoverageRateOrNull("5abc").error ?? "", /valid number/i);
    assert.match(parseCoverageRateOrNull("Infinity").error ?? "", /valid number/i);
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

  test("rejects negative, non-finite, and malformed suffixes", () => {
    assert.match(parseWastePctOrNull("-1").error ?? "", /cannot be negative/i);
    assert.match(parseWastePctOrNull("nope").error ?? "", /valid number/i);
    assert.match(parseWastePctOrNull("10xyz").error ?? "", /valid number/i);
  });
});

describe("parseTaxRatePctOrNull", () => {
  test("empty → null", () => {
    assert.deepEqual(parseTaxRatePctOrNull("", "Sales tax"), {
      value: null,
      error: null,
    });
    assert.deepEqual(parseTaxRatePctOrNull("   ", "Sales tax"), {
      value: null,
      error: null,
    });
  });

  test("valid number and decimal accepted", () => {
    assert.deepEqual(parseTaxRatePctOrNull("8", "Sales tax"), {
      value: 8,
      error: null,
    });
    assert.deepEqual(parseTaxRatePctOrNull("8.25", "Sales tax"), {
      value: 8.25,
      error: null,
    });
    assert.deepEqual(parseTaxRatePctOrNull("0", "Sales tax"), {
      value: 0,
      error: null,
    });
    assert.deepEqual(parseTaxRatePctOrNull(String(CATALOG_TAX_RATE_PCT_MAX), "Sales tax"), {
      value: CATALOG_TAX_RATE_PCT_MAX,
      error: null,
    });
  });

  test("negative, above-bound, malformed, NaN/Infinity rejected", () => {
    assert.match(parseTaxRatePctOrNull("-1", "Sales tax").error ?? "", /cannot be negative/i);
    assert.match(
      parseTaxRatePctOrNull("100.01", "Sales tax").error ?? "",
      /cannot exceed/i
    );
    assert.match(parseTaxRatePctOrNull("5abc", "Sales tax").error ?? "", /valid number/i);
    assert.match(parseTaxRatePctOrNull("NaN", "Sales tax").error ?? "", /valid number/i);
    assert.match(parseTaxRatePctOrNull("Infinity", "Sales tax").error ?? "", /valid number/i);
  });

  test("formatCatalogTaxRateDisplay shows unset honestly", () => {
    assert.equal(formatCatalogTaxRateDisplay(null), "Not set (company default)");
    assert.equal(formatCatalogTaxRateDisplay(undefined), "Not set (company default)");
    assert.equal(formatCatalogTaxRateDisplay(8.25), "8.25%");
  });
});

describe("parseDollarsToCentsOrNull", () => {
  test("keeps valid price behavior and rejects malformed suffixes", () => {
    assert.deepEqual(parseDollarsToCentsOrNull("12.5", "Unit price"), {
      cents: 1250,
      error: null,
    });
    assert.deepEqual(parseDollarsToCentsOrNull("", "Unit price"), {
      cents: null,
      error: null,
    });
    assert.match(parseDollarsToCentsOrNull("12abc", "Unit price").error ?? "", /valid number/i);
    assert.match(parseDollarsToCentsOrNull("-1", "Unit cost").error ?? "", /cannot be negative/i);
  });
});

describe("parseCoverageBasisOrNull", () => {
  test("accepts empty and approved enum values", () => {
    assert.deepEqual(parseCoverageBasisOrNull(""), { value: null, error: null });
    assert.deepEqual(parseCoverageBasisOrNull("roof_square"), {
      value: "roof_square",
      error: null,
    });
  });

  test("rejects invalid enum values", () => {
    assert.match(parseCoverageBasisOrNull("bundle").error ?? "", /not valid/i);
  });
});

describe("parseCatalogQuantityDrivers", () => {
  test("parses coverage, waste_applies, and waste_pct together", () => {
    const parsed = parseCatalogQuantityDrivers({
      coverage_rate: "33.3",
      coverage_basis: "square_feet",
      waste_applies: true,
      waste_pct: "10",
    });
    assert.equal(parsed.error, null);
    assert.equal(parsed.coverage_rate, 33.3);
    assert.equal(parsed.coverage_basis, "square_feet");
    assert.equal(parsed.waste_applies, true);
    assert.equal(parsed.waste_pct, 10);
  });

  test("null coverage forces coverage_basis null", () => {
    const parsed = parseCatalogQuantityDrivers({
      coverage_rate: "",
      coverage_basis: "roof_square",
      waste_applies: false,
      waste_pct: "",
    });
    assert.equal(parsed.error, null);
    assert.equal(parsed.coverage_rate, null);
    assert.equal(parsed.coverage_basis, null);
  });

  test("non-null coverage + null basis is allowed", () => {
    const parsed = parseCatalogQuantityDrivers({
      coverage_rate: "5",
      coverage_basis: "",
      waste_applies: true,
      waste_pct: "10",
    });
    assert.equal(parsed.error, null);
    assert.equal(parsed.coverage_rate, 5);
    assert.equal(parsed.coverage_basis, null);
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

  test("surfaces coverage validation errors including malformed suffixes", () => {
    const parsed = parseCatalogQuantityDrivers({
      coverage_rate: "0",
      waste_applies: true,
      waste_pct: "10",
    });
    assert.match(parsed.error ?? "", /Coverage/i);

    const suffix = parseCatalogQuantityDrivers({
      coverage_rate: "5abc",
      waste_applies: true,
      waste_pct: "10",
    });
    assert.match(suffix.error ?? "", /Coverage/i);
  });
});

describe("buildCatalogCreateDraft / buildCatalogUpdatePatch", () => {
  test("create payload includes coverage_rate, coverage_basis, waste_applies, and waste_pct", () => {
    const built = buildCatalogCreateDraft("00000000-0000-4000-8000-000000000001", {
      ...EMPTY_ADD_CATALOG_FORM,
      name: "Audit material",
      item_type: "material",
      unit: "bundle",
      quantity_source: "roof_squares",
      unit_cost_dollars: "10.25",
      unit_price_dollars: "25.50",
      coverage_rate: "5",
      coverage_basis: "roof_square",
      waste_applies: true,
      waste_pct: "10",
    });
    assert.equal(built.ok, true);
    if (!built.ok) return;
    assert.equal(built.draft.coverage_rate, 5);
    assert.equal(built.draft.coverage_basis, "roof_square");
    assert.equal(built.draft.waste_applies, true);
    assert.equal(built.draft.waste_pct, 10);
    assert.equal(built.draft.unit_cost_cents, 1025);
    assert.equal(built.draft.unit_price_cents, 2550);
    assert.equal(built.draft.active, true);
    assert.equal(built.coverageCompatibility, "compatible");
  });

  test("create payload includes sales_tax_rate_pct and purchase_tax_rate_pct", () => {
    const built = buildCatalogCreateDraft("00000000-0000-4000-8000-000000000001", {
      ...EMPTY_ADD_CATALOG_FORM,
      name: "Tax capture material",
      unit_cost_dollars: "10",
      unit_price_dollars: "20",
      sales_tax_rate_pct: "8.25",
      purchase_tax_rate_pct: "6.5",
    });
    assert.equal(built.ok, true);
    if (!built.ok) return;
    assert.equal(built.draft.sales_tax_rate_pct, 8.25);
    assert.equal(built.draft.purchase_tax_rate_pct, 6.5);
  });

  test("create/update allow null tax rates and reject invalid tax", () => {
    const emptyTax = buildCatalogCreateDraft("00000000-0000-4000-8000-000000000001", {
      ...EMPTY_ADD_CATALOG_FORM,
      name: "No tax",
    });
    assert.equal(emptyTax.ok, true);
    if (!emptyTax.ok) return;
    assert.equal(emptyTax.draft.sales_tax_rate_pct, null);
    assert.equal(emptyTax.draft.purchase_tax_rate_pct, null);

    const badSales = buildCatalogCreateDraft("00000000-0000-4000-8000-000000000001", {
      ...EMPTY_ADD_CATALOG_FORM,
      name: "Bad sales tax",
      sales_tax_rate_pct: "101",
    });
    assert.equal(badSales.ok, false);

    const update = buildCatalogUpdatePatch(item({ id: "1", sales_tax_rate_pct: 8 }), {
      ...buildEditDraftFromItem(item({ id: "1", sales_tax_rate_pct: 8 })),
      sales_tax_rate_pct: "",
      purchase_tax_rate_pct: "",
    });
    assert.equal(update.ok, true);
    if (!update.ok) return;
    assert.equal(update.patch.sales_tax_rate_pct, null);
    assert.equal(update.patch.purchase_tax_rate_pct, null);

    const updateBad = buildCatalogUpdatePatch(item({ id: "1" }), {
      ...buildEditDraftFromItem(item({ id: "1" })),
      purchase_tax_rate_pct: "5abc",
    });
    assert.equal(updateBad.ok, false);
  });

  test("edit draft maps null and finite tax rates", () => {
    const empty = buildEditDraftFromItem(item({ id: "1" }));
    assert.equal(empty.sales_tax_rate_pct, "");
    assert.equal(empty.purchase_tax_rate_pct, "");
    const filled = buildEditDraftFromItem(
      item({ id: "1", sales_tax_rate_pct: 8.25, purchase_tax_rate_pct: 6 })
    );
    assert.equal(filled.sales_tax_rate_pct, "8.25");
    assert.equal(filled.purchase_tax_rate_pct, "6");
  });

  test("create/update include supplier SKUs; blank clears; overlong rejected", () => {
    const built = buildCatalogCreateDraft("00000000-0000-4000-8000-000000000001", {
      ...EMPTY_ADD_CATALOG_FORM,
      name: "SKU material",
      abc_sku: " ABC-1 ",
      qxo_sku: "QXO/2",
      srs_sku: "SRS_3",
    });
    assert.equal(built.ok, true);
    if (!built.ok) return;
    assert.equal(built.draft.abc_sku, "ABC-1");
    assert.equal(built.draft.qxo_sku, "QXO/2");
    assert.equal(built.draft.srs_sku, "SRS_3");

    const cleared = buildCatalogUpdatePatch(
      item({ id: "1", abc_sku: "OLD", qxo_sku: "OLD", srs_sku: "OLD" }),
      {
        ...buildEditDraftFromItem(
          item({ id: "1", abc_sku: "OLD", qxo_sku: "OLD", srs_sku: "OLD" })
        ),
        abc_sku: "",
        qxo_sku: "",
        srs_sku: "",
      }
    );
    assert.equal(cleared.ok, true);
    if (!cleared.ok) return;
    assert.equal(cleared.patch.abc_sku, null);
    assert.equal(cleared.patch.qxo_sku, null);
    assert.equal(cleared.patch.srs_sku, null);

    const overlong = buildCatalogCreateDraft("00000000-0000-4000-8000-000000000001", {
      ...EMPTY_ADD_CATALOG_FORM,
      name: "Bad SKU",
      abc_sku: "X".repeat(129),
    });
    assert.equal(overlong.ok, false);
  });

  test("create with coverage and null basis is allowed but not_verified", () => {
    const built = buildCatalogCreateDraft("00000000-0000-4000-8000-000000000001", {
      ...EMPTY_ADD_CATALOG_FORM,
      name: "Unverified material",
      unit: "bundle",
      quantity_source: "roof_squares",
      coverage_rate: "5",
      coverage_basis: "",
    });
    assert.equal(built.ok, true);
    if (!built.ok) return;
    assert.equal(built.draft.coverage_rate, 5);
    assert.equal(built.draft.coverage_basis, null);
    assert.equal(built.coverageCompatibility, "not_verified");
  });

  test("clearing coverage clears basis on create/update payloads", () => {
    const create = buildCatalogCreateDraft("00000000-0000-4000-8000-000000000001", {
      ...EMPTY_ADD_CATALOG_FORM,
      name: "Cleared",
      coverage_rate: "",
      coverage_basis: "roof_square",
    });
    assert.equal(create.ok, true);
    if (!create.ok) return;
    assert.equal(create.draft.coverage_rate, null);
    assert.equal(create.draft.coverage_basis, null);

    const update = buildCatalogUpdatePatch(
      item({
        id: "1",
        quantity_source: "roof_squares",
        coverage_rate: 5,
        coverage_basis: "roof_square",
      }),
      {
        ...buildEditDraftFromItem(
          item({
            id: "1",
            quantity_source: "roof_squares",
            coverage_rate: 5,
            coverage_basis: "roof_square",
          })
        ),
        coverage_rate: "",
        coverage_basis: "roof_square",
      }
    );
    assert.equal(update.ok, true);
    if (!update.ok) return;
    assert.equal(update.patch.coverage_rate, null);
    assert.equal(update.patch.coverage_basis, null);
  });

  test("malformed numeric values block create and update", () => {
    const createBlocked = buildCatalogCreateDraft("00000000-0000-4000-8000-000000000001", {
      ...EMPTY_ADD_CATALOG_FORM,
      name: "Bad",
      unit_price_dollars: "12abc",
    });
    assert.equal(createBlocked.ok, false);

    const updateBlocked = buildCatalogUpdatePatch(
      item({ id: "1", quantity_source: "roof_squares", unit: "bundle" }),
      {
        ...buildEditDraftFromItem(item({ id: "1" })),
        coverage_rate: "5abc",
      }
    );
    assert.equal(updateBlocked.ok, false);
  });

  test("update payload includes coverage/basis/waste and Apply waste off still stores waste_pct", () => {
    const built = buildCatalogUpdatePatch(
      item({ id: "1", quantity_source: "roof_squares", unit: "bundle" }),
      {
        ...buildEditDraftFromItem(
          item({
            id: "1",
            quantity_source: "roof_squares",
            unit: "bundle",
            coverage_rate: 5,
            coverage_basis: "roof_square",
            waste_applies: true,
            waste_pct: 10,
          })
        ),
        waste_applies: false,
        waste_pct: "10",
        coverage_rate: "7.5",
        coverage_basis: "roof_square",
      }
    );
    assert.equal(built.ok, true);
    if (!built.ok) return;
    assert.equal(built.patch.coverage_rate, 7.5);
    assert.equal(built.patch.coverage_basis, "roof_square");
    assert.equal(built.patch.waste_applies, false);
    assert.equal(built.patch.waste_pct, 10);
    assert.equal(built.coverageCompatibility, "compatible");
  });

  test("deactivate remains soft status — create/update builders never emit delete markers", () => {
    const create = buildCatalogCreateDraft("00000000-0000-4000-8000-000000000001", {
      ...EMPTY_ADD_CATALOG_FORM,
      name: "Soft only",
    });
    assert.equal(create.ok, true);
    if (!create.ok) return;
    assert.equal("deleted_at" in create.draft, false);
    assert.equal(create.draft.active, true);

    const update = buildCatalogUpdatePatch(item({ id: "1" }), buildEditDraftFromItem(item({ id: "1" })));
    assert.equal(update.ok, true);
    if (!update.ok) return;
    assert.equal("deleted_at" in update.patch, false);
    assert.equal("active" in update.patch, false);
  });
});

describe("buildEditDraftFromItem / formatCatalogQuantityDriversLine", () => {
  test("edit draft hydrates coverage, basis, and waste fields", () => {
    const draft = buildEditDraftFromItem(
      item({
        id: "1",
        coverage_rate: 33.3,
        coverage_basis: "square_feet",
        waste_applies: true,
        waste_pct: 10,
      })
    );
    assert.equal(draft.coverage_rate, "33.3");
    assert.equal(draft.coverage_basis, "square_feet");
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
        item({
          id: "2",
          coverage_rate: 33.3,
          coverage_basis: "square_feet",
          waste_applies: true,
          waste_pct: 10,
        })
      ),
      "Coverage 33.3 · Square feet · Waste 10%"
    );
  });
});

describe("Catalog Coverage/Waste UI wiring", () => {
  test("edit and add surfaces include Coverage, Coverage basis, and Waste fields", () => {
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
    assert.match(edit, /data-catalog-coverage-basis="edit"/);
    assert.match(add, /data-catalog-coverage-basis="add"/);
    assert.ok(edit.includes("CATALOG_CONTRACTOR_LABELS.coverageBasis"));
    assert.ok(add.includes("CATALOG_CONTRACTOR_LABELS.coverageBasis"));
    assert.match(setup, /buildCatalogCreateDraft/);
    assert.match(setup, /buildCatalogUpdatePatch/);
    assert.match(setup, /loadCatalogItemsByCompany|loadActiveCatalogItemsByCompany/);
    assert.match(setup, /coverage_basis = ""/);
    assert.equal(setup.includes("shouldAutoRefresh"), false);
    assert.equal(/Send block|block send/i.test(setup), false);
    assert.equal(/wasteModel|raw_plus_waste|whole rounding/i.test(edit), false);
    assert.equal(/wasteModel|raw_plus_waste|whole rounding/i.test(add), false);
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

  test("Catalog Settings has no raw mode switch and planned tools stay planned", () => {
    const settings = readFileSync(
      join(process.cwd(), "app/tools/roofing/catalog/CatalogSettingsPanel.tsx"),
      "utf8"
    );
    assert.match(settings, /CATALOG_SETTINGS_PLANNED_TOOLS/);
    assert.match(settings, /Coming soon|CATALOG_COMING_SOON_LABEL/);
    assert.equal(/wasteModel|raw_plus_waste|mode switch/i.test(settings), false);
    assert.equal(settings.includes('type="checkbox"'), false);
    assert.equal(settings.includes("onChange"), false);
  });

  test("failed catalog read does not show starter empty-install", () => {
    const setup = readFileSync(
      join(process.cwd(), "app/tools/roofing/catalog/CatalogSetupClient.tsx"),
      "utf8"
    );
    assert.match(setup, /showEmptyInstall = !loading && !loadError && sortedItems\.length === 0/);
    assert.match(setup, /onRetryLoad/);
    assert.match(setup, /if \(loading \|\| installing \|\| savingItemId \|\| loadError\) return/);
  });
});
