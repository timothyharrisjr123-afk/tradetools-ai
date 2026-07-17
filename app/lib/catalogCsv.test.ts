/**
 * Run: npx tsx --test app/lib/catalogCsv.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { CatalogItem } from "./catalogTypes";
import {
  CATALOG_CSV_HEADERS,
  analyzeCatalogCsv,
  applyCatalogCsvImport,
  buildCatalogCsvExport,
  buildCatalogCsvTemplate,
  catalogItemToCsvRawRow,
  parseCsvText,
} from "./catalogCsv";

const COMPANY_A = "11111111-1111-4111-8111-111111111111";
const ITEM_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_ID = "33333333-3333-4333-8333-333333333333";

function item(overrides: Partial<CatalogItem> = {}): CatalogItem {
  return {
    id: ITEM_ID,
    company_id: COMPANY_A,
    name: "Existing shingle",
    description: "Desc",
    item_type: "material",
    unit: "bundle",
    quantity_source: "roof_squares",
    pricing_basis: "unit_price",
    customer_visibility: "customer_visible",
    active: true,
    unit_cost_cents: 1000,
    unit_price_cents: 2500,
    coverage_rate: 3,
    coverage_basis: "roof_square",
    waste_applies: true,
    waste_pct: 10,
    sales_tax_rate_pct: 8.25,
    purchase_tax_rate_pct: null,
    ...overrides,
  };
}

function csv(rows: string[][]): string {
  return rows.map((r) => r.join(",")).join("\n") + "\n";
}

function headerRow(): string[] {
  return [...CATALOG_CSV_HEADERS];
}

function createRow(overrides: Partial<Record<(typeof CATALOG_CSV_HEADERS)[number], string>> = {}): string[] {
  const base: Record<(typeof CATALOG_CSV_HEADERS)[number], string> = {
    id: "",
    name: "New ridge cap",
    description: "Ridge",
    item_type: "material",
    quantity_source: "ridge_cap_lf",
    unit: "linear_foot",
    unit_cost: "1.50",
    unit_price: "3.00",
    proposal_visibility: "customer_visible",
    active: "true",
    coverage: "",
    coverage_basis: "",
    waste_applies: "false",
    waste_pct: "",
    sales_tax_rate_pct: "",
    purchase_tax_rate_pct: "",
    abc_sku: "",
    qxo_sku: "",
    srs_sku: "",
    ...overrides,
  };
  return CATALOG_CSV_HEADERS.map((h) => base[h]);
}

describe("catalogCsv", () => {
  test("template is headers only", () => {
    const text = buildCatalogCsvTemplate();
    const grid = parseCsvText(text);
    assert.equal(grid.length, 1);
    assert.deepEqual(grid[0], [...CATALOG_CSV_HEADERS]);
  });

  test("valid create row", () => {
    const text = csv([headerRow(), createRow()]);
    const result = analyzeCatalogCsv(text, []);
    assert.equal(result.ok, true);
    assert.equal(result.summary.createCount, 1);
    assert.equal(result.rows[0].action, "create");
    assert.equal(result.rows[0].values?.name, "New ridge cap");
    assert.equal(result.rows[0].values?.unit_price_cents, 300);
  });

  test("valid update row", () => {
    const existing = item();
    const text = csv([
      headerRow(),
      createRow({
        id: ITEM_ID,
        name: "Existing shingle",
        description: "Updated desc",
        item_type: "material",
        quantity_source: "roof_squares",
        unit: "bundle",
        unit_cost: "10.00",
        unit_price: "30.00",
        proposal_visibility: "customer_visible",
        active: "true",
        coverage: "3",
        coverage_basis: "roof_square",
        waste_applies: "true",
        waste_pct: "10",
        sales_tax_rate_pct: "8.25",
      }),
    ]);
    const result = analyzeCatalogCsv(text, [existing]);
    assert.equal(result.ok, true);
    assert.equal(result.summary.updateCount, 1);
    assert.equal(result.rows[0].action, "update");
    assert.equal(result.rows[0].values?.unit_price_cents, 3000);
    assert.equal(result.rows[0].values?.description, "Updated desc");
  });

  test("missing required name", () => {
    const text = csv([headerRow(), createRow({ name: "" })]);
    const result = analyzeCatalogCsv(text, []);
    assert.equal(result.ok, false);
    assert.equal(result.rows[0].action, "invalid");
    assert.ok(result.rows[0].errors.some((e) => /name is required/i.test(e)));
  });

  test("invalid enum", () => {
    const text = csv([headerRow(), createRow({ item_type: "widget" })]);
    const result = analyzeCatalogCsv(text, []);
    assert.equal(result.ok, false);
    assert.ok(result.rows[0].errors.some((e) => /item_type/i.test(e)));
  });

  test("malformed money", () => {
    const text = csv([headerRow(), createRow({ unit_price: "12abc" })]);
    const result = analyzeCatalogCsv(text, []);
    assert.equal(result.ok, false);
    assert.ok(result.rows[0].errors.some((e) => /Unit price/i.test(e)));
  });

  test("malformed percent", () => {
    const text = csv([headerRow(), createRow({ sales_tax_rate_pct: "101" })]);
    const result = analyzeCatalogCsv(text, []);
    assert.equal(result.ok, false);
    assert.ok(result.rows[0].errors.some((e) => /Sales tax/i.test(e)));
  });

  test("invalid coverage_basis", () => {
    const text = csv([
      headerRow(),
      createRow({ coverage: "3", coverage_basis: "not_a_basis" }),
    ]);
    const result = analyzeCatalogCsv(text, []);
    assert.equal(result.ok, false);
    assert.ok(result.rows[0].errors.some((e) => /Coverage basis/i.test(e)));
  });

  test("coverage cleared clears basis", () => {
    const existing = item({ coverage_rate: 3, coverage_basis: "roof_square" });
    const text = csv([
      headerRow(),
      createRow({
        id: ITEM_ID,
        name: existing.name,
        description: existing.description ?? "",
        item_type: existing.item_type,
        quantity_source: existing.quantity_source,
        unit: existing.unit,
        unit_cost: "10.00",
        unit_price: "25.00",
        proposal_visibility: existing.customer_visibility,
        active: "true",
        coverage: "",
        coverage_basis: "roof_square",
        waste_applies: "true",
        waste_pct: "10",
        sales_tax_rate_pct: "8.25",
      }),
    ]);
    const result = analyzeCatalogCsv(text, [existing]);
    assert.equal(result.ok, true);
    assert.equal(result.rows[0].values?.coverage_rate, null);
    assert.equal(result.rows[0].values?.coverage_basis, null);
  });

  test("invalid id update", () => {
    const text = csv([headerRow(), createRow({ id: OTHER_ID })]);
    const result = analyzeCatalogCsv(text, [item()]);
    assert.equal(result.ok, false);
    assert.ok(result.rows[0].errors.some((e) => /does not match/i.test(e)));
  });

  test("duplicate id rows", () => {
    const existing = item();
    const row = createRow({
      id: ITEM_ID,
      name: existing.name,
      item_type: existing.item_type,
      quantity_source: existing.quantity_source,
      unit: existing.unit,
      unit_cost: "10.00",
      unit_price: "25.00",
      coverage: "3",
      coverage_basis: "roof_square",
      waste_applies: "true",
      waste_pct: "10",
      sales_tax_rate_pct: "8.25",
    });
    const text = csv([headerRow(), row, row]);
    const result = analyzeCatalogCsv(text, [existing]);
    assert.equal(result.ok, false);
    assert.ok(result.rows[1].errors.some((e) => /Duplicate id/i.test(e)));
  });

  test("duplicate new item names warning", () => {
    const text = csv([
      headerRow(),
      createRow({ name: "Dup name" }),
      createRow({ name: "Dup name", description: "B" }),
    ]);
    const result = analyzeCatalogCsv(text, []);
    assert.equal(result.ok, true);
    assert.equal(result.summary.createCount, 2);
    assert.ok(result.rows[0].warnings.some((w) => /Multiple new rows share the name/i.test(w)));
  });

  test("empty CSV", () => {
    const result = analyzeCatalogCsv("", []);
    assert.equal(result.ok, false);
    assert.ok(result.fileErrors.some((e) => /empty/i.test(e)));
  });

  test("unknown header behavior", () => {
    const headers = [...CATALOG_CSV_HEADERS, "extra_col"];
    const text = csv([headers, createRow().concat(["x"])]);
    const result = analyzeCatalogCsv(text, []);
    assert.equal(result.ok, false);
    assert.ok(result.fileErrors.some((e) => /Unknown header|exactly/i.test(e)));
  });

  test("export round-trip", () => {
    const existing = item({
      abc_sku: "ABC-100",
      qxo_sku: "QXO/200",
      srs_sku: "SRS_300",
    });
    const exported = buildCatalogCsvExport([existing]);
    const result = analyzeCatalogCsv(exported, [existing]);
    assert.equal(result.ok, true);
    assert.equal(result.summary.unchangedCount, 1);
    assert.equal(result.rows[0].action, "unchanged");
    const raw = catalogItemToCsvRawRow(existing);
    assert.equal(raw.abc_sku, "ABC-100");
    assert.equal(raw.qxo_sku, "QXO/200");
    assert.equal(raw.srs_sku, "SRS_300");
    assert.equal(raw.purchase_tax_rate_pct, "");
  });

  test("import create with supplier SKUs persists values (no sync warning)", () => {
    const text = csv([
      headerRow(),
      createRow({ abc_sku: "ABC-1", qxo_sku: "QXO-2", srs_sku: "SRS-3" }),
    ]);
    const result = analyzeCatalogCsv(text, []);
    assert.equal(result.ok, true);
    assert.equal(result.rows[0].action, "create");
    assert.equal(result.rows[0].values?.abc_sku, "ABC-1");
    assert.equal(result.rows[0].values?.qxo_sku, "QXO-2");
    assert.equal(result.rows[0].values?.srs_sku, "SRS-3");
    assert.equal(
      result.rows[0].warnings.some((w) => /reserved|not imported/i.test(w)),
      false
    );
  });

  test("update changes supplier SKUs and blank clears them", () => {
    const existing = item({ abc_sku: "OLD-A", qxo_sku: "OLD-Q", srs_sku: "OLD-S" });
    const updateText = csv([
      headerRow(),
      createRow({
        id: ITEM_ID,
        name: existing.name,
        description: existing.description ?? "",
        item_type: existing.item_type,
        quantity_source: existing.quantity_source,
        unit: existing.unit,
        unit_cost: "10.00",
        unit_price: "25.00",
        coverage: "3",
        coverage_basis: "roof_square",
        waste_applies: "true",
        waste_pct: "10",
        sales_tax_rate_pct: "8.25",
        abc_sku: "NEW-A",
        qxo_sku: "",
        srs_sku: "NEW-S",
      }),
    ]);
    const updateResult = analyzeCatalogCsv(updateText, [existing]);
    assert.equal(updateResult.ok, true);
    assert.equal(updateResult.rows[0].action, "update");
    assert.equal(updateResult.rows[0].values?.abc_sku, "NEW-A");
    assert.equal(updateResult.rows[0].values?.qxo_sku, null);
    assert.equal(updateResult.rows[0].values?.srs_sku, "NEW-S");
  });

  test("invalid overlong SKU blocks row", () => {
    const text = csv([headerRow(), createRow({ abc_sku: "X".repeat(129) })]);
    const result = analyzeCatalogCsv(text, []);
    assert.equal(result.ok, false);
    assert.equal(result.rows[0].action, "invalid");
    assert.ok(result.rows[0].errors.some((e) => /ABC SKU/i.test(e) && /128/i.test(e)));
  });

  test("applyCatalogCsvImport creates and updates via adapters", async () => {
    const created: CatalogItem[] = [];
    const updated: Array<{ id: string; patch: Partial<CatalogItem> }> = [];
    const existing = item();
    const text = csv([
      headerRow(),
      createRow({ name: "CSV smoke create" }),
      createRow({
        id: ITEM_ID,
        name: existing.name,
        description: "Patched",
        item_type: existing.item_type,
        quantity_source: existing.quantity_source,
        unit: existing.unit,
        unit_cost: "10.00",
        unit_price: "25.00",
        coverage: "3",
        coverage_basis: "roof_square",
        waste_applies: "true",
        waste_pct: "10",
        sales_tax_rate_pct: "8.25",
        active: "false",
      }),
    ]);
    const analysis = analyzeCatalogCsv(text, [existing]);
    assert.equal(analysis.ok, true);

    const write = await applyCatalogCsvImport({
      companyId: COMPANY_A,
      analysis,
      existingItems: [existing],
      createItem: async (draft) => {
        const row: CatalogItem = {
          id: "44444444-4444-4444-8444-444444444444",
          ...draft,
        };
        created.push(row);
        return row;
      },
      updateItem: async (id, patch) => {
        updated.push({ id, patch });
        return { ...existing, ...patch, id };
      },
    });

    assert.equal(write.ok, true);
    assert.equal(write.createdCount, 1);
    assert.equal(write.updatedCount, 1);
    assert.equal(created[0].name, "CSV smoke create");
    assert.equal(updated[0].patch.active, false);
    assert.equal(updated[0].patch.description, "Patched");
  });

  test("applyCatalogCsvImport writes supplier SKUs on create/update", async () => {
    const existing = item({ abc_sku: null, qxo_sku: null, srs_sku: null });
    const text = csv([
      headerRow(),
      createRow({
        name: "SKU create",
        abc_sku: "A-1",
        qxo_sku: "Q-1",
        srs_sku: "S-1",
      }),
      createRow({
        id: ITEM_ID,
        name: existing.name,
        description: existing.description ?? "",
        item_type: existing.item_type,
        quantity_source: existing.quantity_source,
        unit: existing.unit,
        unit_cost: "10.00",
        unit_price: "25.00",
        coverage: "3",
        coverage_basis: "roof_square",
        waste_applies: "true",
        waste_pct: "10",
        sales_tax_rate_pct: "8.25",
        abc_sku: "A-2",
        qxo_sku: "",
        srs_sku: "S-2",
      }),
    ]);
    const analysis = analyzeCatalogCsv(text, [existing]);
    assert.equal(analysis.ok, true);
    let createdSkus: Partial<CatalogItem> | null = null;
    let updatedSkus: Partial<CatalogItem> | null = null;
    const write = await applyCatalogCsvImport({
      companyId: COMPANY_A,
      analysis,
      existingItems: [existing],
      createItem: async (draft) => {
        createdSkus = {
          abc_sku: draft.abc_sku,
          qxo_sku: draft.qxo_sku,
          srs_sku: draft.srs_sku,
        };
        return { id: "44444444-4444-4444-8444-444444444444", ...draft };
      },
      updateItem: async (id, patch) => {
        updatedSkus = {
          abc_sku: patch.abc_sku,
          qxo_sku: patch.qxo_sku,
          srs_sku: patch.srs_sku,
        };
        return { ...existing, ...patch, id };
      },
    });
    assert.equal(write.ok, true);
    assert.deepEqual(createdSkus, { abc_sku: "A-1", qxo_sku: "Q-1", srs_sku: "S-1" });
    assert.deepEqual(updatedSkus, { abc_sku: "A-2", qxo_sku: null, srs_sku: "S-2" });
  });

  test("blank active on update leaves active unset in patch builder path", async () => {
    const existing = item({ active: true });
    const text = csv([
      headerRow(),
      createRow({
        id: ITEM_ID,
        name: existing.name,
        description: "Only desc",
        item_type: existing.item_type,
        quantity_source: existing.quantity_source,
        unit: existing.unit,
        unit_cost: "10.00",
        unit_price: "25.00",
        coverage: "3",
        coverage_basis: "roof_square",
        waste_applies: "true",
        waste_pct: "10",
        sales_tax_rate_pct: "8.25",
        active: "",
      }),
    ]);
    const analysis = analyzeCatalogCsv(text, [existing]);
    assert.equal(analysis.ok, true);
    let patchActive: unknown = "missing";
    await applyCatalogCsvImport({
      companyId: COMPANY_A,
      analysis,
      existingItems: [existing],
      createItem: async () => null,
      updateItem: async (_id, patch) => {
        patchActive = Object.prototype.hasOwnProperty.call(patch, "active")
          ? patch.active
          : "missing";
        return { ...existing, ...patch };
      },
    });
    assert.equal(patchActive, "missing");
  });
});
