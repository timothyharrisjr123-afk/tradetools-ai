/**
 * Phase 2 helper — stand-alone raw_plus_waste quantity branch fixtures.
 *
 * Phase 5 production path uses resolveProposalLineQuantityViaAdapter({ wasteModel:
 * "raw_plus_waste" }) instead of importing this module into create/refresh.
 * This file remains for focused fixture/tests and echo type export.
 *
 * RAW_PLUS_WASTE_PRODUCTION_ENABLED stays false (not a global enable switch).
 */

import {
  DEFAULT_QUANTITY_MODE,
  resolveRawPlusWasteQuantity,
  type QuantityModeViolation,
  type QuantityRoundingMode,
} from "@/app/lib/catalogQuantityMode";
import type { QuantitySource } from "@/app/lib/catalogTypes";
import {
  resolveProposalLineQuantity,
  type ProposalQuantityPreview,
  type ProposalQuantityResolverInput,
} from "@/app/lib/proposalQuantityResolver";

/** Always false — this module never enables production raw_plus_waste. */
export const RAW_PLUS_WASTE_PRODUCTION_ENABLED = false as const;

export type RawPlusWasteQuantityResolutionEcho = {
  quantity_mode: "raw_plus_waste";
  source_measurement_key: QuantitySource | string | null;
  source_measurement_value: number | null;
  coverage_rate_used: number | null;
  waste_pct_used: number | null;
  rounding_mode_used: "exact";
  resolved_purchase_quantity: number | null;
};

export type DisabledRawPlusWasteBranchInput = {
  /**
   * Proven raw (pre-waste) measurement quantity.
   * Do not pass adjusted_roof_squares / already-wasted values.
   */
  rawSourceQuantity: number | null | undefined;
  /** When true, source is known already-adjusted → double_waste_risk. */
  sourceAlreadyAdjusted?: boolean;
  sourceMeasurementKey?: QuantitySource | string | null;
  coverageRate?: number | null;
  wastePct?: number | null;
  /** Default true for materials; labor/fees should pass false. */
  wasteApplies?: boolean;
  roundingMode?: QuantityRoundingMode;
};

export type DisabledRawPlusWasteBranchSuccess = {
  ok: true;
  productionEnabled: false;
  quantityMode: "raw_plus_waste";
  resolvedQuantity: number;
  quantityResolutionEcho: RawPlusWasteQuantityResolutionEcho;
  notes: string[];
};

export type DisabledRawPlusWasteBranchFailure = QuantityModeViolation & {
  productionEnabled: false;
  quantityMode: "raw_plus_waste";
  quantityResolutionEcho: null;
};

export type DisabledRawPlusWasteBranchResult =
  | DisabledRawPlusWasteBranchSuccess
  | DisabledRawPlusWasteBranchFailure;

/**
 * Disabled-branch raw_plus_waste resolve: source → coverage → waste → exact.
 * Never production-enabled. Requires proven raw source.
 */
export function resolveDisabledRawPlusWasteQuantityBranch(
  input: DisabledRawPlusWasteBranchInput
): DisabledRawPlusWasteBranchResult {
  const wasteApplies = input.wasteApplies !== false;
  const helper = resolveRawPlusWasteQuantity({
    sourceQuantity: input.rawSourceQuantity,
    sourceAlreadyAdjusted: input.sourceAlreadyAdjusted,
    coverage: { coverageRate: input.coverageRate },
    waste: {
      wastePct: input.wastePct,
      wasteApplies,
    },
    rounding: { mode: input.roundingMode ?? "exact" },
  });

  if (!helper.ok) {
    return {
      ...helper,
      productionEnabled: false,
      quantityMode: "raw_plus_waste",
      quantityResolutionEcho: null,
    };
  }

  const echo: RawPlusWasteQuantityResolutionEcho = {
    quantity_mode: "raw_plus_waste",
    source_measurement_key: input.sourceMeasurementKey ?? null,
    source_measurement_value: helper.sourceQuantity,
    coverage_rate_used: helper.coverageRateUsed,
    waste_pct_used: helper.wastePctUsed,
    rounding_mode_used: "exact",
    resolved_purchase_quantity: helper.resolvedQuantity,
  };

  return {
    ok: true,
    productionEnabled: false,
    quantityMode: "raw_plus_waste",
    resolvedQuantity: helper.resolvedQuantity,
    quantityResolutionEcho: echo,
    notes: [
      ...(helper.notes ?? []),
      "disabled branch; not reachable via live company policy",
    ],
  };
}

export type DisabledRawBranchAdapterResult = {
  /** Unchanged production resolver preview (adjusted path identity). */
  preview: ProposalQuantityPreview;
  /** Always adjusted_measurement — production adapter path unchanged. */
  productionQuantityMode: typeof DEFAULT_QUANTITY_MODE;
  /** Disabled raw branch result (may fail). */
  disabledRawBranch: DisabledRawPlusWasteBranchResult;
  /** Always false. */
  productionEnabled: false;
};

/**
 * Test-only composition: keep production resolver preview identity, and
 * separately compute a disabled raw_plus_waste branch from proven raw inputs.
 * Does not replace or mutate the adjusted adapter path.
 */
export function resolveProposalLineQuantityWithDisabledRawBranch(
  resolverInput: ProposalQuantityResolverInput,
  rawInput: DisabledRawPlusWasteBranchInput
): DisabledRawBranchAdapterResult {
  const preview = resolveProposalLineQuantity(resolverInput);
  return {
    preview,
    productionQuantityMode: DEFAULT_QUANTITY_MODE,
    disabledRawBranch: resolveDisabledRawPlusWasteQuantityBranch(rawInput),
    productionEnabled: false,
  };
}
