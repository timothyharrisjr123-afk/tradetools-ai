/**
 * Run: npx tsx --test app/lib/catalogQuantityMode.test.ts
 *
 * Pure S1C fixtures for catalogQuantityMode helpers. No production wiring.
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  assertQuantityModeAllowed,
  applyCoverage,
  applyQuantityRounding,
  applyWastePercent,
  DEFAULT_QUANTITY_MODE,
  detectDoubleWasteRisk,
  resolveAdjustedMeasurementQuantity,
  resolveRawPlusWasteQuantity,
} from "./catalogQuantityMode";

describe("catalogQuantityMode — mode guards", () => {
  test("DEFAULT_QUANTITY_MODE is adjusted_measurement", () => {
    assert.equal(DEFAULT_QUANTITY_MODE, "adjusted_measurement");
  });

  test("assertQuantityModeAllowed accepts dual modes", () => {
    assert.equal(assertQuantityModeAllowed("adjusted_measurement").ok, true);
    assert.equal(assertQuantityModeAllowed("raw_plus_waste").ok, true);
  });

  test("unknown mode returns structured violation", () => {
    const result = assertQuantityModeAllowed("mystery");
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "unsupported_mode");
      assert.match(result.message, /Unsupported quantity mode/);
    }
  });
});

describe("catalogQuantityMode — adjusted_measurement", () => {
  test("returns source quantity unchanged", () => {
    const result = resolveAdjustedMeasurementQuantity({ sourceQuantity: 42.5 });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.mode, "adjusted_measurement");
      assert.equal(result.sourceQuantity, 42.5);
      assert.equal(result.resolvedQuantity, 42.5);
      assert.equal(result.coverageRateUsed, null);
      assert.equal(result.wastePctUsed, null);
    }
  });

  test("forbids waste_pct application", () => {
    const result = resolveAdjustedMeasurementQuantity({
      sourceQuantity: 100,
      waste: { wastePct: 10, wasteApplies: true },
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "waste_forbidden_in_adjusted_mode");
    }
  });

  test("forbids waste_pct even when wasteApplies is false if pct present (double-waste signal)", () => {
    const result = resolveAdjustedMeasurementQuantity({
      sourceQuantity: 100,
      waste: { wastePct: 10, wasteApplies: false },
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "waste_forbidden_in_adjusted_mode");
    }
  });

  test("invalid quantity returns structured violation", () => {
    const result = resolveAdjustedMeasurementQuantity({
      sourceQuantity: Number.NaN,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "invalid_quantity");
    }
  });

  test("whole rounding returns unsupported_rounding", () => {
    const result = resolveAdjustedMeasurementQuantity({
      sourceQuantity: 10.2,
      rounding: { mode: "whole" },
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "unsupported_rounding");
    }
  });
});

describe("catalogQuantityMode — detectDoubleWasteRisk", () => {
  test("true when adjusted + wastePct present", () => {
    assert.equal(
      detectDoubleWasteRisk({
        mode: "adjusted_measurement",
        wastePct: 15,
      }),
      true
    );
  });

  test("true when measurementAlreadyAdjusted and waste would apply", () => {
    assert.equal(
      detectDoubleWasteRisk({
        mode: "raw_plus_waste",
        wastePct: 10,
        measurementAlreadyAdjusted: true,
      }),
      true
    );
  });

  test("false when no wastePct", () => {
    assert.equal(
      detectDoubleWasteRisk({
        mode: "adjusted_measurement",
        wastePct: null,
      }),
      false
    );
  });
});

describe("catalogQuantityMode — coverage", () => {
  test("null/undefined coverageRate = 1:1", () => {
    const nullResult = applyCoverage(100, null);
    assert.equal(nullResult.ok, true);
    if (nullResult.ok) {
      assert.equal(nullResult.quantity, 100);
      assert.equal(nullResult.coverageRateUsed, null);
    }

    const undefResult = applyCoverage(100, undefined);
    assert.equal(undefResult.ok, true);
    if (undefResult.ok) {
      assert.equal(undefResult.quantity, 100);
      assert.equal(undefResult.coverageRateUsed, null);
    }
  });

  test("divides into purchase units", () => {
    const result = applyCoverage(100, 33.3);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.ok(Math.abs(result.quantity - 100 / 33.3) < 1e-12);
      assert.equal(result.coverageRateUsed, 33.3);
    }
  });

  test("invalid coverage 0/negative/non-finite returns invalid_coverage", () => {
    for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const result = applyCoverage(100, bad);
      assert.equal(result.ok, false, `expected violation for coverageRate=${bad}`);
      if (!result.ok) {
        assert.equal(result.code, "invalid_coverage");
      }
    }
  });
});

describe("catalogQuantityMode — waste primitives", () => {
  test("null/undefined wastePct = no waste", () => {
    const result = applyWastePercent(50, null);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.quantity, 50);
      assert.equal(result.wastePctUsed, null);
    }
  });

  test("valid waste applies qty * (1 + wastePct / 100)", () => {
    const result = applyWastePercent(100, 10);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.ok(Math.abs(result.quantity - 110) < 1e-12);
      assert.equal(result.wastePctUsed, 10);
    }
  });

  test("negative/non-finite waste rejected", () => {
    for (const bad of [-5, Number.NaN, Number.NEGATIVE_INFINITY]) {
      const result = applyWastePercent(100, bad);
      assert.equal(result.ok, false, `expected violation for wastePct=${bad}`);
      if (!result.ok) {
        assert.equal(result.code, "invalid_waste");
      }
    }
  });
});

describe("catalogQuantityMode — rounding", () => {
  test("exact rounding leaves value unchanged", () => {
    const result = applyQuantityRounding(12.345, "exact");
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.quantity, 12.345);
    }
  });

  test("whole rounding returns unsupported_rounding", () => {
    const result = applyQuantityRounding(12.345, "whole");
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "unsupported_rounding");
    }
  });
});

describe("catalogQuantityMode — raw_plus_waste", () => {
  test("requires finite raw source", () => {
    const missing = resolveRawPlusWasteQuantity({ sourceQuantity: null });
    assert.equal(missing.ok, false);
    if (!missing.ok) {
      assert.equal(missing.code, "missing_raw_source");
    }

    const nan = resolveRawPlusWasteQuantity({ sourceQuantity: Number.NaN });
    assert.equal(nan.ok, false);
    if (!nan.ok) {
      assert.equal(nan.code, "missing_raw_source");
    }
  });

  test("waste applies once in raw path (coverage then waste)", () => {
    const result = resolveRawPlusWasteQuantity({
      sourceQuantity: 100,
      coverage: { coverageRate: 50 },
      waste: { wastePct: 10, wasteApplies: true },
      rounding: { mode: "exact" },
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      // 100 / 50 = 2; 2 * 1.10 = 2.2
      assert.equal(result.resolvedQuantity, 2.2);
      assert.equal(result.coverageRateUsed, 50);
      assert.equal(result.wastePctUsed, 10);
    }
  });

  test("wasteApplies false skips waste and records wastePctUsed null", () => {
    const result = resolveRawPlusWasteQuantity({
      sourceQuantity: 100,
      coverage: { coverageRate: null },
      waste: { wastePct: 25, wasteApplies: false },
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.resolvedQuantity, 100);
      assert.equal(result.wastePctUsed, null);
      assert.equal(result.coverageRateUsed, null);
    }
  });

  test("1:1 coverage with waste when wasteApplies true", () => {
    const result = resolveRawPlusWasteQuantity({
      sourceQuantity: 80,
      coverage: { coverageRate: undefined },
      waste: { wastePct: 15, wasteApplies: true },
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.resolvedQuantity, 92);
      assert.equal(result.wastePctUsed, 15);
    }
  });

  test("whole rounding returns unsupported_rounding on raw path", () => {
    const result = resolveRawPlusWasteQuantity({
      sourceQuantity: 10,
      rounding: { mode: "whole" },
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "unsupported_rounding");
    }
  });

  test("invalid coverage on raw path surfaces invalid_coverage", () => {
    const result = resolveRawPlusWasteQuantity({
      sourceQuantity: 100,
      coverage: { coverageRate: 0 },
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "invalid_coverage");
    }
  });
});
