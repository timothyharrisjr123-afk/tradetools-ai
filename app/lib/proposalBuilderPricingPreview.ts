/**
 * FieldDive Proposal Builder Pricing Preview orchestrator (3I-2A).
 *
 * Pure read-only bridge:
 *   3H-3 quantity context → mapProposalPricingInput (3I-1B)
 *   → resolveProposalPricing / priceProposalLine (3I-1A)
 *   → ProposalBuilderPricingPreview DTO.
 *
 * Customer/internal separation is enforced at the DTO boundary: customer views
 * carry ONLY customer-safe fields. Per-line cost/profit/margin are never exposed.
 * Option-level internal profitability (internalCostCents, internalProfitCents,
 * effectiveMarginPct) is exposed on `ProposalBuilderOptionInternalView` for the
 * contractor-only Builder rail (3I-3C) — not for customer document surfaces.
 *
 * No React, Supabase, stores, persistence, legacy estimator, or UI. Guardrails: §6J.
 */

import type { CatalogItem, CustomerVisibility } from "@/app/lib/catalogTypes";
import type { ProposalQuantityPreviewContext } from "@/app/lib/proposalBuilderPreview";
import { getDefaultSelectedOptionId } from "@/app/lib/proposalBuilderPreview";
import { priceProposalLine, resolveProposalPricing } from "@/app/lib/proposalPricingEngine";
import { mapProposalPricingInput } from "@/app/lib/proposalPricingInputMapper";
import {
  DEFAULT_PROFITABILITY_TYPE,
  DEFAULT_QUANTITY_ROUNDING,
  DEFAULT_WASTE_MODEL,
  type GuardrailOutcome,
  type LinePricingStatus,
  type PricingActorRole,
  type PricingLineInput,
  type PricingPolicy,
} from "@/app/lib/proposalPricingTypes";
import type { ProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";
import { mapEngineLineStatusToSnapshot } from "@/app/lib/proposalSnapshotStatusMapper";
import { sortTemplateOptionsByOrder } from "@/app/tools/roofing/templates/templatesSetupUtils";

// ---------------------------------------------------------------------------
// Preview-only policy — NOT persisted, NOT company pricing configuration.
// Builder pricing preview assumption only (loudly labeled in UI later).
// ---------------------------------------------------------------------------

export const BUILDER_PREVIEW_PRICING_POLICY: PricingPolicy = {
  profitabilityType: DEFAULT_PROFITABILITY_TYPE,
  defaultProfitabilityPct: 50,
  minimumProfitabilityPct: 20,
  quantityRounding: DEFAULT_QUANTITY_ROUNDING,
  wasteModel: DEFAULT_WASTE_MODEL,
  discount: null,
  tax: {
    salesTaxRatePct: 0,
    materialPurchaseTaxRatePct: null,
  },
  subtotalOverrideCents: null,
};

export const BUILDER_PREVIEW_ACTOR_ROLE: PricingActorRole = "rep";

// ---------------------------------------------------------------------------
// DTO — customer-safe only
// ---------------------------------------------------------------------------

export type BuilderLineDisplayStatus =
  | "priced"
  | "grouped"
  | "included"
  | "needs_quantity"
  | "not_priced"
  | "omitted";

/** Customer-safe line view, keyed by templateItemId. No cost/profit/margin. */
export type ProposalBuilderLineCustomerView = {
  templateItemId: string;
  sectionId: string | null;
  displayStatus: BuilderLineDisplayStatus;
  showPrice: boolean;
  customerLinePriceCents: number | null;
  customerVisibility: CustomerVisibility;
};

/** Customer-safe option view. Customer totals only — null when blocked. */
export type ProposalBuilderOptionCustomerView = {
  optionId: string;
  pricingComplete: boolean;
  customerSubtotalCents: number | null;
  discountCents: number | null;
  salesTaxCents: number | null;
  customerTotalCents: number | null;
  lines: ProposalBuilderLineCustomerView[];
  lineByTemplateItemId: Record<string, ProposalBuilderLineCustomerView>;
};

/** Status-only option view. No dollar values at all. */
export type ProposalBuilderOptionStatus = {
  optionId: string;
  pricingComplete: boolean;
  blockingLineCount: number;
  guardrailOutcome: GuardrailOutcome;
};

/** Contractor-only option view (3I-3C). Never render on customer document. */
export type ProposalBuilderOptionInternalView = {
  optionId: string;
  internalCostCents: number | null;
  internalProfitCents: number | null;
  effectiveMarginPct: number | null;
};

export type ProposalBuilderOptionPreview = {
  optionId: string;
  customer: ProposalBuilderOptionCustomerView;
  status: ProposalBuilderOptionStatus;
  /** Contractor-only rail — not for customer document / PDF. */
  internal: ProposalBuilderOptionInternalView;
};

export type ProposalBuilderPricingPreview = {
  policyEcho: PricingPolicy;
  actorRole: PricingActorRole;
  selectedOptionId: string | null;
  optionIds: string[];
  byOptionId: Record<string, ProposalBuilderOptionPreview>;
};

export type BuildProposalBuilderPricingPreviewParams = {
  graph: ProposalTemplateGraph | null;
  catalogItems: CatalogItem[] | Map<string, CatalogItem>;
  quantityContext: ProposalQuantityPreviewContext | null;
  selectedOptionId?: string | null;
  policy?: PricingPolicy;
  actorRole?: PricingActorRole;
};

// ---------------------------------------------------------------------------
// Internal helpers (not exported)
// ---------------------------------------------------------------------------

function isBlockingLineStatus(status: LinePricingStatus): boolean {
  return status === "unpriced" || status === "unsupported" || status === "unresolved_quantity";
}

/**
 * A line with no resolved catalog row. The mapper sets itemType to null only
 * when the catalog item is missing/absent (a real CatalogItem.item_type is
 * always present), so this uniquely identifies the missing-catalog case.
 */
function isMissingCatalogLine(line: PricingLineInput): boolean {
  return line.itemType == null;
}

function buildOptionPreview(
  graph: ProposalTemplateGraph,
  optionId: string,
  catalogItems: CatalogItem[] | Map<string, CatalogItem>,
  quantityContext: ProposalQuantityPreviewContext | null,
  policy: PricingPolicy,
  actorRole: PricingActorRole
): ProposalBuilderOptionPreview {
  const mappedInput = mapProposalPricingInput({
    optionId,
    policy,
    actorRole,
    graph,
    catalogItems,
    quantityContext,
  });

  const result = resolveProposalPricing(mappedInput);
  const optionPricing = result.options[0];
  const pricingComplete = optionPricing ? !optionPricing.hasBlockingIssues : true;

  const lines: ProposalBuilderLineCustomerView[] = [];
  const lineByTemplateItemId: Record<string, ProposalBuilderLineCustomerView> = {};
  let blockingLineCount = 0;

  for (const line of mappedInput.lines) {
    const priced = priceProposalLine(line, policy);
    if (isBlockingLineStatus(priced.status)) {
      blockingLineCount += 1;
    }

    const displayStatus = mapEngineLineStatusToSnapshot({
      engineStatus: priced.status,
      customerVisibility: line.customerVisibility,
      catalogItemMissing: isMissingCatalogLine(line),
    });
    const showPrice = displayStatus === "priced";
    const view: ProposalBuilderLineCustomerView = {
      templateItemId: line.templateItemId,
      sectionId: line.sectionId ?? null,
      displayStatus,
      showPrice,
      customerLinePriceCents: showPrice ? priced.linePriceCents : null,
      customerVisibility: line.customerVisibility,
    };
    lines.push(view);
    lineByTemplateItemId[line.templateItemId] = view;
  }

  const customer: ProposalBuilderOptionCustomerView = {
    optionId,
    pricingComplete,
    customerSubtotalCents: optionPricing?.customerSubtotalCents ?? null,
    discountCents: optionPricing?.discountCents ?? null,
    salesTaxCents: optionPricing?.salesTaxCents ?? null,
    customerTotalCents: optionPricing?.customerTotalCents ?? null,
    lines,
    lineByTemplateItemId,
  };

  const status: ProposalBuilderOptionStatus = {
    optionId,
    pricingComplete,
    blockingLineCount,
    guardrailOutcome: optionPricing?.guardrail.outcome ?? "block",
  };

  const internal: ProposalBuilderOptionInternalView = {
    optionId,
    internalCostCents: optionPricing?.internalCostCents ?? null,
    internalProfitCents: optionPricing?.internalProfitCents ?? null,
    effectiveMarginPct: optionPricing?.effectiveMarginPct ?? null,
  };

  return { optionId, customer, status, internal };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build the Builder pricing preview DTO for every template option.
 * Pure — no UI, persistence, or protected-system access.
 */
export function buildProposalBuilderPricingPreview(
  params: BuildProposalBuilderPricingPreviewParams
): ProposalBuilderPricingPreview {
  const policy = params.policy ?? BUILDER_PREVIEW_PRICING_POLICY;
  const actorRole = params.actorRole ?? BUILDER_PREVIEW_ACTOR_ROLE;

  if (!params.graph) {
    return {
      policyEcho: policy,
      actorRole,
      selectedOptionId: null,
      optionIds: [],
      byOptionId: {},
    };
  }

  const optionIds = sortTemplateOptionsByOrder(params.graph.options).map((option) => option.id);

  const byOptionId: Record<string, ProposalBuilderOptionPreview> = {};
  for (const optionId of optionIds) {
    byOptionId[optionId] = buildOptionPreview(
      params.graph,
      optionId,
      params.catalogItems,
      params.quantityContext,
      policy,
      actorRole
    );
  }

  const requestedSelection = (params.selectedOptionId ?? "").trim();
  const selectedOptionId =
    requestedSelection && byOptionId[requestedSelection]
      ? requestedSelection
      : getDefaultSelectedOptionId(params.graph);

  return {
    policyEcho: policy,
    actorRole,
    selectedOptionId,
    optionIds,
    byOptionId,
  };
}
