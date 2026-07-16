/**
 * 3I-3B1 — Programmatic tests for companyPricingPolicy.ts (pure, no DB/UI).
 *
 * Run: npx tsx --test app/lib/companyPricingPolicy.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  DEFAULT_STARTER_PRICING_POLICY,
  isStagedPolicyWasteModel,
  resolveCompanyPricingPolicy,
  resolveStarterPricingPolicySeed,
  STAGED_POLICY_WASTE_MODELS,
  validateCompanyPricingPolicy,
  type CompanyPricingPolicyResolution,
} from "./companyPricingPolicy";
import {
  DEFAULT_WASTE_MODEL,
  type PricingPolicy,
  type ProfitabilityType,
} from "./proposalPricingTypes";

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
      validCompanyPolicy({
        discount: { kind: "percent", value: 10 },
      }),
      validCompanyPolicy({ subtotalOverrideCents: 1000 }),
      {
        ...validCompanyPolicy(),
        tax: { salesTaxRatePct: NaN, materialPurchaseTaxRatePct: null },
      },
      validCompanyPolicy({
        wasteModel: "mystery_waste" as PricingPolicy["wasteModel"],
      }),
    ];

    for (const bad of cases) {
      const result = resolveCompanyPricingPolicy({ storedPolicy: bad });
      assert.equal(result.configured, false, JSON.stringify(bad));
      assert.equal(result.source, "missing");
      assert.equal(result.policy, null);
      assert.ok(result.reason);
    }
  });

  test("Phase 3: adjusted_measurement remains default and valid", () => {
    assert.equal(DEFAULT_WASTE_MODEL, "adjusted_measurement");
    assert.equal(DEFAULT_STARTER_PRICING_POLICY.wasteModel, "adjusted_measurement");
    const result = resolveCompanyPricingPolicy({
      storedPolicy: validCompanyPolicy({ wasteModel: "adjusted_measurement" }),
    });
    assert.equal(result.configured, true);
    assert.equal(result.policy?.wasteModel, "adjusted_measurement");
  });

  test("Phase 3: raw_plus_waste is staged/recognized by app validator (not default)", () => {
    assert.deepEqual([...STAGED_POLICY_WASTE_MODELS], [
      "adjusted_measurement",
      "raw_plus_waste",
    ]);
    assert.equal(isStagedPolicyWasteModel("raw_plus_waste"), true);
    assert.equal(isStagedPolicyWasteModel("adjusted_measurement"), true);
    assert.equal(isStagedPolicyWasteModel("mystery"), false);

    const validated = validateCompanyPricingPolicy(
      validCompanyPolicy({ wasteModel: "raw_plus_waste" })
    );
    assert.equal(validated.valid, true);
    if (validated.valid) {
      assert.equal(validated.policy.wasteModel, "raw_plus_waste");
    }

    const resolved = resolveCompanyPricingPolicy({
      storedPolicy: validCompanyPolicy({ wasteModel: "raw_plus_waste" }),
    });
    assert.equal(resolved.configured, true);
    assert.equal(resolved.policy?.wasteModel, "raw_plus_waste");

    // Defaults must not flip to raw.
    assert.equal(DEFAULT_STARTER_PRICING_POLICY.wasteModel, "adjusted_measurement");
    assert.equal(DEFAULT_WASTE_MODEL, "adjusted_measurement");
  });

  test("Phase 3: whole rounding remains rejected", () => {
    const result = resolveCompanyPricingPolicy({
      storedPolicy: validCompanyPolicy({
        quantityRounding: "whole" as PricingPolicy["quantityRounding"],
      }),
    });
    assert.equal(result.configured, false);
    assert.match(result.reason ?? "", /quantityRounding/);
  });

  test("Phase 3: review-only migration widens waste_model CHECK only", () => {
    const sqlPath = path.join(
      process.cwd(),
      "supabase/migrations/20260716_023_allow_raw_plus_waste_policy_mode.sql"
    );
    const sql = readFileSync(sqlPath, "utf8");
    assert.match(sql, /REVIEW ONLY — DO NOT APPLY WITHOUT EXPLICIT APPROVAL/);
    assert.match(sql, /waste_model in \('adjusted_measurement', 'raw_plus_waste'\)/);
    assert.match(sql, /company_pricing_policies_waste_model_check/);
    // Must not widen quantity_rounding (comments may mention it).
    assert.equal(/quantity_rounding\s+in\s*\(/i.test(sql), false);
    assert.equal(/company_pricing_policies_quantity_rounding_check/i.test(sql), false);
    // Forward executable body (non-comment lines) must not UPDATE/backfill rows.
    const executable = sql
      .split("\n")
      .filter((line) => !/^\s*--/.test(line))
      .join("\n");
    assert.equal(/\bupdate\s+public\.company_pricing_policies\b/i.test(executable), false);
    assert.equal(/\bbackfill\b/i.test(executable), false);
    assert.match(sql, /Do not UPDATE \/ backfill existing rows/i);
  });

  test("Phase 3: settings UI remains locked to adjusted_measurement (no mode control)", () => {
    const formUtils = readFileSync(
      path.join(process.cwd(), "app/tools/settings/pricing/pricingPolicyFormUtils.ts"),
      "utf8"
    );
    assert.match(
      formUtils,
      /LOCKED_WASTE_MODEL:\s*PricingPolicy\["wasteModel"\]\s*=\s*"adjusted_measurement"/
    );
    assert.equal(formUtils.includes("raw_plus_waste"), false);
  });

  test("no placeholder policy masquerades as company configured", () => {
    const result = resolveCompanyPricingPolicy({});
    assert.equal(result.configured, false);
    assert.notEqual(result.source, "company");

    const seed = resolveStarterPricingPolicySeed();
    assert.equal(seed.configured, false);
    assert.notEqual(seed.source, "company");
  });

  test("margin 99.99 is valid (just under ceiling)", () => {
    const result = resolveCompanyPricingPolicy({
      storedPolicy: validCompanyPolicy({
        profitabilityType: "margin",
        defaultProfitabilityPct: 99.99,
        minimumProfitabilityPct: 99.99,
      }),
    });
    assert.equal(result.configured, true);
    assert.equal(result.source, "company");
    assert.equal(result.policy?.defaultProfitabilityPct, 99.99);
  });

  test("margin default 100 is invalid / not configured", () => {
    const result = resolveCompanyPricingPolicy({
      storedPolicy: validCompanyPolicy({
        profitabilityType: "margin",
        defaultProfitabilityPct: 100,
        minimumProfitabilityPct: 100,
      }),
    });
    assert.equal(result.configured, false);
    assert.equal(result.source, "missing");
    assert.equal(result.policy, null);
  });

  test("margin minimum 100 is invalid / not configured", () => {
    const result = resolveCompanyPricingPolicy({
      storedPolicy: validCompanyPolicy({
        profitabilityType: "margin",
        defaultProfitabilityPct: 100,
        minimumProfitabilityPct: 100,
      }),
    });
    assert.equal(result.configured, false);
    assert.equal(result.policy, null);

    // default below 100 but minimum at 100 is also rejected
    const v = validateCompanyPricingPolicy(
      validCompanyPolicy({
        profitabilityType: "margin",
        defaultProfitabilityPct: 100,
        minimumProfitabilityPct: 100,
      })
    );
    assert.equal(v.valid, false);
  });

  test("markup 100 remains valid / configured", () => {
    const result = resolveCompanyPricingPolicy({
      storedPolicy: validCompanyPolicy({
        profitabilityType: "markup",
        defaultProfitabilityPct: 100,
        minimumProfitabilityPct: 20,
      }),
    });
    assert.equal(result.configured, true);
    assert.equal(result.source, "company");
    assert.equal(result.policy?.defaultProfitabilityPct, 100);
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
