/**
 * 3J2B1 — Programmatic tests for proposalSnapshotStatusMapper.ts
 *
 * Run: npx tsx --test app/lib/proposalSnapshotStatusMapper.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  assertConfiguredPolicyForPersistence,
  assertCustomerSafeLineRow,
  mapEngineLineStatusToSnapshot,
  mapPreviewLineStatusToSnapshot,
  PROPOSAL_SNAPSHOT_PRICING_STATUSES,
  ProposalSnapshotGuardError,
} from "./proposalSnapshotStatusMapper";
import {
  DEFAULT_PROFITABILITY_TYPE,
  DEFAULT_QUANTITY_ROUNDING,
  DEFAULT_WASTE_MODEL,
  type PricingPolicy,
} from "./proposalPricingTypes";

const CONFIGURED_POLICY: PricingPolicy = {
  profitabilityType: DEFAULT_PROFITABILITY_TYPE,
  defaultProfitabilityPct: 35,
  minimumProfitabilityPct: 25,
  quantityRounding: DEFAULT_QUANTITY_ROUNDING,
  wasteModel: DEFAULT_WASTE_MODEL,
  discount: null,
  tax: { salesTaxRatePct: 8, materialPurchaseTaxRatePct: null },
  subtotalOverrideCents: null,
};

function customerSafeLineRow(): Record<string, unknown> {
  return {
    customer_name: "Shingles",
    pricing_status: "priced",
    customer_unit_price_cents: 1000,
    customer_line_total_cents: 22000,
    visible_to_customer: true,
  };
}

describe("mapEngineLineStatusToSnapshot", () => {
  test("priced maps to priced", () => {
    assert.equal(
      mapEngineLineStatusToSnapshot({
        engineStatus: "priced",
        customerVisibility: "customer_visible",
      }),
      "priced"
    );
  });

  test("priced grouped maps to grouped", () => {
    assert.equal(
      mapEngineLineStatusToSnapshot({
        engineStatus: "priced",
        customerVisibility: "grouped",
      }),
      "grouped"
    );
  });

  test("included maps to included", () => {
    assert.equal(
      mapEngineLineStatusToSnapshot({
        engineStatus: "included",
        customerVisibility: "customer_visible",
      }),
      "included"
    );
  });

  test("unresolved_quantity maps to needs_quantity", () => {
    assert.equal(
      mapEngineLineStatusToSnapshot({
        engineStatus: "unresolved_quantity",
        customerVisibility: "customer_visible",
      }),
      "needs_quantity"
    );
  });

  test("unresolved_quantity + missing catalog maps to not_priced", () => {
    assert.equal(
      mapEngineLineStatusToSnapshot({
        engineStatus: "unresolved_quantity",
        customerVisibility: "customer_visible",
        catalogItemMissing: true,
      }),
      "not_priced"
    );
  });

  test("unpriced maps to not_priced", () => {
    assert.equal(
      mapEngineLineStatusToSnapshot({
        engineStatus: "unpriced",
        customerVisibility: "customer_visible",
      }),
      "not_priced"
    );
  });

  test("unsupported maps to not_priced", () => {
    assert.equal(
      mapEngineLineStatusToSnapshot({
        engineStatus: "unsupported",
        customerVisibility: "customer_visible",
      }),
      "not_priced"
    );
  });

  test("hidden maps to omitted", () => {
    assert.equal(
      mapEngineLineStatusToSnapshot({
        engineStatus: "hidden",
        customerVisibility: "customer_visible",
      }),
      "omitted"
    );
  });

  test("internal_only visibility maps to omitted regardless of engine status", () => {
    assert.equal(
      mapEngineLineStatusToSnapshot({
        engineStatus: "priced",
        customerVisibility: "internal_only",
      }),
      "omitted"
    );
  });

  test("every engine-mapped value is an allowed ProposalPricingStatusSnapshot", () => {
    const engineStatuses = [
      "priced",
      "included",
      "unpriced",
      "unresolved_quantity",
      "hidden",
      "unsupported",
    ] as const;
    const visibilities = ["customer_visible", "grouped", "internal_only"] as const;

    for (const engineStatus of engineStatuses) {
      for (const customerVisibility of visibilities) {
        const snapshot = mapEngineLineStatusToSnapshot({
          engineStatus,
          customerVisibility,
        });
        assert.ok(
          PROPOSAL_SNAPSHOT_PRICING_STATUSES.includes(snapshot),
          `unexpected snapshot status: ${snapshot}`
        );
      }
    }
  });
});

describe("mapPreviewLineStatusToSnapshot", () => {
  test("preview display statuses map identically to snapshot enum", () => {
    const previewStatuses = [
      "priced",
      "grouped",
      "included",
      "needs_quantity",
      "not_priced",
      "omitted",
    ] as const;

    for (const status of previewStatuses) {
      assert.equal(mapPreviewLineStatusToSnapshot(status), status);
    }
  });
});

describe("assertCustomerSafeLineRow", () => {
  test("passes a normal customer-safe line row", () => {
    assert.doesNotThrow(() => assertCustomerSafeLineRow(customerSafeLineRow()));
  });

  test("throws if row contains unit_cost", () => {
    assert.throws(
      () => assertCustomerSafeLineRow({ ...customerSafeLineRow(), unit_cost: null }),
      ProposalSnapshotGuardError
    );
  });

  test("throws if row contains internal_cost_cents", () => {
    assert.throws(
      () =>
        assertCustomerSafeLineRow({ ...customerSafeLineRow(), internal_cost_cents: null }),
      ProposalSnapshotGuardError
    );
  });

  test("throws if row contains profit_cents", () => {
    assert.throws(
      () => assertCustomerSafeLineRow({ ...customerSafeLineRow(), profit_cents: null }),
      ProposalSnapshotGuardError
    );
  });

  test("throws if row contains margin_pct", () => {
    assert.throws(
      () => assertCustomerSafeLineRow({ ...customerSafeLineRow(), margin_pct: null }),
      ProposalSnapshotGuardError
    );
  });

  test("throws if row contains markup_pct", () => {
    assert.throws(
      () => assertCustomerSafeLineRow({ ...customerSafeLineRow(), markup_pct: null }),
      ProposalSnapshotGuardError
    );
  });

  test("throws if row contains policy_echo_json", () => {
    assert.throws(
      () => assertCustomerSafeLineRow({ ...customerSafeLineRow(), policy_echo_json: {} }),
      ProposalSnapshotGuardError
    );
  });
});

describe("assertConfiguredPolicyForPersistence", () => {
  test("accepts a configured policy-like object", () => {
    assert.doesNotThrow(() =>
      assertConfiguredPolicyForPersistence({
        configured: true,
        source: "company",
        policy: CONFIGURED_POLICY,
        pricingPolicyId: "policy-row-1",
      })
    );
  });

  test("rejects configured false", () => {
    assert.throws(
      () =>
        assertConfiguredPolicyForPersistence({
          configured: false,
          source: "missing",
          policy: null,
        }),
      ProposalSnapshotGuardError
    );
  });

  test("rejects starter_default source", () => {
    assert.throws(
      () =>
        assertConfiguredPolicyForPersistence({
          configured: true,
          source: "starter_default",
          policy: CONFIGURED_POLICY,
        }),
      ProposalSnapshotGuardError
    );
  });

  test("rejects preview source", () => {
    assert.throws(
      () =>
        assertConfiguredPolicyForPersistence({
          configured: true,
          source: "preview",
          policy: CONFIGURED_POLICY,
        }),
      ProposalSnapshotGuardError
    );
  });

  test("rejects null policy when configured", () => {
    assert.throws(
      () =>
        assertConfiguredPolicyForPersistence({
          configured: true,
          source: "company",
          policy: null,
        }),
      ProposalSnapshotGuardError
    );
  });
});
