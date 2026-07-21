/**
 * 3I-1C — Programmatic tests for proposalPricingEngine.ts (pure, no DB/UI).
 *
 * Run: npx tsx --test app/lib/proposalPricingEngine.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { PricingLineInput, PricingPolicy, ProposalPricingInput } from "./proposalPricingTypes";
import { DEFAULT_WASTE_MODEL } from "./proposalPricingTypes";
import {
  evaluateProfitabilityGuardrail,
  priceProposalLine,
  resolveProposalPricing,
} from "./proposalPricingEngine";

function basePolicy(overrides: Partial<PricingPolicy> = {}): PricingPolicy {
  return {
    profitabilityType: "margin",
    defaultProfitabilityPct: 50,
    minimumProfitabilityPct: 20,
    quantityRounding: "exact",
    wasteModel: DEFAULT_WASTE_MODEL,
    tax: {
      salesTaxRatePct: 0,
      materialPurchaseTaxRatePct: null,
    },
    ...overrides,
  };
}

function baseLine(overrides: Partial<PricingLineInput> = {}): PricingLineInput {
  return {
    templateItemId: "line-1",
    catalogItemId: "cat-1",
    itemRole: "standard",
    unit: "square",
    pricingBasis: "cost_plus_margin",
    customerVisibility: "customer_visible",
    quantity: 10,
    quantityUnresolved: false,
    unitCostCents: 10_000,
    ...overrides,
  };
}

function baseInput(overrides: Partial<ProposalPricingInput> = {}): ProposalPricingInput {
  return {
    policy: basePolicy(),
    actorRole: "rep",
    optionId: "opt-1",
    lines: [baseLine()],
    ...overrides,
  };
}

describe("proposalPricingEngine", () => {
  test("1. cost_plus_margin margin happy path", () => {
    const line = priceProposalLine(baseLine(), basePolicy({ defaultProfitabilityPct: 50 }));
    assert.equal(line.unitPriceCents, 20_000);
    assert.equal(line.linePriceCents, 200_000);
    assert.equal(line.status, "priced");
    assert.equal(line.unresolved, false);

    const result = resolveProposalPricing(baseInput());
    assert.equal(result.options[0]?.hasBlockingIssues, false);
    assert.equal(result.generatedFrom.allLinesPriced, true);
  });

  test("2. cost_plus_margin markup happy path", () => {
    const policy = basePolicy({
      profitabilityType: "markup",
      defaultProfitabilityPct: 50,
    });
    const line = priceProposalLine(baseLine(), policy);
    assert.equal(line.unitPriceCents, 15_000);
    assert.equal(line.linePriceCents, 150_000);
    assert.equal(line.status, "priced");
  });

  test("3. unit_price override wins over cost-plus math", () => {
    const line = priceProposalLine(
      baseLine({
        pricingBasis: "unit_price",
        unitCostCents: 10_000,
        unitPriceCents: 25_000,
      }),
      basePolicy({ defaultProfitabilityPct: 50 })
    );
    assert.equal(line.unitPriceCents, 25_000);
    assert.equal(line.linePriceCents, 250_000);
    assert.notEqual(line.linePriceCents, 200_000);
  });

  test("4. fixed_price: unit fixed vs quantity multiply", () => {
    const lump = priceProposalLine(
      baseLine({
        pricingBasis: "fixed_price",
        unit: "fixed",
        unitPriceCents: 50_000,
        quantity: 99,
      }),
      basePolicy()
    );
    assert.equal(lump.linePriceCents, 50_000);

    const perUnit = priceProposalLine(
      baseLine({
        pricingBasis: "fixed_price",
        unit: "square",
        unitPriceCents: 5_000,
        quantity: 10,
      }),
      basePolicy()
    );
    assert.equal(perUnit.linePriceCents, 50_000);
  });

  test("5. included: customer price 0, internal cost rolls", () => {
    const line = priceProposalLine(
      baseLine({
        pricingBasis: "included",
        unitCostCents: 10_000,
        quantity: 10,
      }),
      basePolicy()
    );
    assert.equal(line.linePriceCents, 0);
    assert.equal(line.lineCostCents, 100_000);
    assert.equal(line.status, "included");
  });

  test("6. internal_only excluded from customer subtotal", () => {
    const result = resolveProposalPricing(
      baseInput({
        lines: [
          baseLine({
            templateItemId: "visible",
            pricingBasis: "unit_price",
            unitCostCents: null,
            unitPriceCents: 10_000,
            quantity: 10,
            customerVisibility: "customer_visible",
          }),
          baseLine({
            templateItemId: "internal",
            pricingBasis: "cost_plus_margin",
            unitCostCents: 5_000,
            quantity: 10,
            customerVisibility: "internal_only",
          }),
        ],
      })
    );
    const opt = result.options[0];
    assert.ok(opt);
    assert.equal(opt.customerSubtotalCents, 100_000);
    assert.equal(opt.internalCostCents, 50_000);
    assert.equal(opt.internalProfitCents, 50_000);
  });

  test("7. grouped and hiddenButInCalc contribute to customer subtotal", () => {
    const grouped = resolveProposalPricing(
      baseInput({
        lines: [
          baseLine({
            templateItemId: "grouped",
            pricingBasis: "unit_price",
            unitPriceCents: 3_000,
            quantity: 10,
            customerVisibility: "grouped",
          }),
        ],
      })
    );
    assert.equal(grouped.options[0]?.customerSubtotalCents, 30_000);

    const hidden = resolveProposalPricing(
      baseInput({
        lines: [
          baseLine({
            templateItemId: "hidden",
            pricingBasis: "unit_price",
            unitPriceCents: 2_000,
            quantity: 5,
            customerVisibility: "customer_visible",
            hiddenButInCalc: true,
          }),
        ],
      })
    );
    assert.equal(hidden.options[0]?.customerSubtotalCents, 10_000);
  });

  test("8. discount before tax", () => {
    const result = resolveProposalPricing(
      baseInput({
        policy: basePolicy({
          discount: { kind: "fixed", value: 10_000 },
          tax: { salesTaxRatePct: 10, materialPurchaseTaxRatePct: null },
        }),
        lines: [
          baseLine({
            pricingBasis: "unit_price",
            unitPriceCents: 10_000,
            quantity: 10,
          }),
        ],
      })
    );
    const opt = result.options[0];
    assert.ok(opt);
    assert.equal(opt.customerSubtotalCents, 100_000);
    assert.equal(opt.discountCents, 10_000);
    assert.equal(opt.salesTaxCents, 9_000);
    assert.equal(opt.customerTotalCents, 99_000);
  });

  test("9. percent discount integer cents", () => {
    const result = resolveProposalPricing(
      baseInput({
        policy: basePolicy({
          discount: { kind: "percent", value: 10 },
        }),
        lines: [
          baseLine({
            pricingBasis: "unit_price",
            unitPriceCents: 10_000,
            quantity: 10,
          }),
        ],
      })
    );
    assert.equal(result.options[0]?.discountCents, 10_000);
  });

  test("10. fixed discount caps at subtotal", () => {
    const result = resolveProposalPricing(
      baseInput({
        policy: basePolicy({
          discount: { kind: "fixed", value: 150_000 },
          tax: { salesTaxRatePct: 10, materialPurchaseTaxRatePct: null },
        }),
        lines: [
          baseLine({
            pricingBasis: "unit_price",
            unitPriceCents: 10_000,
            quantity: 10,
          }),
        ],
      })
    );
    const opt = result.options[0];
    assert.ok(opt);
    assert.equal(opt.discountCents, 100_000);
    assert.equal(opt.salesTaxCents, null);
    assert.equal(opt.customerTotalCents, 0);
  });

  test("11. negative fixed discount acts as 0", () => {
    const result = resolveProposalPricing(
      baseInput({
        policy: basePolicy({
          discount: { kind: "fixed", value: -5_000 },
        }),
        lines: [
          baseLine({
            pricingBasis: "unit_price",
            unitPriceCents: 10_000,
            quantity: 10,
          }),
        ],
      })
    );
    assert.equal(result.options[0]?.discountCents, null);
    assert.equal(result.options[0]?.customerTotalCents, 100_000);
  });

  test("12. material purchase tax internal only", () => {
    const line = priceProposalLine(
      baseLine({
        itemType: "material",
        unitCostCents: 10_000,
        quantity: 1,
        pricingBasis: "cost_plus_margin",
      }),
      basePolicy({
        defaultProfitabilityPct: 0,
        tax: { salesTaxRatePct: 0, materialPurchaseTaxRatePct: 10 },
      })
    );
    assert.equal(line.effectiveUnitCostCents, 11_000);
    assert.equal(line.unitPriceCents, 11_000);
    assert.equal(line.salesTaxCents, null);
  });

  test("13. itemType missing skips material purchase tax", () => {
    const line = priceProposalLine(
      baseLine({
        unitCostCents: 10_000,
        quantity: 1,
        pricingBasis: "cost_plus_margin",
      }),
      basePolicy({
        defaultProfitabilityPct: 0,
        tax: { salesTaxRatePct: 0, materialPurchaseTaxRatePct: 10 },
      })
    );
    assert.equal(line.effectiveUnitCostCents, 10_000);
  });

  test("14. unresolved quantity blocks option totals", () => {
    const result = resolveProposalPricing(
      baseInput({
        lines: [
          baseLine({
            quantityUnresolved: true,
            quantity: null,
          }),
        ],
      })
    );
    const opt = result.options[0];
    assert.ok(opt);
    assert.equal(opt.hasBlockingIssues, true);
    assert.equal(opt.customerSubtotalCents, null);
    assert.equal(opt.customerTotalCents, null);
    assert.equal(result.generatedFrom.allLinesPriced, false);
  });

  test("15. missing cost blocks cost_plus_margin without unit_price fallback", () => {
    const line = priceProposalLine(
      baseLine({
        pricingBasis: "cost_plus_margin",
        unitCostCents: null,
        unitPriceCents: 20_000,
      }),
      basePolicy()
    );
    assert.equal(line.status, "unpriced");
    assert.equal(line.linePriceCents, null);
  });

  test("16. margin >= 100 unpriced", () => {
    const line = priceProposalLine(
      baseLine(),
      basePolicy({ defaultProfitabilityPct: 100 })
    );
    assert.equal(line.status, "unpriced");
  });

  test("17. negative profitability unpriced", () => {
    const line = priceProposalLine(
      baseLine(),
      basePolicy({ defaultProfitabilityPct: -5 })
    );
    assert.equal(line.status, "unpriced");
  });

  test("18. negative quantity blocks with null line amounts", () => {
    const line = priceProposalLine(
      baseLine({ quantity: -1 }),
      basePolicy()
    );
    assert.equal(line.status, "unsupported");
    assert.equal(line.lineCostCents, null);
    assert.equal(line.linePriceCents, null);

    const result = resolveProposalPricing(baseInput({ lines: [baseLine({ quantity: -1 })] }));
    assert.equal(result.options[0]?.customerTotalCents, null);
    assert.equal(result.options[0]?.hasBlockingIssues, true);
  });

  test("19. quantity 0 produces zero line amount, not unresolved", () => {
    const line = priceProposalLine(
      baseLine({
        quantity: 0,
        pricingBasis: "unit_price",
        unitPriceCents: 10_000,
      }),
      basePolicy()
    );
    assert.equal(line.linePriceCents, 0);
    assert.equal(line.status, "priced");
    assert.equal(line.unresolved, false);

    const result = resolveProposalPricing(
      baseInput({
        lines: [
          baseLine({
            quantity: 0,
            pricingBasis: "unit_price",
            unitPriceCents: 10_000,
          }),
        ],
      })
    );
    assert.equal(result.options[0]?.hasBlockingIssues, false);
    assert.equal(result.options[0]?.customerSubtotalCents, 0);
  });

  test("20. guardrails", () => {
    const policy = basePolicy({ minimumProfitabilityPct: 30, defaultProfitabilityPct: 50 });

    assert.equal(
      evaluateProfitabilityGuardrail(policy, "rep", 25).outcome,
      "block"
    );
    assert.equal(
      evaluateProfitabilityGuardrail(policy, "manager", 25).outcome,
      "warn"
    );
    assert.equal(
      evaluateProfitabilityGuardrail(policy, "rep", 30).outcome,
      "pass"
    );
    assert.equal(
      evaluateProfitabilityGuardrail(policy, "rep", 45).outcome,
      "pass"
    );
    assert.equal(
      evaluateProfitabilityGuardrail(policy, "rep", null).outcome,
      "block"
    );
    assert.equal(
      evaluateProfitabilityGuardrail(policy, "manager", null).outcome,
      "warn"
    );
  });

  test("21. blocking line nulls customer totals, no partial total", () => {
    const result = resolveProposalPricing(
      baseInput({
        lines: [
          baseLine({
            templateItemId: "ok",
            pricingBasis: "unit_price",
            unitPriceCents: 10_000,
            quantity: 10,
          }),
          baseLine({
            templateItemId: "bad",
            pricingBasis: "cost_plus_margin",
            unitCostCents: null,
          }),
        ],
      })
    );
    const opt = result.options[0];
    assert.ok(opt);
    assert.equal(opt.hasBlockingIssues, true);
    assert.equal(opt.customerSubtotalCents, null);
    assert.equal(opt.customerTotalCents, null);
    assert.equal(result.generatedFrom.allLinesPriced, false);
  });

  test("22. exact-only and waste model", () => {
    const wholeIgnored = resolveProposalPricing(
      baseInput({
        policy: basePolicy({ quantityRounding: "whole" }),
        lines: [
          baseLine({
            pricingBasis: "unit_price",
            unitPriceCents: 10_000,
            quantity: 10.7,
          }),
        ],
      })
    );
    assert.equal(wholeIgnored.options[0]?.customerSubtotalCents, 107_000);

    // Phase 5: engine accepts raw_plus_waste but does not apply coverage/waste math.
    const rawAccepted = resolveProposalPricing(
      baseInput({
        policy: basePolicy({ wasteModel: "raw_plus_waste" }),
        lines: [
          baseLine({
            pricingBasis: "unit_price",
            unitPriceCents: 10_000,
            quantity: 2.2,
          }),
        ],
      })
    );
    assert.equal(rawAccepted.options[0]?.hasBlockingIssues, false);
    assert.equal(rawAccepted.options[0]?.customerSubtotalCents, 22_000);

    const mysteryWaste = resolveProposalPricing(
      baseInput({
        policy: basePolicy({
          wasteModel: "mystery" as PricingPolicy["wasteModel"],
        }),
      })
    );
    assert.equal(mysteryWaste.options[0]?.hasBlockingIssues, true);
    assert.equal(mysteryWaste.options[0]?.customerTotalCents, null);
  });

  test("optional upgrade truth — unselected additive does not contribute to totals or internal cost", () => {
    const result = resolveProposalPricing(
      baseInput({
        lines: [
          baseLine({
            templateItemId: "base",
            pricingBasis: "unit_price",
            unitPriceCents: 10_000,
            unitCostCents: 5_000,
            quantity: 1,
          }),
          baseLine({
            templateItemId: "upgrade-a",
            pricingBasis: "unit_price",
            unitPriceCents: 4_000,
            unitCostCents: 2_000,
            quantity: 1,
            upgradeScope: {
              parentOptionId: "opt-1",
              selectionState: "not_selected",
              effect: "additive",
            },
          }),
        ],
      })
    );
    assert.equal(result.options[0]?.customerSubtotalCents, 10_000);
    assert.equal(result.options[0]?.internalCostCents, 5_000);
    assert.deepEqual(result.options[0]?.upgradeLineIds, ["upgrade-a"]);
  });

  test("optional upgrade truth — selected additive contributes once", () => {
    const result = resolveProposalPricing(
      baseInput({
        lines: [
          baseLine({
            templateItemId: "base",
            pricingBasis: "unit_price",
            unitPriceCents: 10_000,
            unitCostCents: 5_000,
            quantity: 1,
          }),
          baseLine({
            templateItemId: "upgrade-a",
            pricingBasis: "unit_price",
            unitPriceCents: 4_000,
            unitCostCents: 2_000,
            quantity: 1,
            upgradeScope: {
              parentOptionId: "opt-1",
              selectionState: "selected",
              effect: "additive",
            },
          }),
        ],
      })
    );
    assert.equal(result.options[0]?.customerSubtotalCents, 14_000);
    assert.equal(result.options[0]?.internalCostCents, 7_000);
  });

  test("optional upgrade truth — selected replacement suppresses base contribution", () => {
    const result = resolveProposalPricing(
      baseInput({
        lines: [
          baseLine({
            templateItemId: "base",
            pricingBasis: "unit_price",
            unitPriceCents: 10_000,
            unitCostCents: 5_000,
            quantity: 1,
            suppressedByReplacement: true,
          }),
          baseLine({
            templateItemId: "upgrade-r",
            pricingBasis: "unit_price",
            unitPriceCents: 12_000,
            unitCostCents: 6_000,
            quantity: 1,
            upgradeScope: {
              parentOptionId: "opt-1",
              selectionState: "selected",
              effect: "replacement",
              replacesTemplateItemId: "base",
            },
          }),
        ],
      })
    );
    assert.equal(result.options[0]?.customerSubtotalCents, 12_000);
    assert.equal(result.options[0]?.internalCostCents, 6_000);
  });
});
