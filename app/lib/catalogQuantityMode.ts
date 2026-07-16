/**
 * Catalog quantity-mode helpers (S1B / raw_plus_waste Phase 1) — pure foundation only.
 *
 * Production today remains on adjusted_measurement via proposalQuantityResolver
 * (measurement → quantity_source → resolved qty). The pricing engine does not
 * apply coverage or waste when wasteModel is adjusted_measurement.
 *
 * This module is intentionally unwired:
 * - Do not import into proposalQuantityResolver, pricing engine, mapper, or UI.
 * - raw_plus_waste is a future-mode helper only until schema/math/tests + wiring
 *   are separately approved.
 * - DEFAULT_QUANTITY_MODE stays adjusted_measurement; helpers never mark
 *   raw_plus_waste as production-enabled.
 *
 * Formula order for future raw_plus_waste: source → coverage → waste → exact.
 * Coverage null/undefined = 1:1. Exact rounding only; whole returns
 * unsupported_rounding (never silently applied).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Dual-mode quantity contract (aligns with WasteModel literals; standalone). */
export type QuantityMode = "adjusted_measurement" | "raw_plus_waste";

/** Exact is honored; whole is contract-only and returns a violation. */
export type QuantityRoundingMode = "exact" | "whole";

export type CoverageInput = {
  coverageRate: number | null | undefined;
};

export type WasteInput = {
  /** Percent points: 10 = 10%. */
  wastePct: number | null | undefined;
  /** When false, skip waste even if wastePct is present. */
  wasteApplies: boolean;
};

export type RoundingInput = {
  mode: QuantityRoundingMode;
};

export type ResolvedQuantityOutput = {
  ok: true;
  mode: QuantityMode;
  sourceQuantity: number;
  /** null = 1:1 / not applied. */
  coverageRateUsed: number | null;
  /** null = not applied. */
  wastePctUsed: number | null;
  resolvedQuantity: number;
  notes?: string[];
};

export type QuantityModeViolationCode =
  | "unsupported_mode"
  | "waste_forbidden_in_adjusted_mode"
  | "double_waste_risk"
  | "missing_raw_source"
  | "invalid_coverage"
  | "invalid_waste"
  | "unsupported_rounding"
  | "invalid_quantity";

export type QuantityModeViolation = {
  ok: false;
  code: QuantityModeViolationCode;
  message: string;
};

export type QuantityModeResult = ResolvedQuantityOutput | QuantityModeViolation;

export const DEFAULT_QUANTITY_MODE: QuantityMode = "adjusted_measurement";

// ---------------------------------------------------------------------------
// Mode / risk guards
// ---------------------------------------------------------------------------

/**
 * Validates mode literals for helper use.
 * raw_plus_waste is allowed as a future helper mode (not production-enabled).
 */
export function assertQuantityModeAllowed(
  mode: string
): { ok: true; mode: QuantityMode } | QuantityModeViolation {
  if (mode === "adjusted_measurement" || mode === "raw_plus_waste") {
    return { ok: true, mode };
  }
  return {
    ok: false,
    code: "unsupported_mode",
    message: `Unsupported quantity mode "${mode}". Expected adjusted_measurement or raw_plus_waste.`,
  };
}

/**
 * Detects risk of applying catalog waste when measurement already includes waste.
 * Callers may treat a true result as a hard block via resolveAdjustedMeasurementQuantity.
 */
export function detectDoubleWasteRisk(input: {
  mode: QuantityMode;
  wastePct: number | null | undefined;
  measurementAlreadyAdjusted?: boolean;
}): boolean {
  const wasteWouldApply =
    input.wastePct != null && Number.isFinite(input.wastePct) && input.wastePct !== 0;

  if (input.mode === "adjusted_measurement" && wasteWouldApply) {
    return true;
  }
  if (input.measurementAlreadyAdjusted === true && wasteWouldApply) {
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Coverage / waste / rounding primitives
// ---------------------------------------------------------------------------

/**
 * null/undefined coverageRate → 1:1 (quantity unchanged).
 * <= 0 or non-finite → invalid_coverage.
 * Otherwise divides measurement into purchase units: qty / coverageRate.
 */
export function applyCoverage(
  quantity: number,
  coverageRate: number | null | undefined
): { ok: true; quantity: number; coverageRateUsed: number | null } | QuantityModeViolation {
  if (!Number.isFinite(quantity)) {
    return {
      ok: false,
      code: "invalid_quantity",
      message: "Quantity must be a finite number before applying coverage.",
    };
  }
  if (coverageRate == null) {
    return { ok: true, quantity, coverageRateUsed: null };
  }
  if (!Number.isFinite(coverageRate) || coverageRate <= 0) {
    return {
      ok: false,
      code: "invalid_coverage",
      message: "coverageRate must be a finite number greater than 0, or null/undefined for 1:1.",
    };
  }
  return {
    ok: true,
    quantity: quantity / coverageRate,
    coverageRateUsed: coverageRate,
  };
}

/**
 * null/undefined wastePct → no waste (quantity unchanged).
 * negative or non-finite → invalid_waste.
 * Otherwise qty * (1 + wastePct / 100).
 */
export function applyWastePercent(
  quantity: number,
  wastePct: number | null | undefined
): { ok: true; quantity: number; wastePctUsed: number | null } | QuantityModeViolation {
  if (!Number.isFinite(quantity)) {
    return {
      ok: false,
      code: "invalid_quantity",
      message: "Quantity must be a finite number before applying waste.",
    };
  }
  if (wastePct == null) {
    return { ok: true, quantity, wastePctUsed: null };
  }
  if (!Number.isFinite(wastePct) || wastePct < 0) {
    return {
      ok: false,
      code: "invalid_waste",
      message: "wastePct must be a finite number >= 0, or null/undefined for no waste.",
    };
  }
  return {
    ok: true,
    quantity: quantity * (1 + wastePct / 100),
    wastePctUsed: wastePct,
  };
}

/**
 * exact → unchanged. whole → unsupported_rounding (never silently applied).
 */
export function applyQuantityRounding(
  quantity: number,
  mode: QuantityRoundingMode
): { ok: true; quantity: number } | QuantityModeViolation {
  if (!Number.isFinite(quantity)) {
    return {
      ok: false,
      code: "invalid_quantity",
      message: "Quantity must be a finite number before rounding.",
    };
  }
  if (mode === "exact") {
    return { ok: true, quantity };
  }
  if (mode === "whole") {
    return {
      ok: false,
      code: "unsupported_rounding",
      message:
        'Quantity rounding mode "whole" is not implemented; only "exact" is honored.',
    };
  }
  return {
    ok: false,
    code: "unsupported_rounding",
    message: `Unsupported quantity rounding mode "${String(mode)}".`,
  };
}

// ---------------------------------------------------------------------------
// Mode resolvers
// ---------------------------------------------------------------------------

export type ResolveAdjustedMeasurementInput = {
  sourceQuantity: number;
  /**
   * Ignored in this phase. Coverage is not applied under adjusted_measurement;
   * coverageRateUsed remains null even when provided.
   */
  coverage?: CoverageInput;
  waste?: WasteInput;
  rounding?: RoundingInput;
};

/**
 * Production-aligned path: pass-through measurement quantity only.
 * No coverage conversion, no waste application.
 * If waste would apply, returns waste_forbidden_in_adjusted_mode (double-waste guard).
 */
export function resolveAdjustedMeasurementQuantity(
  input: ResolveAdjustedMeasurementInput
): QuantityModeResult {
  const { sourceQuantity } = input;
  if (!Number.isFinite(sourceQuantity)) {
    return {
      ok: false,
      code: "invalid_quantity",
      message: "sourceQuantity must be a finite number for adjusted_measurement.",
    };
  }

  const waste = input.waste;
  if (waste?.wasteApplies === true && waste.wastePct != null) {
    return {
      ok: false,
      code: "waste_forbidden_in_adjusted_mode",
      message:
        "adjusted_measurement forbids applying waste_pct; measurement quantities already include waste.",
    };
  }

  // Also forbid when wastePct is present even without wasteApplies (double-waste risk signal).
  if (
    detectDoubleWasteRisk({
      mode: "adjusted_measurement",
      wastePct: waste?.wastePct,
    })
  ) {
    return {
      ok: false,
      code: "waste_forbidden_in_adjusted_mode",
      message:
        "adjusted_measurement forbids applying waste_pct; measurement quantities already include waste.",
    };
  }

  const roundingMode = input.rounding?.mode ?? "exact";
  const rounded = applyQuantityRounding(sourceQuantity, roundingMode);
  if (!rounded.ok) {
    return rounded;
  }

  return {
    ok: true,
    mode: "adjusted_measurement",
    sourceQuantity,
    coverageRateUsed: null,
    wastePctUsed: null,
    resolvedQuantity: rounded.quantity,
    notes: ["pass-through; no coverage or waste applied"],
  };
}

export type ResolveRawPlusWasteInput = {
  /**
   * Must be a raw (pre-waste) measurement quantity.
   * Do not pass adjusted_roof_squares or other already-wasted values.
   */
  sourceQuantity: number | null | undefined;
  /**
   * When true, source is known to already include waste / be adjusted —
   * raw_plus_waste refuses to proceed (double_waste_risk).
   */
  sourceAlreadyAdjusted?: boolean;
  coverage?: CoverageInput;
  waste?: WasteInput;
  rounding?: RoundingInput;
};

/**
 * Future helper mode only — not wired into production resolver or pricing.
 * Order: source → coverage → waste (if wasteApplies) → exact rounding.
 * Rejects missing raw source and already-adjusted sources.
 */
export function resolveRawPlusWasteQuantity(
  input: ResolveRawPlusWasteInput
): QuantityModeResult {
  const { sourceQuantity } = input;
  if (sourceQuantity == null || !Number.isFinite(sourceQuantity)) {
    return {
      ok: false,
      code: "missing_raw_source",
      message: "raw_plus_waste requires a finite raw sourceQuantity.",
    };
  }

  if (input.sourceAlreadyAdjusted === true) {
    return {
      ok: false,
      code: "double_waste_risk",
      message:
        "raw_plus_waste forbids already-adjusted sources; provide a proven raw measurement quantity.",
    };
  }

  const covered = applyCoverage(sourceQuantity, input.coverage?.coverageRate);
  if (!covered.ok) {
    return covered;
  }

  let quantity = covered.quantity;
  let wastePctUsed: number | null = null;

  const waste = input.waste;
  if (waste?.wasteApplies === true) {
    const wasted = applyWastePercent(quantity, waste.wastePct);
    if (!wasted.ok) {
      return wasted;
    }
    quantity = wasted.quantity;
    wastePctUsed = wasted.wastePctUsed;
  }
  // wasteApplies false or omitted: skip waste; wastePctUsed stays null

  const roundingMode = input.rounding?.mode ?? "exact";
  const rounded = applyQuantityRounding(quantity, roundingMode);
  if (!rounded.ok) {
    return rounded;
  }

  return {
    ok: true,
    mode: "raw_plus_waste",
    sourceQuantity,
    coverageRateUsed: covered.coverageRateUsed,
    wastePctUsed,
    resolvedQuantity: rounded.quantity,
    notes: [
      "future mode; not wired into production quantity resolver",
      "not production-enabled",
    ],
  };
}
