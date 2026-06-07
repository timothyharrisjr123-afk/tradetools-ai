/**
 * Pricing Trust Hardening — pure pricing-behavior goldens (engine-level).
 *
 * Proves the math contract that feeds proposal snapshots without touching the
 * engine: fixed/unit/cost-plus behavior vs quantity, option total = sum of
 * contributing line totals, and missing-quantity must block (never fake a
 * price). Pure: priceProposalLine / resolveProposalPricing only — no Supabase,
 * React, or persistence.
 *
 * Run: npx tsx --test app/lib/proposalPricingTrustFixtures.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { priceProposalLine, resolveProposalPricing } from "./proposalPricingEngine";
import {
  DEFAULT_PROFITABILITY_TYPE,
  DEFAULT_QUANTITY_ROUNDING,
  DEFAULT_WASTE_MODEL,
  type PricingLineInput,
  type PricingPolicy,
} from "./proposalPricingTypes";

const NO_TAX_POLICY: PricingPolicy = {
  profitabilityType: DEFAULT_PROFITABILITY_TYPE,
  defaultProfitabilityPct: 35,
  minimumProfitabilityPct: 25,
  quantityRounding: DEFAULT_QUANTITY_ROUNDING,
  wasteModel: DEFAULT_WASTE_MODEL,
  discount: null,
  tax: { salesTaxRatePct: 0, materialPurchaseTaxRatePct: null },
  subtotalOverrideCents: null,
};

function line(overrides: Partial<PricingLineInput> & Pick<PricingLineInput, "templateItemId">): PricingLineInput {
  return {
    catalogItemId: overrides.templateItemId,
    itemRole: "standard",
    itemType: "material",
    sectionId: "sec-1",
    unit: "square",
    pricingBasis: "unit_price",
    customerVisibility: "customer_visible",
    quantity: 22,
    quantityUnresolved: false,
    unitCostCents: null,
    unitPriceCents: null,
    ...overrides,
  };
}

describe("Golden #7: unit_price line changes with quantity", () => {
  test("line total scales with quantity (2300 → 2500 squares)", () => {
    const at23 = priceProposalLine(
      line({ templateItemId: "shingles", pricingBasis: "unit_price", unitPriceCents: 50000, quantity: 23 }),
      NO_TAX_POLICY
    );
    const at25 = priceProposalLine(
      line({ templateItemId: "shingles", pricingBasis: "unit_price", unitPriceCents: 50000, quantity: 25 }),
      NO_TAX_POLICY
    );
    assert.equal(at23.status, "priced");
    assert.equal(at23.linePriceCents, 50000 * 23);
    assert.equal(at25.linePriceCents, 50000 * 25);
    assert.ok(at25.linePriceCents! > at23.linePriceCents!);
  });

  test("unit_price with no unit price is blocking, never faked", () => {
    const priced = priceProposalLine(
      line({ templateItemId: "shingles", pricingBasis: "unit_price", unitPriceCents: null }),
      NO_TAX_POLICY
    );
    assert.equal(priced.status, "unpriced");
    assert.equal(priced.linePriceCents, null);
  });
});

describe("Golden #6: fixed_price line behavior is explicit", () => {
  test("fixed unit is invariant to quantity", () => {
    const at22 = priceProposalLine(
      line({
        templateItemId: "permit",
        pricingBasis: "fixed_price",
        unit: "fixed",
        unitPriceCents: 30000,
        quantity: 22,
      }),
      NO_TAX_POLICY
    );
    const at50 = priceProposalLine(
      line({
        templateItemId: "permit",
        pricingBasis: "fixed_price",
        unit: "fixed",
        unitPriceCents: 30000,
        quantity: 50,
      }),
      NO_TAX_POLICY
    );
    assert.equal(at22.linePriceCents, 30000);
    assert.equal(at50.linePriceCents, 30000);
  });

  test("non-fixed unit fixed_price multiplies by quantity (documented behavior)", () => {
    const priced = priceProposalLine(
      line({
        templateItemId: "fee",
        pricingBasis: "fixed_price",
        unit: "each",
        unitPriceCents: 30000,
        quantity: 3,
      }),
      NO_TAX_POLICY
    );
    assert.equal(priced.linePriceCents, 90000);
  });
});

describe("Golden #8: cost_plus_margin line changes with quantity/policy", () => {
  test("line total scales with quantity", () => {
    const at22 = priceProposalLine(
      line({ templateItemId: "labor", pricingBasis: "cost_plus_margin", unitCostCents: 10000, quantity: 22 }),
      NO_TAX_POLICY
    );
    const at24 = priceProposalLine(
      line({ templateItemId: "labor", pricingBasis: "cost_plus_margin", unitCostCents: 10000, quantity: 24 }),
      NO_TAX_POLICY
    );
    assert.equal(at22.status, "priced");
    assert.ok(at24.linePriceCents! > at22.linePriceCents!);
    assert.equal(at22.linePriceCents, at22.unitPriceCents! * 22);
  });

  test("higher margin policy raises unit price for same cost", () => {
    const lowMargin = priceProposalLine(
      line({ templateItemId: "labor", pricingBasis: "cost_plus_margin", unitCostCents: 10000, quantity: 10 }),
      { ...NO_TAX_POLICY, defaultProfitabilityPct: 20 }
    );
    const highMargin = priceProposalLine(
      line({ templateItemId: "labor", pricingBasis: "cost_plus_margin", unitCostCents: 10000, quantity: 10 }),
      { ...NO_TAX_POLICY, defaultProfitabilityPct: 50 }
    );
    assert.ok(highMargin.unitPriceCents! > lowMargin.unitPriceCents!);
  });
});

describe("Golden #9: option total equals sum of contributing line totals", () => {
  test("subtotal = sum of priced line totals (no tax/discount)", () => {
    const lines: PricingLineInput[] = [
      line({ templateItemId: "shingles", pricingBasis: "unit_price", unitPriceCents: 50000, quantity: 24 }),
      line({ templateItemId: "labor", pricingBasis: "cost_plus_margin", unitCostCents: 10000, quantity: 24 }),
      line({
        templateItemId: "permit",
        pricingBasis: "fixed_price",
        unit: "fixed",
        unitPriceCents: 30000,
        quantity: 24,
      }),
    ];

    const result = resolveProposalPricing({
      policy: NO_TAX_POLICY,
      actorRole: "rep",
      optionId: "opt-1",
      lines,
    });

    const option = result.options[0]!;
    const lineSum = lines.reduce((acc, l) => {
      const priced = priceProposalLine(l, NO_TAX_POLICY);
      return acc + (priced.status === "priced" ? priced.linePriceCents ?? 0 : 0);
    }, 0);

    assert.equal(option.customerSubtotalCents, lineSum);
    assert.equal(option.customerTotalCents, lineSum);
  });
});

describe("Golden #12: missing quantity blocks totals, never fakes a price", () => {
  test("unresolved quantity line is blocking with null price", () => {
    const priced = priceProposalLine(
      line({
        templateItemId: "shingles",
        pricingBasis: "unit_price",
        unitPriceCents: 50000,
        quantity: null,
        quantityUnresolved: true,
      }),
      NO_TAX_POLICY
    );
    assert.equal(priced.status, "unresolved_quantity");
    assert.equal(priced.linePriceCents, null);
  });

  test("an option with a missing-quantity line reports a blocking issue", () => {
    const result = resolveProposalPricing({
      policy: NO_TAX_POLICY,
      actorRole: "rep",
      optionId: "opt-1",
      lines: [
        line({ templateItemId: "good", pricingBasis: "unit_price", unitPriceCents: 50000, quantity: 10 }),
        line({
          templateItemId: "blocked",
          pricingBasis: "unit_price",
          unitPriceCents: 50000,
          quantity: null,
          quantityUnresolved: true,
        }),
      ],
    });
    assert.equal(result.options[0]!.hasBlockingIssues, true);
    assert.equal(result.generatedFrom.allLinesPriced, false);
  });
});

describe("Golden #10: included lines do not add to customer total", () => {
  test("included line contributes zero customer price", () => {
    const result = resolveProposalPricing({
      policy: NO_TAX_POLICY,
      actorRole: "rep",
      optionId: "opt-1",
      lines: [
        line({ templateItemId: "shingles", pricingBasis: "unit_price", unitPriceCents: 50000, quantity: 10 }),
        line({ templateItemId: "warranty", pricingBasis: "included", quantity: 10 }),
      ],
    });
    assert.equal(result.options[0]!.customerSubtotalCents, 50000 * 10);
  });
});
