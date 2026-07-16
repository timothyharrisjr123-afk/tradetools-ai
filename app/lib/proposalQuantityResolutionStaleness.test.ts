/**
 * S3D4 — quantity_resolution_echo staleness detection tests.
 *
 * Run: npx tsx --test app/lib/proposalQuantityResolutionStaleness.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { AdjustedQuantityResolutionEcho } from "./proposalQuantityResolutionAdapter";
import { compareAdjustedQuantityResolutionEcho } from "./proposalQuantityResolutionStaleness";

function currentEcho(
  overrides: Partial<AdjustedQuantityResolutionEcho> = {}
): AdjustedQuantityResolutionEcho {
  return {
    quantity_mode: "adjusted_measurement",
    source_measurement_key: "squares",
    source_measurement_value: 24,
    coverage_rate_used: null,
    waste_pct_used: null,
    rounding_mode_used: "exact",
    resolved_purchase_quantity: 24,
    ...overrides,
  };
}

function persistedEcho(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    quantity_mode: "adjusted_measurement",
    source_measurement_key: "squares",
    source_measurement_value: 24,
    coverage_rate_used: null,
    waste_pct_used: null,
    rounding_mode_used: "exact",
    resolved_purchase_quantity: 24,
    ...overrides,
  };
}

describe("compareAdjustedQuantityResolutionEcho", () => {
  test("1. current echo vs current adapter = current", () => {
    const current = currentEcho();
    const result = compareAdjustedQuantityResolutionEcho({
      persistedEcho: persistedEcho(),
      currentEcho: current,
    });
    assert.equal(result.status, "current");
    assert.deepEqual(result.reasons, []);
    assert.equal(result.current?.resolved_purchase_quantity, 24);
  });

  test("2. missing historical echo = unknown, not stale", () => {
    const result = compareAdjustedQuantityResolutionEcho({
      persistedEcho: null,
      currentEcho: currentEcho(),
    });
    assert.equal(result.status, "unknown");
    assert.ok(result.reasons.includes("missing_persisted_echo"));
    assert.notEqual(result.status, "stale");
  });

  test("3. malformed echo = unknown, not stale", () => {
    const asArray = compareAdjustedQuantityResolutionEcho({
      persistedEcho: ["not", "an", "object"],
      currentEcho: currentEcho(),
    });
    assert.equal(asArray.status, "unknown");
    assert.ok(asArray.reasons.includes("malformed_persisted_echo"));

    const missingMode = compareAdjustedQuantityResolutionEcho({
      persistedEcho: { resolved_purchase_quantity: 24 },
      currentEcho: currentEcho(),
    });
    assert.equal(missingMode.status, "unknown");
    assert.ok(missingMode.reasons.includes("malformed_persisted_echo"));
  });

  test("4. quantity_mode mismatch = stale", () => {
    const result = compareAdjustedQuantityResolutionEcho({
      persistedEcho: persistedEcho({ quantity_mode: "raw_plus_waste" }),
      currentEcho: currentEcho(),
    });
    assert.equal(result.status, "stale");
    assert.ok(result.reasons.includes("quantity_mode_mismatch"));
  });

  test("5. resolved_purchase_quantity mismatch = stale", () => {
    const result = compareAdjustedQuantityResolutionEcho({
      persistedEcho: persistedEcho({ resolved_purchase_quantity: 20 }),
      currentEcho: currentEcho({ resolved_purchase_quantity: 24 }),
    });
    assert.equal(result.status, "stale");
    assert.ok(result.reasons.includes("resolved_purchase_quantity_mismatch"));
  });

  test("6. source key mismatch = stale when both known", () => {
    const result = compareAdjustedQuantityResolutionEcho({
      persistedEcho: persistedEcho({ source_measurement_key: "ridge_lf" }),
      currentEcho: currentEcho({ source_measurement_key: "squares" }),
    });
    assert.equal(result.status, "stale");
    assert.ok(result.reasons.includes("source_measurement_key_mismatch"));
  });

  test("7. source value mismatch = stale when both known", () => {
    const result = compareAdjustedQuantityResolutionEcho({
      persistedEcho: persistedEcho({ source_measurement_value: 20 }),
      currentEcho: currentEcho({ source_measurement_value: 24 }),
    });
    assert.equal(result.status, "stale");
    assert.ok(result.reasons.includes("source_measurement_value_mismatch"));
  });

  test("8. rounding mode not exact = stale", () => {
    const result = compareAdjustedQuantityResolutionEcho({
      persistedEcho: persistedEcho({ rounding_mode_used: "whole" }),
      currentEcho: currentEcho(),
    });
    assert.equal(result.status, "stale");
    assert.ok(result.reasons.includes("rounding_mode_mismatch"));
  });

  test("9. coverage_rate_used non-null under adjusted mode = stale", () => {
    const result = compareAdjustedQuantityResolutionEcho({
      persistedEcho: persistedEcho({ coverage_rate_used: 100 }),
      currentEcho: currentEcho(),
    });
    assert.equal(result.status, "stale");
    assert.ok(result.reasons.includes("coverage_rate_used_non_null"));
  });

  test("10. waste_pct_used non-null under adjusted mode = stale", () => {
    const result = compareAdjustedQuantityResolutionEcho({
      persistedEcho: persistedEcho({ waste_pct_used: 10 }),
      currentEcho: currentEcho(),
    });
    assert.equal(result.status, "stale");
    assert.ok(result.reasons.includes("waste_pct_used_non_null"));
  });

  test("11. fixed/multiplier cases without source value do not invent stale", () => {
    const fixed = compareAdjustedQuantityResolutionEcho({
      persistedEcho: persistedEcho({
        source_measurement_key: "fixed",
        source_measurement_value: null,
        resolved_purchase_quantity: 1,
      }),
      currentEcho: currentEcho({
        source_measurement_key: "fixed",
        source_measurement_value: null,
        resolved_purchase_quantity: 1,
      }),
    });
    assert.equal(fixed.status, "current");
    assert.deepEqual(fixed.reasons, []);

    // One side null source value — do not invent value mismatch stale.
    const halfKnown = compareAdjustedQuantityResolutionEcho({
      persistedEcho: persistedEcho({
        source_measurement_value: 24,
        resolved_purchase_quantity: 48,
      }),
      currentEcho: currentEcho({
        source_measurement_key: "squares",
        source_measurement_value: null,
        resolved_purchase_quantity: 48,
      }),
    });
    assert.equal(halfKnown.status, "current");
    assert.ok(!halfKnown.reasons.includes("source_measurement_value_mismatch"));
  });

  test("12. raw echo under adjusted comparer is flagged stale, not accepted as current", () => {
    const result = compareAdjustedQuantityResolutionEcho({
      persistedEcho: persistedEcho({
        quantity_mode: "raw_plus_waste",
        waste_pct_used: 15,
        coverage_rate_used: 33,
      }),
      currentEcho: currentEcho(),
    });
    assert.equal(result.status, "stale");
    assert.ok(result.reasons.includes("quantity_mode_mismatch"));
    assert.ok(result.reasons.includes("waste_pct_used_non_null"));
    assert.ok(result.reasons.includes("coverage_rate_used_non_null"));
  });

  test("unresolved current preview = unknown, not stale", () => {
    const result = compareAdjustedQuantityResolutionEcho({
      persistedEcho: persistedEcho(),
      currentEcho: currentEcho({ resolved_purchase_quantity: null }),
      currentPreviewUnresolved: true,
    });
    assert.equal(result.status, "unknown");
    assert.ok(result.reasons.includes("current_unresolved"));
  });

  test("missing current echo = unknown", () => {
    const result = compareAdjustedQuantityResolutionEcho({
      persistedEcho: persistedEcho(),
      currentEcho: null,
    });
    assert.equal(result.status, "unknown");
    assert.ok(result.reasons.includes("missing_current_echo"));
  });

  test("source key null on either side does not invent key mismatch stale", () => {
    const result = compareAdjustedQuantityResolutionEcho({
      persistedEcho: persistedEcho({ source_measurement_key: null }),
      currentEcho: currentEcho({ source_measurement_key: "squares" }),
    });
    assert.equal(result.status, "current");
    assert.ok(!result.reasons.includes("source_measurement_key_mismatch"));
  });
});
