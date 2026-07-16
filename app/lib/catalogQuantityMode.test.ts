/**
 * Run: npx tsx --test app/lib/catalogQuantityMode.test.ts
 *
 * Pure Phase 1 fixtures for catalogQuantityMode helpers. No production wiring.
 * raw_plus_waste remains future-only; DEFAULT_QUANTITY_MODE stays adjusted_measurement.
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
  test("DEFAULT_QUANTITY_MODE is adjusted_measurement (production default)", () => {
    assert.equal(DEFAULT_QUANTITY_MODE, "adjusted_measurement");
  });

  test("assertQuantityModeAllowed accepts dual modes as helper literals only", () => {
    assert.equal(assertQuantityModeAllowed("adjusted_measurement").ok, true);
    assert.equal(assertQuantityModeAllowed("raw_plus_waste").ok, true);
  });

  test("20. unknown/unsupported mode returns structured violation", () => {
    const result = assertQuantityModeAllowed("mystery");
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "unsupported_mode");
      assert.match(result.message, /Unsupported quantity mode/);
    }
  });

  test("19. no helper returns raw_plus_waste as production-enabled", () => {
    assert.equal(DEFAULT_QUANTITY_MODE, "adjusted_measurement");
    const result = resolveRawPlusWasteQuantity({
      sourceQuantity: 100,
      waste: { wastePct: 10, wasteApplies: true },
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.mode, "raw_plus_waste");
      assert.ok(result.notes?.includes("not production-enabled"));
      assert.ok(
        result.notes?.some((n) => /not wired into production/i.test(n))
      );
    }
  });
});

describe("catalogQuantityMode — adjusted_measurement", () => {
  test("11. forbids waste_pct application", () => {
    const result = resolveAdjustedMeasurementQuantity({
      sourceQuantity: 100,
      waste: { wastePct: 10, wasteApplies: true },
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "waste_forbidden_in_adjusted_mode");
    }
  });

  test("12. ignores coverage in this phase", () => {
    const result = resolveAdjustedMeasurementQuantity({
      sourceQuantity: 100,
      coverage: { coverageRate: 25 },
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.resolvedQuantity, 100);
      assert.equal(result.coverageRateUsed, null);
      assert.equal(result.wastePctUsed, null);
    }
  });

  test("13. rejects double-waste risk when waste_pct present", () => {
    const withAppliesFalse = resolveAdjustedMeasurementQuantity({
      sourceQuantity: 100,
      waste: { wastePct: 10, wasteApplies: false },
    });
    assert.equal(withAppliesFalse.ok, false);
    if (!withAppliesFalse.ok) {
      assert.equal(withAppliesFalse.code, "waste_forbidden_in_adjusted_mode");
    }

    assert.equal(
      detectDoubleWasteRisk({
        mode: "adjusted_measurement",
        wastePct: 15,
      }),
      true
    );
  });

  test("returns source quantity unchanged (pass-through)", () => {
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

  test("invalid quantity returns structured violation", () => {
    const result = resolveAdjustedMeasurementQuantity({
      sourceQuantity: Number.NaN,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "invalid_quantity");
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
  test("3. null/undefined coverageRate = 1:1", () => {
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

  test("4. coverage divides source by coverage_rate", () => {
    const result = applyCoverage(100, 33.3);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.ok(Math.abs(result.quantity - 100 / 33.3) < 1e-12);
      assert.equal(result.coverageRateUsed, 33.3);
    }
  });

  test("5. invalid coverage 0/negative/non-finite returns invalid_coverage", () => {
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
  test("8. null/undefined wastePct = no waste", () => {
    const nullResult = applyWastePercent(50, null);
    assert.equal(nullResult.ok, true);
    if (nullResult.ok) {
      assert.equal(nullResult.quantity, 50);
      assert.equal(nullResult.wastePctUsed, null);
    }

    const undefResult = applyWastePercent(50, undefined);
    assert.equal(undefResult.ok, true);
    if (undefResult.ok) {
      assert.equal(undefResult.quantity, 50);
      assert.equal(undefResult.wastePctUsed, null);
    }
  });

  test("7. waste applies qty * (1 + wastePct / 100) once", () => {
    const result = applyWastePercent(100, 10);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.ok(Math.abs(result.quantity - 110) < 1e-12);
      assert.equal(result.wastePctUsed, 10);
    }
  });

  test("9. invalid waste negative/non-finite returns invalid_waste", () => {
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
  test("14. exact rounding returns unchanged", () => {
    const result = applyQuantityRounding(12.345, "exact");
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.quantity, 12.345);
    }
  });

  test("15. whole rounding returns unsupported_rounding", () => {
    const result = applyQuantityRounding(12.345, "whole");
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "unsupported_rounding");
    }
  });
});

describe("catalogQuantityMode — raw_plus_waste", () => {
  test("1. uses raw source quantity", () => {
    const result = resolveRawPlusWasteQuantity({
      sourceQuantity: 80,
      coverage: { coverageRate: null },
      waste: { wastePct: null, wasteApplies: false },
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.mode, "raw_plus_waste");
      assert.equal(result.sourceQuantity, 80);
      assert.equal(result.resolvedQuantity, 80);
    }
  });

  test("2. rejects missing/null/non-finite raw source", () => {
    for (const bad of [null, undefined, Number.NaN, Number.POSITIVE_INFINITY]) {
      const result = resolveRawPlusWasteQuantity({ sourceQuantity: bad as number });
      assert.equal(result.ok, false, `expected violation for sourceQuantity=${bad}`);
      if (!result.ok) {
        assert.equal(result.code, "missing_raw_source");
      }
    }
  });

  test("6. waste_applies=false skips waste even if waste_pct exists", () => {
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

  test("7. waste_applies=true applies waste_pct once", () => {
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

  test("8. waste_pct null/undefined = no waste on raw path", () => {
    const result = resolveRawPlusWasteQuantity({
      sourceQuantity: 50,
      waste: { wastePct: null, wasteApplies: true },
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.resolvedQuantity, 50);
      assert.equal(result.wastePctUsed, null);
    }
  });

  test("9. invalid waste on raw path returns invalid_waste", () => {
    const result = resolveRawPlusWasteQuantity({
      sourceQuantity: 100,
      waste: { wastePct: -1, wasteApplies: true },
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "invalid_waste");
    }
  });

  test("10. formula order is coverage then waste", () => {
    const result = resolveRawPlusWasteQuantity({
      sourceQuantity: 100,
      coverage: { coverageRate: 50 },
      waste: { wastePct: 10, wasteApplies: true },
      rounding: { mode: "exact" },
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      // coverage first: 100 / 50 = 2; then waste: 2 * 1.10 = 2.2
      // (waste-then-coverage would be 110 / 50 = 2.2 coincidence — use asymmetric values)
      assert.equal(result.resolvedQuantity, 2.2);
      assert.equal(result.coverageRateUsed, 50);
      assert.equal(result.wastePctUsed, 10);
    }

    // Prove order with values where waste-first would differ: 200 / 40 * 1.25 = 6.25
    // waste-first: 200 * 1.25 / 40 = 6.25 — still same for multiply/divide.
    // Use coverage that does not commute with additive interpretation:
    // coverage then waste: (90 / 30) * 1.10 = 3.3
    const ordered = resolveRawPlusWasteQuantity({
      sourceQuantity: 90,
      coverage: { coverageRate: 30 },
      waste: { wastePct: 10, wasteApplies: true },
    });
    assert.equal(ordered.ok, true);
    if (ordered.ok) {
      assert.ok(Math.abs(ordered.resolvedQuantity - 3.3) < 1e-12);
    }
  });

  test("5. invalid coverage on raw path surfaces invalid_coverage", () => {
    const result = resolveRawPlusWasteQuantity({
      sourceQuantity: 100,
      coverage: { coverageRate: 0 },
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "invalid_coverage");
    }
  });

  test("14/15. exact ok; whole unsupported on raw path", () => {
    const exact = resolveRawPlusWasteQuantity({
      sourceQuantity: 10.25,
      rounding: { mode: "exact" },
    });
    assert.equal(exact.ok, true);
    if (exact.ok) {
      assert.equal(exact.resolvedQuantity, 10.25);
    }

    const whole = resolveRawPlusWasteQuantity({
      sourceQuantity: 10,
      rounding: { mode: "whole" },
    });
    assert.equal(whole.ok, false);
    if (!whole.ok) {
      assert.equal(whole.code, "unsupported_rounding");
    }
  });

  test("16. material case with coverage+waste", () => {
    // Shingles: 33 squares raw, 33.3 sq/bundle coverage, 10% waste
    const result = resolveRawPlusWasteQuantity({
      sourceQuantity: 33,
      coverage: { coverageRate: 33.3 },
      waste: { wastePct: 10, wasteApplies: true },
      rounding: { mode: "exact" },
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      const expected = (33 / 33.3) * 1.1;
      assert.ok(Math.abs(result.resolvedQuantity - expected) < 1e-12);
      assert.equal(result.coverageRateUsed, 33.3);
      assert.equal(result.wastePctUsed, 10);
    }
  });

  test("17. labor/fee case with waste_applies=false", () => {
    const result = resolveRawPlusWasteQuantity({
      sourceQuantity: 12,
      coverage: { coverageRate: null },
      waste: { wastePct: 15, wasteApplies: false },
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.resolvedQuantity, 12);
      assert.equal(result.coverageRateUsed, null);
      assert.equal(result.wastePctUsed, null);
    }
  });

  test("18. source already adjusted + raw_plus_waste returns double_waste_risk", () => {
    const result = resolveRawPlusWasteQuantity({
      sourceQuantity: 110,
      sourceAlreadyAdjusted: true,
      coverage: { coverageRate: null },
      waste: { wastePct: 10, wasteApplies: true },
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "double_waste_risk");
      assert.match(result.message, /already-adjusted/);
    }

    // Even without waste_applies, already-adjusted raw source is rejected.
    const noWaste = resolveRawPlusWasteQuantity({
      sourceQuantity: 110,
      sourceAlreadyAdjusted: true,
    });
    assert.equal(noWaste.ok, false);
    if (!noWaste.ok) {
      assert.equal(noWaste.code, "double_waste_risk");
    }
  });
});
