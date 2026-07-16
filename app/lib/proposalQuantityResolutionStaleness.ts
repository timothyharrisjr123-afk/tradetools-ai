/**
 * S3D4 — draft quantity_resolution_echo staleness detection (pure).
 *
 * Compares a persisted draft line echo against a current echo for the active
 * quantity mode. Detection/metadata only: no DB writes, no auto-refresh, no UI,
 * no quantity math.
 *
 * Missing/malformed historical echoes are "unknown", not "stale".
 * Customer/public DTOs must not expose this result.
 *
 * Dual-mode: compareAdjustedQuantityResolutionEcho for adjusted_measurement;
 * compareRawPlusWasteQuantityResolutionEcho for policy-gated raw_plus_waste.
 * Inspection/preflight dispatch by wasteModel (Phase 5).
 */

import type { AdjustedQuantityResolutionEcho } from "@/app/lib/proposalQuantityResolutionAdapter";
import type { RawPlusWasteQuantityResolutionEcho } from "@/app/lib/proposalQuantityResolutionDisabledRawBranch";

export type QuantityResolutionEchoStalenessStatus = "current" | "stale" | "unknown";

export type QuantityResolutionEchoStalenessReason =
  | "missing_persisted_echo"
  | "malformed_persisted_echo"
  | "missing_current_echo"
  | "current_unresolved"
  | "quantity_mode_mismatch"
  | "source_measurement_key_mismatch"
  | "source_measurement_value_mismatch"
  | "resolved_purchase_quantity_mismatch"
  | "rounding_mode_mismatch"
  | "coverage_rate_used_non_null"
  | "waste_pct_used_non_null"
  | "coverage_rate_used_mismatch"
  | "waste_pct_used_mismatch";

export type QuantityResolutionEchoStalenessResult = {
  status: QuantityResolutionEchoStalenessStatus;
  reasons: QuantityResolutionEchoStalenessReason[];
  previous: Record<string, unknown> | null;
  current: AdjustedQuantityResolutionEcho | null;
};

export type QuantityResolutionEchoStalenessResultRaw = {
  status: QuantityResolutionEchoStalenessStatus;
  reasons: QuantityResolutionEchoStalenessReason[];
  previous: Record<string, unknown> | null;
  current: RawPlusWasteQuantityResolutionEcho | null;
};

export type CompareAdjustedQuantityResolutionEchoInput = {
  /** Persisted proposal_line_items.quantity_resolution_echo (may be null/historical). */
  persistedEcho: unknown;
  /** Current adjusted-mode echo from the quantity resolution adapter. */
  currentEcho: AdjustedQuantityResolutionEcho | null | undefined;
  /** When true, current preview is unresolved — return unknown. */
  currentPreviewUnresolved?: boolean;
};

export type CompareRawPlusWasteQuantityResolutionEchoInput = {
  persistedEcho: unknown;
  currentEcho: RawPlusWasteQuantityResolutionEcho | null | undefined;
  currentPreviewUnresolved?: boolean;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function finiteNumberOrNull(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function stringOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Compare persisted draft echo vs current adjusted-mode echo.
 * Does not mutate quantities, write DB, or trigger refresh.
 */
export function compareAdjustedQuantityResolutionEcho(
  input: CompareAdjustedQuantityResolutionEchoInput
): QuantityResolutionEchoStalenessResult {
  const current =
    input.currentEcho == null ? null : ({ ...input.currentEcho } as AdjustedQuantityResolutionEcho);

  if (input.persistedEcho == null) {
    return {
      status: "unknown",
      reasons: ["missing_persisted_echo"],
      previous: null,
      current,
    };
  }

  if (!isPlainObject(input.persistedEcho)) {
    return {
      status: "unknown",
      reasons: ["malformed_persisted_echo"],
      previous: null,
      current,
    };
  }

  const previous = { ...input.persistedEcho };

  if (current == null) {
    return {
      status: "unknown",
      reasons: ["missing_current_echo"],
      previous,
      current: null,
    };
  }

  if (input.currentPreviewUnresolved === true) {
    return {
      status: "unknown",
      reasons: ["current_unresolved"],
      previous,
      current,
    };
  }

  const reasons: QuantityResolutionEchoStalenessReason[] = [];

  const previousMode = stringOrNull(previous.quantity_mode);
  if (previousMode == null) {
    return {
      status: "unknown",
      reasons: ["malformed_persisted_echo"],
      previous,
      current,
    };
  }
  if (previousMode !== current.quantity_mode) {
    reasons.push("quantity_mode_mismatch");
  }

  const previousRounding = stringOrNull(previous.rounding_mode_used);
  if (previousRounding != null && previousRounding !== "exact") {
    reasons.push("rounding_mode_mismatch");
  } else if (
    previousRounding != null &&
    previousRounding !== current.rounding_mode_used
  ) {
    reasons.push("rounding_mode_mismatch");
  }

  if (previous.coverage_rate_used != null) {
    reasons.push("coverage_rate_used_non_null");
  }
  if (previous.waste_pct_used != null) {
    reasons.push("waste_pct_used_non_null");
  }

  const previousSourceKey = stringOrNull(previous.source_measurement_key);
  const currentSourceKey = stringOrNull(current.source_measurement_key);
  if (previousSourceKey != null && currentSourceKey != null) {
    if (previousSourceKey !== currentSourceKey) {
      reasons.push("source_measurement_key_mismatch");
    }
  }

  const previousSourceValue = finiteNumberOrNull(previous.source_measurement_value);
  const currentSourceValue = finiteNumberOrNull(current.source_measurement_value);
  // Only compare when both sides honestly know a source value (not fixed/multiplier nulls).
  if (previousSourceValue != null && currentSourceValue != null) {
    if (previousSourceValue !== currentSourceValue) {
      reasons.push("source_measurement_value_mismatch");
    }
  }

  const previousQty = finiteNumberOrNull(previous.resolved_purchase_quantity);
  const currentQty = finiteNumberOrNull(current.resolved_purchase_quantity);
  if (previousQty != null && currentQty != null) {
    if (previousQty !== currentQty) {
      reasons.push("resolved_purchase_quantity_mismatch");
    }
  }

  if (reasons.length > 0) {
    return { status: "stale", reasons, previous, current };
  }

  return { status: "current", reasons: [], previous, current };
}

/**
 * Compare persisted echo vs current raw_plus_waste echo (policy-gated path).
 * Allows matching non-null coverage/waste when both sides are raw_plus_waste.
 * Used by inspection/preflight when wasteModel === "raw_plus_waste".
 */
export function compareRawPlusWasteQuantityResolutionEcho(
  input: CompareRawPlusWasteQuantityResolutionEchoInput
): QuantityResolutionEchoStalenessResultRaw {
  const current =
    input.currentEcho == null
      ? null
      : ({ ...input.currentEcho } as RawPlusWasteQuantityResolutionEcho);

  if (input.persistedEcho == null) {
    return {
      status: "unknown",
      reasons: ["missing_persisted_echo"],
      previous: null,
      current,
    };
  }

  if (!isPlainObject(input.persistedEcho)) {
    return {
      status: "unknown",
      reasons: ["malformed_persisted_echo"],
      previous: null,
      current,
    };
  }

  const previous = { ...input.persistedEcho };

  if (current == null) {
    return {
      status: "unknown",
      reasons: ["missing_current_echo"],
      previous,
      current: null,
    };
  }

  if (input.currentPreviewUnresolved === true) {
    return {
      status: "unknown",
      reasons: ["current_unresolved"],
      previous,
      current,
    };
  }

  const reasons: QuantityResolutionEchoStalenessReason[] = [];

  const previousMode = stringOrNull(previous.quantity_mode);
  if (previousMode == null) {
    return {
      status: "unknown",
      reasons: ["malformed_persisted_echo"],
      previous,
      current,
    };
  }
  if (previousMode !== current.quantity_mode) {
    reasons.push("quantity_mode_mismatch");
  }

  const previousRounding = stringOrNull(previous.rounding_mode_used);
  if (previousRounding != null && previousRounding !== "exact") {
    reasons.push("rounding_mode_mismatch");
  } else if (
    previousRounding != null &&
    previousRounding !== current.rounding_mode_used
  ) {
    reasons.push("rounding_mode_mismatch");
  }

  // Raw mode: non-null coverage/waste are valid; mismatch when values differ.
  const previousCoverage = finiteNumberOrNull(previous.coverage_rate_used);
  const currentCoverage = finiteNumberOrNull(current.coverage_rate_used);
  if (previousCoverage !== currentCoverage) {
    reasons.push("coverage_rate_used_mismatch");
  }

  const previousWaste = finiteNumberOrNull(previous.waste_pct_used);
  const currentWaste = finiteNumberOrNull(current.waste_pct_used);
  if (previousWaste !== currentWaste) {
    reasons.push("waste_pct_used_mismatch");
  }

  const previousSourceKey = stringOrNull(previous.source_measurement_key);
  const currentSourceKey = stringOrNull(current.source_measurement_key);
  if (previousSourceKey != null && currentSourceKey != null) {
    if (previousSourceKey !== currentSourceKey) {
      reasons.push("source_measurement_key_mismatch");
    }
  }

  const previousSourceValue = finiteNumberOrNull(previous.source_measurement_value);
  const currentSourceValue = finiteNumberOrNull(current.source_measurement_value);
  if (previousSourceValue != null && currentSourceValue != null) {
    if (previousSourceValue !== currentSourceValue) {
      reasons.push("source_measurement_value_mismatch");
    }
  }

  const previousQty = finiteNumberOrNull(previous.resolved_purchase_quantity);
  const currentQty = finiteNumberOrNull(current.resolved_purchase_quantity);
  if (previousQty != null && currentQty != null) {
    if (previousQty !== currentQty) {
      reasons.push("resolved_purchase_quantity_mismatch");
    }
  }

  if (reasons.length > 0) {
    return { status: "stale", reasons, previous, current };
  }

  return { status: "current", reasons: [], previous, current };
}
