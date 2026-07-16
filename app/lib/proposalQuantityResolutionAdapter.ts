/**
 * S3D1/S3D2/S3D3 — quantity resolution adapter.
 *
 * S3D1: wraps resolveProposalLineQuantity without changing math/labels.
 * S3D2: computes internal adjusted-mode quantity_resolution_echo metadata.
 * S3D3: draft create/refresh may persist the echo; quantities stay resolver/mapper-owned.
 *
 * Do not import into pricing engine math. Do not enable raw_plus_waste.
 * Do not import catalogQuantityMode into production resolve paths yet.
 * Phase 2 disabled/test-only raw branch lives in
 * proposalQuantityResolutionDisabledRawBranch.ts (unwired from this adapter).
 * Customer/public DTOs must omit quantity_resolution_echo.
 */

import type { QuantitySource } from "@/app/lib/catalogTypes";
import {
  resolveProposalLineQuantity,
  type ProposalQuantityPreview,
  type ProposalQuantityResolverInput,
} from "@/app/lib/proposalQuantityResolver";

/** Production-supported mode stamped by this adapter (metadata only). */
export type AdapterQuantityMode = "adjusted_measurement";

/**
 * Internal adjusted-mode echo shape (S1E / S3D2).
 * Not customer-facing. Not persisted in S3D2.
 */
export type AdjustedQuantityResolutionEcho = {
  quantity_mode: AdapterQuantityMode;
  source_measurement_key: QuantitySource | null;
  /**
   * Pre-multiplier measurement value when the existing preview can prove it.
   * Null for unresolved, fixed, multiplier, or when value cannot be proven
   * without changing resolver math.
   */
  source_measurement_value: number | null;
  coverage_rate_used: null;
  waste_pct_used: null;
  rounding_mode_used: "exact";
  resolved_purchase_quantity: number | null;
};

export type ProposalQuantityResolutionAdapterResult = {
  /** Exact output of resolveProposalLineQuantity — not mutated. */
  preview: ProposalQuantityPreview;
  /** Metadata only; does not change resolve behavior. */
  quantityMode: AdapterQuantityMode;
  /** Internal echo — draft persist only in S3D3; never customer/public. */
  quantityResolutionEcho: AdjustedQuantityResolutionEcho;
};

/**
 * Align echo purchase qty with the quantity that will be persisted.
 * Does not change that quantity. Clears source_measurement_value when the
 * persisted qty cannot be proven as a direct measurement passthrough.
 */
export function alignAdjustedEchoToPersistedQuantity(
  echo: AdjustedQuantityResolutionEcho,
  persistedQuantity: number | null | undefined,
  options?: { clearSourceMeasurementValue?: boolean }
): AdjustedQuantityResolutionEcho {
  const qty =
    persistedQuantity != null && Number.isFinite(persistedQuantity)
      ? persistedQuantity
      : null;
  const clearSource =
    options?.clearSourceMeasurementValue === true ||
    qty == null ||
    qty !== echo.resolved_purchase_quantity ||
    echo.source_measurement_value == null;

  return {
    ...echo,
    resolved_purchase_quantity: qty,
    source_measurement_value: clearSource ? null : echo.source_measurement_value,
  };
}

function isMultiplierRule(input: ProposalQuantityResolverInput): boolean {
  return input.templateItem.quantity_rule?.mode === "multiplier";
}

function isFixedSource(preview: ProposalQuantityPreview): boolean {
  return preview.sourceKey === "fixed" || preview.status === "fixed_quantity";
}

/**
 * Build adjusted-mode echo from an existing resolver preview.
 * Does not re-resolve quantity. Does not apply coverage or waste.
 */
export function buildAdjustedQuantityResolutionEcho(
  preview: ProposalQuantityPreview,
  input: ProposalQuantityResolverInput
): AdjustedQuantityResolutionEcho {
  const resolvedPurchaseQuantity =
    !preview.unresolved && preview.quantity != null && Number.isFinite(preview.quantity)
      ? preview.quantity
      : null;

  // Resolver preview does not expose pre-multiplier source value. Only use
  // resolved quantity as source_measurement_value when it is a direct
  // measurement passthrough (not fixed, not multiplier).
  let sourceMeasurementValue: number | null = null;
  if (
    resolvedPurchaseQuantity != null &&
    !isMultiplierRule(input) &&
    !isFixedSource(preview)
  ) {
    sourceMeasurementValue = resolvedPurchaseQuantity;
  }

  return {
    quantity_mode: "adjusted_measurement",
    source_measurement_key: preview.sourceKey,
    source_measurement_value: sourceMeasurementValue,
    coverage_rate_used: null,
    waste_pct_used: null,
    rounding_mode_used: "exact",
    resolved_purchase_quantity: resolvedPurchaseQuantity,
  };
}

/**
 * Resolve line quantity via the existing resolver and return an identical preview
 * plus adjusted_measurement mode metadata and internal echo (not persisted).
 */
export function resolveProposalLineQuantityViaAdapter(
  input: ProposalQuantityResolverInput
): ProposalQuantityResolutionAdapterResult {
  const preview = resolveProposalLineQuantity(input);
  return {
    preview,
    quantityMode: "adjusted_measurement",
    quantityResolutionEcho: buildAdjustedQuantityResolutionEcho(preview, input),
  };
}
