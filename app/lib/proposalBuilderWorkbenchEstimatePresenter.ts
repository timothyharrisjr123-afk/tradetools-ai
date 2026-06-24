/**
 * R17C2 Phase 1 — Pure Builder workbench estimate presentation mapper.
 *
 * Classifies template line rows into contractor workbench zones for the
 * future zoned Builder Estimate UI. Separate from customer document presentation.
 *
 * No React, DB, pricing math, or persistence. Does not mutate inputs.
 */

import type { CatalogItem } from "@/app/lib/catalogTypes";
import type {
  BuilderLineDisplayStatus,
  ProposalBuilderLineCustomerView,
  ProposalBuilderOptionCustomerView,
} from "@/app/lib/proposalBuilderPricingPreview";
import {
  buildCatalogItemById,
  buildLinePreviewRowsForSection,
  getDefaultSelectedOptionId,
  type ProposalPreviewLineRow,
  type ProposalQuantityPreviewContext,
} from "@/app/lib/proposalBuilderPreview";
import type { ProposalSnapshotLineQuantityView } from "@/app/lib/proposalDraftGraphAdapter";
import type { ProposalPageSettings } from "@/app/lib/proposalPageTypes";
import { resolvePackageMeta } from "@/app/lib/proposalPackagePresentation";
import type { ProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";
import type { ProposalScopeDecision } from "@/app/lib/proposalScopeDecisionTypes";
import type {
  ProposalTemplateOption,
  ProposalTemplateOptionSelectionMode,
  ProposalTemplateSection,
} from "@/app/lib/proposalTemplateTypes";
import { parseEstimatePageSettings } from "@/app/lib/proposalTemplateEstimateSettings";
import { sortTemplateOptionsByOrder } from "@/app/tools/roofing/templates/templatesSetupUtils";
import { formatPriceCents } from "@/app/tools/roofing/proposals/builder/proposalBuilderConstants";

export const WORKBENCH_ESTIMATE_PAGE_TITLE = "Estimate";
export const WORKBENCH_ESTIMATE_PAGE_SUBTITLE =
  "Package options, line items, and totals for the customer proposal.";

export const WORKBENCH_TOTALS_INCOMPLETE_COPY =
  "Totals appear when quantity and pricing review is complete. Check scope review below or Pricing readiness in the rail.";

export const WORKBENCH_HARD_BLOCKERS_TITLE = "Pricing blockers";
export const WORKBENCH_HARD_BLOCKERS_DESCRIPTION =
  "Catalog or pricing setup must be resolved before these lines can appear on the customer proposal.";

export const WORKBENCH_SCOPE_REVIEW_TITLE = "Scope review";
export const WORKBENCH_SCOPE_REVIEW_SUBTITLE = "Items needing quantity review";
export const WORKBENCH_SCOPE_REVIEW_DESCRIPTION =
  "These template lines need quantity review before totals are final.";

export const WORKBENCH_SCOPE_REVIEW_ROW_HELPER =
  "Set quantity in Edit option when line editing is enabled.";

export const WORKBENCH_DECISION_TRACE_REMOVED_TITLE = "Removed from this option";
export const WORKBENCH_DECISION_TRACE_REMOVED_DESCRIPTION =
  "Template lines excluded from this package for this job. Restore to return them to scope review or customer-ready scope.";
export const WORKBENCH_DECISION_TRACE_REMOVED_STATUS = "Removed";

export const WORKBENCH_SCOPE_REVIEW_FUTURE_ACTIONS = [
  { id: "set_quantity", label: "Set quantity", enabled: false as const },
  { id: "remove", label: "Remove", enabled: false as const },
] as const;

export const WORKBENCH_DISPLAY_SETTINGS_ENTRY_LABEL = "Estimate display settings";
export const WORKBENCH_DISPLAY_SETTINGS_COMING_SOON_BADGE = "Coming soon";
export const WORKBENCH_DISPLAY_SETTINGS_LOCKED_COPY =
  "Control line prices, totals, and headings on the customer proposal. Saved on template today — customer display wiring in a future update.";

export const WORKBENCH_CUSTOMER_PACKAGE_CHOICE_HINT =
  "Customer package choice happens when the proposal is sent for signing — not in this editor.";

export const WORKBENCH_CUSTOMER_UPGRADE_SELECTION_HINT =
  "Optional upgrades appear on the customer proposal. Selection is enabled when signing — not in this editor.";

export const WORKBENCH_UPGRADES_EMPTY_COPY = "No upgrade lines in this package.";

export const WORKBENCH_LINE_INCLUDED_LABEL = "Included";
export const WORKBENCH_LINE_IN_PACKAGE_LABEL = "In package";
export const WORKBENCH_HIDDEN_FROM_CUSTOMER_LABEL = "Hidden from customer";

export const WORKBENCH_ATTENTION_AMOUNT_MISSING_CATALOG = "Missing catalog";
export const WORKBENCH_ATTENTION_AMOUNT_NEEDS_QUANTITY = "Needs quantity";
export const WORKBENCH_ATTENTION_AMOUNT_NOT_PRICED = "Not priced";

export type WorkbenchAttentionReason =
  | "missing_catalog"
  | "needs_quantity"
  | "not_priced"
  | "missing_pricing_view";

export type WorkbenchCustomerSelectionMode = "contractor_only" | "future_signing";

export type WorkbenchEstimateLineStatusKind = "priced" | "included" | "grouped";

export type WorkbenchLineDetailMeta = {
  source: string;
  rule: string;
  unit: string;
  role: string;
  resolvedStatus: string | null;
};

export type WorkbenchPackageOptionSummary = {
  id: string;
  label: string;
  isSelected: boolean;
  isDefault: boolean;
  selectionMode: ProposalTemplateOptionSelectionMode;
};

export type WorkbenchPackageZone = {
  selectedOptionId: string | null;
  effectiveOptionId: string | null;
  label: string | null;
  description: string | null;
  bullets: string[];
  hasExplicitSelection: boolean;
  optionCount: number;
  allOptions: WorkbenchPackageOptionSummary[];
  selectionMode: ProposalTemplateOptionSelectionMode;
  customerSelectionMode: WorkbenchCustomerSelectionMode;
  customerSigningHint: string | null;
};

export type WorkbenchDecisionTraceLine = {
  templateItemId: string;
  name: string;
  qtyLabel: string | null;
  statusLabel: typeof WORKBENCH_DECISION_TRACE_REMOVED_STATUS;
  detailMeta: WorkbenchLineDetailMeta;
};

export type WorkbenchDecisionTraceBucket = {
  show: boolean;
  count: number;
  title: string;
  description: string;
  lines: WorkbenchDecisionTraceLine[];
};

export type WorkbenchDecisionTraceZone = {
  show: boolean;
  excluded: WorkbenchDecisionTraceBucket;
};

export type WorkbenchScopeLine = {
  templateItemId: string;
  name: string;
  qtyLabel: string;
  qtyUnresolved: boolean;
  amountLabel: string;
  statusKind: WorkbenchEstimateLineStatusKind;
  hiddenFromCustomer: boolean;
  detailMeta: WorkbenchLineDetailMeta;
  attentionReasons: WorkbenchAttentionReason[];
  /** R17D Phase 2.5 — snapshot shows an active manual quantity override. */
  manualQuantityActive: boolean;
};

export type WorkbenchScopeSection = {
  sectionId: string;
  title: string;
  lines: WorkbenchScopeLine[];
};

export type WorkbenchAttentionKind = "hard_blocker" | "scope_review";

export type WorkbenchAttentionLine = {
  templateItemId: string;
  name: string;
  reasons: WorkbenchAttentionReason[];
  attentionKind: WorkbenchAttentionKind;
  qtyLabel: string;
  qtyUnresolved: boolean;
  amountLabel: string;
  hiddenFromCustomer: boolean;
  detailMeta: WorkbenchLineDetailMeta;
  suggestedAction: string | null;
};

export type WorkbenchAttentionBucket = {
  show: boolean;
  count: number;
  title: string;
  description: string;
  lines: WorkbenchAttentionLine[];
  railHint: string | null;
};

export type WorkbenchNeedsAttentionZone = {
  show: boolean;
  blockingCount: number;
  lines: WorkbenchAttentionLine[];
  railHint: string | null;
  hardBlockers: WorkbenchAttentionBucket;
  scopeReview: WorkbenchAttentionBucket;
};

export type WorkbenchUpgradeSection = {
  sectionId: string;
  title: string;
  lines: WorkbenchScopeLine[];
};

export type WorkbenchUpgradesZone = {
  show: boolean;
  hasTemplateUpgradeSections: boolean;
  isEmpty: boolean;
  sections: WorkbenchUpgradeSection[];
  customerSelectionEnabled: false;
  customerSelectionHint: string | null;
  emptyCopy: string | null;
};

export type WorkbenchPolicyBanner = {
  show: boolean;
  configured: boolean;
  copy: string;
};

export type WorkbenchTotalsZone = {
  pricingComplete: boolean;
  showAmounts: boolean;
  subtotalLabel: string | null;
  discountLabel: string | null;
  taxLabel: string | null;
  totalLabel: string | null;
  incompleteCopy: string | null;
  pricingPolicyConfigured: boolean;
  policyBanner: WorkbenchPolicyBanner;
};

export type WorkbenchDisplaySettingsEntry = {
  visible: true;
  enabled: false;
  label: string;
  comingSoonBadge: string;
  lockedCopy: string;
  currentSettings: ProposalPageSettings | null;
  settingsSummary: string | null;
};

export type WorkbenchEstimatePresentationMeta = {
  pricingPolicyConfigured: boolean;
  suppressedDocumentBlockerCount: number;
  readyLineCount: number;
  /** All attention lines (hard blockers + scope review). */
  attentionLineCount: number;
  hardBlockerLineCount: number;
  scopeReviewLineCount: number;
  excludedLineCount: number;
  upgradeLineCount: number;
  sourceLineCount: number;
};

export type ProposalWorkbenchEstimatePresentation = {
  page: {
    title: string;
    subtitle: string;
  };
  packageZone: WorkbenchPackageZone;
  readyScope: {
    sections: WorkbenchScopeSection[];
  };
  needsAttention: WorkbenchNeedsAttentionZone;
  upgradesZone: WorkbenchUpgradesZone;
  totalsZone: WorkbenchTotalsZone;
  displaySettingsEntry: WorkbenchDisplaySettingsEntry;
  decisionTraceZone: WorkbenchDecisionTraceZone;
  meta: WorkbenchEstimatePresentationMeta;
};

export type BuildProposalWorkbenchEstimatePresentationInput = {
  graph: ProposalTemplateGraph;
  sections: ProposalTemplateSection[];
  catalogItems: CatalogItem[];
  optionCustomerView: ProposalBuilderOptionCustomerView | null;
  selectedOptionId: string | null;
  effectiveOptionId?: string | null;
  pricingPolicyConfigured?: boolean;
  quantityContext?: ProposalQuantityPreviewContext | null;
  snapshotQuantityByTemplateItemId?: Record<string, ProposalSnapshotLineQuantityView> | null;
  /** Read-only estimate page settings from draft graph when available. */
  estimatePageSettings?: ProposalPageSettings | null;
  /** Active scope decisions for the selected runtime proposal option (R17D Phase 3A+). */
  activeScopeDecisionsForOption?: ProposalScopeDecision[] | null;
};

type LineClassification =
  | {
      zone: "ready";
      statusKind: WorkbenchEstimateLineStatusKind;
      reasons: WorkbenchAttentionReason[];
    }
  | {
      zone: "attention";
      reasons: WorkbenchAttentionReason[];
    };

function sectionTitle(section: ProposalTemplateSection): string {
  return (section.customer_title ?? section.name).trim() || section.name;
}

function resolveEffectiveOptionId(
  graph: ProposalTemplateGraph,
  selectedOptionId: string | null,
  effectiveOptionId: string | null | undefined
): string | null {
  const explicit = (selectedOptionId ?? "").trim();
  if (explicit) return explicit;
  const provided = (effectiveOptionId ?? "").trim();
  if (provided) return provided;
  return getDefaultSelectedOptionId(graph);
}

function optionLabel(option: ProposalTemplateOption): string {
  return (option.customer_label ?? option.name).trim() || option.name;
}

function resolveSelectionMode(
  graph: ProposalTemplateGraph,
  effectiveOptionId: string | null
): ProposalTemplateOptionSelectionMode {
  const option = graph.options.find((row) => row.id === effectiveOptionId);
  return option?.selection_mode ?? "single";
}

function resolveCustomerSelectionMode(
  optionCount: number,
  selectionMode: ProposalTemplateOptionSelectionMode
): WorkbenchCustomerSelectionMode {
  if (optionCount > 1 || selectionMode === "multi") {
    return "future_signing";
  }
  return "contractor_only";
}

function buildDetailMeta(
  row: ProposalPreviewLineRow,
  quantityStatusLabel: string | null
): WorkbenchLineDetailMeta {
  return {
    source: row.quantitySourceLabel,
    rule: row.quantityRuleLabel,
    unit: row.unitLabel,
    role: row.roleLabel,
    resolvedStatus: quantityStatusLabel,
  };
}

function resolveQtyState(
  row: ProposalPreviewLineRow,
  snapshotQty: ProposalSnapshotLineQuantityView | undefined
): { qtyLabel: string; qtyUnresolved: boolean; quantityStatusLabel: string | null } {
  if (snapshotQty) {
    const qtyLabel = snapshotQty.quantityDisplayLabel ?? "—";
    return {
      qtyLabel,
      qtyUnresolved: snapshotQty.quantityDisplayLabel == null,
      quantityStatusLabel: null,
    };
  }

  return {
    qtyLabel: row.quantityDisplayLabel,
    qtyUnresolved: row.quantityUnresolved,
    quantityStatusLabel: row.quantityStatusLabel || null,
  };
}

function isQtyUnresolved(
  row: ProposalPreviewLineRow,
  snapshotQty: ProposalSnapshotLineQuantityView | undefined
): boolean {
  if (snapshotQty) {
    return snapshotQty.quantityDisplayLabel == null;
  }
  return row.quantityUnresolved;
}

function buildExcludedTemplateItemIdSet(
  decisions: ProposalScopeDecision[] | null | undefined
): Set<string> {
  const excluded = new Set<string>();
  for (const decision of decisions ?? []) {
    if (!decision.active || decision.decisionType !== "excluded") continue;
    const templateItemId = (decision.sourceTemplateItemId ?? "").trim();
    if (templateItemId) {
      excluded.add(templateItemId);
    }
  }
  return excluded;
}

function buildDecisionTraceLine(
  row: ProposalPreviewLineRow,
  snapshotQty: ProposalSnapshotLineQuantityView | undefined
): WorkbenchDecisionTraceLine {
  const qtyState = resolveQtyState(row, snapshotQty);
  const qtyLabel =
    qtyState.qtyLabel && qtyState.qtyLabel !== "—" && !qtyState.qtyUnresolved
      ? qtyState.qtyLabel
      : null;

  return {
    templateItemId: row.id,
    name: row.displayName,
    qtyLabel,
    statusLabel: WORKBENCH_DECISION_TRACE_REMOVED_STATUS,
    detailMeta: buildDetailMeta(row, qtyState.quantityStatusLabel),
  };
}

function buildDecisionTraceBucket(
  lines: WorkbenchDecisionTraceLine[],
  title: string,
  description: string
): WorkbenchDecisionTraceBucket {
  return {
    show: lines.length > 0,
    count: lines.length,
    title,
    description,
    lines,
  };
}

function classifyLine(
  row: ProposalPreviewLineRow,
  lineView: ProposalBuilderLineCustomerView | undefined,
  snapshotQty: ProposalSnapshotLineQuantityView | undefined
): LineClassification {
  if (row.missingCatalog) {
    return { zone: "attention", reasons: ["missing_catalog"] };
  }

  const qtyBlocked = isQtyUnresolved(row, snapshotQty);
  const displayStatus: BuilderLineDisplayStatus | undefined = lineView?.displayStatus;

  if (displayStatus === "not_priced") {
    return { zone: "attention", reasons: ["not_priced"] };
  }

  if (qtyBlocked || displayStatus === "needs_quantity") {
    return { zone: "attention", reasons: ["needs_quantity"] };
  }

  if (!lineView) {
    return { zone: "attention", reasons: ["missing_pricing_view"] };
  }

  if (displayStatus === "included") {
    return { zone: "ready", statusKind: "included", reasons: [] };
  }

  if (displayStatus === "grouped") {
    return { zone: "ready", statusKind: "grouped", reasons: [] };
  }

  if (
    lineView.customerLinePriceCents != null &&
    Number.isFinite(lineView.customerLinePriceCents) &&
    (displayStatus === "priced" || displayStatus === "omitted")
  ) {
    return { zone: "ready", statusKind: "priced", reasons: [] };
  }

  if (displayStatus === "omitted") {
    return { zone: "ready", statusKind: "included", reasons: [] };
  }

  if (displayStatus === "priced" && lineView.showPrice) {
    return { zone: "ready", statusKind: "priced", reasons: [] };
  }

  return { zone: "attention", reasons: ["not_priced"] };
}

function readyAmountLabel(
  statusKind: WorkbenchEstimateLineStatusKind,
  lineView: ProposalBuilderLineCustomerView
): string {
  if (statusKind === "included") return WORKBENCH_LINE_INCLUDED_LABEL;
  if (statusKind === "grouped") return WORKBENCH_LINE_IN_PACKAGE_LABEL;
  if (lineView.customerLinePriceCents != null && Number.isFinite(lineView.customerLinePriceCents)) {
    return formatPriceCents(lineView.customerLinePriceCents);
  }
  return WORKBENCH_ATTENTION_AMOUNT_NOT_PRICED;
}

function attentionAmountLabel(reasons: WorkbenchAttentionReason[]): string {
  if (reasons.includes("missing_catalog")) {
    return WORKBENCH_ATTENTION_AMOUNT_MISSING_CATALOG;
  }
  if (reasons.includes("needs_quantity")) {
    return WORKBENCH_ATTENTION_AMOUNT_NEEDS_QUANTITY;
  }
  return WORKBENCH_ATTENTION_AMOUNT_NOT_PRICED;
}

function attentionKindForReasons(reasons: WorkbenchAttentionReason[]): WorkbenchAttentionKind {
  if (reasons.some((reason) => reason !== "needs_quantity")) {
    return "hard_blocker";
  }
  return "scope_review";
}

function suggestedActionForReasons(
  reasons: WorkbenchAttentionReason[],
  attentionKind: WorkbenchAttentionKind
): string | null {
  if (attentionKind === "scope_review") {
    return WORKBENCH_SCOPE_REVIEW_ROW_HELPER;
  }
  if (reasons.includes("missing_catalog")) {
    return "Link a catalog item for this line.";
  }
  if (reasons.includes("not_priced") || reasons.includes("missing_pricing_view")) {
    return "Check company pricing and catalog setup.";
  }
  return null;
}

function isHiddenFromCustomer(lineView: ProposalBuilderLineCustomerView | undefined): boolean {
  if (!lineView) return false;
  return !lineView.showOnCustomerDocument;
}

function wouldSuppressFromDocument(
  row: ProposalPreviewLineRow,
  lineView: ProposalBuilderLineCustomerView | undefined
): boolean {
  if (row.missingCatalog) return true;
  if (!lineView) return true;
  if (lineView.displayStatus === "needs_quantity" || lineView.displayStatus === "not_priced") {
    return true;
  }
  if (
    lineView.displayStatus === "priced" &&
    lineView.showPrice &&
    lineView.customerLinePriceCents != null &&
    Number.isFinite(lineView.customerLinePriceCents)
  ) {
    return false;
  }
  if (lineView.displayStatus === "included" || lineView.displayStatus === "grouped") {
    return false;
  }
  if (lineView.displayStatus === "omitted") {
    return false;
  }
  return true;
}

function buildScopeLine(
  row: ProposalPreviewLineRow,
  lineView: ProposalBuilderLineCustomerView | undefined,
  classification: Extract<LineClassification, { zone: "ready" }>,
  snapshotQty: ProposalSnapshotLineQuantityView | undefined
): WorkbenchScopeLine {
  const qtyState = resolveQtyState(row, snapshotQty);
  const hiddenFromCustomer = isHiddenFromCustomer(lineView);

  return {
    templateItemId: row.id,
    name: row.displayName,
    qtyLabel: qtyState.qtyLabel,
    qtyUnresolved: qtyState.qtyUnresolved,
    amountLabel: readyAmountLabel(classification.statusKind, lineView!),
    statusKind: classification.statusKind,
    hiddenFromCustomer,
    detailMeta: buildDetailMeta(row, qtyState.quantityStatusLabel),
    attentionReasons: [],
    manualQuantityActive: snapshotQty?.quantitySourceLabel === "Manual",
  };
}

function buildAttentionLine(
  row: ProposalPreviewLineRow,
  lineView: ProposalBuilderLineCustomerView | undefined,
  classification: Extract<LineClassification, { zone: "attention" }>,
  snapshotQty: ProposalSnapshotLineQuantityView | undefined
): WorkbenchAttentionLine {
  const qtyState = resolveQtyState(row, snapshotQty);
  const attentionKind = attentionKindForReasons(classification.reasons);

  return {
    templateItemId: row.id,
    name: row.displayName,
    reasons: classification.reasons,
    attentionKind,
    qtyLabel: qtyState.qtyLabel,
    qtyUnresolved: qtyState.qtyUnresolved,
    amountLabel: attentionAmountLabel(classification.reasons),
    hiddenFromCustomer: isHiddenFromCustomer(lineView),
    detailMeta: buildDetailMeta(row, qtyState.quantityStatusLabel),
    suggestedAction: suggestedActionForReasons(classification.reasons, attentionKind),
  };
}

function buildAttentionBucket(
  lines: WorkbenchAttentionLine[],
  title: string,
  description: string,
  railHint: string | null
): WorkbenchAttentionBucket {
  return {
    show: lines.length > 0,
    count: lines.length,
    title,
    description,
    lines,
    railHint: lines.length > 0 ? railHint : null,
  };
}

function buildUpgradeScopeLine(
  row: ProposalPreviewLineRow,
  lineView: ProposalBuilderLineCustomerView | undefined,
  classification: LineClassification,
  snapshotQty: ProposalSnapshotLineQuantityView | undefined
): WorkbenchScopeLine {
  const qtyState = resolveQtyState(row, snapshotQty);
  const hiddenFromCustomer = isHiddenFromCustomer(lineView);

  if (classification.zone === "ready") {
    return {
      templateItemId: row.id,
      name: row.displayName,
      qtyLabel: qtyState.qtyLabel,
      qtyUnresolved: qtyState.qtyUnresolved,
      amountLabel: readyAmountLabel(classification.statusKind, lineView!),
      statusKind: classification.statusKind,
      hiddenFromCustomer,
      detailMeta: buildDetailMeta(row, qtyState.quantityStatusLabel),
      attentionReasons: [],
      manualQuantityActive: snapshotQty?.quantitySourceLabel === "Manual",
    };
  }

  return {
    templateItemId: row.id,
    name: row.displayName,
    qtyLabel: qtyState.qtyLabel,
    qtyUnresolved: qtyState.qtyUnresolved,
    amountLabel: attentionAmountLabel(classification.reasons),
    statusKind: "priced",
    hiddenFromCustomer,
    detailMeta: buildDetailMeta(row, qtyState.quantityStatusLabel),
    attentionReasons: classification.reasons,
    manualQuantityActive: snapshotQty?.quantitySourceLabel === "Manual",
  };
}

function formatSettingsSummary(settings: ProposalPageSettings | null): string | null {
  if (!settings) return null;
  const parsed = parseEstimatePageSettings(settings);
  const parts: string[] = [];
  parts.push(parsed.show_line_prices ? "line prices on" : "line prices off");
  parts.push(parsed.show_option_totals ? "option totals on" : "option totals off");
  parts.push(parsed.show_section_headings ? "section headings on" : "section headings off");
  return `Template defaults: ${parts.join(", ")}.`;
}

function buildPolicyBanner(pricingPolicyConfigured: boolean): WorkbenchPolicyBanner {
  if (pricingPolicyConfigured) {
    return {
      show: true,
      configured: true,
      copy: "Preview based on your company pricing. Not a sent quote.",
    };
  }

  return {
    show: true,
    configured: false,
    copy:
      "Preview pricing uses a placeholder margin, not your company's configured pricing. Not a customer quote.",
  };
}

function buildTotalsZone(
  optionCustomerView: ProposalBuilderOptionCustomerView | null,
  pricingPolicyConfigured: boolean
): WorkbenchTotalsZone {
  const pricingComplete = optionCustomerView?.pricingComplete ?? false;
  const policyBanner = buildPolicyBanner(pricingPolicyConfigured);

  if (!pricingComplete) {
    return {
      pricingComplete: false,
      showAmounts: false,
      subtotalLabel: null,
      discountLabel: null,
      taxLabel: null,
      totalLabel: null,
      incompleteCopy: WORKBENCH_TOTALS_INCOMPLETE_COPY,
      pricingPolicyConfigured,
      policyBanner,
    };
  }

  const subtotal = optionCustomerView?.customerSubtotalCents ?? null;
  const discount = optionCustomerView?.discountCents ?? null;
  const tax = optionCustomerView?.salesTaxCents ?? null;
  const total = optionCustomerView?.customerTotalCents ?? null;

  if (subtotal == null || total == null) {
    return {
      pricingComplete: false,
      showAmounts: false,
      subtotalLabel: null,
      discountLabel: null,
      taxLabel: null,
      totalLabel: null,
      incompleteCopy: WORKBENCH_TOTALS_INCOMPLETE_COPY,
      pricingPolicyConfigured,
      policyBanner,
    };
  }

  const showDiscount = discount != null && discount !== 0;
  const showTax = tax != null && tax !== 0;

  return {
    pricingComplete: true,
    showAmounts: true,
    subtotalLabel: formatPriceCents(subtotal),
    discountLabel: showDiscount && discount != null ? `−${formatPriceCents(Math.abs(discount))}` : null,
    taxLabel: showTax && tax != null ? formatPriceCents(tax) : null,
    totalLabel: formatPriceCents(total),
    incompleteCopy: null,
    pricingPolicyConfigured,
    policyBanner,
  };
}

function buildPackageZone(
  graph: ProposalTemplateGraph,
  selectedOptionId: string | null,
  effectiveOptionId: string | null
): WorkbenchPackageZone {
  const options = sortTemplateOptionsByOrder(graph.options);
  const selected = options.find((option) => option.id === effectiveOptionId) ?? null;
  const label = selected ? optionLabel(selected) : null;
  const packageMeta = label ? resolvePackageMeta(label) : null;
  const selectionMode = resolveSelectionMode(graph, effectiveOptionId);
  const optionCount = options.length;
  const customerSelectionMode = resolveCustomerSelectionMode(optionCount, selectionMode);

  return {
    selectedOptionId,
    effectiveOptionId,
    label,
    description: packageMeta?.description ?? null,
    bullets: packageMeta ? [...packageMeta.bullets] : [],
    hasExplicitSelection: (selectedOptionId ?? "").trim().length > 0,
    optionCount,
    allOptions: options.map((option) => ({
      id: option.id,
      label: optionLabel(option),
      isSelected: option.id === effectiveOptionId,
      isDefault: option.is_default === true,
      selectionMode: option.selection_mode ?? "single",
    })),
    selectionMode,
    customerSelectionMode,
    customerSigningHint:
      customerSelectionMode === "future_signing" ? WORKBENCH_CUSTOMER_PACKAGE_CHOICE_HINT : null,
  };
}

/**
 * Build contractor workbench estimate presentation for Builder Estimate zones.
 */
export function buildProposalWorkbenchEstimatePresentation(
  input: BuildProposalWorkbenchEstimatePresentationInput
): ProposalWorkbenchEstimatePresentation {
  const catalogById = buildCatalogItemById(input.catalogItems);
  const effectiveOptionId = resolveEffectiveOptionId(
    input.graph,
    input.selectedOptionId,
    input.effectiveOptionId
  );
  const pricingPolicyConfigured = input.pricingPolicyConfigured ?? false;
  const excludedTemplateItemIds = buildExcludedTemplateItemIdSet(input.activeScopeDecisionsForOption);

  const readySections: WorkbenchScopeSection[] = [];
  const attentionLines: WorkbenchAttentionLine[] = [];
  const excludedTraceLines: WorkbenchDecisionTraceLine[] = [];
  const upgradeSections: WorkbenchUpgradeSection[] = [];
  let suppressedDocumentBlockerCount = 0;
  let readyLineCount = 0;
  let attentionLineCount = 0;
  let hardBlockerLineCount = 0;
  let scopeReviewLineCount = 0;
  let excludedLineCount = 0;
  let upgradeLineCount = 0;
  let sourceLineCount = 0;

  const hasTemplateUpgradeSections = input.sections.some(
    (section) => section.kind === "upgrade_group"
  );

  for (const section of input.sections) {
    const rows = buildLinePreviewRowsForSection(
      input.graph,
      section.id,
      catalogById,
      input.quantityContext ?? null
    );

    if (section.kind === "upgrade_group") {
      const lines: WorkbenchScopeLine[] = [];

      for (const row of rows) {
        sourceLineCount += 1;
        const snapshotQty = input.snapshotQuantityByTemplateItemId?.[row.id];
        if (excludedTemplateItemIds.has(row.id)) {
          excludedTraceLines.push(buildDecisionTraceLine(row, snapshotQty));
          excludedLineCount += 1;
          continue;
        }

        const lineView = input.optionCustomerView?.lineByTemplateItemId[row.id];
        const classification = classifyLine(row, lineView, snapshotQty);

        if (wouldSuppressFromDocument(row, lineView)) {
          suppressedDocumentBlockerCount += 1;
        }

        lines.push(buildUpgradeScopeLine(row, lineView, classification, snapshotQty));
        upgradeLineCount += 1;
      }

      upgradeSections.push({
        sectionId: section.id,
        title: sectionTitle(section),
        lines,
      });
      continue;
    }

    if (section.kind !== "line_items") {
      continue;
    }

    const readyLines: WorkbenchScopeLine[] = [];

    for (const row of rows) {
      sourceLineCount += 1;
      const snapshotQty = input.snapshotQuantityByTemplateItemId?.[row.id];
      if (excludedTemplateItemIds.has(row.id)) {
        excludedTraceLines.push(buildDecisionTraceLine(row, snapshotQty));
        excludedLineCount += 1;
        continue;
      }

      const lineView = input.optionCustomerView?.lineByTemplateItemId[row.id];
      const classification = classifyLine(row, lineView, snapshotQty);

      if (wouldSuppressFromDocument(row, lineView)) {
        suppressedDocumentBlockerCount += 1;
      }

      if (classification.zone === "attention") {
        const attentionLine = buildAttentionLine(row, lineView, classification, snapshotQty);
        attentionLines.push(attentionLine);
        attentionLineCount += 1;
        if (attentionLine.attentionKind === "hard_blocker") {
          hardBlockerLineCount += 1;
        } else {
          scopeReviewLineCount += 1;
        }
        continue;
      }

      readyLines.push(buildScopeLine(row, lineView, classification, snapshotQty));
      readyLineCount += 1;
    }

    if (readyLines.length > 0) {
      readySections.push({
        sectionId: section.id,
        title: sectionTitle(section),
        lines: readyLines,
      });
    }
  }

  const upgradeLineTotal = upgradeSections.reduce(
    (sum, section) => sum + section.lines.length,
    0
  );
  const parsedSettings = input.estimatePageSettings
    ? parseEstimatePageSettings(input.estimatePageSettings)
    : null;

  const hardBlockerLines = attentionLines.filter((line) => line.attentionKind === "hard_blocker");
  const scopeReviewLines = attentionLines.filter((line) => line.attentionKind === "scope_review");
  const attentionRailHint =
    attentionLines.length > 0 ? "See Pricing readiness in the rail for setup guidance." : null;

  return {
    page: {
      title: WORKBENCH_ESTIMATE_PAGE_TITLE,
      subtitle: WORKBENCH_ESTIMATE_PAGE_SUBTITLE,
    },
    packageZone: buildPackageZone(input.graph, input.selectedOptionId, effectiveOptionId),
    readyScope: {
      sections: readySections,
    },
    needsAttention: {
      show: attentionLines.length > 0,
      blockingCount: attentionLines.length,
      lines: attentionLines,
      railHint: attentionRailHint,
      hardBlockers: buildAttentionBucket(
        hardBlockerLines,
        WORKBENCH_HARD_BLOCKERS_TITLE,
        WORKBENCH_HARD_BLOCKERS_DESCRIPTION,
        attentionRailHint
      ),
      scopeReview: buildAttentionBucket(
        scopeReviewLines,
        WORKBENCH_SCOPE_REVIEW_TITLE,
        WORKBENCH_SCOPE_REVIEW_DESCRIPTION,
        attentionRailHint
      ),
    },
    upgradesZone: {
      show: hasTemplateUpgradeSections,
      hasTemplateUpgradeSections,
      isEmpty: hasTemplateUpgradeSections && upgradeLineTotal === 0,
      sections: upgradeSections,
      customerSelectionEnabled: false,
      customerSelectionHint: hasTemplateUpgradeSections
        ? WORKBENCH_CUSTOMER_UPGRADE_SELECTION_HINT
        : null,
      emptyCopy:
        hasTemplateUpgradeSections && upgradeLineTotal === 0
          ? WORKBENCH_UPGRADES_EMPTY_COPY
          : null,
    },
    totalsZone: buildTotalsZone(input.optionCustomerView, pricingPolicyConfigured),
    displaySettingsEntry: {
      visible: true,
      enabled: false,
      label: WORKBENCH_DISPLAY_SETTINGS_ENTRY_LABEL,
      comingSoonBadge: WORKBENCH_DISPLAY_SETTINGS_COMING_SOON_BADGE,
      lockedCopy: WORKBENCH_DISPLAY_SETTINGS_LOCKED_COPY,
      currentSettings: parsedSettings,
      settingsSummary: formatSettingsSummary(parsedSettings),
    },
    decisionTraceZone: {
      show: excludedTraceLines.length > 0,
      excluded: buildDecisionTraceBucket(
        excludedTraceLines,
        WORKBENCH_DECISION_TRACE_REMOVED_TITLE,
        WORKBENCH_DECISION_TRACE_REMOVED_DESCRIPTION
      ),
    },
    meta: {
      pricingPolicyConfigured,
      suppressedDocumentBlockerCount,
      readyLineCount,
      attentionLineCount,
      hardBlockerLineCount,
      scopeReviewLineCount,
      excludedLineCount,
      upgradeLineCount,
      sourceLineCount,
    },
  };
}
