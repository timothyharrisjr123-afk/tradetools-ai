/**
 * Pure read-only proposal line quantity resolver (3H-3).
 *
 * Answers: given job measurement + catalog item + template line rule,
 * what quantity would this proposal line use?
 *
 * No pricing, persistence, Supabase, React, or rounding settings.
 */

import type { CatalogItem, CatalogUnit, QuantitySource } from "@/app/lib/catalogTypes";
import { catalogUnitLabel, quantitySourceLabel } from "@/app/lib/catalogTypes";
import type { MeasurementProposalHandoff, ProposalQuantitySummary } from "@/app/lib/measurementProposalHandoff";
import type { MeasurementQuantityMap } from "@/app/lib/measurementTypes";
import type { ProposalTemplateItem, TemplateQuantityRule } from "@/app/lib/proposalTemplateTypes";
import { templateQuantityModeLabel } from "@/app/lib/proposalTemplateTypes";

export type ProposalQuantityResolveStatus =
  | "resolved"
  | "fixed_quantity"
  | "missing_measurement"
  | "missing_quantity_field"
  | "missing_catalog"
  | "unsupported_rule"
  | "manual_later";

export type ProposalQuantityPreview = {
  status: ProposalQuantityResolveStatus;
  quantity: number | null;
  quantityDisplayLabel: string;
  sourceKey: QuantitySource | null;
  sourceLabel: string;
  ruleLabel: string;
  statusLabel: string;
  unresolved: boolean;
};

export type ProposalQuantityResolverInput = {
  measurementHandoff: MeasurementProposalHandoff | null;
  quantityMap: MeasurementQuantityMap | null;
  catalogItem: CatalogItem | null;
  templateItem: ProposalTemplateItem;
};

function formatQuantityRuleLabel(rule: TemplateQuantityRule | null | undefined): string {
  if (!rule?.mode) return "—";
  let label = templateQuantityModeLabel(rule.mode);
  if (rule.measurement_quantity_key) {
    label += ` · ${rule.measurement_quantity_key}`;
  }
  if (rule.fixed_quantity != null && Number.isFinite(rule.fixed_quantity)) {
    label += ` · fixed ${rule.fixed_quantity}`;
  }
  if (rule.quantity_multiplier != null && Number.isFinite(rule.quantity_multiplier)) {
    label += ` · ×${rule.quantity_multiplier}`;
  }
  return label;
}

function finiteOrNull(value: number | null | undefined): number | null {
  return value != null && Number.isFinite(value) ? value : null;
}

function sumLf(...values: Array<number | null | undefined>): number | null {
  const nums = values.filter((v): v is number => v != null && Number.isFinite(v));
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0);
}

function formatQuantityValue(quantity: number, unit: CatalogUnit): string {
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

function lookupFromSummary(
  source: QuantitySource,
  quantities: ProposalQuantitySummary
): number | null {
  switch (source) {
    case "roof_squares":
      return finiteOrNull(quantities.roof_squares);
    case "adjusted_roof_squares":
      return finiteOrNull(quantities.adjusted_roof_squares);
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

function lookupFromQuantityMap(source: QuantitySource, map: MeasurementQuantityMap): number | null {
  switch (source) {
    case "starter_lf":
      return finiteOrNull(map.starter_lf);
    case "drip_edge_lf":
      return finiteOrNull(map.drip_edge_lf);
    case "ridge_cap_lf":
      return finiteOrNull(map.ridge_cap_lf);
    case "valleys_lf":
      return finiteOrNull(map.valley_flashing_lf);
    case "wall_flashing_lf":
      return finiteOrNull(map.wall_flashing_lf);
    case "step_flashing_lf":
      return finiteOrNull(map.step_flashing_lf);
    case "pipe_boots_count":
      return finiteOrNull(map.pipe_boots);
    case "vents_count":
      return finiteOrNull(map.vents);
    case "skylights_count":
      return finiteOrNull(map.skylights);
    case "chimneys_count":
      return finiteOrNull(map.chimneys);
    case "adjusted_roof_squares":
    case "roof_squares":
      return (
        finiteOrNull(map.shingles_squares) ??
        finiteOrNull(map.labor_squares)
      );
    case "tear_off_squares":
      return finiteOrNull(map.tear_off_squares);
    case "debris_tons":
      return finiteOrNull(map.debris_tons);
    default:
      return null;
  }
}

function lookupMeasurementQuantity(
  source: QuantitySource,
  handoff: MeasurementProposalHandoff,
  quantityMap: MeasurementQuantityMap | null
): number | null {
  const fromSummary = lookupFromSummary(source, handoff.quantities);
  if (fromSummary != null) return fromSummary;

  if (quantityMap) {
    const fromMap = lookupFromQuantityMap(source, quantityMap);
    if (fromMap != null) return fromMap;
  }

  const q = handoff.quantities;
  if (source === "starter_lf") {
    return sumLf(q.eaves_lf, q.rakes_lf);
  }
  if (source === "drip_edge_lf") {
    return sumLf(q.eaves_lf, q.rakes_lf);
  }
  if (source === "ridge_cap_lf") {
    return sumLf(q.ridges_lf, q.hips_lf);
  }

  return null;
}

function resolveEffectiveSource(
  rule: TemplateQuantityRule | null | undefined,
  catalog: CatalogItem
): QuantitySource | null {
  const mode = rule?.mode ?? "inherit_catalog";

  if (mode === "fixed") {
    return "fixed";
  }

  if (mode === "measurement" && rule?.quantity_source) {
    return rule.quantity_source;
  }

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

function buildStatusLabel(
  status: ProposalQuantityResolveStatus,
  sourceLabel: string,
  handoff: MeasurementProposalHandoff | null
): string {
  switch (status) {
    case "resolved":
      return "Resolved from selected measurement";
    case "fixed_quantity":
      return "Fixed quantity";
    case "manual_later":
      return "Resolved from selected measurement · editable on proposal later";
    case "missing_measurement":
      return handoff?.blockers[0] ?? "Save measurement first";
    case "missing_quantity_field":
      return `Needs measurement field: ${sourceLabel}`;
    case "missing_catalog":
      return "Missing catalog item";
    case "unsupported_rule":
      return "Quantity rule not supported in this preview";
    default:
      return "";
  }
}

function unsupportedPreview(
  rule: TemplateQuantityRule | null | undefined,
  reason: string
): ProposalQuantityPreview {
  return {
    status: "unsupported_rule",
    quantity: null,
    quantityDisplayLabel: "Not resolved",
    sourceKey: null,
    sourceLabel: reason,
    ruleLabel: formatQuantityRuleLabel(rule),
    statusLabel: "Quantity rule not supported in this preview",
    unresolved: true,
  };
}

export function resolveProposalLineQuantity(
  input: ProposalQuantityResolverInput
): ProposalQuantityPreview {
  const { measurementHandoff, quantityMap, catalogItem, templateItem } = input;
  const rule = templateItem.quantity_rule;

  if (!catalogItem) {
    return {
      status: "missing_catalog",
      quantity: null,
      quantityDisplayLabel: "Not resolved",
      sourceKey: null,
      sourceLabel: "—",
      ruleLabel: formatQuantityRuleLabel(rule),
      statusLabel: "Missing catalog item",
      unresolved: true,
    };
  }

  if (!measurementHandoff?.proposalReady) {
    return {
      status: "missing_measurement",
      quantity: null,
      quantityDisplayLabel: "Not resolved",
      sourceKey: catalogItem.quantity_source,
      sourceLabel: quantitySourceLabel(catalogItem.quantity_source),
      ruleLabel: formatQuantityRuleLabel(rule),
      statusLabel: buildStatusLabel("missing_measurement", "", measurementHandoff),
      unresolved: true,
    };
  }

  const mode = rule?.mode ?? "inherit_catalog";

  if (mode === "fixed" || catalogItem.quantity_source === "fixed") {
    const fixedQty = resolveFixedQuantity(rule, catalogItem);
    if (fixedQty == null) {
      return {
        status: "missing_quantity_field",
        quantity: null,
        quantityDisplayLabel: "Not resolved",
        sourceKey: "fixed",
        sourceLabel: quantitySourceLabel("fixed"),
        ruleLabel: formatQuantityRuleLabel(rule),
        statusLabel: "Needs fixed quantity value",
        unresolved: true,
      };
    }
    const unit = catalogItem.unit === "fixed" ? "fixed" : catalogItem.unit;
    return {
      status: "fixed_quantity",
      quantity: fixedQty,
      quantityDisplayLabel: formatQuantityValue(fixedQty, unit),
      sourceKey: "fixed",
      sourceLabel: quantitySourceLabel("fixed"),
      ruleLabel: formatQuantityRuleLabel(rule),
      statusLabel: buildStatusLabel("fixed_quantity", "", null),
      unresolved: false,
    };
  }

  if (catalogItem.quantity_source === "custom" || catalogItem.quantity_source === "labor_multiplier") {
    return unsupportedPreview(rule, quantitySourceLabel(catalogItem.quantity_source));
  }

  if (mode === "measurement" && rule?.measurement_quantity_key && !rule.quantity_source) {
    return unsupportedPreview(rule, rule.measurement_quantity_key);
  }

  const effectiveSource = resolveEffectiveSource(rule, catalogItem);
  if (!effectiveSource || effectiveSource === "custom" || effectiveSource === "labor_multiplier") {
    return unsupportedPreview(rule, effectiveSource ? quantitySourceLabel(effectiveSource) : "Unknown source");
  }

  if (effectiveSource === "fixed") {
    const fixedQty = resolveFixedQuantity(rule, catalogItem);
    if (fixedQty == null) {
      return {
        status: "missing_quantity_field",
        quantity: null,
        quantityDisplayLabel: "Not resolved",
        sourceKey: "fixed",
        sourceLabel: quantitySourceLabel("fixed"),
        ruleLabel: formatQuantityRuleLabel(rule),
        statusLabel: "Needs fixed quantity value",
        unresolved: true,
      };
    }
    return {
      status: "fixed_quantity",
      quantity: fixedQty,
      quantityDisplayLabel: formatQuantityValue(fixedQty, catalogItem.unit),
      sourceKey: "fixed",
      sourceLabel: quantitySourceLabel("fixed"),
      ruleLabel: formatQuantityRuleLabel(rule),
      statusLabel: buildStatusLabel("fixed_quantity", "", null),
      unresolved: false,
    };
  }

  let quantity = lookupMeasurementQuantity(effectiveSource, measurementHandoff, quantityMap);

  if (quantity != null && mode === "multiplier") {
    const multiplier = finiteOrNull(rule?.quantity_multiplier);
    if (multiplier != null) {
      quantity = quantity * multiplier;
    }
  }

  const sourceLabel = quantitySourceLabel(effectiveSource);
  const ruleLabel = formatQuantityRuleLabel(rule);

  if (quantity == null) {
    let missingNote = `Needs measurement field: ${sourceLabel}`;
    if (effectiveSource === "tear_off_squares") {
      missingNote = "Needs measurement: tear-off not marked required";
    }

    return {
      status: "missing_quantity_field",
      quantity: null,
      quantityDisplayLabel: "Not resolved",
      sourceKey: effectiveSource,
      sourceLabel,
      ruleLabel,
      statusLabel: missingNote,
      unresolved: true,
    };
  }

  const allowManualOverride = Boolean(rule?.allow_manual_override);
  const status: ProposalQuantityResolveStatus = allowManualOverride ? "manual_later" : "resolved";

  return {
    status,
    quantity,
    quantityDisplayLabel: formatQuantityValue(quantity, catalogItem.unit),
    sourceKey: effectiveSource,
    sourceLabel,
    ruleLabel,
    statusLabel: buildStatusLabel(status, sourceLabel, measurementHandoff),
    unresolved: false,
  };
}
