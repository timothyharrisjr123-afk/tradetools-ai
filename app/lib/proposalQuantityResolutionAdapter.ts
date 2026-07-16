/**
 * Quantity resolution adapter — adjusted default + policy-gated raw_plus_waste.
 *
 * adjusted_measurement (default): wraps resolveProposalLineQuantity; echo has
 * null coverage/waste. Golden identity with the resolver remains unchanged.
 *
 * raw_plus_waste: only when options.wasteModel === "raw_plus_waste". Uses proven
 * raw measurement source + catalog coverage/waste via catalogQuantityMode.
 * Never uses adjusted_roof_squares as a raw source.
 *
 * Do not import into pricing engine math. Customer/public DTOs must omit echo.
 * raw_plus_waste activates only when options.wasteModel === "raw_plus_waste".
 */

import {
  resolveRawPlusWasteQuantity,
} from "@/app/lib/catalogQuantityMode";
import type { CatalogItem, QuantitySource } from "@/app/lib/catalogTypes";
import { quantitySourceLabel, catalogUnitLabel } from "@/app/lib/catalogTypes";
import type { ProposalQuantitySummary } from "@/app/lib/measurementProposalHandoff";
import type { RawPlusWasteQuantityResolutionEcho } from "@/app/lib/proposalQuantityResolutionDisabledRawBranch";
import {
  resolveProposalLineQuantity,
  type ProposalQuantityPreview,
  type ProposalQuantityResolverInput,
} from "@/app/lib/proposalQuantityResolver";
import type { WasteModel } from "@/app/lib/proposalPricingTypes";
import type { TemplateQuantityRule } from "@/app/lib/proposalTemplateTypes";

/** Modes this adapter may stamp (metadata + quantity path). */
export type AdapterQuantityMode = "adjusted_measurement" | "raw_plus_waste";

/**
 * Internal adjusted-mode echo shape (S1E / S3D2).
 * Not customer-facing.
 */
export type AdjustedQuantityResolutionEcho = {
  quantity_mode: "adjusted_measurement";
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

export type QuantityResolutionEcho =
  | AdjustedQuantityResolutionEcho
  | RawPlusWasteQuantityResolutionEcho;

export type ProposalQuantityResolutionAdapterOptions = {
  /**
   * From company pricing policy. Default / omitted = adjusted_measurement.
   * raw_plus_waste activates the raw branch only when explicitly selected.
   */
  wasteModel?: WasteModel | null;
};

export type ProposalQuantityResolutionAdapterResult = {
  preview: ProposalQuantityPreview;
  quantityMode: AdapterQuantityMode;
  quantityResolutionEcho: QuantityResolutionEcho;
};

/**
 * Align echo purchase qty with the quantity that will be persisted.
 * Does not change that quantity. Clears source_measurement_value when the
 * persisted qty cannot be proven as a direct measurement passthrough.
 * Preserves raw coverage/waste drivers.
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

export function alignQuantityResolutionEchoToPersistedQuantity(
  echo: QuantityResolutionEcho,
  persistedQuantity: number | null | undefined,
  options?: { clearSourceMeasurementValue?: boolean }
): QuantityResolutionEcho {
  if (echo.quantity_mode === "raw_plus_waste") {
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
  return alignAdjustedEchoToPersistedQuantity(echo, persistedQuantity, options);
}

function isMultiplierRule(input: ProposalQuantityResolverInput): boolean {
  return input.templateItem.quantity_rule?.mode === "multiplier";
}

function isFixedSource(preview: ProposalQuantityPreview): boolean {
  return preview.sourceKey === "fixed" || preview.status === "fixed_quantity";
}

function finiteOrNull(value: number | null | undefined): number | null {
  return value != null && Number.isFinite(value) ? value : null;
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

function resolveEffectiveSource(
  rule: TemplateQuantityRule | null | undefined,
  catalog: CatalogItem
): QuantitySource | null {
  const mode = rule?.mode ?? "inherit_catalog";
  if (mode === "fixed") return "fixed";
  if (mode === "measurement" && rule?.quantity_source) return rule.quantity_source;
  if (mode === "multiplier") {
    if (rule?.quantity_source) return rule.quantity_source;
    return catalog.quantity_source;
  }
  return catalog.quantity_source;
}

function resolveFixedQuantity(
  rule: TemplateQuantityRule | null | undefined,
  catalog: CatalogItem
): number | null {
  const fromRule = finiteOrNull(rule?.fixed_quantity);
  if (fromRule != null) return fromRule;
  const fromCatalog = finiteOrNull(catalog.default_quantity);
  if (fromCatalog != null) return fromCatalog;
  if (catalog.quantity_source === "fixed") return 1;
  return null;
}

/** Proven raw lookup from handoff summary only (never quantity-map conflation). */
function lookupRawFromSummary(
  source: QuantitySource,
  quantities: ProposalQuantitySummary
): number | null {
  switch (source) {
    case "roof_squares":
      return finiteOrNull(quantities.roof_squares);
    case "roof_area_sqft":
      return finiteOrNull(quantities.roof_area_sqft);
    case "eaves_lf":
      return finiteOrNull(quantities.eaves_lf);
    case "rakes_lf":
      return finiteOrNull(quantities.rakes_lf);
    case "ridges_lf":
      return finiteOrNull(quantities.ridges_lf);
    case "hips_lf":
      return finiteOrNull(quantities.hips_lf);
    case "valleys_lf":
      return finiteOrNull(quantities.valleys_lf);
    case "wall_flashing_lf":
      return finiteOrNull(quantities.wall_flashing_lf);
    case "step_flashing_lf":
      return finiteOrNull(quantities.step_flashing_lf);
    case "transitions_lf":
      return finiteOrNull(quantities.transitions_lf);
    case "parapet_wall_lf":
      return finiteOrNull(quantities.parapet_wall_lf);
    case "drip_edge_lf":
      return finiteOrNull(quantities.drip_edge_lf);
    case "starter_lf":
      return finiteOrNull(quantities.starter_lf);
    case "ridge_cap_lf":
      return finiteOrNull(quantities.ridge_cap_lf);
    case "pipe_boots_count":
      return finiteOrNull(quantities.pipe_boots_count);
    case "vents_count":
      return finiteOrNull(quantities.vents_count);
    case "skylights_count":
      return finiteOrNull(quantities.skylights_count);
    case "chimneys_count":
      return finiteOrNull(quantities.chimneys_count);
    case "satellite_dishes_count":
      return finiteOrNull(quantities.satellite_dishes_count);
    default:
      return null;
  }
}

export type ProvenRawSource = {
  sourceMeasurementKey: QuantitySource | null;
  rawSourceQuantity: number | null;
  sourceAlreadyAdjusted: boolean;
};

/**
 * Prove a raw (pre-waste) source for raw_plus_waste.
 * Remaps adjusted_roof_squares → roof_squares from handoff summary only.
 * Never treats adjusted_roof_squares values as raw proof.
 */
export function proveRawSourceQuantityForAdapter(
  input: ProposalQuantityResolverInput
): ProvenRawSource {
  const catalog = input.catalogItem;
  if (catalog == null) {
    return {
      sourceMeasurementKey: null,
      rawSourceQuantity: null,
      sourceAlreadyAdjusted: false,
    };
  }

  const rule = input.templateItem.quantity_rule;
  const mode = rule?.mode ?? "inherit_catalog";

  if (mode === "fixed" || catalog.quantity_source === "fixed") {
    return {
      sourceMeasurementKey: "fixed",
      rawSourceQuantity: resolveFixedQuantity(rule, catalog),
      sourceAlreadyAdjusted: false,
    };
  }

  const effective = resolveEffectiveSource(rule, catalog);
  if (effective == null || effective === "custom" || effective === "labor_multiplier") {
    return {
      sourceMeasurementKey: effective,
      rawSourceQuantity: null,
      sourceAlreadyAdjusted: false,
    };
  }

  if (effective === "fixed") {
    return {
      sourceMeasurementKey: "fixed",
      rawSourceQuantity: resolveFixedQuantity(rule, catalog),
      sourceAlreadyAdjusted: false,
    };
  }

  const quantities = input.measurementHandoff?.quantities;

  if (effective === "adjusted_roof_squares") {
    const rawSquares = quantities ? finiteOrNull(quantities.roof_squares) : null;
    if (rawSquares != null) {
      let value = rawSquares;
      if (mode === "multiplier") {
        const multiplier = finiteOrNull(rule?.quantity_multiplier);
        if (multiplier != null) value = value * multiplier;
      }
      return {
        sourceMeasurementKey: "roof_squares",
        rawSourceQuantity: value,
        sourceAlreadyAdjusted: false,
      };
    }
    const adjusted = quantities ? finiteOrNull(quantities.adjusted_roof_squares) : null;
    if (adjusted != null) {
      return {
        sourceMeasurementKey: "adjusted_roof_squares",
        rawSourceQuantity: adjusted,
        sourceAlreadyAdjusted: true,
      };
    }
    return {
      sourceMeasurementKey: "roof_squares",
      rawSourceQuantity: null,
      sourceAlreadyAdjusted: false,
    };
  }

  if (!quantities) {
    return {
      sourceMeasurementKey: effective,
      rawSourceQuantity: null,
      sourceAlreadyAdjusted: false,
    };
  }

  let value = lookupRawFromSummary(effective, quantities);
  if (value != null && mode === "multiplier") {
    const multiplier = finiteOrNull(rule?.quantity_multiplier);
    if (multiplier != null) value = value * multiplier;
  }

  return {
    sourceMeasurementKey: effective,
    rawSourceQuantity: value,
    sourceAlreadyAdjusted: false,
  };
}

function formatQuantityValue(quantity: number, unit: CatalogItem["unit"]): string {
  const rounded =
    unit === "each" || unit === "fixed"
      ? quantity.toFixed(0)
      : quantity.toFixed(1).replace(/\.0$/, "");
  switch (unit) {
    case "square":
      return `${rounded} SQ`;
    case "sqft":
      return `${quantity.toLocaleString(undefined, { maximumFractionDigits: 1 })} sq ft`;
    case "linear_foot":
      return `${rounded} LF`;
    case "each":
      return `${rounded} each`;
    case "fixed":
      return rounded;
    case "bundle":
      return `${rounded} bundle${quantity === 1 ? "" : "s"}`;
    case "hour":
      return `${rounded} hr`;
    case "day":
      return `${rounded} day${quantity === 1 ? "" : "s"}`;
    case "allowance":
      return rounded;
    default:
      return `${rounded} ${catalogUnitLabel(unit).toLowerCase()}`;
  }
}

function unresolvedRawPreview(
  input: ProposalQuantityResolverInput,
  sourceKey: QuantitySource | null,
  statusLabel: string
): ProposalQuantityPreview {
  const sourceLabel = sourceKey ? quantitySourceLabel(sourceKey) : "—";
  return {
    status: "missing_quantity_field",
    quantity: null,
    quantityDisplayLabel: "Not resolved",
    sourceKey,
    sourceLabel,
    ruleLabel: input.templateItem.quantity_rule?.mode
      ? String(input.templateItem.quantity_rule.mode)
      : "—",
    statusLabel,
    unresolved: true,
  };
}

function resolveRawPlusWasteViaAdapter(
  input: ProposalQuantityResolverInput
): ProposalQuantityResolutionAdapterResult {
  const catalog = input.catalogItem;
  if (catalog == null) {
    const preview = resolveProposalLineQuantity(input);
    return {
      preview,
      quantityMode: "raw_plus_waste",
      quantityResolutionEcho: {
        quantity_mode: "raw_plus_waste",
        source_measurement_key: null,
        source_measurement_value: null,
        coverage_rate_used: null,
        waste_pct_used: null,
        rounding_mode_used: "exact",
        resolved_purchase_quantity: null,
      },
    };
  }

  const proven = proveRawSourceQuantityForAdapter(input);
  const wasteApplies = catalog.waste_applies === true;

  const helper = resolveRawPlusWasteQuantity({
    sourceQuantity: proven.rawSourceQuantity,
    sourceAlreadyAdjusted: proven.sourceAlreadyAdjusted,
    coverage: { coverageRate: catalog.coverage_rate },
    waste: {
      wastePct: catalog.waste_pct,
      wasteApplies,
    },
    rounding: { mode: "exact" },
  });

  if (!helper.ok) {
    const preview = unresolvedRawPreview(
      input,
      proven.sourceMeasurementKey,
      helper.message
    );
    return {
      preview,
      quantityMode: "raw_plus_waste",
      quantityResolutionEcho: {
        quantity_mode: "raw_plus_waste",
        source_measurement_key: proven.sourceMeasurementKey,
        source_measurement_value:
          proven.sourceAlreadyAdjusted === true
            ? null
            : proven.rawSourceQuantity != null && Number.isFinite(proven.rawSourceQuantity)
              ? proven.rawSourceQuantity
              : null,
        coverage_rate_used: null,
        waste_pct_used: null,
        rounding_mode_used: "exact",
        resolved_purchase_quantity: null,
      },
    };
  }

  const preview: ProposalQuantityPreview = {
    status: proven.sourceMeasurementKey === "fixed" ? "fixed_quantity" : "resolved",
    quantity: helper.resolvedQuantity,
    quantityDisplayLabel: formatQuantityValue(helper.resolvedQuantity, catalog.unit),
    sourceKey: proven.sourceMeasurementKey,
    sourceLabel: proven.sourceMeasurementKey
      ? quantitySourceLabel(proven.sourceMeasurementKey)
      : "—",
    ruleLabel: "raw_plus_waste",
    statusLabel: "Resolved via raw + coverage + waste",
    unresolved: false,
  };

  const echo: RawPlusWasteQuantityResolutionEcho = {
    quantity_mode: "raw_plus_waste",
    source_measurement_key: proven.sourceMeasurementKey,
    source_measurement_value: helper.sourceQuantity,
    coverage_rate_used: helper.coverageRateUsed,
    waste_pct_used: helper.wastePctUsed,
    rounding_mode_used: "exact",
    resolved_purchase_quantity: helper.resolvedQuantity,
  };

  return {
    preview,
    quantityMode: "raw_plus_waste",
    quantityResolutionEcho: echo,
  };
}

/**
 * Resolve line quantity + internal echo.
 * Default (omit wasteModel / adjusted_measurement): identical to historical
 * adjusted adapter behavior.
 * raw_plus_waste: policy-gated raw source → coverage → waste → exact.
 */
export function resolveProposalLineQuantityViaAdapter(
  input: ProposalQuantityResolverInput,
  options?: ProposalQuantityResolutionAdapterOptions
): ProposalQuantityResolutionAdapterResult {
  if (options?.wasteModel === "raw_plus_waste") {
    return resolveRawPlusWasteViaAdapter(input);
  }

  const preview = resolveProposalLineQuantity(input);
  return {
    preview,
    quantityMode: "adjusted_measurement",
    quantityResolutionEcho: buildAdjustedQuantityResolutionEcho(preview, input),
  };
}

/** Infer waste model from draft version policy_echo (no UI required). */
export function wasteModelFromPolicyEcho(policyEcho: unknown): WasteModel {
  if (
    policyEcho != null &&
    typeof policyEcho === "object" &&
    !Array.isArray(policyEcho) &&
    (policyEcho as { waste_model?: unknown }).waste_model === "raw_plus_waste"
  ) {
    return "raw_plus_waste";
  }
  return "adjusted_measurement";
}
