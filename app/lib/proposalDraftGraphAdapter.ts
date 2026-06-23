/**
 * Pure adapter: persisted ProposalDraftGraph → Builder preview DTOs (3J3D).
 *
 * No Supabase, React, pricing math, or UI. Customer/internal boundaries enforced
 * at the DTO boundary — internal summaries feed rail-only fields only.
 */

import type {
  ProposalBuilderLineCustomerView,
  ProposalBuilderOptionPreview,
  ProposalBuilderPricingPreview,
  BuilderLineDisplayStatus,
} from "@/app/lib/proposalBuilderPricingPreview";
import { BUILDER_PREVIEW_ACTOR_ROLE, BUILDER_PREVIEW_PRICING_POLICY } from "@/app/lib/proposalBuilderPricingPreview";
import type { CustomerVisibility } from "@/app/lib/catalogTypes";
import { PROPOSAL_LINE_CUSTOMER_FORBIDDEN_KEYS } from "@/app/lib/proposalLineSnapshotTypes";
import type { GuardrailOutcome } from "@/app/lib/proposalPricingTypes";
import { PROPOSAL_SNAPSHOT_PRICING_STATUSES } from "@/app/lib/proposalSnapshotStatusMapper";
import { buildProposalDocumentContextFromDraftGraph } from "@/app/lib/proposalDocumentContext";
import type { ProposalDocumentContext } from "@/app/lib/proposalDocumentTokenTypes";
import type {
  ProposalDraftGraph,
  ProposalLineItemRow,
  ProposalOptionRow,
} from "@/app/lib/proposalRecordStore";
import { isUuidLike } from "@/app/lib/jobStore";

export class ProposalDraftGraphAdapterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProposalDraftGraphAdapterError";
  }
}

/**
 * Snapshot quantity view for a persisted line, keyed by template item id.
 * Drives the Builder's no-mixed-truth display: in the persisted path the
 * quantity shown MUST come from the same snapshot as the price.
 */
export type ProposalSnapshotLineQuantityView = {
  templateItemId: string;
  quantityDisplayLabel: string | null;
  quantitySourceLabel: string | null;
  unitLabel: string | null;
};

/** Read-only company branding slice from persisted context_echo (R11c). */
export type ProposalCompanyContext = {
  companyName: string | null;
  companyLogoUrl: string | null;
  companyPhone: string | null;
  companyLicense: string | null;
  companyAddress: string | null;
  companyWebsite: string | null;
  brandPrimaryColor: string | null;
  brandSecondaryColor: string | null;
  showLicenseOnCover: boolean;
};

/** Read-only customer identity slice from persisted context_echo (R12). */
export type ProposalCustomerContext = {
  customerId: string | null;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  customerAddress: string | null;
};

export type ProposalDraftGraphAdapterResult = {
  pricingPreview: ProposalBuilderPricingPreview;
  selectedTemplateOptionId: string | null;
  templateId: string;
  templateTitle: string | null;
  pricingPolicyConfigured: boolean;
  /**
   * Persisted snapshot quantities keyed by template option id → template item id.
   * Same source as the snapshot prices, so the Builder never pairs live
   * quantities with snapshot prices.
   */
  snapshotQuantityByOptionId: Record<
    string,
    Record<string, ProposalSnapshotLineQuantityView>
  >;
  /** measurement_record_id captured in the version snapshot (for staleness). */
  snapshotMeasurementRecordId: string | null;
  /** Customer-safe measurement quantity labels captured at snapshot time. */
  snapshotMeasurementDisplay: string | null;
  /** Company branding stamped on the proposal version context_echo. */
  proposalCompanyContext: ProposalCompanyContext;
  /** Customer identity stamped on the proposal version context_echo. */
  proposalCustomerContext: ProposalCustomerContext;
  /** Frozen document token context for cover/display/PDF (R13). */
  proposalDocumentContext: ProposalDocumentContext;
};

export type ValidateProposalDraftGraphForJobResult =
  | { valid: true }
  | { valid: false; message: string };

const SNAPSHOT_STATUS_SET = new Set<string>(PROPOSAL_SNAPSHOT_PRICING_STATUSES);

const GUARDRAIL_OUTCOMES: readonly GuardrailOutcome[] = ["pass", "warn", "block"];

export function mapSnapshotPricingStatusToBuilderDisplayStatus(
  status: string | null | undefined
): BuilderLineDisplayStatus {
  const normalized = (status ?? "").trim();
  if (SNAPSHOT_STATUS_SET.has(normalized)) {
    return normalized as BuilderLineDisplayStatus;
  }
  return "not_priced";
}

function normalizeGuardrailOutcome(value: string | null | undefined): GuardrailOutcome {
  const v = (value ?? "").trim() as GuardrailOutcome;
  if (GUARDRAIL_OUTCOMES.includes(v)) return v;
  return "block";
}

function isContributingSnapshotDisplayStatus(displayStatus: BuilderLineDisplayStatus): boolean {
  return (
    displayStatus === "priced" ||
    displayStatus === "included" ||
    displayStatus === "grouped"
  );
}

/**
 * Snapshot customerVisibility drives subtotal semantics on persisted totals.
 * hidden-but-in-calc (visible_to_customer false while still priced) stays customer_visible.
 */
export function customerVisibilityForSnapshotLine(
  line: ProposalLineItemRow,
  displayStatus: BuilderLineDisplayStatus
): CustomerVisibility {
  if (displayStatus === "omitted") return "internal_only";
  if (displayStatus === "grouped") return "grouped";
  if (
    line.visible_to_customer === false &&
    isContributingSnapshotDisplayStatus(displayStatus)
  ) {
    return "customer_visible";
  }
  if (line.visible_to_customer === false) return "internal_only";
  return "customer_visible";
}

export function showOnCustomerDocumentForSnapshotLine(
  line: ProposalLineItemRow,
  displayStatus: BuilderLineDisplayStatus
): boolean {
  if (displayStatus === "omitted") return false;
  return line.visible_to_customer !== false;
}

function trimOrNull(value: string | null | undefined): string | null {
  const v = (value ?? "").trim();
  return v ? v : null;
}

function buildSnapshotLineQuantityView(
  line: ProposalLineItemRow
): ProposalSnapshotLineQuantityView | null {
  const templateItemId = (line.source_template_item_id ?? "").trim();
  if (!templateItemId) return null;
  return {
    templateItemId,
    quantityDisplayLabel: trimOrNull(line.quantity_display_label),
    quantitySourceLabel: trimOrNull(line.quantity_source_label),
    unitLabel: trimOrNull(line.unit),
  };
}

function readContextEchoString(
  contextEcho: ProposalDraftGraph["version"]["context_echo"] | null | undefined,
  key: string
): string | null {
  if (!contextEcho || typeof contextEcho !== "object") return null;
  const value = (contextEcho as Record<string, unknown>)[key];
  return typeof value === "string" ? trimOrNull(value) : null;
}

function readContextEchoBoolean(
  contextEcho: ProposalDraftGraph["version"]["context_echo"] | null | undefined,
  key: string
): boolean | null {
  if (!contextEcho || typeof contextEcho !== "object") return null;
  const value = (contextEcho as Record<string, unknown>)[key];
  if (typeof value === "boolean") return value;
  return null;
}

export function readProposalCompanyContextFromEcho(
  contextEcho: ProposalDraftGraph["version"]["context_echo"] | null | undefined
): ProposalCompanyContext {
  return {
    companyName: readContextEchoString(contextEcho, "company_name"),
    companyLogoUrl: readContextEchoString(contextEcho, "company_logo_url"),
    companyPhone: readContextEchoString(contextEcho, "company_phone"),
    companyLicense: readContextEchoString(contextEcho, "company_license"),
    companyAddress: readContextEchoString(contextEcho, "company_address"),
    companyWebsite: readContextEchoString(contextEcho, "company_website"),
    brandPrimaryColor: readContextEchoString(contextEcho, "brand_primary_color"),
    brandSecondaryColor: readContextEchoString(contextEcho, "brand_secondary_color"),
    showLicenseOnCover: readContextEchoBoolean(contextEcho, "show_license_on_cover") ?? false,
  };
}

export function readProposalCustomerContextFromEcho(
  contextEcho: ProposalDraftGraph["version"]["context_echo"] | null | undefined
): ProposalCustomerContext {
  return {
    customerId: readContextEchoString(contextEcho, "customer_id"),
    customerName: readContextEchoString(contextEcho, "customer_name"),
    customerEmail: readContextEchoString(contextEcho, "customer_email"),
    customerPhone: readContextEchoString(contextEcho, "customer_phone"),
    customerAddress: readContextEchoString(contextEcho, "customer_address"),
  };
}

function buildLineCustomerView(line: ProposalLineItemRow): ProposalBuilderLineCustomerView | null {
  const templateItemId = (line.source_template_item_id ?? "").trim();
  if (!templateItemId) return null;

  const displayStatus = mapSnapshotPricingStatusToBuilderDisplayStatus(line.pricing_status);
  const customerLinePriceCents =
    displayStatus === "priced" ? line.customer_line_total_cents : null;

  const customerVisibility = customerVisibilityForSnapshotLine(line, displayStatus);
  const showOnCustomerDocument = showOnCustomerDocumentForSnapshotLine(line, displayStatus);

  return {
    templateItemId,
    sectionId: line.section_id,
    displayStatus,
    showPrice: displayStatus === "priced" && customerLinePriceCents != null,
    customerLinePriceCents,
    customerVisibility,
    showOnCustomerDocument,
  };
}

export function resolveSelectedTemplateOptionIdFromGraph(
  graph: ProposalDraftGraph
): string | null {
  const options = [...graph.options].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
  );

  const selectedRuntimeId = (graph.proposal.selected_option_id ?? "").trim();
  if (selectedRuntimeId) {
    const selected = options.find((o) => o.id === selectedRuntimeId);
    const templateId = (selected?.source_template_option_id ?? "").trim();
    if (templateId) return templateId;
  }

  const defaultOpt = options.find((o) => o.is_default);
  const fallback = defaultOpt ?? options[0];
  const templateId = (fallback?.source_template_option_id ?? "").trim();
  return templateId || null;
}

/** Map Builder/template option tab id → persisted proposal_options.id for draft updates. */
export function resolveRuntimeOptionIdFromTemplateOptionId(
  graph: ProposalDraftGraph,
  templateOptionId: string | null | undefined
): string | null {
  const templateId = (templateOptionId ?? "").trim();
  if (!templateId) return null;

  for (const option of graph.options) {
    const sourceId = (option.source_template_option_id ?? "").trim();
    if (sourceId !== templateId) continue;
    const runtimeId = (option.id ?? "").trim();
    if (runtimeId && isUuidLike(runtimeId)) return runtimeId;
  }
  return null;
}

export function validateProposalDraftGraphForJob(
  graph: ProposalDraftGraph | null,
  jobId: string | null | undefined
): ValidateProposalDraftGraphForJobResult {
  if (!graph) {
    return { valid: false, message: "Could not load persisted proposal draft." };
  }

  if (graph.proposal.status !== "draft") {
    return {
      valid: false,
      message: "Only draft proposals can be opened in Proposal Builder.",
    };
  }

  const expectedJobId = (jobId ?? "").trim();
  if (expectedJobId && isUuidLike(expectedJobId)) {
    const proposalJobId = (graph.proposal.job_id ?? "").trim();
    if (proposalJobId !== expectedJobId) {
      return {
        valid: false,
        message: "This proposal does not belong to the job in the URL.",
      };
    }
  }

  if (graph.options.length === 0) {
    return {
      valid: false,
      message: "Persisted proposal draft has no options to display.",
    };
  }

  return { valid: true };
}

function buildOptionPreview(
  option: ProposalOptionRow,
  lines: ProposalLineItemRow[],
  summary: ProposalDraftGraph["internalSummaries"][number] | undefined
): ProposalBuilderOptionPreview | null {
  const templateOptionId = (option.source_template_option_id ?? "").trim();
  if (!templateOptionId) return null;

  const lineViews: ProposalBuilderLineCustomerView[] = [];
  const lineByTemplateItemId: Record<string, ProposalBuilderLineCustomerView> = {};

  for (const line of lines) {
    const view = buildLineCustomerView(line);
    if (!view) continue;
    lineViews.push(view);
    lineByTemplateItemId[view.templateItemId] = view;

    for (const key of PROPOSAL_LINE_CUSTOMER_FORBIDDEN_KEYS) {
      if (key in line) {
        throw new ProposalDraftGraphAdapterError(
          `Persisted line row contains forbidden customer field: ${key}`
        );
      }
    }
  }

  const customer = {
    optionId: templateOptionId,
    pricingComplete: Boolean(option.pricing_complete),
    customerSubtotalCents: option.customer_subtotal_cents,
    discountCents: option.discount_cents,
    salesTaxCents: option.sales_tax_cents,
    customerTotalCents: option.customer_total_cents,
    lines: lineViews,
    lineByTemplateItemId,
  };

  return {
    optionId: templateOptionId,
    customer,
    status: {
      optionId: templateOptionId,
      pricingComplete: Boolean(option.pricing_complete),
      blockingLineCount: option.blocking_line_count ?? 0,
      guardrailOutcome: normalizeGuardrailOutcome(option.guardrail_outcome),
    },
    internal: {
      optionId: templateOptionId,
      internalCostCents: summary?.internal_cost_cents ?? null,
      internalProfitCents: summary?.internal_profit_cents ?? null,
      effectiveMarginPct: summary?.effective_margin_pct ?? null,
    },
  };
}

/**
 * Map persisted draft graph rows into Builder pricing preview DTOs.
 * Internal summaries remain on option.internal only — never merged into line rows.
 */
export function adaptProposalDraftGraphToBuilderPreview(
  graph: ProposalDraftGraph
): ProposalDraftGraphAdapterResult {
  const linesByRuntimeOptionId = new Map<string, ProposalLineItemRow[]>();
  for (const line of graph.lineItems) {
    const bucket = linesByRuntimeOptionId.get(line.proposal_option_id) ?? [];
    bucket.push(line);
    linesByRuntimeOptionId.set(line.proposal_option_id, bucket);
  }

  const summaryByRuntimeOptionId = new Map(
    graph.internalSummaries.map((s) => [s.proposal_option_id, s] as const)
  );

  const byOptionId: Record<string, ProposalBuilderOptionPreview> = {};
  const optionIds: string[] = [];
  const snapshotQuantityByOptionId: Record<
    string,
    Record<string, ProposalSnapshotLineQuantityView>
  > = {};

  for (const option of graph.options) {
    const optionLines = linesByRuntimeOptionId.get(option.id) ?? [];
    const preview = buildOptionPreview(
      option,
      optionLines,
      summaryByRuntimeOptionId.get(option.id)
    );
    if (!preview) continue;
    optionIds.push(preview.optionId);
    byOptionId[preview.optionId] = preview;

    const snapshotQuantities: Record<string, ProposalSnapshotLineQuantityView> = {};
    for (const line of optionLines) {
      const view = buildSnapshotLineQuantityView(line);
      if (view) snapshotQuantities[view.templateItemId] = view;
    }
    snapshotQuantityByOptionId[preview.optionId] = snapshotQuantities;
  }

  const selectedTemplateOptionId = resolveSelectedTemplateOptionIdFromGraph(graph);

  return {
    pricingPreview: {
      policyEcho: BUILDER_PREVIEW_PRICING_POLICY,
      actorRole: BUILDER_PREVIEW_ACTOR_ROLE,
      selectedOptionId: selectedTemplateOptionId,
      optionIds,
      byOptionId,
    },
    selectedTemplateOptionId,
    templateId: graph.proposal.template_id,
    templateTitle: graph.proposal.title,
    pricingPolicyConfigured: Boolean((graph.proposal.pricing_policy_id ?? "").trim()),
    snapshotQuantityByOptionId,
    snapshotMeasurementRecordId: readContextEchoString(
      graph.version.context_echo,
      "measurement_record_id"
    ),
    snapshotMeasurementDisplay: readContextEchoString(
      graph.version.context_echo,
      "measurement_quantities_display"
    ),
    proposalCompanyContext: readProposalCompanyContextFromEcho(graph.version.context_echo),
    proposalCustomerContext: readProposalCustomerContextFromEcho(graph.version.context_echo),
    proposalDocumentContext: buildProposalDocumentContextFromDraftGraph(graph),
  };
}
