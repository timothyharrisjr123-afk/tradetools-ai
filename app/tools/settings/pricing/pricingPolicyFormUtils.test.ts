/**
 * 3I-3B3b — Tests for pricingPolicyFormUtils.ts (pure, no React/Supabase).
 *
 * Run: npx tsx --test app/tools/settings/pricing/pricingPolicyFormUtils.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  resolveStarterPricingPolicySeed,
} from "@/app/lib/companyPricingPolicy";
import type { PricingPolicy } from "@/app/lib/proposalPricingTypes";
import {
  LOCKED_QUANTITY_ROUNDING,
  LOCKED_WASTE_MODEL,
  policyToPricingPolicyFormState,
  pricingPolicyFormStateToPolicy,
  starterSeedToPricingPolicyFormState,
  validatePricingPolicyFormState,
  type PricingPolicyFormState,
} from "./pricingPolicyFormUtils";

function formState(overrides: Partial<PricingPolicyFormState> = {}): PricingPolicyFormState {
  return {
    profitabilityType: "margin",
    defaultProfitabilityPct: "45",
    minimumProfitabilityPct: "25",
    salesTaxRatePct: "8.25",
    materialPurchaseTaxRatePct: "6",
    ...overrides,
  };
}

function policy(overrides: Partial<PricingPolicy> = {}): PricingPolicy {
  return {
    profitabilityType: "margin",
    defaultProfitabilityPct: 45,
    minimumProfitabilityPct: 25,
    quantityRounding: "exact",
    wasteModel: "adjusted_measurement",
    discount: null,
    tax: { salesTaxRatePct: 8.25, materialPurchaseTaxRatePct: 6 },
    subtotalOverrideCents: null,
    ...overrides,
  };
}

describe("pricingPolicyFormUtils", () => {
  test("policy → form state (numbers become strings)", () => {
    const fs = policyToPricingPolicyFormState(
      policy({ profitabilityType: "markup", defaultProfitabilityPct: 60, minimumProfitabilityPct: 30 })
    );
    assert.equal(fs.profitabilityType, "markup");
    assert.equal(fs.defaultProfitabilityPct, "60");
    assert.equal(fs.minimumProfitabilityPct, "30");
    assert.equal(fs.salesTaxRatePct, "8.25");
    assert.equal(fs.materialPurchaseTaxRatePct, "6");
  });

  test("policy with null material tax → empty string", () => {
    const fs = policyToPricingPolicyFormState(
      policy({ tax: { salesTaxRatePct: 0, materialPurchaseTaxRatePct: null } })
    );
    assert.equal(fs.salesTaxRatePct, "0");
    assert.equal(fs.materialPurchaseTaxRatePct, "");
  });

  test("form state → PricingPolicy maps locked fields and parses numbers", () => {
    const p = pricingPolicyFormStateToPolicy(formState());
    assert.equal(p.profitabilityType, "margin");
    assert.equal(p.defaultProfitabilityPct, 45);
    assert.equal(p.minimumProfitabilityPct, 25);
    assert.equal(p.tax.salesTaxRatePct, 8.25);
    assert.equal(p.tax.materialPurchaseTaxRatePct, 6);
    assert.equal(p.quantityRounding, LOCKED_QUANTITY_ROUNDING);
    assert.equal(p.wasteModel, LOCKED_WASTE_MODEL);
  });

  test("empty material purchase tax → null", () => {
    const p = pricingPolicyFormStateToPolicy(formState({ materialPurchaseTaxRatePct: "" }));
    assert.equal(p.tax.materialPurchaseTaxRatePct, null);
    const result = validatePricingPolicyFormState(formState({ materialPurchaseTaxRatePct: "" }));
    assert.equal(result.valid, true);
  });

  test("discount remains null and subtotalOverrideCents remains null", () => {
    const p = pricingPolicyFormStateToPolicy(formState());
    assert.equal(p.discount, null);
    assert.equal(p.subtotalOverrideCents, null);
  });

  test("quantityRounding is exact, wasteModel is adjusted_measurement", () => {
    const p = pricingPolicyFormStateToPolicy(formState());
    assert.equal(p.quantityRounding, "exact");
    assert.equal(p.wasteModel, "adjusted_measurement");
  });

  // -------------------------------------------------------------------------
  // Validation (delegates to validateCompanyPricingPolicy)
  // -------------------------------------------------------------------------

  test("margin 99.99 is valid", () => {
    const result = validatePricingPolicyFormState(
      formState({ profitabilityType: "margin", defaultProfitabilityPct: "99.99", minimumProfitabilityPct: "99.99" })
    );
    assert.equal(result.valid, true);
  });

  test("margin 100 is invalid", () => {
    const result = validatePricingPolicyFormState(
      formState({ profitabilityType: "margin", defaultProfitabilityPct: "100", minimumProfitabilityPct: "100" })
    );
    assert.equal(result.valid, false);
  });

  test("margin minimum 100 is invalid", () => {
    const result = validatePricingPolicyFormState(
      formState({ profitabilityType: "margin", defaultProfitabilityPct: "100", minimumProfitabilityPct: "100" })
    );
    assert.equal(result.valid, false);
  });

  test("markup 100 is valid", () => {
    const result = validatePricingPolicyFormState(
      formState({ profitabilityType: "markup", defaultProfitabilityPct: "100", minimumProfitabilityPct: "20" })
    );
    assert.equal(result.valid, true);
  });

  test("minimum > default is invalid", () => {
    const result = validatePricingPolicyFormState(
      formState({ defaultProfitabilityPct: "40", minimumProfitabilityPct: "50" })
    );
    assert.equal(result.valid, false);
  });

  test("negative sales tax is invalid", () => {
    const result = validatePricingPolicyFormState(formState({ salesTaxRatePct: "-1" }));
    assert.equal(result.valid, false);
  });

  test("negative material tax is invalid", () => {
    const result = validatePricingPolicyFormState(formState({ materialPurchaseTaxRatePct: "-1" }));
    assert.equal(result.valid, false);
  });

  test("empty required number is invalid", () => {
    const result = validatePricingPolicyFormState(formState({ defaultProfitabilityPct: "" }));
    assert.equal(result.valid, false);
  });

  test("non-numeric required field is invalid", () => {
    const result = validatePricingPolicyFormState(formState({ salesTaxRatePct: "abc" }));
    assert.equal(result.valid, false);
  });

  // -------------------------------------------------------------------------
  // Starter seed mapping
  // -------------------------------------------------------------------------

  test("starter seed maps to form but carries no configured flag", () => {
    const seed = resolveStarterPricingPolicySeed();
    const fs = starterSeedToPricingPolicyFormState(seed);
    assert.equal(fs.profitabilityType, "margin");
    assert.equal(fs.defaultProfitabilityPct, "50");
    assert.equal(fs.minimumProfitabilityPct, "20");
    assert.equal(fs.salesTaxRatePct, "0");
    assert.equal(fs.materialPurchaseTaxRatePct, "");
    assert.equal("configured" in fs, false);
    // resolution itself remains not-configured
    assert.equal(seed.configured, false);
    assert.equal(seed.source, "starter_default");
  });

  test("round-trip policy → form → policy preserves locked fields", () => {
    const fs = policyToPricingPolicyFormState(policy({ profitabilityType: "markup", defaultProfitabilityPct: 60, minimumProfitabilityPct: 30 }));
    const rebuilt = pricingPolicyFormStateToPolicy(fs);
    assert.equal(rebuilt.profitabilityType, "markup");
    assert.equal(rebuilt.defaultProfitabilityPct, 60);
    assert.equal(rebuilt.minimumProfitabilityPct, 30);
    assert.equal(rebuilt.quantityRounding, "exact");
    assert.equal(rebuilt.wasteModel, "adjusted_measurement");
    assert.equal(rebuilt.discount, null);
    assert.equal(rebuilt.subtotalOverrideCents, null);
  });
});
