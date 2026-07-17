/**
 * Run: npx tsx --test app/lib/catalogContractorLabels.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { CatalogItem } from "./catalogTypes";
import {
  CATALOG_CONTRACTOR_FILTER_OPTIONS,
  CATALOG_CONTRACTOR_LABELS,
  CATALOG_COMMAND_BAR_PLANNED_CONTROLS,
  CATALOG_COMING_SOON_LABEL,
  CATALOG_FIELD_HELPERS,
  CATALOG_PAGE_SUBTITLE,
  CATALOG_SETTINGS_PLANNED_TOOLS,
  CATALOG_TABLE_HEADERS,
  catalogItemMatchesContractorFilter,
  coverageBasisFieldHelper,
  formatCatalogCompactStatusLine,
  formatCatalogItemStatus,
  formatProposalVisibilityShort,
} from "./catalogContractorLabels";

function item(overrides: Partial<CatalogItem> & Pick<CatalogItem, "id" | "item_type">): CatalogItem {
  return {
    id: overrides.id,
    company_id: "00000000-0000-4000-8000-000000000001",
    name: overrides.name ?? "Test item",
    item_type: overrides.item_type,
    unit: "each",
    quantity_source: "fixed",
    pricing_basis: "unit_price",
    customer_visibility: "customer_visible",
    active: overrides.active ?? true,
    unit_price_cents: overrides.unit_price_cents ?? 1000,
    ...overrides,
  };
}

describe("catalogContractorLabels", () => {
  test("page subtitle matches P0B compact copy", () => {
    assert.equal(CATALOG_PAGE_SUBTITLE, "Manage the materials, labor, and fees used in proposals.");
    assert.equal(CATALOG_CONTRACTOR_LABELS.pageSubtitle, CATALOG_PAGE_SUBTITLE);
  });

  test("contractor labels avoid Price book and use Roofr-aligned headers", () => {
    assert.ok(!CATALOG_CONTRACTOR_LABELS.pageSubtitle.toLowerCase().includes("price book"));
    assert.equal(CATALOG_CONTRACTOR_LABELS.name, "Name");
    assert.equal(CATALOG_CONTRACTOR_LABELS.measurement, "Measurement");
    assert.equal(CATALOG_CONTRACTOR_LABELS.unitCost, "Unit cost");
    assert.equal(CATALOG_CONTRACTOR_LABELS.unitPrice, "Unit price");
    assert.equal(CATALOG_CONTRACTOR_LABELS.proposal, "Proposal");
  });

  test("table headers are the P0B contractor set", () => {
    assert.deepEqual([...CATALOG_TABLE_HEADERS], [
      "Name",
      "Type",
      "Measurement",
      "Unit",
      "Unit cost",
      "Unit price",
      "Proposal",
      "Status",
      "Actions",
    ]);
    const joined = CATALOG_TABLE_HEADERS.join(" ");
    for (const banned of ["Sort", "Seed", "Coverage", "Waste", "Sales tax", "Purchase tax", "Supplier"]) {
      assert.ok(!joined.includes(banned), `should not include ${banned}`);
    }
  });

  test("Phase 7 Coverage/Waste labels and helpers are contractor-facing", () => {
    assert.equal(CATALOG_CONTRACTOR_LABELS.coverage, "Coverage");
    assert.equal(CATALOG_CONTRACTOR_LABELS.coverageBasis, "Coverage basis");
    assert.equal(CATALOG_CONTRACTOR_LABELS.waste, "Waste");
    assert.equal(CATALOG_CONTRACTOR_LABELS.wasteApplies, "Apply waste");
    assert.match(CATALOG_FIELD_HELPERS.quantityDriversSection, /Used by raw quantity mode/i);
    assert.match(CATALOG_FIELD_HELPERS.quantityDriversSection, /Does not change adjusted-mode/i);
    assert.match(CATALOG_FIELD_HELPERS.coverage, /one purchase unit covers/i);
    assert.match(CATALOG_FIELD_HELPERS.coverageBasis, /What the coverage value measures/i);
    assert.equal(/sq ft|square feet/i.test(CATALOG_FIELD_HELPERS.coverage), false);
    assert.equal(/sq ft|square feet/i.test(CATALOG_FIELD_HELPERS.coverageBasis), false);
    assert.match(coverageBasisFieldHelper("square_feet"), /square feet/i);
    assert.match(coverageBasisFieldHelper("roof_square"), /roof squares/i);
    assert.match(coverageBasisFieldHelper(""), /What the coverage value measures/i);
    assert.match(CATALOG_FIELD_HELPERS.waste, /Extra material percentage/i);
    const planned = CATALOG_SETTINGS_PLANNED_TOOLS.find((t) => t.id === "coverage_waste_tax");
    assert.ok(planned);
    assert.match(planned!.detail, /editable on each catalog item/i);
    assert.match(planned!.detail, /Proposal line-tax math/i);
    assert.match(planned!.detail, /remain planned/i);
  });

  test("item tax labels and helpers are capture-only and purchase tax is internal", () => {
    assert.equal(CATALOG_CONTRACTOR_LABELS.salesTax, "Sales tax");
    assert.equal(CATALOG_CONTRACTOR_LABELS.purchaseTax, "Material purchase tax");
    assert.match(CATALOG_FIELD_HELPERS.salesTax, /not active yet/i);
    assert.match(CATALOG_FIELD_HELPERS.purchaseTax, /Never shown to customers/i);
    assert.match(CATALOG_FIELD_HELPERS.purchaseTax, /Internal/i);
    assert.match(CATALOG_FIELD_HELPERS.taxSection, /not active yet/i);
    assert.equal(/proposal totals are updated|line-tax math is active/i.test(CATALOG_FIELD_HELPERS.salesTax), false);
  });

  test("filter options include Materials, Labor, Fees & Other, Needs price", () => {
    const labels = CATALOG_CONTRACTOR_FILTER_OPTIONS.map((option) => option.label);
    assert.deepEqual(labels, ["All", "Materials", "Labor", "Fees & Other", "Needs price"]);
  });

  test("P0D command-bar planned controls are Coming soon layout placeholders", () => {
    assert.equal(CATALOG_COMING_SOON_LABEL, "Coming soon");
    assert.deepEqual(
      CATALOG_COMMAND_BAR_PLANNED_CONTROLS.map((c) => c.label),
      ["Re-order items", "Columns", "Manage catalog"]
    );
    const titles = CATALOG_SETTINGS_PLANNED_TOOLS.map((t) => t.title);
    assert.ok(titles.some((t) => t.includes("Catalog defaults")));
    assert.ok(titles.some((t) => t.includes("CSV")));
    assert.ok(titles.some((t) => t.includes("Columns")));
    assert.ok(titles.some((t) => t.includes("Re-order")));
    assert.ok(titles.some((t) => t.toLowerCase().includes("supplier")));
  });

  test("catalogItemMatchesContractorFilter handles fees_other and needs_price", () => {
    const material = item({ id: "1", item_type: "material" });
    const fee = item({ id: "2", item_type: "fee" });
    const service = item({ id: "3", item_type: "service" });
    const unpriced = item({ id: "4", item_type: "labor", unit_price_cents: null });

    assert.equal(catalogItemMatchesContractorFilter(material, "material"), true);
    assert.equal(catalogItemMatchesContractorFilter(fee, "fees_other"), true);
    assert.equal(catalogItemMatchesContractorFilter(service, "fees_other"), true);
    assert.equal(catalogItemMatchesContractorFilter(material, "fees_other"), false);
    assert.equal(catalogItemMatchesContractorFilter(unpriced, "needs_price"), true);
    assert.equal(catalogItemMatchesContractorFilter(material, "needs_price"), false);
  });

  test("formatProposalVisibilityShort uses Visible / Grouped / Hidden", () => {
    assert.equal(formatProposalVisibilityShort("customer_visible"), "Visible");
    assert.equal(formatProposalVisibilityShort("internal_only"), "Hidden");
    assert.equal(formatProposalVisibilityShort("grouped"), "Grouped");
  });

  test("formatCatalogItemStatus reflects active and needs price", () => {
    assert.equal(formatCatalogItemStatus(item({ id: "1", item_type: "material", active: true })), "Active");
    assert.equal(
      formatCatalogItemStatus(item({ id: "2", item_type: "material", active: false })),
      "Inactive"
    );
    assert.equal(
      formatCatalogItemStatus(item({ id: "3", item_type: "material", unit_price_cents: null })),
      "Needs price"
    );
  });

  test("field helpers use plain-English P0B copy", () => {
    assert.equal(CATALOG_FIELD_HELPERS.unitCost, "What this costs your business per unit.");
    assert.equal(
      CATALOG_FIELD_HELPERS.unitPrice,
      "What the customer is charged per unit before tax."
    );
    assert.equal(
      CATALOG_FIELD_HELPERS.measurement,
      "The job measurement used to calculate quantity."
    );
    assert.equal(
      CATALOG_FIELD_HELPERS.proposal,
      "Whether this item appears on the customer proposal."
    );
    assert.equal(
      CATALOG_FIELD_HELPERS.laborExplainer,
      "Labor is priced like a catalog item: rate per unit × job measurement."
    );
    assert.equal(
      CATALOG_FIELD_HELPERS.waste,
      "Extra material percentage used by raw quantity mode."
    );
  });

  test("formatCatalogCompactStatusLine is subtle readiness only", () => {
    assert.equal(
      formatCatalogCompactStatusLine({ pricedCount: 12, activeCount: 14, needsPriceCount: 2 }),
      "12/14 priced · 2 need price"
    );
    assert.equal(
      formatCatalogCompactStatusLine({ pricedCount: 0, activeCount: 0, needsPriceCount: 0 }),
      null
    );
  });
});
