/**
 * V2E1 — Draft-structure pricing for refreshDraftPricing.
 *
 * Reprices an EXISTING draft graph from Catalog/policy/measurement inputs.
 * Does NOT rebuild line membership, package presentation, or upgrade defs
 * from the live Template graph.
 *
 * Composition identity (V2E2A1):
 * Refresh preserves draft-owned composition_role / composition_slot_key.
 * Live Template composition fields and Catalog composition_role are never read.
 *
 * Quantity ownership (V2E1 completion):
 * Refresh may re-resolve measurement quantities using ONLY draft-owned + Catalog
 * provenance (synthesized quantity rule). Live Template quantity_rule is never read.
 */

import type { CatalogItem, CatalogUnit, CustomerVisibility, PricingBasis, QuantitySource } from "@/app/lib/catalogTypes";
import { QUANTITY_SOURCES } from "@/app/lib/catalogTypes";
import {
  normalizeCompositionRole,
  normalizeCompositionSlotKey,
} from "@/app/lib/packageCompositionIdentity";
import type { ProposalQuantityPreviewContext } from "@/app/lib/proposalBuilderPreview";
import { buildCatalogItemById } from "@/app/lib/proposalBuilderPreview";
import { priceProposalLine, resolveProposalPricing } from "@/app/lib/proposalPricingEngine";
import type {
  LinePricingStatus,
  PricingActorRole,
  PricingLineInput,
  PricingPolicy,
  UpgradeScopeRef,
} from "@/app/lib/proposalPricingTypes";
import {
  alignQuantityResolutionEchoToPersistedQuantity,
  resolveProposalLineQuantityViaAdapter,
} from "@/app/lib/proposalQuantityResolutionAdapter";
import {
  createEmptyScopeDecisionMergeReport,
  type ProposalScopeDecisionMergeReport,
} from "@/app/lib/proposalScopeDecisionMerge";
import {
  parseManualQuantityPayload,
  parseVisibilityOverridePayload,
  type ProposalScopeDecision,
} from "@/app/lib/proposalScopeDecisionTypes";
import type {
  ProposalDraftGraph,
  ProposalLineItemRow,
  ProposalOptionRow,
} from "@/app/lib/proposalRecordStore";
import type {
  BuildContextEchoInput,
  DraftInstantiateInput,
  LineItemSnapshotInput,
  OptionPricingSnapshotInput,
} from "@/app/lib/proposalSnapshotBuilder";
import type {
  ProposalTemplateItem,
  ProposalTemplateItemRole,
  ProposalTemplateOption,
  TemplateQuantityRule,
} from "@/app/lib/proposalTemplateTypes";
import {
  isUpgradeTemplateItemRole,
  upgradeChoicesToMap,
  upgradeLineEchoesFromPricingLine,
  type UpgradeChoiceByTemplateItemId,
} from "@/app/lib/proposalUpgradeTruth";
import {
  isProposalUpgradeEffect,
  type ProposalOptionUpgradeChoicePersistRow,
  type ProposalUpgradeEffect,
  type ProposalUpgradeSelectionState,
} from "@/app/lib/proposalUpgradeTruthTypes";

const MISSING_CATALOG_UNIT: CatalogUnit = "fixed";
const QUANTITY_SOURCE_SET = new Set<string>(QUANTITY_SOURCES);

export type DraftStructurePricingReport = {
  orphanedSourceTemplateItemIds: string[];
  /** @deprecated Always 0 — live Template quantity_rule is never consulted. */
  quantityRuleLiveLookups: number;
  draftOwnedQuantityResolves: number;
  preservedDraftQuantities: number;
  warnings: string[];
};

export type BuildDraftInstantiateInputFromDraftStructureParams = {
  companyId: string;
  draftGraph: ProposalDraftGraph;
  catalogItems: CatalogItem[];
  quantityContext: ProposalQuantityPreviewContext | null;
  policy: PricingPolicy;
  pricingPolicyId: string;
  actorRole: PricingActorRole;
  context: BuildContextEchoInput;
  selectedTemplateOptionId?: string | null;
  /**
   * @deprecated Ignored. Refresh must not read live Template quantity_rule or membership.
   * Kept optional so call sites can drop the argument without a breaking rename.
   */
  liveTemplateGraph?: unknown;
  scopeDecisionsByTemplateOptionId?: Record<string, ProposalScopeDecision[]>;
  upgradeChoicesByTemplateOptionId?: Record<
    string,
    ProposalOptionUpgradeChoicePersistRow[]
  > | null;
  computedAt?: string;
};

function isQuantitySource(value: string): value is QuantitySource {
  return QUANTITY_SOURCE_SET.has(value);
}

function isFixedDraftQuantityProvenance(draftLine: ProposalLineItemRow): boolean {
  const label = (draftLine.quantity_source_label ?? "").trim().toLowerCase();
  if (label === "fixed" || label.startsWith("fixed ")) return true;
  const echo = draftLine.quantity_resolution_echo;
  if (echo && typeof echo === "object") {
    const key = (echo as { source_measurement_key?: unknown }).source_measurement_key;
    if (key === "fixed") return true;
  }
  return false;
}

/**
 * Synthesize the quantity rule owned by this draft line from persisted draft + Catalog.
 * Never reads live Template quantity_rule.
 *
 * - Fixed Catalog / Fixed draft provenance → fixed using draft quantity (or catalog default)
 * - Draft measurement_quantity_key override ≠ Catalog source → measurement mode with that key
 * - Otherwise inherit_catalog (Catalog.quantity_source drives measurement refresh)
 *
 * Template-only multiplier rules are not rehydrated (not persisted on draft). Changing a
 * Template multiplier later cannot affect an old draft; measurement refresh uses Catalog 1:1.
 */
export function synthesizeDraftOwnedQuantityRule(
  draftLine: ProposalLineItemRow,
  catalog: CatalogItem | null | undefined
): TemplateQuantityRule {
  if (catalog?.quantity_source === "fixed" || isFixedDraftQuantityProvenance(draftLine)) {
    const fixedFromDraft =
      draftLine.quantity != null && Number.isFinite(draftLine.quantity)
        ? draftLine.quantity
        : null;
    return {
      mode: "fixed",
      fixed_quantity: fixedFromDraft ?? catalog?.default_quantity ?? 1,
    };
  }

  const key = (draftLine.measurement_quantity_key ?? "").trim();
  if (key && isQuantitySource(key) && (!catalog || key !== catalog.quantity_source)) {
    return {
      mode: "measurement",
      quantity_source: key,
      measurement_quantity_key: key,
    };
  }

  return { mode: "inherit_catalog" };
}

/**
 * Minimal synthetic template item so the existing quantity adapter can run without
 * loading the live Template graph. Rule comes only from synthesizeDraftOwnedQuantityRule.
 */
export function buildSyntheticTemplateItemForDraftQuantity(
  draftLine: ProposalLineItemRow,
  catalog: CatalogItem | null | undefined
): ProposalTemplateItem {
  const id = (draftLine.source_template_item_id ?? "").trim() || draftLine.id;
  return {
    id,
    template_id: "",
    option_id: "",
    section_id: (draftLine.section_id ?? "").trim() || id,
    catalog_item_id: draftLine.catalog_item_id,
    catalog_seed_key: draftLine.catalog_seed_key,
    composition_role: normalizeCompositionRole(draftLine.composition_role),
    composition_slot_key: normalizeCompositionSlotKey(draftLine.composition_slot_key),
    item_role: asItemRole(draftLine.role),
    quantity_rule: synthesizeDraftOwnedQuantityRule(draftLine, catalog),
    sort_order: draftLine.sort_order,
  };
}

function isBlockingLineStatus(status: LinePricingStatus): boolean {
  return status === "unpriced" || status === "unsupported" || status === "unresolved_quantity";
}

function isMissingCatalogLine(itemType: unknown): boolean {
  return itemType == null;
}

function sortOptionsByOrder(rows: ProposalOptionRow[]): ProposalOptionRow[] {
  return [...rows].sort((a, b) => {
    const ao = a.sort_order ?? 0;
    const bo = b.sort_order ?? 0;
    if (ao !== bo) return ao - bo;
    return a.id.localeCompare(b.id);
  });
}

function sortLinesByOrder(rows: ProposalLineItemRow[]): ProposalLineItemRow[] {
  return [...rows].sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return a.id.localeCompare(b.id);
  });
}

function asItemRole(role: string | null | undefined): ProposalTemplateItemRole {
  const normalized = (role ?? "").trim();
  if (
    normalized === "standard" ||
    normalized === "included" ||
    normalized === "optional_addon" ||
    normalized === "upgrade" ||
    normalized === "fee" ||
    normalized === "discount"
  ) {
    return normalized;
  }
  return "included";
}

function asCatalogUnit(unit: string | null | undefined): CatalogUnit {
  const normalized = (unit ?? "").trim();
  if (
    normalized === "square" ||
    normalized === "sqft" ||
    normalized === "linear_foot" ||
    normalized === "each" ||
    normalized === "bundle" ||
    normalized === "hour" ||
    normalized === "day" ||
    normalized === "fixed" ||
    normalized === "allowance"
  ) {
    return normalized;
  }
  return MISSING_CATALOG_UNIT;
}

function draftOptionToTemplateOptionShape(option: ProposalOptionRow): ProposalTemplateOption {
  const sourceId = (option.source_template_option_id ?? "").trim();
  return {
    id: sourceId,
    template_id: "",
    name: (option.name ?? "").trim() || "Package",
    customer_label: option.customer_label,
    description: option.description ?? null,
    selection_mode: "single",
    is_default: Boolean(option.is_default),
    visible_to_customer: option.visible_to_customer !== false,
    sort_order: option.sort_order ?? 0,
    metadata: null,
  };
}

/**
 * Draft upgrade membership is authoritative — do not merge live Template defs.
 */
export function resolveDraftOnlyUpgradeChoiceRows(
  explicit: readonly ProposalOptionUpgradeChoicePersistRow[] | null | undefined
): {
  rows: ProposalOptionUpgradeChoicePersistRow[];
  choicesByTemplateItemId: UpgradeChoiceByTemplateItemId;
} {
  const rows = (explicit ?? []).map((row) => ({ ...row }));
  return {
    rows,
    choicesByTemplateItemId: upgradeChoicesToMap(rows),
  };
}

function buildUpgradeScopeFromDraftLine(params: {
  line: ProposalLineItemRow;
  optionId: string;
  choice:
    | { selectionState: ProposalUpgradeSelectionState; upgradeEffect?: ProposalUpgradeEffect | null }
    | undefined;
}): UpgradeScopeRef | null {
  const { line, optionId, choice } = params;
  if (!isUpgradeTemplateItemRole(line.role)) return null;

  const effectFromLine = isProposalUpgradeEffect(line.upgrade_effect)
    ? line.upgrade_effect
    : null;
  const effect: ProposalUpgradeEffect =
    effectFromLine ??
    (choice?.upgradeEffect && isProposalUpgradeEffect(choice.upgradeEffect)
      ? choice.upgradeEffect
      : "additive");

  const selectionFromChoice = choice?.selectionState;
  const selectionFromLine =
    line.upgrade_selection_state === "selected" || line.upgrade_selection_state === "not_selected"
      ? (line.upgrade_selection_state as ProposalUpgradeSelectionState)
      : null;
  const selectionState: ProposalUpgradeSelectionState =
    selectionFromChoice ?? selectionFromLine ?? "not_selected";

  return {
    parentOptionId: optionId,
    isSelectedByDefault: false,
    selectionState,
    effect,
    replacesTemplateItemId:
      effect === "replacement" ? line.replaces_source_template_item_id ?? null : null,
  };
}

function applyDraftUpgradeSuppression(lines: PricingLineInput[]): PricingLineInput[] {
  const suppressed = new Set<string>();
  for (const line of lines) {
    if (
      line.upgradeScope?.selectionState === "selected" &&
      line.upgradeScope.effect === "replacement" &&
      line.upgradeScope.replacesTemplateItemId
    ) {
      suppressed.add(line.upgradeScope.replacesTemplateItemId);
    }
  }
  return lines.map((line) => ({
    ...line,
    suppressedByReplacement: suppressed.has(line.templateItemId),
  }));
}

function resolveQuantityForDraftLine(params: {
  draftLine: ProposalLineItemRow;
  catalog: CatalogItem | null | undefined;
  quantityContext: ProposalQuantityPreviewContext | null;
  policy: PricingPolicy;
}): {
  quantity: number | null;
  quantityUnresolved: boolean;
  quantityDisplayLabel: string;
  quantitySourceLabel: string | null;
  quantityResolutionEcho: Record<string, unknown> | null;
  usedLiveQuantityRule: boolean;
  draftOwnedQuantityResolve: boolean;
  preservedDraftQuantity: boolean;
} {
  const { draftLine, catalog, quantityContext, policy } = params;
  const sourceItemId = (draftLine.source_template_item_id ?? "").trim();
  const syntheticItem = buildSyntheticTemplateItemForDraftQuantity(draftLine, catalog);
  const rule = syntheticItem.quantity_rule;

  // Fixed draft-owned qty does not require a measurement handoff (resolver gates on it).
  if (rule?.mode === "fixed") {
    const fixedQty =
      rule.fixed_quantity != null && Number.isFinite(rule.fixed_quantity)
        ? rule.fixed_quantity
        : null;
    return {
      quantity: fixedQty,
      quantityUnresolved: fixedQty == null,
      quantityDisplayLabel:
        draftLine.quantity_display_label?.trim() ||
        (fixedQty != null ? String(fixedQty) : ""),
      quantitySourceLabel: "Fixed",
      quantityResolutionEcho: {
        quantity_mode: "adjusted_measurement",
        source_measurement_key: "fixed",
        source_measurement_value: null,
        coverage_rate_used: null,
        waste_pct_used: null,
        rounding_mode_used: "exact",
        resolved_purchase_quantity: fixedQty,
      },
      usedLiveQuantityRule: false,
      draftOwnedQuantityResolve: true,
      preservedDraftQuantity: false,
    };
  }

  if (sourceItemId || catalog) {
    const qtyResolved = resolveProposalLineQuantityViaAdapter(
      {
        measurementHandoff: quantityContext?.measurementHandoff ?? null,
        quantityMap: quantityContext?.quantityMap ?? null,
        catalogItem: catalog ?? null,
        templateItem: syntheticItem,
      },
      { wasteModel: policy.wasteModel }
    );
    const qtyPreview = qtyResolved.preview;
    const quantityResolutionEcho = alignQuantityResolutionEchoToPersistedQuantity(
      qtyResolved.quantityResolutionEcho,
      qtyPreview.quantity
    );
    return {
      quantity: qtyPreview.quantity,
      quantityUnresolved: qtyPreview.unresolved,
      quantityDisplayLabel: qtyPreview.quantityDisplayLabel,
      quantitySourceLabel: qtyPreview.sourceLabel ?? null,
      quantityResolutionEcho: quantityResolutionEcho as unknown as Record<string, unknown>,
      usedLiveQuantityRule: false,
      draftOwnedQuantityResolve: true,
      preservedDraftQuantity: false,
    };
  }

  const quantity =
    draftLine.quantity != null && Number.isFinite(draftLine.quantity) ? draftLine.quantity : null;
  return {
    quantity,
    quantityUnresolved: quantity == null,
    quantityDisplayLabel: draftLine.quantity_display_label ?? "",
    quantitySourceLabel: draftLine.quantity_source_label ?? null,
    quantityResolutionEcho: (draftLine.quantity_resolution_echo as Record<string, unknown> | null) ?? null,
    usedLiveQuantityRule: false,
    draftOwnedQuantityResolve: false,
    preservedDraftQuantity: true,
  };
}

function mapDraftLineToPricingLineInput(params: {
  draftLine: ProposalLineItemRow;
  templateOptionId: string;
  catalog: CatalogItem | null | undefined;
  quantity: { quantity: number | null; quantityUnresolved: boolean };
  choicesByTemplateItemId: UpgradeChoiceByTemplateItemId;
  hiddenButInCalc: boolean;
}): PricingLineInput {
  const { draftLine, templateOptionId, catalog, quantity, choicesByTemplateItemId, hiddenButInCalc } =
    params;
  const templateItemId = (draftLine.source_template_item_id ?? "").trim();
  const choice = choicesByTemplateItemId.get(templateItemId);
  const upgradeScope = buildUpgradeScopeFromDraftLine({
    line: draftLine,
    optionId: templateOptionId,
    choice,
  });

  if (!catalog) {
    return {
      templateItemId,
      catalogItemId: (draftLine.catalog_item_id ?? "").trim() || null,
      sectionId: draftLine.section_id,
      itemRole: asItemRole(draftLine.role),
      itemType: null,
      unit: MISSING_CATALOG_UNIT,
      pricingBasis: "cost_plus_margin",
      customerVisibility: draftLine.visible_to_customer === false ? "customer_visible" : "customer_visible",
      quantity: quantity.quantity,
      quantityUnresolved: quantity.quantityUnresolved,
      unitCostCents: null,
      unitPriceCents: null,
      laborUnitCostCents: null,
      tax: null,
      upgradeScope,
      hiddenButInCalc: hiddenButInCalc || draftLine.visible_to_customer === false,
    };
  }

  return {
    templateItemId,
    catalogItemId: catalog.id,
    sectionId: draftLine.section_id,
    itemRole: asItemRole(draftLine.role),
    itemType: catalog.item_type,
    unit: catalog.unit,
    pricingBasis: catalog.pricing_basis as PricingBasis,
    customerVisibility: "customer_visible" as CustomerVisibility,
    quantity: quantity.quantity,
    quantityUnresolved: quantity.quantityUnresolved,
    unitCostCents: catalog.unit_cost_cents ?? null,
    unitPriceCents: catalog.unit_price_cents ?? null,
    laborUnitCostCents: catalog.labor_unit_cost_cents ?? null,
    tax: null,
    upgradeScope,
    hiddenButInCalc: hiddenButInCalc || draftLine.visible_to_customer === false,
  };
}

/**
 * Apply scope decisions against draft pricing lines (membership = draft).
 * Does not require the live Template item to still exist.
 */
export function mergeScopeDecisionsIntoDraftPricingLines(params: {
  lines: PricingLineInput[];
  decisions: ProposalScopeDecision[];
  report: ProposalScopeDecisionMergeReport;
}): PricingLineInput[] {
  const { decisions, report } = params;
  let lines = params.lines.map((line) => ({ ...line }));

  if (decisions.length === 0) return lines;

  const presentIds = new Set(lines.map((line) => line.templateItemId));
  const excluded = new Set<string>();

  for (const decision of decisions) {
    if (!decision.active) {
      report.ignored.push({
        decisionId: decision.id,
        decisionType: decision.decisionType,
        sourceTemplateItemId: decision.sourceTemplateItemId,
        instanceLineKey: decision.instanceLineKey,
        message: "Decision is inactive.",
      });
      continue;
    }

    if (decision.decisionType !== "excluded") continue;

    const templateItemId = decision.sourceTemplateItemId;
    if (!templateItemId) {
      report.stale.push({
        decisionId: decision.id,
        decisionType: decision.decisionType,
        sourceTemplateItemId: decision.sourceTemplateItemId,
        instanceLineKey: decision.instanceLineKey,
        message: "excluded requires source_template_item_id.",
      });
      continue;
    }

    if (!presentIds.has(templateItemId)) {
      report.stale.push({
        decisionId: decision.id,
        decisionType: decision.decisionType,
        sourceTemplateItemId: templateItemId,
        instanceLineKey: decision.instanceLineKey,
        message: "source_template_item_id is not present on the draft option.",
      });
      continue;
    }

    excluded.add(templateItemId);
    report.applied.push({
      decisionId: decision.id,
      decisionType: decision.decisionType,
      sourceTemplateItemId: templateItemId,
      instanceLineKey: decision.instanceLineKey,
      message: "Excluded line from draft option pricing input.",
    });
  }

  if (excluded.size > 0) {
    lines = lines.filter((line) => !excluded.has(line.templateItemId));
  }

  for (const decision of decisions) {
    if (!decision.active) continue;
    if (decision.decisionType === "excluded") continue;

    const templateItemId = decision.sourceTemplateItemId;

    if (decision.decisionType === "visibility_override") {
      if (templateItemId && excluded.has(templateItemId)) {
        report.ignored.push({
          decisionId: decision.id,
          decisionType: decision.decisionType,
          sourceTemplateItemId: templateItemId,
          instanceLineKey: decision.instanceLineKey,
          message: "visibility_override ignored because line is excluded.",
        });
        continue;
      }
      if (!templateItemId) {
        report.stale.push({
          decisionId: decision.id,
          decisionType: decision.decisionType,
          sourceTemplateItemId: decision.sourceTemplateItemId,
          instanceLineKey: decision.instanceLineKey,
          message: "visibility_override requires source_template_item_id.",
        });
        continue;
      }
      const parsed = parseVisibilityOverridePayload(decision.payload as Record<string, unknown>);
      if (!parsed || parsed.visible_to_customer !== false) {
        report.stale.push({
          decisionId: decision.id,
          decisionType: decision.decisionType,
          sourceTemplateItemId: templateItemId,
          instanceLineKey: decision.instanceLineKey,
          message: "visibility_override payload must set visible_to_customer: false.",
        });
        continue;
      }
      const target = lines.find((line) => line.templateItemId === templateItemId);
      if (!target) {
        report.stale.push({
          decisionId: decision.id,
          decisionType: decision.decisionType,
          sourceTemplateItemId: templateItemId,
          instanceLineKey: decision.instanceLineKey,
          message: "Draft line is not present in pricing input.",
        });
        continue;
      }
      target.hiddenButInCalc = true;
      report.applied.push({
        decisionId: decision.id,
        decisionType: decision.decisionType,
        sourceTemplateItemId: templateItemId,
        instanceLineKey: decision.instanceLineKey,
        message: "Line hidden from customer document but still priced in option total.",
      });
      continue;
    }

    if (decision.decisionType === "manual_quantity") {
      if (templateItemId && excluded.has(templateItemId)) {
        report.ignored.push({
          decisionId: decision.id,
          decisionType: decision.decisionType,
          sourceTemplateItemId: templateItemId,
          instanceLineKey: decision.instanceLineKey,
          message: "manual_quantity ignored because line is excluded.",
        });
        continue;
      }
      if (!templateItemId) {
        report.stale.push({
          decisionId: decision.id,
          decisionType: decision.decisionType,
          sourceTemplateItemId: decision.sourceTemplateItemId,
          instanceLineKey: decision.instanceLineKey,
          message: "manual_quantity requires source_template_item_id.",
        });
        continue;
      }
      const parsed = parseManualQuantityPayload(decision.payload as Record<string, unknown>);
      if (!parsed) {
        report.stale.push({
          decisionId: decision.id,
          decisionType: decision.decisionType,
          sourceTemplateItemId: templateItemId,
          instanceLineKey: decision.instanceLineKey,
          message: "manual_quantity payload is invalid.",
        });
        continue;
      }
      const target = lines.find((line) => line.templateItemId === templateItemId);
      if (!target) {
        report.stale.push({
          decisionId: decision.id,
          decisionType: decision.decisionType,
          sourceTemplateItemId: templateItemId,
          instanceLineKey: decision.instanceLineKey,
          message: "Draft line is not present in pricing input.",
        });
        continue;
      }
      target.quantity = parsed.quantity;
      target.quantityUnresolved = false;
      report.applied.push({
        decisionId: decision.id,
        decisionType: decision.decisionType,
        sourceTemplateItemId: templateItemId,
        instanceLineKey: decision.instanceLineKey,
        message: `Applied manual quantity ${parsed.quantity}.`,
      });
      continue;
    }

    report.unsupported.push({
      decisionId: decision.id,
      decisionType: decision.decisionType,
      sourceTemplateItemId: decision.sourceTemplateItemId,
      instanceLineKey: decision.instanceLineKey,
      message: `${decision.decisionType} is not implemented in draft-structure scope merge.`,
    });
  }

  return lines;
}

function draftLineToSnapshotInput(params: {
  draftLine: ProposalLineItemRow;
  pricingLine: PricingLineInput;
  pricedStatus: LinePricingStatus;
  unitPriceCents: number | null;
  linePriceCents: number | null;
  quantityDisplayLabel: string;
  quantitySourceLabel: string | null;
  quantityResolutionEcho: Record<string, unknown> | null;
}): LineItemSnapshotInput {
  const {
    draftLine,
    pricingLine,
    pricedStatus,
    unitPriceCents,
    linePriceCents,
    quantityDisplayLabel,
    quantitySourceLabel,
    quantityResolutionEcho,
  } = params;
  const upgradeEchoes = upgradeLineEchoesFromPricingLine(pricingLine);
  const showPrice = pricedStatus === "priced";

  return {
    source_template_item_id: (draftLine.source_template_item_id ?? "").trim(),
    catalog_item_id: draftLine.catalog_item_id,
    catalog_seed_key: draftLine.catalog_seed_key,
    composition_role: normalizeCompositionRole(draftLine.composition_role),
    composition_slot_key: normalizeCompositionSlotKey(draftLine.composition_slot_key),
    section_id: draftLine.section_id,
    sort_order: draftLine.sort_order,
    customer_name: draftLine.customer_name,
    description: draftLine.description,
    role: asItemRole(draftLine.role),
    quantity: pricingLine.quantity,
    quantity_display_label: quantityDisplayLabel || draftLine.quantity_display_label || "",
    quantity_source_label: quantitySourceLabel ?? draftLine.quantity_source_label ?? null,
    unit: pricingLine.unit ?? asCatalogUnit(draftLine.unit),
    customer_unit_price_cents: showPrice ? unitPriceCents : null,
    customer_line_total_cents: showPrice ? linePriceCents : null,
    engineStatus: pricedStatus,
    customerVisibility: "customer_visible",
    hiddenButInCalc: pricingLine.hiddenButInCalc === true,
    catalogItemMissing: isMissingCatalogLine(pricingLine.itemType),
    measurement_quantity_key: draftLine.measurement_quantity_key,
    quantity_resolution_echo: quantityResolutionEcho,
    upgrade_selection_state: upgradeEchoes.upgradeSelectionState,
    upgrade_effect: upgradeEchoes.upgradeEffect,
    replaces_source_template_item_id: upgradeEchoes.replacesSourceTemplateItemId,
  };
}

/**
 * Build DraftInstantiateInput from persisted draft structure + Catalog economics.
 * Pure — no DB.
 */
export function buildDraftInstantiateInputFromDraftStructure(
  params: BuildDraftInstantiateInputFromDraftStructureParams
): { input: DraftInstantiateInput; report: DraftStructurePricingReport } {
  const catalogById = buildCatalogItemById(params.catalogItems);
  const report: DraftStructurePricingReport = {
    orphanedSourceTemplateItemIds: [],
    quantityRuleLiveLookups: 0,
    draftOwnedQuantityResolves: 0,
    preservedDraftQuantities: 0,
    warnings: [],
  };
  const mergeReport = createEmptyScopeDecisionMergeReport();

  // Intentionally ignore params.liveTemplateGraph — refresh must not read live Template.

  const optionPricing: OptionPricingSnapshotInput[] = [];
  const lineItemsByTemplateOptionId: Record<string, LineItemSnapshotInput[]> = {};
  const upgradeChoicesByTemplateOptionId: Record<
    string,
    ProposalOptionUpgradeChoicePersistRow[]
  > = {};
  const internalSummaryByTemplateOptionId: Record<
    string,
    {
      internal_cost_cents: number | null;
      internal_profit_cents: number | null;
      effective_margin_pct: number | null;
    }
  > = {};

  const templateOptions: ProposalTemplateOption[] = [];
  const draftOptions = sortOptionsByOrder(params.draftGraph.options);

  for (const draftOption of draftOptions) {
    const templateOptionId = (draftOption.source_template_option_id ?? "").trim();
    if (!templateOptionId) continue;

    templateOptions.push(draftOptionToTemplateOptionShape(draftOption));

    const explicitChoices =
      params.upgradeChoicesByTemplateOptionId?.[templateOptionId] ?? null;
    const resolvedUpgrades = resolveDraftOnlyUpgradeChoiceRows(explicitChoices);
    upgradeChoicesByTemplateOptionId[templateOptionId] = resolvedUpgrades.rows;

    const draftLines = sortLinesByOrder(
      params.draftGraph.lineItems.filter((line) => line.proposal_option_id === draftOption.id)
    );

    const pricingLines: PricingLineInput[] = [];
    const qtyMetaByTemplateItemId = new Map<
      string,
      {
        quantityDisplayLabel: string;
        quantitySourceLabel: string | null;
        quantityResolutionEcho: Record<string, unknown> | null;
        draftLine: ProposalLineItemRow;
      }
    >();

    for (const draftLine of draftLines) {
      const sourceItemId = (draftLine.source_template_item_id ?? "").trim();
      if (!sourceItemId) {
        report.warnings.push(
          `Draft line ${draftLine.id} has no source_template_item_id; skipped on structure refresh.`
        );
        continue;
      }

      const catalogId = (draftLine.catalog_item_id ?? "").trim();
      const catalog = catalogId ? catalogById.get(catalogId) : undefined;

      const qty = resolveQuantityForDraftLine({
        draftLine,
        catalog,
        quantityContext: params.quantityContext,
        policy: params.policy,
      });
      if (qty.draftOwnedQuantityResolve) report.draftOwnedQuantityResolves += 1;
      if (qty.preservedDraftQuantity) report.preservedDraftQuantities += 1;
      if (qty.usedLiveQuantityRule) report.quantityRuleLiveLookups += 1;

      pricingLines.push(
        mapDraftLineToPricingLineInput({
          draftLine,
          templateOptionId,
          catalog,
          quantity: {
            quantity: qty.quantity,
            quantityUnresolved: qty.quantityUnresolved,
          },
          choicesByTemplateItemId: resolvedUpgrades.choicesByTemplateItemId,
          hiddenButInCalc: draftLine.visible_to_customer === false,
        })
      );

      qtyMetaByTemplateItemId.set(sourceItemId, {
        quantityDisplayLabel: qty.quantityDisplayLabel,
        quantitySourceLabel: qty.quantitySourceLabel,
        quantityResolutionEcho: qty.quantityResolutionEcho,
        draftLine,
      });
    }

    const optionDecisions = params.scopeDecisionsByTemplateOptionId?.[templateOptionId] ?? [];
    const afterScope = mergeScopeDecisionsIntoDraftPricingLines({
      lines: pricingLines,
      decisions: optionDecisions,
      report: mergeReport,
    });
    const pricedLines = applyDraftUpgradeSuppression(afterScope);

    const pricingInput = {
      policy: params.policy,
      actorRole: params.actorRole,
      optionId: templateOptionId,
      lines: pricedLines,
    };
    const pricingResult = resolveProposalPricing(pricingInput);
    const repricedOption = pricingResult.options[0];

    let blockingLineCount = 0;
    const lineInputs: LineItemSnapshotInput[] = [];

    for (const pricingLine of pricedLines) {
      const priced = priceProposalLine(pricingLine, params.policy);
      if (isBlockingLineStatus(priced.status)) {
        blockingLineCount += 1;
      }
      const meta = qtyMetaByTemplateItemId.get(pricingLine.templateItemId);
      if (!meta) continue;

      let quantityDisplayLabel = meta.quantityDisplayLabel;
      let quantitySourceLabel = meta.quantitySourceLabel;
      let quantityResolutionEcho = meta.quantityResolutionEcho;

      const manualDecision = optionDecisions.find(
        (decision) =>
          decision.active &&
          decision.decisionType === "manual_quantity" &&
          decision.sourceTemplateItemId === pricingLine.templateItemId
      );
      if (manualDecision) {
        const parsed = parseManualQuantityPayload(
          manualDecision.payload as Record<string, unknown>
        );
        quantitySourceLabel = "Manual";
        const authoredLabel = parsed?.quantity_display_label?.trim();
        quantityDisplayLabel =
          authoredLabel ||
          (pricingLine.quantity != null ? String(pricingLine.quantity) : quantityDisplayLabel);
        quantityResolutionEcho = alignQuantityResolutionEchoToPersistedQuantity(
          (quantityResolutionEcho as never) ?? {
            quantity_mode: "adjusted_measurement",
            source_measurement_key: null,
            source_measurement_value: null,
            coverage_rate_used: null,
            waste_pct_used: null,
            rounding_mode_used: "exact",
            resolved_purchase_quantity: pricingLine.quantity,
          },
          pricingLine.quantity
        ) as unknown as Record<string, unknown>;
      }

      lineInputs.push(
        draftLineToSnapshotInput({
          draftLine: meta.draftLine,
          pricingLine,
          pricedStatus: priced.status,
          unitPriceCents: priced.unitPriceCents,
          linePriceCents: priced.linePriceCents,
          quantityDisplayLabel,
          quantitySourceLabel,
          quantityResolutionEcho,
        })
      );
    }

    lineItemsByTemplateOptionId[templateOptionId] = lineInputs;
    internalSummaryByTemplateOptionId[templateOptionId] = {
      internal_cost_cents: repricedOption?.internalCostCents ?? null,
      internal_profit_cents: repricedOption?.internalProfitCents ?? null,
      effective_margin_pct: repricedOption?.effectiveMarginPct ?? null,
    };

    optionPricing.push({
      source_template_option_id: templateOptionId,
      name: draftOption.name,
      customer_label: draftOption.customer_label ?? null,
      description: draftOption.description ?? null,
      sort_order: draftOption.sort_order ?? 0,
      is_default: Boolean(draftOption.is_default),
      visible_to_customer: draftOption.visible_to_customer !== false,
      customer_subtotal_cents: repricedOption?.customerSubtotalCents ?? null,
      discount_cents: repricedOption?.discountCents ?? null,
      sales_tax_cents: repricedOption?.salesTaxCents ?? null,
      customer_total_cents: repricedOption?.customerTotalCents ?? null,
      pricing_complete: repricedOption ? !repricedOption.hasBlockingIssues : false,
      blocking_line_count: blockingLineCount,
      guardrail_outcome: repricedOption?.guardrail.outcome ?? "block",
      is_selected: params.selectedTemplateOptionId === templateOptionId,
    });
  }

  for (const entry of mergeReport.warnings) {
    report.warnings.push(entry);
  }

  const input: DraftInstantiateInput = {
    company_id: params.companyId,
    context: params.context,
    policy: {
      configured: true,
      source: "company",
      policy: params.policy,
      pricingPolicyId: params.pricingPolicyId,
    },
    templateOptions,
    // Empty on purpose — refresh must not remap draft section_ids via live Template pages.
    templateSections: [],
    template: null,
    optionPricing,
    lineItemsByTemplateOptionId,
    internalSummaryByTemplateOptionId,
    upgradeChoicesByTemplateOptionId,
    selectedTemplateOptionId: params.selectedTemplateOptionId ?? null,
    computedAt: params.computedAt,
  };

  return { input, report };
}
