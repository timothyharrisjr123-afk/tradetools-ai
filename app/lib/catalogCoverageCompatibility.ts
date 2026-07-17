/**
 * Catalog coverage/unit compatibility classifier (P1 guardrail).
 *
 * The current schema has coverage_rate but no coverage_basis / dimensional unit.
 * This helper must not invent conversion truth. When coverage is set, status is
 * not_verified unless a clear incompatibility can be proven from existing fields.
 *
 * Does not block adjusted-mode Catalog saves. Raw mode switch remains deferred
 * until product-approved dimensional verification exists.
 */

import type { CatalogUnit, QuantitySource } from "@/app/lib/catalogTypes";

export type CatalogCoverageCompatibilityStatus =
  | "compatible"
  | "not_applicable"
  | "not_verified"
  | "incompatible";

export type CatalogCoverageCompatibilityInput = {
  quantity_source: QuantitySource;
  unit: CatalogUnit;
  coverage_rate: number | null | undefined;
  waste_applies?: boolean | null;
  waste_pct?: number | null;
};

/**
 * Classify whether coverage can be treated as dimensionally verified.
 *
 * - null/empty coverage → not_applicable (1:1 / no conversion)
 * - coverage on fixed quantity sources → incompatible (coverage cannot convert a fixed qty)
 * - any other non-null coverage → not_verified (no coverage_basis in schema)
 * - never returns compatible until dimensional basis exists
 */
export function classifyCatalogCoverageCompatibility(
  input: CatalogCoverageCompatibilityInput
): CatalogCoverageCompatibilityStatus {
  const coverage =
    input.coverage_rate != null && Number.isFinite(input.coverage_rate)
      ? input.coverage_rate
      : null;

  if (coverage == null) {
    return "not_applicable";
  }

  if (coverage <= 0) {
    return "incompatible";
  }

  if (input.quantity_source === "fixed") {
    return "incompatible";
  }

  // Schema cannot prove that coverage units match the measurement source or
  // purchase unit (no coverage_basis). Do not pretend compatibility.
  return "not_verified";
}

export function catalogCoverageCompatibilityBlocksRawModeSwitch(
  status: CatalogCoverageCompatibilityStatus
): boolean {
  return status === "not_verified" || status === "incompatible";
}
