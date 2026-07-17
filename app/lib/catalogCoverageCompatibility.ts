/**
 * Catalog coverage / coverage_basis compatibility classifier.
 *
 * coverage_basis is the measurement-side unit of the coverage divisor.
 * Do not use purchase unit as a proxy for basis.
 *
 * Compatibility is a trust/setup gate — not a second math engine.
 * adjusted_measurement still ignores coverage/waste.
 * Raw mode switch remains blocked until status is compatible.
 */

import type { CatalogUnit, CoverageBasis, QuantitySource } from "@/app/lib/catalogTypes";

export type CatalogCoverageCompatibilityStatus =
  | "compatible"
  | "not_applicable"
  | "not_verified"
  | "incompatible";

export type CatalogCoverageCompatibilityInput = {
  quantity_source: QuantitySource;
  unit: CatalogUnit;
  coverage_rate: number | null | undefined;
  coverage_basis?: CoverageBasis | null;
  waste_applies?: boolean | null;
  waste_pct?: number | null;
};

type CoverageBasisCategory =
  | "roof_square"
  | "square_feet"
  | "linear_feet"
  | "each"
  | "tons";

/**
 * Map quantity source → measurement category for coverage_basis matching.
 * adjusted_roof_squares is treated as roof_square because the approved raw path
 * remaps it to roof_squares (never treats adjusted values as raw proof).
 */
export function coverageBasisCategoryForQuantitySource(
  source: QuantitySource
): CoverageBasisCategory | "unmapped" | "fixed" {
  if (source === "fixed") return "fixed";
  if (
    source === "roof_squares" ||
    source === "tear_off_squares" ||
    source === "adjusted_roof_squares"
  ) {
    return "roof_square";
  }
  if (source === "roof_area_sqft") return "square_feet";
  if (source === "debris_tons") return "tons";
  if (source.endsWith("_lf")) return "linear_feet";
  if (source.endsWith("_count")) return "each";
  // custom / labor_multiplier / unknown
  return "unmapped";
}

/**
 * Classify whether coverage + basis can be treated as dimensionally verified.
 *
 * - null coverage → not_applicable
 * - coverage > 0 + null basis → not_verified
 * - fixed source + non-null coverage → incompatible
 * - source/basis same category → compatible
 * - source/basis mismatch → incompatible
 * - custom / labor_multiplier / unmapped → not_verified
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

  const basis = input.coverage_basis ?? null;
  if (basis == null) {
    return "not_verified";
  }

  const sourceCategory = coverageBasisCategoryForQuantitySource(input.quantity_source);
  if (sourceCategory === "fixed") {
    return "incompatible";
  }
  if (sourceCategory === "unmapped") {
    return "not_verified";
  }
  if (sourceCategory === basis) {
    return "compatible";
  }
  return "incompatible";
}

export function catalogCoverageCompatibilityBlocksRawModeSwitch(
  status: CatalogCoverageCompatibilityStatus
): boolean {
  return status === "not_verified" || status === "incompatible";
}

export function catalogCoverageCompatibilityLabel(
  status: CatalogCoverageCompatibilityStatus
): string | null {
  switch (status) {
    case "compatible":
      return "Compatible";
    case "not_verified":
      return "Not verified";
    case "incompatible":
      return "Incompatible";
    case "not_applicable":
      return null;
    default:
      return null;
  }
}
