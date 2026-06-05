/**
 * 3I-3B2B — Programmatic tests for companyPricingPolicyStore.ts.
 *
 * Pure mapper / validation / resolver-integration tests only. No live Supabase
 * (no DB test harness exists in the repo); async store functions are exercised
 * through their pure helpers.
 *
 * Run: npx tsx --test app/lib/companyPricingPolicyStore.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  resolveCompanyPricingPolicy,
  validateCompanyPricingPolicy,
} from "./companyPricingPolicy";
import {
  pricingPolicyToRowFields,
  rowToPricingPolicy,
  validateStorableCompanyPricingPolicy,
  type CompanyPricingPolicyRow,
} from "./companyPricingPolicyStore";
import type { PricingPolicy } from "./proposalPricingTypes";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";

function dbRow(overrides: Partial<CompanyPricingPolicyRow> = {}): CompanyPricingPolicyRow {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    company_id: COMPANY_ID,
    profitability_type: "margin",
    default_profitability_pct: 45,
    minimum_profitability_pct: 25,
    quantity_rounding: "exact",
    waste_model: "adjusted_measurement",
    sales_tax_rate_pct: 8.25,
    material_purchase_tax_rate_pct: 6,
    metadata: null,
    created_by: null,
    updated_by: null,
    created_at: "2026-06-05T00:00:00Z",
    updated_at: "2026-06-05T00:00:00Z",
    ...overrides,
  };
}

function validPolicy(overrides: Partial<PricingPolicy> = {}): PricingPolicy {
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

describe("companyPricingPolicyStore", () => {
  test("rowToPricingPolicy maps DB row to PricingPolicy correctly", () => {
    const policy = rowToPricingPolicy(dbRow());
    assert.ok(policy);
    assert.equal(policy.profitabilityType, "margin");
    assert.equal(policy.defaultProfitabilityPct, 45);
    assert.equal(policy.minimumProfitabilityPct, 25);
    assert.equal(policy.quantityRounding, "exact");
    assert.equal(policy.wasteModel, "adjusted_measurement");
    assert.equal(policy.tax.salesTaxRatePct, 8.25);
    assert.equal(policy.tax.materialPurchaseTaxRatePct, 6);
    assert.equal(policy.discount, null);
    assert.equal(policy.subtotalOverrideCents, null);
  });

  test("numeric strings from DB are tolerated", () => {
    const policy = rowToPricingPolicy(
      dbRow({
        default_profitability_pct: "45",
        minimum_profitability_pct: "25",
        sales_tax_rate_pct: "8.25",
        material_purchase_tax_rate_pct: "6",
      })
    );
    assert.ok(policy);
    assert.equal(policy.defaultProfitabilityPct, 45);
    assert.equal(policy.minimumProfitabilityPct, 25);
    assert.equal(policy.tax.salesTaxRatePct, 8.25);
    assert.equal(policy.tax.materialPurchaseTaxRatePct, 6);
  });

  test("material_purchase_tax_rate_pct null maps to null", () => {
    const nullTax = rowToPricingPolicy(dbRow({ material_purchase_tax_rate_pct: null }));
    assert.equal(nullTax?.tax.materialPurchaseTaxRatePct, null);

    const undefinedTax = rowToPricingPolicy(dbRow({ material_purchase_tax_rate_pct: undefined }));
    assert.equal(undefinedTax?.tax.materialPurchaseTaxRatePct, null);
  });

  test("rowToPricingPolicy returns null when required numeric is non-finite", () => {
    const policy = rowToPricingPolicy(
      dbRow({ default_profitability_pct: "not-a-number" })
    );
    assert.equal(policy, null);
  });

  test("pricingPolicyToRowFields maps policy to snake_case fields", () => {
    const row = pricingPolicyToRowFields(COMPANY_ID, validPolicy());
    assert.equal(row.company_id, COMPANY_ID);
    assert.equal(row.profitability_type, "margin");
    assert.equal(row.default_profitability_pct, 45);
    assert.equal(row.minimum_profitability_pct, 25);
    assert.equal(row.quantity_rounding, "exact");
    assert.equal(row.waste_model, "adjusted_measurement");
    assert.equal(row.sales_tax_rate_pct, 8.25);
    assert.equal(row.material_purchase_tax_rate_pct, 6);
  });

  test("null material tax maps to null in row fields", () => {
    const row = pricingPolicyToRowFields(
      COMPANY_ID,
      validPolicy({ tax: { salesTaxRatePct: 0, materialPurchaseTaxRatePct: null } })
    );
    assert.equal(row.sales_tax_rate_pct, 0);
    assert.equal(row.material_purchase_tax_rate_pct, null);
  });

  test("discount and subtotalOverride are never emitted to row fields", () => {
    const row = pricingPolicyToRowFields(COMPANY_ID, validPolicy());
    assert.equal("discount" in row, false);
    assert.equal("discount_kind" in row, false);
    assert.equal("subtotal_override_cents" in row, false);
    assert.equal("subtotalOverrideCents" in row, false);
  });

  test("round-trip row → policy → row preserves locked fields", () => {
    const row = dbRow({ profitability_type: "markup", default_profitability_pct: 60, minimum_profitability_pct: 30 });
    const policy = rowToPricingPolicy(row);
    assert.ok(policy);
    const rebuilt = pricingPolicyToRowFields(COMPANY_ID, policy);
    assert.equal(rebuilt.profitability_type, "markup");
    assert.equal(rebuilt.default_profitability_pct, 60);
    assert.equal(rebuilt.minimum_profitability_pct, 30);
    assert.equal(rebuilt.quantity_rounding, "exact");
    assert.equal(rebuilt.waste_model, "adjusted_measurement");
    assert.equal(rebuilt.sales_tax_rate_pct, 8.25);
    assert.equal(rebuilt.material_purchase_tax_rate_pct, 6);
  });

  // -------------------------------------------------------------------------
  // Pre-write validation (store delegates to the resolver validator — no drift)
  // -------------------------------------------------------------------------

  test("valid policy passes pre-write validation", () => {
    assert.equal(validateStorableCompanyPricingPolicy(validPolicy()).valid, true);
  });

  test("store validation matches resolver validation (no drift)", () => {
    const cases: PricingPolicy[] = [
      validPolicy(),
      validPolicy({ profitabilityType: "margin", defaultProfitabilityPct: 100, minimumProfitabilityPct: 100 }),
      validPolicy({ profitabilityType: "markup", defaultProfitabilityPct: 100, minimumProfitabilityPct: 20 }),
      validPolicy({ defaultProfitabilityPct: 40, minimumProfitabilityPct: 50 }),
    ];
    for (const c of cases) {
      assert.equal(
        validateStorableCompanyPricingPolicy(c).valid,
        validateCompanyPricingPolicy(c).valid,
        JSON.stringify(c)
      );
    }
  });

  test("min > default is invalid", () => {
    const v = validateStorableCompanyPricingPolicy(
      validPolicy({ defaultProfitabilityPct: 40, minimumProfitabilityPct: 50 })
    );
    assert.equal(v.valid, false);
  });

  test("margin 100 is invalid", () => {
    const v = validateStorableCompanyPricingPolicy(
      validPolicy({ profitabilityType: "margin", defaultProfitabilityPct: 100, minimumProfitabilityPct: 100 })
    );
    assert.equal(v.valid, false);
  });

  test("markup 100 is valid", () => {
    const v = validateStorableCompanyPricingPolicy(
      validPolicy({ profitabilityType: "markup", defaultProfitabilityPct: 100, minimumProfitabilityPct: 20 })
    );
    assert.equal(v.valid, true);
  });

  test('quantityRounding "whole" is invalid', () => {
    const v = validateStorableCompanyPricingPolicy(
      validPolicy({ quantityRounding: "whole" as PricingPolicy["quantityRounding"] })
    );
    assert.equal(v.valid, false);
  });

  test("wasteModel raw_plus_waste is invalid", () => {
    const v = validateStorableCompanyPricingPolicy(
      validPolicy({ wasteModel: "raw_plus_waste" as PricingPolicy["wasteModel"] })
    );
    assert.equal(v.valid, false);
  });

  test("non-null discount is invalid", () => {
    const v = validateStorableCompanyPricingPolicy(
      validPolicy({ discount: { kind: "percent", value: 10 } })
    );
    assert.equal(v.valid, false);
  });

  test("non-null subtotalOverride is invalid", () => {
    const v = validateStorableCompanyPricingPolicy(validPolicy({ subtotalOverrideCents: 1000 }));
    assert.equal(v.valid, false);
  });

  // -------------------------------------------------------------------------
  // Resolver integration
  // -------------------------------------------------------------------------

  test("mapped valid row resolves configured:true source:company", () => {
    const policy = rowToPricingPolicy(dbRow());
    const resolution = resolveCompanyPricingPolicy({ storedPolicy: policy });
    assert.equal(resolution.configured, true);
    assert.equal(resolution.source, "company");
    assert.ok(resolution.policy);
  });

  test("missing row resolves configured:false source:missing policy:null", () => {
    const resolution = resolveCompanyPricingPolicy({ storedPolicy: null });
    assert.equal(resolution.configured, false);
    assert.equal(resolution.source, "missing");
    assert.equal(resolution.policy, null);
  });

  test("margin-100 row maps but validation refuses to persist it", () => {
    const policy = rowToPricingPolicy(
      dbRow({ profitability_type: "margin", default_profitability_pct: 100, minimum_profitability_pct: 100 })
    );
    assert.ok(policy);
    // Resolver and store now agree: margin 100 is rejected (matches DB + engine).
    assert.equal(validateStorableCompanyPricingPolicy(policy).valid, false);
    assert.equal(resolveCompanyPricingPolicy({ storedPolicy: policy }).configured, false);
  });

  // -------------------------------------------------------------------------
  // Starter default is not auto-saved
  // -------------------------------------------------------------------------

  test("store exposes no starter-default auto-save path", async () => {
    const store = await import("./companyPricingPolicyStore");
    const exportNames = Object.keys(store);
    assert.equal(exportNames.includes("upsertCompanyPricingPolicy"), true);
    assert.equal(
      exportNames.some((n) => /starter|seed|default/i.test(n)),
      false
    );
    assert.equal(
      exportNames.some((n) => /delete|remove/i.test(n)),
      false
    );
  });
});
