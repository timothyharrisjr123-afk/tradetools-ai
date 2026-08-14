/**
 * V2E1 — Draft-owned line label presentation goldens.
 *
 * Run: npx tsx --test app/lib/proposalDraftLinePresentation.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import type { CatalogItem } from "./catalogTypes";
import { buildCustomerPreviewEstimatePresentationFromDraft } from "./proposalCustomerEstimatePresenter";
import { resolveDraftOwnedLineCustomerLabel } from "./proposalDraftLinePresentation";

const CAT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ITEM_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function catalog(overrides: Partial<CatalogItem> = {}): CatalogItem {
  return {
    id: CAT_ID,
    company_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    name: "Architectural shingles",
    customer_name: "Shingles",
    item_type: "material",
    unit: "square",
    quantity_source: "adjusted_roof_squares",
    pricing_basis: "cost_plus_margin",
    customer_visibility: "customer_visible",
    active: true,
    unit_cost_cents: 10_000,
    ...overrides,
  };
}

describe("resolveDraftOwnedLineCustomerLabel", () => {
  test("1. persisted customer-facing label wins", () => {
    assert.equal(
      resolveDraftOwnedLineCustomerLabel({
        customerName: "Job-specific shingles",
        catalogSeedKey: "roofing.architectural_shingles",
        catalogItem: catalog(),
      }),
      "Job-specific shingles"
    );
  });

  test("2. later Template label change is irrelevant — draft label still wins", () => {
    assert.equal(
      resolveDraftOwnedLineCustomerLabel({
        customerName: "Copied draft label",
        catalogSeedKey: "roofing.architectural_shingles",
        catalogItem: catalog({ customer_name: "Template renamed later" }),
      }),
      "Copied draft label"
    );
  });

  test("3. raw catalog seed is not shown when Catalog customer_name exists", () => {
    assert.equal(
      resolveDraftOwnedLineCustomerLabel({
        customerName: "roofing.architectural_shingles",
        catalogSeedKey: "roofing.architectural_shingles",
        catalogItem: catalog(),
      }),
      "Shingles"
    );
  });

  test("4. Builder/Preview share the same draft-owned resolver output", () => {
    const input = {
      customerName: "roofing.starter_strip",
      catalogSeedKey: "roofing.starter_strip",
      catalogItem: catalog({
        id: "starter",
        name: "Starter strip",
        customer_name: "Starter",
      }),
    };
    assert.equal(resolveDraftOwnedLineCustomerLabel(input), "Starter");
    assert.equal(resolveDraftOwnedLineCustomerLabel(input), "Starter");
  });

  test("5. legacy/missing label has deterministic non-Template fallback", () => {
    assert.equal(
      resolveDraftOwnedLineCustomerLabel({
        customerName: null,
        catalogSeedKey: "roofing.ridge_cap",
        catalogItem: null,
      }),
      "Ridge Cap"
    );
    assert.equal(
      resolveDraftOwnedLineCustomerLabel({
        customerName: "",
        catalogSeedKey: null,
        catalogItem: null,
      }),
      "Line item"
    );
  });
});

describe("Preview draft estimate labels", () => {
  test("6. Preview estimate uses draft-owned labels without Template graph", () => {
    const presentation = buildCustomerPreviewEstimatePresentationFromDraft({
      draftLines: [
        {
          sourceTemplateItemId: ITEM_ID,
          customerName: "roofing.architectural_shingles",
          catalogSeedKey: "roofing.architectural_shingles",
          catalogItemId: CAT_ID,
          role: "standard",
          sortOrder: 0,
        },
      ],
      catalogItems: [catalog()],
      optionCustomerView: {
        optionId: "opt",
        pricingComplete: true,
        customerSubtotalCents: 100,
        discountCents: 0,
        salesTaxCents: 0,
        customerTotalCents: 100,
        lines: [],
        lineByTemplateItemId: {
          [ITEM_ID]: {
            templateItemId: ITEM_ID,
            sectionId: null,
            displayStatus: "priced",
            showPrice: true,
            customerLinePriceCents: 100,
            showOnCustomerDocument: true,
            customerVisibility: "customer_visible",
          },
        },
      },
      selectedOptionLabel: "Enhanced",
    });

    assert.equal(presentation.scopeSections[0]?.lines[0]?.name, "Shingles");
    assert.notEqual(
      presentation.scopeSections[0]?.lines[0]?.name,
      "roofing.architectural_shingles"
    );
  });

  test("Preview document sources draft + Catalog only (no templateGraph)", () => {
    const root = process.cwd();
    const doc = readFileSync(
      path.join(root, "app/tools/roofing/proposals/preview/ProposalCustomerPreviewDocument.tsx"),
      "utf8"
    );
    assert.match(doc, /catalogSeedKey/);
    assert.match(doc, /catalogItemId/);
    assert.doesNotMatch(doc, /templateGraph/);
    assert.doesNotMatch(doc, /getProposalTemplateGraph/);

    const presentation = readFileSync(
      path.join(root, "app/lib/proposalDraftLinePresentation.ts"),
      "utf8"
    );
    assert.match(presentation, /never from live mutable Template/i);
  });
});
