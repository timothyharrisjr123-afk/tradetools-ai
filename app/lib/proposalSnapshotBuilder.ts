/**
 * FieldDive Proposal Snapshot Builder (3J2B2).
 *
 * Pure row-shape assembly for proposal draft instantiate payloads.
 * No Supabase, React, stores, APIs, pricing math, or DB writes.
 *
 * Consumed by proposalRecordStore (3J2B3) for insert payloads.
 */

import type { CustomerVisibility } from "@/app/lib/catalogTypes";
import type { ProposalPageContent, ProposalPageSettings, ProposalPageType } from "@/app/lib/proposalPageTypes";
import { formatProposalPageTypeLabel } from "@/app/lib/proposalPageTypes";
import type {
  ProposalGuardrailOutcomeSnapshot,
  ProposalPricingStatusSnapshot,
} from "@/app/lib/proposalLineSnapshotTypes";
import type { ProposalVersionContextEcho, ProposalVersionPolicyEcho } from "@/app/lib/proposalVersionTypes";
import type {
  GuardrailOutcome,
  LinePricingStatus,
  PricingPolicy,
} from "@/app/lib/proposalPricingTypes";
import {
  DEFAULT_ESTIMATE_PAGE_SETTINGS,
  resolveEstimatePageSettingsForOption,
} from "@/app/lib/proposalTemplateEstimateSettings";
import type {
  ProposalTemplate,
  ProposalTemplateItem,
  ProposalTemplateItemRole,
  ProposalTemplateOption,
  ProposalTemplateSection,
} from "@/app/lib/proposalTemplateTypes";
import {
  assertConfiguredPolicyForPersistence,
  assertCustomerSafeLineRow,
  mapEngineLineStatusToSnapshot,
  type PersistablePricingPolicyInput,
} from "@/app/lib/proposalSnapshotStatusMapper";

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class ProposalSnapshotBuilderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProposalSnapshotBuilderError";
  }
}

// ---------------------------------------------------------------------------
// Insert payloads — store assigns ids / FKs when omitted
// ---------------------------------------------------------------------------

export type ProposalPageSnapshotPayload = {
  company_id: string;
  proposal_version_id?: string | null;
  page_type: ProposalPageType;
  sort_order: number;
  title: string;
  customer_title: string | null;
  visible_to_customer: boolean;
  source_template_section_id: string | null;
  content_json: ProposalPageContent;
  settings_json: ProposalPageSettings;
};

export type ProposalOptionSnapshotPayload = {
  company_id: string;
  proposal_version_id?: string | null;
  source_template_option_id: string;
  name: string;
  customer_label: string | null;
  sort_order: number;
  is_default: boolean;
  visible_to_customer: boolean;
  customer_subtotal_cents: number | null;
  discount_cents: number | null;
  sales_tax_cents: number | null;
  customer_total_cents: number | null;
  pricing_complete: boolean;
  blocking_line_count: number;
  guardrail_outcome: ProposalGuardrailOutcomeSnapshot;
  selected_at: string | null;
};

export type ProposalLineItemSnapshotPayload = {
  company_id: string;
  proposal_option_id?: string | null;
  source_template_item_id: string | null;
  catalog_item_id: string | null;
  catalog_seed_key: string | null;
  section_id: string | null;
  page_id: string | null;
  sort_order: number;
  customer_name: string;
  description: string | null;
  role: ProposalTemplateItemRole;
  quantity: number | null;
  quantity_display_label: string;
  quantity_source_label: string | null;
  unit: string | null;
  customer_unit_price_cents: number | null;
  customer_line_total_cents: number | null;
  pricing_status: ProposalPricingStatusSnapshot;
  visible_to_customer: boolean;
  measurement_quantity_key: string | null;
};

export type ProposalInternalSummarySnapshotPayload = {
  company_id: string;
  proposal_option_id?: string | null;
  internal_cost_cents: number | null;
  internal_profit_cents: number | null;
  effective_margin_pct: number | null;
  policy_echo_json: Record<string, unknown> | null;
  computed_at: string;
};

export type ProposalDraftEventPayload = {
  event_type: "created" | "draft_saved";
  payload_json?: Record<string, unknown> | null;
};

export type DraftInstantiatePayload = {
  contextEcho: ProposalVersionContextEcho;
  policyEcho: ProposalVersionPolicyEcho;
  pages: ProposalPageSnapshotPayload[];
  options: ProposalOptionSnapshotPayload[];
  lineItems: ProposalLineItemSnapshotPayload[];
  internalSummaries: ProposalInternalSummarySnapshotPayload[];
  selectedTemplateOptionId: string | null;
  events: ProposalDraftEventPayload[];
};

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export type BuildContextEchoInput = {
  job_id: string;
  job_name?: string | null;
  customer_id?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  address_formatted?: string | null;
  company_name?: string | null;
  company_logo_url?: string | null;
  company_phone?: string | null;
  company_license?: string | null;
  company_address?: string | null;
  company_website?: string | null;
  brand_primary_color?: string | null;
  brand_secondary_color?: string | null;
  show_license_on_cover?: boolean;
  template_id: string;
  template_name?: string | null;
  measurement_record_id?: string | null;
  measurement_quantities_display?: string | null;
};

export type BuildPolicyEchoInput = PersistablePricingPolicyInput & {
  pricingPolicyId?: string | null;
};

export type BuildInternalPolicyEchoInput = {
  policy: PricingPolicy;
  pricingPolicyId?: string | null;
  source?: string;
};

export type MapTemplateSectionsToProposalPagesInput = {
  company_id: string;
  proposal_version_id?: string | null;
  sections: readonly ProposalTemplateSection[];
  /** When set, only sections for this template option become pages. */
  spineOptionId?: string | null;
  /** Template row for estimate display settings metadata (R10c). */
  template?: ProposalTemplate | null;
};

export type PreviewGuardrailState = GuardrailOutcome | "checking" | "loading";

export type OptionPricingSnapshotInput = {
  source_template_option_id: string;
  name: string;
  customer_label?: string | null;
  sort_order: number;
  is_default: boolean;
  visible_to_customer: boolean;
  customer_subtotal_cents: number | null;
  discount_cents: number | null;
  sales_tax_cents: number | null;
  customer_total_cents: number | null;
  pricing_complete: boolean;
  blocking_line_count: number;
  guardrail_outcome: PreviewGuardrailState;
  /** When true and selected_at omitted, uses computedAt or ISO now. */
  is_selected?: boolean;
  selected_at?: string | null;
};

export type BuildOptionSnapshotsInput = {
  company_id: string;
  proposal_version_id?: string | null;
  options: readonly OptionPricingSnapshotInput[];
  computedAt?: string;
};

export type LineItemSnapshotInput = {
  source_template_item_id: string;
  catalog_item_id?: string | null;
  catalog_seed_key?: string | null;
  section_id?: string | null;
  page_id?: string | null;
  sort_order: number;
  customer_name: string;
  description?: string | null;
  role: ProposalTemplateItemRole;
  quantity?: number | null;
  quantity_display_label?: string;
  quantity_source_label?: string | null;
  unit?: string | null;
  customer_unit_price_cents?: number | null;
  customer_line_total_cents?: number | null;
  engineStatus: LinePricingStatus;
  customerVisibility: CustomerVisibility;
  catalogItemMissing?: boolean;
  measurement_quantity_key?: string | null;
};

export type BuildLineItemSnapshotsInput = {
  company_id: string;
  proposal_option_id?: string | null;
  lines: readonly LineItemSnapshotInput[];
};

export type InternalSummarySnapshotInput = {
  internal_cost_cents: number | null;
  internal_profit_cents: number | null;
  effective_margin_pct: number | null;
  policy_echo_json?: Record<string, unknown> | null;
  computed_at?: string;
};

export type BuildInternalSummarySnapshotsInput = {
  company_id: string;
  proposal_option_id?: string | null;
  summary: InternalSummarySnapshotInput;
};

export type DraftInstantiateInput = {
  company_id: string;
  proposal_version_id?: string | null;
  context: BuildContextEchoInput;
  policy: BuildPolicyEchoInput;
  templateOptions: readonly ProposalTemplateOption[];
  templateSections: readonly ProposalTemplateSection[];
  /** Template row for estimate display settings on instantiate (R10c). */
  template?: ProposalTemplate | null;
  optionPricing: readonly OptionPricingSnapshotInput[];
  lineItemsByTemplateOptionId: Readonly<Record<string, readonly LineItemSnapshotInput[]>>;
  internalSummaryByTemplateOptionId: Readonly<
    Record<string, InternalSummarySnapshotInput | undefined>
  >;
  selectedTemplateOptionId?: string | null;
  spineOptionId?: string | null;
  computedAt?: string;
};

// ---------------------------------------------------------------------------
// Guardrail normalization
// ---------------------------------------------------------------------------

const LEGACY_INVALID_GUARDRAIL = new Set(["warning", "blocked"]);

/**
 * Preview/orchestrator guardrail → persistable pass | warn | block only.
 * checking/loading map to block (conservative — never snapshot indeterminate as pass).
 */
export function normalizeGuardrailOutcomeForSnapshot(
  outcome: PreviewGuardrailState | string
): GuardrailOutcome {
  if (outcome === "checking" || outcome === "loading") {
    return "block";
  }
  if (LEGACY_INVALID_GUARDRAIL.has(outcome)) {
    throw new ProposalSnapshotBuilderError(
      `Invalid guardrail outcome for snapshot: ${outcome}`
    );
  }
  if (outcome === "pass" || outcome === "warn" || outcome === "block") {
    return outcome;
  }
  throw new ProposalSnapshotBuilderError(
    `Invalid guardrail outcome for snapshot: ${outcome}`
  );
}

// ---------------------------------------------------------------------------
// Section kind → page type
// ---------------------------------------------------------------------------

function mapSectionKindToPageType(
  section: ProposalTemplateSection
): ProposalPageType | null {
  switch (section.kind) {
    case "line_items":
      return "estimate";
    case "terms":
      return "terms";
    case "warranty":
      return "warranty";
    case "text":
      return resolveTextSectionPageType(section);
    case "image":
      return "photos";
    case "signature_placeholder":
      return "signature";
    case "upgrade_group":
      return null;
    default:
      return null;
  }
}

function resolveTextSectionPageType(section: ProposalTemplateSection): ProposalPageType {
  const meta = section.metadata;
  if (meta && typeof meta === "object" && meta.page_type === "project_overview") {
    return "project_overview";
  }
  const title = `${section.customer_title ?? ""} ${section.name}`.toLowerCase();
  if (title.includes("project overview") || title.includes("overview")) {
    return "project_overview";
  }
  return "custom_text";
}

function sectionVisibleToCustomer(section: ProposalTemplateSection, pageType: ProposalPageType): boolean {
  if (pageType === "signature") {
    return false;
  }
  if (section.customer_visibility === "internal_only") {
    return false;
  }
  return true;
}

function resolveEstimatePageSettingsForMapping(
  template: ProposalTemplate | null | undefined,
  sections: readonly ProposalTemplateSection[],
  optionId: string
): ProposalPageSettings {
  if (!template) {
    return { ...DEFAULT_ESTIMATE_PAGE_SETTINGS };
  }

  return resolveEstimatePageSettingsForOption(
    {
      template,
      options: [],
      sections: [...sections],
      items: [],
    },
    optionId
  );
}

function buildPageContent(section: ProposalTemplateSection): ProposalPageContent {
  const content = section.content;
  if (!content) {
    return {};
  }
  const mediaRefs =
    section.kind === "image" && content.asset_ref
      ? [{ storage_key: content.asset_ref, caption: content.title ?? null, sort_order: 0 }]
      : undefined;
  return {
    body_markdown: content.body_markdown ?? null,
    media_refs: mediaRefs,
    pdf_attachment_key: null,
  };
}

// ---------------------------------------------------------------------------
// A. Context echo
// ---------------------------------------------------------------------------

export function buildContextEcho(input: BuildContextEchoInput): ProposalVersionContextEcho {
  return {
    job_id: input.job_id,
    job_name: input.job_name ?? null,
    customer_id: input.customer_id ?? null,
    customer_name: input.customer_name ?? null,
    customer_email: input.customer_email ?? null,
    customer_phone: input.customer_phone ?? null,
    address_formatted: input.address_formatted ?? null,
    company_name: input.company_name ?? null,
    company_logo_url: input.company_logo_url ?? null,
    company_phone: input.company_phone ?? null,
    company_license: input.company_license ?? null,
    company_address: input.company_address ?? null,
    company_website: input.company_website ?? null,
    brand_primary_color: input.brand_primary_color ?? null,
    brand_secondary_color: input.brand_secondary_color ?? null,
    show_license_on_cover: input.show_license_on_cover ?? false,
    template_id: input.template_id,
    template_name: input.template_name ?? null,
    measurement_record_id: input.measurement_record_id ?? null,
    measurement_quantities_display: input.measurement_quantities_display ?? null,
  };
}

// ---------------------------------------------------------------------------
// B. Customer-safe policy echo
// ---------------------------------------------------------------------------

export function buildPolicyEchoCustomerSafe(input: BuildPolicyEchoInput): ProposalVersionPolicyEcho {
  assertConfiguredPolicyForPersistence(input);
  const policy = input.policy!;

  return {
    pricing_policy_id: input.pricingPolicyId ?? null,
    configured: true,
    profitability_type: policy.profitabilityType,
    default_profitability_pct: policy.defaultProfitabilityPct,
    sales_tax_rate_pct: policy.tax.salesTaxRatePct,
    discount_kind: policy.discount?.kind ?? null,
    discount_value: policy.discount?.value ?? null,
    waste_model: policy.wasteModel,
    quantity_rounding: policy.quantityRounding,
  };
}

// ---------------------------------------------------------------------------
// C. Internal policy echo (contractor-only summaries)
// ---------------------------------------------------------------------------

export function buildInternalPolicyEchoJson(
  input: BuildInternalPolicyEchoInput
): Record<string, unknown> {
  const policy = input.policy;
  return {
    pricing_policy_id: input.pricingPolicyId ?? null,
    source: input.source ?? "company",
    profitability_type: policy.profitabilityType,
    default_profitability_pct: policy.defaultProfitabilityPct,
    minimum_profitability_pct: policy.minimumProfitabilityPct,
    sales_tax_rate_pct: policy.tax.salesTaxRatePct,
    material_purchase_tax_rate_pct: policy.tax.materialPurchaseTaxRatePct ?? null,
    discount_kind: policy.discount?.kind ?? null,
    discount_value: policy.discount?.value ?? null,
    waste_model: policy.wasteModel,
    quantity_rounding: policy.quantityRounding,
    subtotal_override_cents: policy.subtotalOverrideCents ?? null,
  };
}

// ---------------------------------------------------------------------------
// D. Template sections → pages
// ---------------------------------------------------------------------------

export function mapTemplateSectionsToProposalPages(
  input: MapTemplateSectionsToProposalPagesInput
): ProposalPageSnapshotPayload[] {
  const spineOptionId = input.spineOptionId?.trim() || null;
  const sections = input.sections
    .filter((section) => {
      if (spineOptionId && section.option_id !== spineOptionId) {
        return false;
      }
      return mapSectionKindToPageType(section) != null;
    })
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  return sections.map((section, index) => {
    const pageType = mapSectionKindToPageType(section)!;
    const title = (section.name ?? "").trim() || formatProposalPageTypeLabel(pageType);
    const settings_json =
      pageType === "estimate"
        ? resolveEstimatePageSettingsForMapping(
            input.template,
            input.sections,
            section.option_id
          )
        : {};

    return {
      company_id: input.company_id,
      proposal_version_id: input.proposal_version_id ?? null,
      page_type: pageType,
      sort_order: section.sort_order ?? index,
      title,
      customer_title: section.customer_title ?? null,
      visible_to_customer: sectionVisibleToCustomer(section, pageType),
      source_template_section_id: section.id,
      content_json: buildPageContent(section),
      settings_json,
    };
  });
}

// ---------------------------------------------------------------------------
// E. Option snapshots
// ---------------------------------------------------------------------------

export function buildOptionSnapshots(input: BuildOptionSnapshotsInput): ProposalOptionSnapshotPayload[] {
  const computedAt = input.computedAt ?? new Date().toISOString();

  return input.options.map((option) => {
    const guardrail_outcome = normalizeGuardrailOutcomeForSnapshot(option.guardrail_outcome);
    const selectedAt =
      option.selected_at ??
      (option.is_selected ? computedAt : null);

    const payload: ProposalOptionSnapshotPayload = {
      company_id: input.company_id,
      proposal_version_id: input.proposal_version_id ?? null,
      source_template_option_id: option.source_template_option_id,
      name: option.name,
      customer_label: option.customer_label ?? null,
      sort_order: option.sort_order,
      is_default: option.is_default,
      visible_to_customer: option.visible_to_customer,
      customer_subtotal_cents: option.customer_subtotal_cents,
      discount_cents: option.discount_cents,
      sales_tax_cents: option.sales_tax_cents,
      customer_total_cents: option.customer_total_cents,
      pricing_complete: option.pricing_complete,
      blocking_line_count: option.blocking_line_count,
      guardrail_outcome,
      selected_at: selectedAt,
    };

    assertNoLegacyOptionTotalKeys(payload as unknown as Record<string, unknown>);
    return payload;
  });
}

function assertNoLegacyOptionTotalKeys(row: Record<string, unknown>): void {
  for (const legacy of ["subtotal_cents", "tax_cents", "total_cents"] as const) {
    if (Object.prototype.hasOwnProperty.call(row, legacy)) {
      throw new ProposalSnapshotBuilderError(`Legacy option total field: ${legacy}`);
    }
  }
}

// ---------------------------------------------------------------------------
// F. Line item snapshots
// ---------------------------------------------------------------------------

export function buildLineItemSnapshots(
  input: BuildLineItemSnapshotsInput
): ProposalLineItemSnapshotPayload[] {
  const rows: ProposalLineItemSnapshotPayload[] = [];

  for (const line of input.lines) {
    const pricing_status = mapEngineLineStatusToSnapshot({
      engineStatus: line.engineStatus,
      customerVisibility: line.customerVisibility,
      catalogItemMissing: line.catalogItemMissing ?? false,
    });

    const visible_to_customer =
      line.customerVisibility !== "internal_only" &&
      pricing_status !== "omitted" &&
      line.engineStatus !== "hidden";

    const quantityDisplay =
      (line.quantity_display_label ?? "").trim() ||
      (line.quantity != null ? String(line.quantity) : "—");

    const payload: ProposalLineItemSnapshotPayload = {
      company_id: input.company_id,
      proposal_option_id: input.proposal_option_id ?? null,
      source_template_item_id: line.source_template_item_id,
      catalog_item_id: line.catalog_item_id ?? null,
      catalog_seed_key: line.catalog_seed_key ?? null,
      section_id: line.section_id ?? null,
      page_id: line.page_id ?? null,
      sort_order: line.sort_order,
      customer_name: line.customer_name,
      description: line.description ?? null,
      role: line.role,
      quantity: line.quantity ?? null,
      quantity_display_label: quantityDisplay,
      quantity_source_label: line.quantity_source_label ?? null,
      unit: line.unit ?? null,
      customer_unit_price_cents: line.customer_unit_price_cents ?? null,
      customer_line_total_cents: line.customer_line_total_cents ?? null,
      pricing_status,
      visible_to_customer,
      measurement_quantity_key: line.measurement_quantity_key ?? null,
    };

    assertCustomerSafeLineRow(payload as unknown as Record<string, unknown>);
    rows.push(payload);
  }

  return rows;
}

// ---------------------------------------------------------------------------
// G. Internal summary snapshots
// ---------------------------------------------------------------------------

export function buildInternalSummarySnapshots(
  input: BuildInternalSummarySnapshotsInput
): ProposalInternalSummarySnapshotPayload[] {
  const summary = input.summary;
  return [
    {
      company_id: input.company_id,
      proposal_option_id: input.proposal_option_id ?? null,
      internal_cost_cents: summary.internal_cost_cents,
      internal_profit_cents: summary.internal_profit_cents,
      effective_margin_pct: summary.effective_margin_pct,
      policy_echo_json: summary.policy_echo_json ?? null,
      computed_at: summary.computed_at ?? new Date().toISOString(),
    },
  ];
}

// ---------------------------------------------------------------------------
// Helpers — template spine / page linkage
// ---------------------------------------------------------------------------

export function resolveSpineOptionId(
  options: readonly ProposalTemplateOption[],
  explicitSpineOptionId?: string | null
): string | null {
  const explicit = (explicitSpineOptionId ?? "").trim();
  if (explicit) {
    return explicit;
  }
  const sorted = options.slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const defaultOption = sorted.find((o) => o.is_default) ?? sorted[0];
  return defaultOption?.id ?? null;
}

// ---------------------------------------------------------------------------
// H. Draft instantiate payload
// ---------------------------------------------------------------------------

export function buildDraftInstantiatePayload(input: DraftInstantiateInput): DraftInstantiatePayload {
  assertConfiguredPolicyForPersistence(input.policy);

  const computedAt = input.computedAt ?? new Date().toISOString();
  const spineOptionId = resolveSpineOptionId(input.templateOptions, input.spineOptionId);

  const contextEcho = buildContextEcho(input.context);
  const policyEcho = buildPolicyEchoCustomerSafe(input.policy);

  const pages = mapTemplateSectionsToProposalPages({
    company_id: input.company_id,
    proposal_version_id: input.proposal_version_id ?? null,
    sections: input.templateSections,
    spineOptionId,
    template: input.template ?? null,
  });

  const selectedTemplateOptionId =
    (input.selectedTemplateOptionId ?? "").trim() ||
    input.optionPricing.find((o) => o.is_selected)?.source_template_option_id ||
    input.optionPricing.find((o) => o.is_default)?.source_template_option_id ||
    input.optionPricing[0]?.source_template_option_id ||
    null;

  const options = buildOptionSnapshots({
    company_id: input.company_id,
    proposal_version_id: input.proposal_version_id ?? null,
    options: input.optionPricing.map((option) => ({
      ...option,
      is_selected:
        option.is_selected ??
        option.source_template_option_id === selectedTemplateOptionId,
    })),
    computedAt,
  });

  const lineItems: ProposalLineItemSnapshotPayload[] = [];
  const internalSummaries: ProposalInternalSummarySnapshotPayload[] = [];

  for (const option of input.optionPricing) {
    const templateOptionId = option.source_template_option_id;
    const rawLines = input.lineItemsByTemplateOptionId[templateOptionId] ?? [];

    lineItems.push(
      ...buildLineItemSnapshots({
        company_id: input.company_id,
        lines: rawLines,
      })
    );

    const internalInput = input.internalSummaryByTemplateOptionId[templateOptionId];
    if (internalInput) {
      const policyEchoJson =
        internalInput.policy_echo_json ??
        buildInternalPolicyEchoJson({
          policy: input.policy.policy!,
          pricingPolicyId: input.policy.pricingPolicyId ?? null,
          source: input.policy.source,
        });

      internalSummaries.push(
        ...buildInternalSummarySnapshots({
          company_id: input.company_id,
          summary: {
            ...internalInput,
            policy_echo_json: policyEchoJson,
            computed_at: internalInput.computed_at ?? computedAt,
          },
        })
      );
    }
  }

  return {
    contextEcho,
    policyEcho,
    pages,
    options,
    lineItems,
    internalSummaries,
    selectedTemplateOptionId,
    events: [{ event_type: "created", payload_json: { spine_option_id: spineOptionId } }],
  };
}

/** Map template item rows from template graph + pricing line hints (no engine calls). */
export function templateItemToLineInput(
  item: ProposalTemplateItem,
  pricing: {
    engineStatus: LinePricingStatus;
    customerVisibility: CustomerVisibility;
    catalogItemMissing?: boolean;
    customerName?: string;
    quantity?: number | null;
    quantityDisplayLabel?: string;
    quantitySourceLabel?: string | null;
    unit?: string | null;
    customerUnitPriceCents?: number | null;
    customerLineTotalCents?: number | null;
  }
): LineItemSnapshotInput {
  return {
    source_template_item_id: item.id,
    catalog_item_id: item.catalog_item_id ?? null,
    catalog_seed_key: item.catalog_seed_key ?? null,
    section_id: item.section_id,
    sort_order: item.sort_order ?? 0,
    customer_name:
      pricing.customerName ??
      (item.customer_name_override?.trim() || item.catalog_seed_key || "Line item"),
    description: item.description_override ?? null,
    role: item.item_role,
    quantity: pricing.quantity ?? null,
    quantity_display_label: pricing.quantityDisplayLabel,
    quantity_source_label: pricing.quantitySourceLabel ?? null,
    unit: pricing.unit ?? null,
    customer_unit_price_cents: pricing.customerUnitPriceCents ?? null,
    customer_line_total_cents: pricing.customerLineTotalCents ?? null,
    engineStatus: pricing.engineStatus,
    customerVisibility: pricing.customerVisibility,
    catalogItemMissing: pricing.catalogItemMissing,
    measurement_quantity_key: item.quantity_rule?.measurement_quantity_key ?? null,
  };
}
