/**
 * 3I-3B1 — Programmatic tests for companyPricingPolicy.ts (pure, no DB/UI).
 *
 * Run: npx tsx --test app/lib/companyPricingPolicy.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  DEFAULT_STARTER_PRICING_POLICY,
  resolveCompanyPricingPolicy,
  resolveStarterPricingPolicySeed,
  validateCompanyPricingPolicy,
  type CompanyPricingPolicyResolution,
} from "./companyPricingPolicy";
import type { PricingPolicy, ProfitabilityType } from "./proposalPricingTypes";

function validCompanyPolicy(overrides: Partial<PricingPolicy> = {}): PricingPolicy {
  return {
    profitabilityType: "margin",
    defaultProfitabilityPct: 45,
    minimumProfitabilityPct: 25,
    quantityRounding: "exact",
    wasteModel: "adjusted_measurement",
    discount: null,
    tax: {
      salesTaxRatePct: 8.25,
      materialPurchaseTaxRatePct: 6,
    },
    subtotalOverrideCents: null,
    ...overrides,
  };
}

const RESOLUTION_KEYS: (keyof CompanyPricingPolicyResolution)[] = [
  "configured",
  "source",
  "policy",
  "reason",
];

describe("companyPricingPolicy", () => {
  test("real company policy resolves as configured", () => {
    const stored = validCompanyPolicy();
    const result = resolveCompanyPricingPolicy({ storedPolicy: stored });

    assert.equal(result.configured, true);
    assert.equal(result.source, "company");
    assert.ok(result.policy);
    assert.equal(result.reason, null);
  });

  test("missing policy returns configured false / not configured", () => {
    for (const input of [
      {},
      { storedPolicy: null },
      { storedPolicy: undefined },
    ] as const) {
      const result = resolveCompanyPricingPolicy(input);
      assert.equal(result.configured, false);
      assert.equal(result.source, "missing");
      assert.equal(result.policy, null);
      assert.ok(result.reason);
    }
  });

  test("starter default is not treated as configured via resolver", () => {
    const missing = resolveCompanyPricingPolicy({});
    assert.equal(missing.configured, false);
    assert.equal(missing.policy, null);

    const seed = resolveStarterPricingPolicySeed();
    assert.equal(seed.configured, false);
    assert.equal(seed.source, "starter_default");
    assert.ok(seed.policy);
    assert.ok(seed.reason?.includes("Starter default"));

    assert.notDeepEqual(missing, {
      configured: true,
      source: "company",
      policy: DEFAULT_STARTER_PRICING_POLICY,
      reason: null,
    });
  });

  test("returned policy fields match input company policy", () => {
    const stored = validCompanyPolicy({
      profitabilityType: "markup",
      defaultProfitabilityPct: 60,
      minimumProfitabilityPct: 30,
      tax: { salesTaxRatePct: 7.5, materialPurchaseTaxRatePct: null },
    });
    const result = resolveCompanyPricingPolicy({ storedPolicy: stored });

    assert.ok(result.policy);
    assert.equal(result.policy.profitabilityType, "markup");
    assert.equal(result.policy.defaultProfitabilityPct, 60);
    assert.equal(result.policy.minimumProfitabilityPct, 30);
    assert.equal(result.policy.quantityRounding, "exact");
    assert.equal(result.policy.wasteModel, "adjusted_measurement");
    assert.equal(result.policy.discount, null);
    assert.equal(result.policy.subtotalOverrideCents, null);
    assert.equal(result.policy.tax.salesTaxRatePct, 7.5);
    assert.equal(result.policy.tax.materialPurchaseTaxRatePct, null);
  });

  test("invalid or incomplete policy returns not configured", () => {
    const cases: PricingPolicy[] = [
      validCompanyPolicy({ defaultProfitabilityPct: 150 }),
      validCompanyPolicy({ minimumProfitabilityPct: -1 }),
      validCompanyPolicy({ minimumProfitabilityPct: 50, defaultProfitabilityPct: 40 }),
      validCompanyPolicy({ quantityRounding: "whole" as PricingPolicy["quantityRounding"] }),
      validCompanyPolicy({ wasteModel: "raw_plus_waste" as PricingPolicy["wasteModel"] }),
      validCompanyPolicy({
        discount: { kind: "percent", value: 10 },
      }),
      validCompanyPolicy({ subtotalOverrideCents: 1000 }),
      {
        ...validCompanyPolicy(),
        tax: { salesTaxRatePct: NaN, materialPurchaseTaxRatePct: null },
      },
    ];

    for (const bad of cases) {
      const result = resolveCompanyPricingPolicy({ storedPolicy: bad });
      assert.equal(result.configured, false, JSON.stringify(bad));
      assert.equal(result.source, "missing");
      assert.equal(result.policy, null);
      assert.ok(result.reason);
    }
  });

  test("no placeholder policy masquerades as company configured", () => {
    const result = resolveCompanyPricingPolicy({});
    assert.equal(result.configured, false);
    assert.notEqual(result.source, "company");

    const seed = resolveStarterPricingPolicySeed();
    assert.equal(seed.configured, false);
    assert.notEqual(seed.source, "company");
  });

  test("margin profitability fields pass through", () => {
    const result = resolveCompanyPricingPolicy({
      storedPolicy: validCompanyPolicy({
        profitabilityType: "margin",
        defaultProfitabilityPct: 55,
        minimumProfitabilityPct: 22,
      }),
    });
    assert.equal(result.configured, true);
    assert.equal(result.policy?.profitabilityType, "margin");
    assert.equal(result.policy?.defaultProfitabilityPct, 55);
    assert.equal(result.policy?.minimumProfitabilityPct, 22);
  });

  test("markup profitability fields pass through", () => {
    const result = resolveCompanyPricingPolicy({
      storedPolicy: validCompanyPolicy({
        profitabilityType: "markup",
        defaultProfitabilityPct: 40,
        minimumProfitabilityPct: 15,
      }),
    });
    assert.equal(result.configured, true);
    assert.equal(result.policy?.profitabilityType, "markup");
    assert.equal(result.policy?.defaultProfitabilityPct, 40);
    assert.equal(result.policy?.minimumProfitabilityPct, 15);
  });

  test("tax fields pass through", () => {
    const withMaterial = resolveCompanyPricingPolicy({
      storedPolicy: validCompanyPolicy({
        tax: { salesTaxRatePct: 9.5, materialPurchaseTaxRatePct: 4.5 },
      }),
    });
    assert.equal(withMaterial.policy?.tax.salesTaxRatePct, 9.5);
    assert.equal(withMaterial.policy?.tax.materialPurchaseTaxRatePct, 4.5);

    const noMaterial = resolveCompanyPricingPolicy({
      storedPolicy: validCompanyPolicy({
        tax: { salesTaxRatePct: 0, materialPurchaseTaxRatePct: null },
      }),
    });
    assert.equal(noMaterial.policy?.tax.salesTaxRatePct, 0);
    assert.equal(noMaterial.policy?.tax.materialPurchaseTaxRatePct, null);
  });

  test("quantityRounding passes through as exact", () => {
    const result = resolveCompanyPricingPolicy({
      storedPolicy: validCompanyPolicy({ quantityRounding: "exact" }),
    });
    assert.equal(result.policy?.quantityRounding, "exact");
  });

  test("wasteModel passes through as adjusted_measurement", () => {
    const result = resolveCompanyPricingPolicy({
      storedPolicy: validCompanyPolicy({ wasteModel: "adjusted_measurement" }),
    });
    assert.equal(result.policy?.wasteModel, "adjusted_measurement");
  });

  test("result shape is stable for future Builder integration", () => {
    const configured = resolveCompanyPricingPolicy({
      storedPolicy: validCompanyPolicy(),
    });
    const missing = resolveCompanyPricingPolicy({});
    const seed = resolveStarterPricingPolicySeed();

    for (const result of [configured, missing, seed]) {
      assert.deepEqual(Object.keys(result).sort(), [...RESOLUTION_KEYS].sort());
      assert.equal(typeof result.configured, "boolean");
      assert.ok(
        result.source === "company" ||
          result.source === "starter_default" ||
          result.source === "missing"
      );
      assert.ok(result.policy === null || typeof result.policy === "object");
      assert.ok(result.reason === null || typeof result.reason === "string");
    }
  });

  test("validateCompanyPricingPolicy rejects unsupported profitability type", () => {
    const bad = validCompanyPolicy({
      profitabilityType: "margin" as ProfitabilityType,
    });
    (bad as { profitabilityType: string }).profitabilityType = "invalid";
    const v = validateCompanyPricingPolicy(bad);
    assert.equal(v.valid, false);
  });

  test("DEFAULT_STARTER_PRICING_POLICY matches documented starter shape", () => {
    assert.equal(DEFAULT_STARTER_PRICING_POLICY.profitabilityType, "margin");
    assert.equal(DEFAULT_STARTER_PRICING_POLICY.defaultProfitabilityPct, 50);
    assert.equal(DEFAULT_STARTER_PRICING_POLICY.minimumProfitabilityPct, 20);
    assert.equal(DEFAULT_STARTER_PRICING_POLICY.quantityRounding, "exact");
    assert.equal(DEFAULT_STARTER_PRICING_POLICY.wasteModel, "adjusted_measurement");
    assert.equal(DEFAULT_STARTER_PRICING_POLICY.discount, null);
    assert.equal(DEFAULT_STARTER_PRICING_POLICY.tax.salesTaxRatePct, 0);
    assert.equal(DEFAULT_STARTER_PRICING_POLICY.tax.materialPurchaseTaxRatePct, null);
    assert.equal(DEFAULT_STARTER_PRICING_POLICY.subtotalOverrideCents, null);
  });
});
