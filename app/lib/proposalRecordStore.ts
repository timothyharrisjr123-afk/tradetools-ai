/**
 * FieldDive Proposal Record Store (3J2B3).
 *
 * First DB-writing proposal layer — draft create, read, pricing refresh,
 * selected-option update, and append-only events.
 *
 * Uses getSupabaseClient() + RLS (same pattern as jobStore / catalogStore).
 *
 * NOT atomic: Supabase JS issues sequential requests without a guaranteed
 * single DB transaction. On partial failure, earlier rows may persist;
 * callers must treat errors as potentially inconsistent and reconcile manually.
 *
 * No React, Builder UI, APIs, pricing formula changes, or legacy estimator paths.
 */

import type { CatalogItem } from "@/app/lib/catalogTypes";
import { getActiveCatalogItemsByCompany } from "@/app/lib/catalogStore";
import {
  buildProposalCompanyContextEchoFromProfile,
  mergeCompanyBrandingProfile,
} from "@/app/lib/companyBrandingProfile";
import type { CompanyBrandingExtendedFields } from "@/app/lib/companyBrandingProfileStore";
import { getCompanyBrandingProfileResult } from "@/app/lib/companyBrandingProfileStore";
import { normalizeCompanyProfile, type CompanyProfile } from "@/app/lib/companyProfile";
import {
  loadProposalCustomerContextFromDatabase,
  type ProposalContextEchoCustomerFields,
} from "@/app/lib/proposalCustomerContext";
import { getResolvedCompanyPricingPolicy } from "@/app/lib/companyPricingPolicyStore";
import { getSupabaseClient } from "@/app/lib/supabaseClient";
import {
  BUILDER_PREVIEW_ACTOR_ROLE,
  buildProposalBuilderPricingPreview,
  type ProposalBuilderPricingPreview,
} from "@/app/lib/proposalBuilderPricingPreview";
import type { ProposalQuantityPreviewContext } from "@/app/lib/proposalBuilderPreview";
import { buildCatalogItemById, getDefaultSelectedOptionId } from "@/app/lib/proposalBuilderPreview";
import type { ProposalRecord, ProposalRecordStatusSummary } from "@/app/lib/proposalRecordTypes";
import type { ProposalStatus, ProposalVersionKind } from "@/app/lib/proposalLifecycleTypes";
import type { ProposalEventType } from "@/app/lib/proposalLifecycleTypes";
import type { ProposalPageType } from "@/app/lib/proposalPageTypes";
import { PROPOSAL_LINE_CUSTOMER_FORBIDDEN_KEYS } from "@/app/lib/proposalLineSnapshotTypes";
import { priceProposalLine } from "@/app/lib/proposalPricingEngine";
import { mapProposalPricingInput } from "@/app/lib/proposalPricingInputMapper";
import type { PricingActorRole, PricingPolicy } from "@/app/lib/proposalPricingTypes";
import {
  buildDraftInstantiatePayload,
  buildInternalPolicyEchoJson,
  buildLineItemSnapshots,
  templateItemToLineInput,
  type BuildContextEchoInput,
  type DraftInstantiateInput,
  type LineItemSnapshotInput,
  type OptionPricingSnapshotInput,
} from "@/app/lib/proposalSnapshotBuilder";
import { assertConfiguredPolicyForPersistence } from "@/app/lib/proposalSnapshotStatusMapper";
import {
  getProposalTemplateGraph,
  type ProposalTemplateGraph,
} from "@/app/lib/proposalTemplateStore";
import { resolveProposalLineQuantity } from "@/app/lib/proposalQuantityResolver";
import {
  buildDraftInstantiateInputWithScopeDecisions,
  groupScopeDecisionsByTemplateOptionId,
  hasAnyActiveScopeDecisions,
} from "@/app/lib/proposalScopeDecisionMerge";
import type { ProposalScopeDecision } from "@/app/lib/proposalScopeDecisionTypes";
import { getScopeDecisionsForDraftGraph } from "@/app/lib/proposalScopeDecisionStore";
import {
  isEditableProposalPageType,
  mergeProposalPageBodyMarkdown,
} from "@/app/lib/proposalPageContentEditing";
import { canToggleProposalPageVisibility } from "@/app/lib/proposalPageVisibilityEditing";
import type {
  ProposalVersionContextEcho,
  ProposalVersionPolicyEcho,
} from "@/app/lib/proposalVersionTypes";

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class ProposalRecordStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProposalRecordStoreError";
  }
}

// ---------------------------------------------------------------------------
// Write-step labels (tests assert ordering)
// ---------------------------------------------------------------------------

export const CREATE_DRAFT_WRITE_STEPS = [
  "proposals.insert",
  "proposal_versions.insert",
  "proposal_pages.insert",
  "proposal_options.insert",
  "proposal_line_items.insert",
  "proposal_internal_summaries.insert",
  "proposals.update_pointers",
  "proposal_events.insert",
  "jobs.update_active_proposal",
] as const;

export type CreateDraftWriteStep = (typeof CREATE_DRAFT_WRITE_STEPS)[number];

// ---------------------------------------------------------------------------
// DB row shapes (snake_case)
// ---------------------------------------------------------------------------

export type ProposalRow = {
  id: string;
  company_id: string;
  job_id: string | null;
  customer_id: string | null;
  template_id: string | null;
  status: string;
  current_draft_version_id: string | null;
  latest_sent_version_id: string | null;
  signed_version_id: string | null;
  selected_option_id: string | null;
  measurement_record_id: string | null;
  pricing_policy_id: string | null;
  proposal_number: string | null;
  title: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  deleted_at: string | null;
};

export type ProposalVersionRow = {
  id: string;
  company_id: string;
  proposal_id: string;
  version_number: number;
  version_kind: string;
  parent_version_id: string | null;
  frozen_at: string | null;
  context_echo: ProposalVersionContextEcho | Record<string, unknown>;
  policy_echo: ProposalVersionPolicyEcho | Record<string, unknown>;
  created_by: string | null;
  created_at: string;
};

export type ProposalPageRow = {
  id: string;
  company_id: string;
  proposal_version_id: string;
  page_type: ProposalPageType;
  sort_order: number;
  title: string;
  customer_title: string | null;
  visible_to_customer: boolean;
  source_template_section_id: string | null;
  content_json: Record<string, unknown>;
  settings_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type ProposalOptionRow = {
  id: string;
  company_id: string;
  proposal_version_id: string;
  source_template_option_id: string | null;
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
  guardrail_outcome: string;
  selected_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ProposalLineItemRow = {
  id: string;
  company_id: string;
  proposal_option_id: string;
  source_template_item_id: string | null;
  catalog_item_id: string | null;
  catalog_seed_key: string | null;
  section_id: string | null;
  page_id: string | null;
  sort_order: number;
  customer_name: string;
  description: string | null;
  role: string | null;
  quantity: number | null;
  quantity_display_label: string | null;
  quantity_source_label: string | null;
  unit: string | null;
  customer_unit_price_cents: number | null;
  customer_line_total_cents: number | null;
  pricing_status: string;
  visible_to_customer: boolean;
  measurement_quantity_key: string | null;
  created_at: string;
  updated_at: string;
};

export type ProposalInternalSummaryRow = {
  id: string;
  company_id: string;
  proposal_option_id: string;
  internal_cost_cents: number | null;
  internal_profit_cents: number | null;
  effective_margin_pct: number | null;
  policy_echo_json: Record<string, unknown>;
  computed_at: string;
  created_at: string;
  updated_at: string;
};

export type ProposalEventRow = {
  id: string;
  company_id: string;
  proposal_id: string;
  proposal_version_id: string | null;
  event_type: string;
  actor_user_id: string | null;
  payload_json: Record<string, unknown>;
  occurred_at: string;
};

// ---------------------------------------------------------------------------
// Graph read shape
// ---------------------------------------------------------------------------

export type ProposalDraftGraph = {
  proposal: ProposalRecord;
  version: ProposalVersionRow;
  pages: ProposalPageRow[];
  options: ProposalOptionRow[];
  lineItems: ProposalLineItemRow[];
  internalSummaries: ProposalInternalSummaryRow[];
  /** Active scope decisions for the current draft version (R17D Phase 3A+). */
  scopeDecisions: ProposalScopeDecision[];
};

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export type CreateDraftProposalInput = {
  company_id: string;
  job_id: string;
  template_id: string;
  customer_id?: string | null;
  measurement_record_id?: string | null;
  title?: string | null;
  created_by?: string | null;
  selected_template_option_id?: string | null;
  quantity_context?: ProposalQuantityPreviewContext | null;
  context?: Partial<Omit<BuildContextEchoInput, "job_id" | "template_id">>;
  actor_role?: PricingActorRole;
};

export type RefreshDraftPricingInput = {
  quantity_context?: ProposalQuantityPreviewContext | null;
  actor_role?: PricingActorRole;
  /**
   * Current selected measurement id. When provided, the refresh re-stamps the
   * version `context_echo.measurement_record_id` and the proposal header so
   * staleness detection (snapshot id vs current id) clears after refresh.
   */
  measurement_record_id?: string | null;
  /** Customer-safe measurement quantity labels captured at refresh time. */
  measurement_quantities_display?: string | null;
};

export type AppendProposalEventInput = {
  company_id: string;
  proposal_id: string;
  proposal_version_id?: string | null;
  event_type: ProposalEventType;
  actor_user_id?: string | null;
  payload_json?: Record<string, unknown> | null;
};

const PROPOSAL_SELECT =
  "id, company_id, job_id, customer_id, template_id, status, current_draft_version_id, latest_sent_version_id, signed_version_id, selected_option_id, measurement_record_id, pricing_policy_id, proposal_number, title, created_by, updated_by, created_at, updated_at, archived_at, deleted_at";

const PROPOSAL_SUMMARY_SELECT =
  "id, job_id, status, title, proposal_number, template_id, latest_sent_version_id, signed_version_id, updated_at";

const MARGIN_DB_MAX = 99.9999;

// ---------------------------------------------------------------------------
// Injectable deps (tests)
// ---------------------------------------------------------------------------

export type ProposalCompanyContextLoadResult = {
  core: CompanyProfile;
  branding: CompanyBrandingExtendedFields | null;
  /** False when branding read failed; core-only stamping still proceeds. */
  brandingLoadOk: boolean;
};

export type ProposalRecordStoreDeps = {
  getSupabase?: typeof getSupabaseClient;
  getTemplateGraph?: typeof getProposalTemplateGraph;
  getCatalogItems?: typeof getActiveCatalogItemsByCompany;
  getResolvedPolicy?: typeof getResolvedCompanyPricingPolicy;
  loadProposalCompanyContext?: (
    companyId: string,
    supabase: NonNullable<ReturnType<typeof getSupabaseClient>>
  ) => Promise<ProposalCompanyContextLoadResult>;
  loadProposalCustomerContext?: (
    companyId: string,
    customerId: string | null | undefined,
    supabase: NonNullable<ReturnType<typeof getSupabaseClient>>
  ) => Promise<ProposalContextEchoCustomerFields>;
};

function resolveDeps(deps?: ProposalRecordStoreDeps) {
  return {
    getSupabase: deps?.getSupabase ?? getSupabaseClient,
    getTemplateGraph: deps?.getTemplateGraph ?? getProposalTemplateGraph,
    getCatalogItems: deps?.getCatalogItems ?? getActiveCatalogItemsByCompany,
    getResolvedPolicy: deps?.getResolvedPolicy ?? getResolvedCompanyPricingPolicy,
    loadProposalCompanyContext:
      deps?.loadProposalCompanyContext ?? loadProposalCompanyContextFromDatabase,
    loadProposalCustomerContext:
      deps?.loadProposalCustomerContext ?? loadProposalCustomerContextFromDatabase,
  };
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

export function isUuidLike(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const s = value.trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

export function normalizeCompanyId(companyId: string): string | null {
  if (typeof companyId !== "string") return null;
  const id = companyId.trim();
  if (!id || !isUuidLike(id)) return null;
  return id;
}

/**
 * DB CHECK: effective_margin_pct >= 0 AND < 100.
 * Engine may return exactly 100 when cost is zero — clamp to 99.9999.
 */
export function sanitizeEffectiveMarginPct(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  if (value < 0) {
    throw new ProposalRecordStoreError("effective_margin_pct cannot be negative.");
  }
  if (value >= 100) {
    return MARGIN_DB_MAX;
  }
  return value;
}

export function rowToProposalRecord(row: ProposalRow): ProposalRecord {
  return {
    id: row.id,
    company_id: row.company_id,
    job_id: row.job_id ?? "",
    customer_id: row.customer_id,
    template_id: row.template_id ?? "",
    status: row.status as ProposalStatus,
    current_draft_version_id: row.current_draft_version_id,
    latest_sent_version_id: row.latest_sent_version_id,
    signed_version_id: row.signed_version_id,
    selected_option_id: row.selected_option_id,
    measurement_record_id: row.measurement_record_id,
    pricing_policy_id: row.pricing_policy_id,
    proposal_number: row.proposal_number,
    title: row.title,
    created_by: row.created_by,
    updated_by: row.updated_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
    archived_at: row.archived_at,
    deleted_at: row.deleted_at,
  };
}

export function rowToProposalSummary(row: ProposalRow): ProposalRecordStatusSummary {
  return {
    id: row.id,
    job_id: row.job_id ?? "",
    status: row.status as ProposalStatus,
    title: row.title,
    proposal_number: row.proposal_number,
    template_id: row.template_id ?? "",
    latest_sent_version_id: row.latest_sent_version_id,
    signed_version_id: row.signed_version_id,
    updated_at: row.updated_at,
  };
}

/** Map source_template_section_id → runtime page id after pages insert. */
export function buildPageIdByTemplateSectionId(
  pages: ReadonlyArray<{ id: string; source_template_section_id: string | null }>
): Map<string, string> {
  const map = new Map<string, string>();
  for (const page of pages) {
    if (page.source_template_section_id) {
      map.set(page.source_template_section_id, page.id);
    }
  }
  return map;
}

export function assertLineInsertRowCustomerSafe(row: Record<string, unknown>): void {
  for (const key of PROPOSAL_LINE_CUSTOMER_FORBIDDEN_KEYS) {
    if (Object.prototype.hasOwnProperty.call(row, key)) {
      throw new ProposalRecordStoreError(`Forbidden line insert field: ${key}`);
    }
  }
  if (Object.prototype.hasOwnProperty.call(row, "policy_echo_json")) {
    throw new ProposalRecordStoreError("Forbidden line insert field: policy_echo_json");
  }
}

export function resolveTemplateOptionIdForItem(
  graph: ProposalTemplateGraph,
  sourceTemplateItemId: string | null
): string | null {
  if (!sourceTemplateItemId) return null;
  return graph.items.find((item) => item.id === sourceTemplateItemId)?.option_id ?? null;
}

function sortOptionsByOrder<T extends { sort_order?: number | null; id: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const ao = a.sort_order ?? 0;
    const bo = b.sort_order ?? 0;
    if (ao !== bo) return ao - bo;
    return a.id.localeCompare(b.id);
  });
}

function isMissingCatalogLine(itemType: unknown): boolean {
  return itemType == null;
}

function pushWriteStep(steps: CreateDraftWriteStep[], step: CreateDraftWriteStep): void {
  if (steps.length === 0 || steps[steps.length - 1] !== step) {
    steps.push(step);
  }
}

async function fetchCompanyPricingPolicyId(
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>,
  companyId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("company_pricing_policies")
    .select("id")
    .eq("company_id", companyId)
    .maybeSingle();

  if (error || !data?.id) return null;
  return String(data.id);
}

const EMPTY_COMPANY_PROFILE: CompanyProfile = {
  companyName: "",
  phone: "",
  email: "",
  license: "",
  logoDataUrl: "",
  notificationsEmail: "",
};

function companyProfileFromCompaniesRow(row: Record<string, unknown>): CompanyProfile {
  return normalizeCompanyProfile({
    companyName: (row.name ?? "").toString().trim(),
    email: (row.owner_email ?? "").toString().trim(),
    phone: (row.phone ?? "").toString().trim(),
    license: (row.license ?? "").toString().trim(),
    logoDataUrl: typeof row.logo_url === "string" ? row.logo_url.trim() : "",
    notificationsEmail: (row.notifications_email ?? "").toString().trim(),
  });
}

/** DB-truth company core + branding for proposal context_echo stamping (no localStorage). */
export async function loadProposalCompanyContextFromDatabase(
  companyId: string,
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>
): Promise<ProposalCompanyContextLoadResult> {
  const { data: row, error } = await supabase
    .from("companies")
    .select("name, owner_email, phone, license, logo_url, notifications_email")
    .eq("id", companyId)
    .maybeSingle();

  const core =
    error || !row
      ? { ...EMPTY_COMPANY_PROFILE }
      : companyProfileFromCompaniesRow(row as Record<string, unknown>);

  const brandingResult = await getCompanyBrandingProfileResult(companyId);
  if (brandingResult.status === "success" && brandingResult.fields) {
    return { core, branding: brandingResult.fields, brandingLoadOk: true };
  }
  if (brandingResult.status === "missing_row") {
    return { core, branding: null, brandingLoadOk: true };
  }

  return { core, branding: null, brandingLoadOk: false };
}

function mergeCompanyContextEchoInput(
  stamped: ReturnType<typeof buildProposalCompanyContextEchoFromProfile>,
  overrides?: Partial<BuildContextEchoInput>
): Pick<
  BuildContextEchoInput,
  | "company_name"
  | "company_logo_url"
  | "company_phone"
  | "company_license"
  | "company_address"
  | "company_website"
  | "brand_primary_color"
  | "brand_secondary_color"
  | "show_license_on_cover"
> {
  return {
    company_name: overrides?.company_name ?? stamped.company_name,
    company_logo_url: overrides?.company_logo_url ?? stamped.company_logo_url,
    company_phone: overrides?.company_phone ?? stamped.company_phone,
    company_license: overrides?.company_license ?? stamped.company_license,
    company_address: overrides?.company_address ?? stamped.company_address,
    company_website: overrides?.company_website ?? stamped.company_website,
    brand_primary_color: overrides?.brand_primary_color ?? stamped.brand_primary_color,
    brand_secondary_color: overrides?.brand_secondary_color ?? stamped.brand_secondary_color,
    show_license_on_cover: overrides?.show_license_on_cover ?? stamped.show_license_on_cover,
  };
}

function mergeCustomerContextEchoInput(
  stamped: ProposalContextEchoCustomerFields,
  overrides?: Partial<BuildContextEchoInput>
): Pick<
  BuildContextEchoInput,
  "customer_name" | "customer_email" | "customer_phone" | "customer_address"
> {
  return {
    customer_name: overrides?.customer_name ?? stamped.customer_name,
    customer_email: overrides?.customer_email ?? stamped.customer_email,
    customer_phone: overrides?.customer_phone ?? stamped.customer_phone,
    customer_address: overrides?.customer_address ?? stamped.customer_address,
  };
}

/**
 * Build DraftInstantiateInput from live pricing preview + template graph.
 * Pure — no DB.
 */
export function buildDraftInstantiateInputFromPreview(params: {
  companyId: string;
  graph: ProposalTemplateGraph;
  catalogItems: CatalogItem[];
  quantityContext: ProposalQuantityPreviewContext | null;
  preview: ProposalBuilderPricingPreview;
  policy: PricingPolicy;
  pricingPolicyId: string;
  context: BuildContextEchoInput;
  selectedTemplateOptionId?: string | null;
  computedAt?: string;
}): DraftInstantiateInput {
  const catalogById = buildCatalogItemById(params.catalogItems);
  const actorRole = params.preview.actorRole;
  const optionPricing: OptionPricingSnapshotInput[] = [];
  const lineItemsByTemplateOptionId: Record<string, LineItemSnapshotInput[]> = {};
  const internalSummaryByTemplateOptionId: Record<
    string,
    {
      internal_cost_cents: number | null;
      internal_profit_cents: number | null;
      effective_margin_pct: number | null;
    }
  > = {};

  for (const templateOption of sortOptionsByOrder(params.graph.options)) {
    const optionId = templateOption.id;
    const optionPreview = params.preview.byOptionId[optionId];
    if (!optionPreview) continue;

    optionPricing.push({
      source_template_option_id: optionId,
      name: templateOption.name,
      customer_label: templateOption.customer_label ?? null,
      sort_order: templateOption.sort_order ?? 0,
      is_default: templateOption.is_default ?? false,
      visible_to_customer: templateOption.visible_to_customer ?? true,
      customer_subtotal_cents: optionPreview.customer.customerSubtotalCents,
      discount_cents: optionPreview.customer.discountCents,
      sales_tax_cents: optionPreview.customer.salesTaxCents,
      customer_total_cents: optionPreview.customer.customerTotalCents,
      pricing_complete: optionPreview.customer.pricingComplete,
      blocking_line_count: optionPreview.status.blockingLineCount,
      guardrail_outcome: optionPreview.status.guardrailOutcome,
      is_selected: params.preview.selectedOptionId === optionId,
    });

    const mappedInput = mapProposalPricingInput({
      optionId,
      policy: params.policy,
      actorRole,
      graph: params.graph,
      catalogItems: catalogById,
      quantityContext: params.quantityContext,
    });

    const lineInputs: LineItemSnapshotInput[] = [];
    for (const line of mappedInput.lines) {
      const priced = priceProposalLine(line, params.policy);
      const templateItem = params.graph.items.find((item) => item.id === line.templateItemId);
      if (!templateItem) continue;

      const catalog = line.catalogItemId ? catalogById.get(line.catalogItemId) : undefined;
      const qtyPreview = resolveProposalLineQuantity({
        measurementHandoff: params.quantityContext?.measurementHandoff ?? null,
        quantityMap: params.quantityContext?.quantityMap ?? null,
        catalogItem: catalog ?? null,
        templateItem,
      });

      const previewLine = optionPreview.customer.lineByTemplateItemId[line.templateItemId];
      const showPrice = previewLine?.displayStatus === "priced";

      lineInputs.push(
        templateItemToLineInput(templateItem, {
          engineStatus: priced.status,
          customerVisibility: line.customerVisibility,
          catalogItemMissing: isMissingCatalogLine(line.itemType),
          quantity: line.quantity,
          quantityDisplayLabel: qtyPreview.quantityDisplayLabel,
          quantitySourceLabel: qtyPreview.sourceLabel ?? null,
          unit: line.unit,
          customerUnitPriceCents: showPrice ? priced.unitPriceCents : null,
          customerLineTotalCents: showPrice ? priced.linePriceCents : null,
        })
      );
    }
    lineItemsByTemplateOptionId[optionId] = lineInputs;

    internalSummaryByTemplateOptionId[optionId] = {
      internal_cost_cents: optionPreview.internal.internalCostCents,
      internal_profit_cents: optionPreview.internal.internalProfitCents,
      effective_margin_pct: optionPreview.internal.effectiveMarginPct,
    };
  }

  return {
    company_id: params.companyId,
    context: params.context,
    policy: {
      configured: true,
      source: "company",
      policy: params.policy,
      pricingPolicyId: params.pricingPolicyId,
    },
    templateOptions: params.graph.options,
    templateSections: params.graph.sections,
    template: params.graph.template,
    optionPricing,
    lineItemsByTemplateOptionId,
    internalSummaryByTemplateOptionId,
    selectedTemplateOptionId: params.selectedTemplateOptionId ?? params.preview.selectedOptionId,
    computedAt: params.computedAt,
  };
}

// ---------------------------------------------------------------------------
// Validation (DB helpers)
// ---------------------------------------------------------------------------

async function validateCustomerBelongsToCompany(
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>,
  companyId: string,
  customerId: string | null | undefined
): Promise<void> {
  const id = (customerId ?? "").trim();
  if (!id) return;
  if (!isUuidLike(id)) {
    throw new ProposalRecordStoreError("customer_id is not a valid UUID.");
  }

  const { data, error } = await supabase
    .from("customers")
    .select("id")
    .eq("id", id)
    .eq("company_id", companyId)
    .maybeSingle();

  if (error || !data) {
    throw new ProposalRecordStoreError(
      "customer_id does not belong to the same company (fail closed)."
    );
  }
}

async function validateJobBelongsToCompany(
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>,
  companyId: string,
  jobId: string
): Promise<{ customer_id: string | null; job_name: string | null; address_formatted: string | null }> {
  const { data, error } = await supabase
    .from("jobs")
    .select("id, company_id, customer_id, job_name, address_formatted")
    .eq("id", jobId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (error || !data) {
    throw new ProposalRecordStoreError("job_id does not belong to the same company.");
  }

  return {
    customer_id: (data.customer_id as string | null) ?? null,
    job_name: (data.job_name as string | null) ?? null,
    address_formatted: (data.address_formatted as string | null) ?? null,
  };
}

async function loadDraftVersionOrThrow(
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>,
  companyId: string,
  proposal: ProposalRow
): Promise<ProposalVersionRow> {
  const versionId = proposal.current_draft_version_id;
  if (!versionId) {
    throw new ProposalRecordStoreError("Proposal has no current draft version.");
  }

  const { data, error } = await supabase
    .from("proposal_versions")
    .select("*")
    .eq("id", versionId)
    .eq("company_id", companyId)
    .eq("proposal_id", proposal.id)
    .maybeSingle();

  if (error || !data) {
    throw new ProposalRecordStoreError("Draft version not found for proposal.");
  }

  if ((data.version_kind as ProposalVersionKind) !== "draft") {
    throw new ProposalRecordStoreError(
      `Version ${versionId} is not mutable (kind=${data.version_kind}).`
    );
  }

  return data as ProposalVersionRow;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function getProposalById(
  companyId: string,
  proposalId: string,
  deps?: ProposalRecordStoreDeps
): Promise<ProposalRecord | null> {
  const { getSupabase } = resolveDeps(deps);
  const supabase = getSupabase();
  const cid = normalizeCompanyId(companyId);
  const pid = (proposalId ?? "").trim();
  if (!supabase || !cid || !isUuidLike(pid)) return null;

  try {
    const { data, error } = await supabase
      .from("proposals")
      .select(PROPOSAL_SELECT)
      .eq("id", pid)
      .eq("company_id", cid)
      .maybeSingle();

    if (error || !data) return null;
    return rowToProposalRecord(data as ProposalRow);
  } catch {
    return null;
  }
}

export async function listProposalsForJob(
  companyId: string,
  jobId: string,
  deps?: ProposalRecordStoreDeps
): Promise<ProposalRecordStatusSummary[]> {
  const { getSupabase } = resolveDeps(deps);
  const supabase = getSupabase();
  const cid = normalizeCompanyId(companyId);
  const jid = (jobId ?? "").trim();
  if (!supabase || !cid || !isUuidLike(jid)) return [];

  try {
    const { data, error } = await supabase
      .from("proposals")
      .select(PROPOSAL_SUMMARY_SELECT)
      .eq("company_id", cid)
      .eq("job_id", jid)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false });

    if (error || !data) return [];
    return (data as ProposalRow[]).map(rowToProposalSummary);
  } catch {
    return [];
  }
}

export async function getDraftGraph(
  companyId: string,
  proposalId: string,
  deps?: ProposalRecordStoreDeps
): Promise<ProposalDraftGraph | null> {
  const { getSupabase } = resolveDeps(deps);
  const supabase = getSupabase();
  const cid = normalizeCompanyId(companyId);
  const pid = (proposalId ?? "").trim();
  if (!supabase || !cid || !isUuidLike(pid)) return null;

  try {
    const { data: proposalData, error: proposalError } = await supabase
      .from("proposals")
      .select(PROPOSAL_SELECT)
      .eq("id", pid)
      .eq("company_id", cid)
      .maybeSingle();

    if (proposalError || !proposalData) return null;
    const proposal = proposalData as ProposalRow;
    const version = await loadDraftVersionOrThrow(supabase, cid, proposal);

    const versionId = version.id;

    const [pagesRes, optionsRes] = await Promise.all([
      supabase
        .from("proposal_pages")
        .select("*")
        .eq("company_id", cid)
        .eq("proposal_version_id", versionId)
        .order("sort_order"),
      supabase
        .from("proposal_options")
        .select("*")
        .eq("company_id", cid)
        .eq("proposal_version_id", versionId)
        .order("sort_order"),
    ]);

    const options = (optionsRes.data ?? []) as ProposalOptionRow[];
    const optionIds = options.map((o) => o.id);

    let lineItems: ProposalLineItemRow[] = [];
    let internalSummaries: ProposalInternalSummaryRow[] = [];

    if (optionIds.length > 0) {
      const [linesRes, summariesRes] = await Promise.all([
        supabase
          .from("proposal_line_items")
          .select("*")
          .eq("company_id", cid)
          .in("proposal_option_id", optionIds)
          .order("sort_order"),
        supabase
          .from("proposal_internal_summaries")
          .select("*")
          .eq("company_id", cid)
          .in("proposal_option_id", optionIds),
      ]);
      lineItems = (linesRes.data ?? []) as ProposalLineItemRow[];
      internalSummaries = (summariesRes.data ?? []) as ProposalInternalSummaryRow[];
    }

    const scopeDecisions = await getScopeDecisionsForDraftGraph(cid, versionId, deps);

    return {
      proposal: rowToProposalRecord(proposal),
      version,
      pages: (pagesRes.data ?? []) as ProposalPageRow[],
      options,
      lineItems,
      internalSummaries,
      scopeDecisions,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Events (insert-only)
// ---------------------------------------------------------------------------

export async function appendProposalEvent(
  input: AppendProposalEventInput,
  deps?: ProposalRecordStoreDeps
): Promise<ProposalEventRow | null> {
  const { getSupabase } = resolveDeps(deps);
  const supabase = getSupabase();
  const companyId = normalizeCompanyId(input.company_id);
  const proposalId = (input.proposal_id ?? "").trim();
  if (!supabase || !companyId || !isUuidLike(proposalId)) return null;

  try {
    const { data, error } = await supabase
      .from("proposal_events")
      .insert({
        company_id: companyId,
        proposal_id: proposalId,
        proposal_version_id: input.proposal_version_id ?? null,
        event_type: input.event_type,
        actor_user_id: input.actor_user_id ?? null,
        payload_json: input.payload_json ?? {},
      })
      .select("*")
      .single();

    if (error || !data) return null;
    return data as ProposalEventRow;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Create draft (sequential writes — not atomic)
// ---------------------------------------------------------------------------

export type CreateDraftProposalResult = {
  proposal: ProposalRecord;
  versionId: string;
  selectedOptionId: string | null;
  writeSteps: CreateDraftWriteStep[];
};

export async function createDraftProposal(
  input: CreateDraftProposalInput,
  deps?: ProposalRecordStoreDeps
): Promise<CreateDraftProposalResult> {
  const d = resolveDeps(deps);
  const supabase = d.getSupabase();
  const companyId = normalizeCompanyId(input.company_id);
  const jobId = (input.job_id ?? "").trim();
  const templateId = (input.template_id ?? "").trim();

  if (!supabase) {
    throw new ProposalRecordStoreError("Supabase client unavailable.");
  }
  if (!companyId || !isUuidLike(jobId) || !isUuidLike(templateId)) {
    throw new ProposalRecordStoreError("company_id, job_id, and template_id are required UUIDs.");
  }

  const writeSteps: CreateDraftWriteStep[] = [];

  const policyResolution = await d.getResolvedPolicy(companyId);
  const pricingPolicyId = (await fetchCompanyPricingPolicyId(supabase, companyId)) ?? "";

  assertConfiguredPolicyForPersistence({
    configured: policyResolution.configured,
    source: policyResolution.source === "company" ? "company" : policyResolution.source,
    policy: policyResolution.policy,
    pricingPolicyId,
    requirePricingPolicyId: true,
  });

  const policy = policyResolution.policy!;

  const jobEcho = await validateJobBelongsToCompany(supabase, companyId, jobId);

  const inputCustomerId = (input.customer_id ?? "").trim() || null;
  const jobCustomerId = (jobEcho.customer_id ?? "").trim() || null;
  if (inputCustomerId && jobCustomerId && inputCustomerId !== jobCustomerId) {
    throw new ProposalRecordStoreError(
      "customer_id does not match job customer_id (fail closed)."
    );
  }
  const resolvedCustomerId = inputCustomerId ?? jobCustomerId;
  await validateCustomerBelongsToCompany(supabase, companyId, resolvedCustomerId);

  const graph = await d.getTemplateGraph(templateId, { companyId });
  if (!graph) {
    throw new ProposalRecordStoreError("Template graph not found for company.");
  }

  const catalogItems = await d.getCatalogItems(companyId);
  const actorRole = input.actor_role ?? BUILDER_PREVIEW_ACTOR_ROLE;
  const quantityContext = input.quantity_context ?? null;

  const preview = buildProposalBuilderPricingPreview({
    graph,
    catalogItems,
    quantityContext,
    selectedOptionId: input.selected_template_option_id ?? null,
    policy,
    actorRole,
  });

  const companySource = await d.loadProposalCompanyContext(companyId, supabase);
  const mergedCompanyProfile = mergeCompanyBrandingProfile(
    companySource.core,
    companySource.branding ?? {}
  );
  const stampedCompany = buildProposalCompanyContextEchoFromProfile(mergedCompanyProfile);
  const companyEcho = mergeCompanyContextEchoInput(stampedCompany, input.context);

  const customerSource = await d.loadProposalCustomerContext(
    companyId,
    resolvedCustomerId,
    supabase
  );
  const customerEcho = mergeCustomerContextEchoInput(customerSource, input.context);

  const contextEcho: BuildContextEchoInput = {
    job_id: jobId,
    job_name: input.context?.job_name ?? jobEcho.job_name,
    customer_id: resolvedCustomerId,
    ...customerEcho,
    address_formatted: input.context?.address_formatted ?? jobEcho.address_formatted,
    ...companyEcho,
    template_id: templateId,
    template_name: input.context?.template_name ?? graph.template.name,
    measurement_record_id: input.measurement_record_id ?? null,
    measurement_quantities_display: input.context?.measurement_quantities_display ?? null,
  };

  const instantiateInput = buildDraftInstantiateInputFromPreview({
    companyId,
    graph,
    catalogItems,
    quantityContext,
    preview,
    policy,
    pricingPolicyId,
    context: contextEcho,
    selectedTemplateOptionId: input.selected_template_option_id ?? preview.selectedOptionId,
  });

  const payload = buildDraftInstantiatePayload(instantiateInput);

  // --- 1. proposals header ---
  pushWriteStep(writeSteps, "proposals.insert");
  const { data: proposalRow, error: proposalError } = await supabase
    .from("proposals")
    .insert({
      company_id: companyId,
      job_id: jobId,
      customer_id: resolvedCustomerId,
      template_id: templateId,
      status: "draft",
      measurement_record_id: input.measurement_record_id ?? null,
      pricing_policy_id: pricingPolicyId,
      title: input.title ?? graph.template.name,
      created_by: input.created_by ?? null,
    })
    .select(PROPOSAL_SELECT)
    .single();

  if (proposalError || !proposalRow) {
    throw new ProposalRecordStoreError(
      proposalError?.message ?? "Failed to insert proposal header."
    );
  }

  const proposalId = (proposalRow as ProposalRow).id;

  // --- 2. proposal_versions v1 draft ---
  pushWriteStep(writeSteps, "proposal_versions.insert");
  const { data: versionRow, error: versionError } = await supabase
    .from("proposal_versions")
    .insert({
      company_id: companyId,
      proposal_id: proposalId,
      version_number: 1,
      version_kind: "draft",
      parent_version_id: null,
      frozen_at: null,
      context_echo: payload.contextEcho,
      policy_echo: payload.policyEcho,
      created_by: input.created_by ?? null,
    })
    .select("*")
    .single();

  if (versionError || !versionRow) {
    throw new ProposalRecordStoreError(
      versionError?.message ?? "Failed to insert draft version."
    );
  }

  const versionId = (versionRow as ProposalVersionRow).id;

  // --- 3. pages ---
  pushWriteStep(writeSteps, "proposal_pages.insert");
  const insertedPages: ProposalPageRow[] = [];
  for (const page of payload.pages) {
    const { data: pageRow, error: pageError } = await supabase
      .from("proposal_pages")
      .insert({
        company_id: companyId,
        proposal_version_id: versionId,
        page_type: page.page_type,
        sort_order: page.sort_order,
        title: page.title,
        customer_title: page.customer_title,
        visible_to_customer: page.visible_to_customer,
        source_template_section_id: page.source_template_section_id,
        content_json: page.content_json,
        settings_json: page.settings_json,
      })
      .select("*")
      .single();

    if (pageError || !pageRow) {
      throw new ProposalRecordStoreError(pageError?.message ?? "Failed to insert proposal page.");
    }
    insertedPages.push(pageRow as ProposalPageRow);
  }

  const pageIdBySection = buildPageIdByTemplateSectionId(insertedPages);

  // --- 4. options + 5. lines + 6. internal summaries (per template option) ---
  pushWriteStep(writeSteps, "proposal_options.insert");

  const templateOptionIdToRuntimeOptionId = new Map<string, string>();
  let selectedRuntimeOptionId: string | null = null;

  for (const option of payload.options) {
    const { data: optionRow, error: optionError } = await supabase
      .from("proposal_options")
      .insert({
        company_id: companyId,
        proposal_version_id: versionId,
        source_template_option_id: option.source_template_option_id,
        name: option.name,
        customer_label: option.customer_label,
        sort_order: option.sort_order,
        is_default: option.is_default,
        visible_to_customer: option.visible_to_customer,
        customer_subtotal_cents: option.customer_subtotal_cents,
        discount_cents: option.discount_cents,
        sales_tax_cents: option.sales_tax_cents,
        customer_total_cents: option.customer_total_cents,
        pricing_complete: option.pricing_complete,
        blocking_line_count: option.blocking_line_count,
        guardrail_outcome: option.guardrail_outcome,
        selected_at: option.selected_at,
      })
      .select("*")
      .single();

    if (optionError || !optionRow) {
      throw new ProposalRecordStoreError(optionError?.message ?? "Failed to insert proposal option.");
    }

    const runtimeOptionId = (optionRow as ProposalOptionRow).id;
    templateOptionIdToRuntimeOptionId.set(option.source_template_option_id, runtimeOptionId);

    if (
      payload.selectedTemplateOptionId &&
      option.source_template_option_id === payload.selectedTemplateOptionId
    ) {
      selectedRuntimeOptionId = runtimeOptionId;
    } else if (!selectedRuntimeOptionId && option.is_default) {
      selectedRuntimeOptionId = runtimeOptionId;
    }

    const linesForOption =
      instantiateInput.lineItemsByTemplateOptionId[option.source_template_option_id] ?? [];

    const builtLines = buildLineItemSnapshots({
      company_id: companyId,
      proposal_option_id: runtimeOptionId,
      lines: linesForOption,
    });

    pushWriteStep(writeSteps, "proposal_line_items.insert");
    for (const built of builtLines) {
      const insertRow = {
        company_id: companyId,
        proposal_option_id: runtimeOptionId,
        source_template_item_id: built.source_template_item_id,
        catalog_item_id: built.catalog_item_id,
        catalog_seed_key: built.catalog_seed_key,
        section_id: built.section_id,
        page_id: built.section_id ? pageIdBySection.get(built.section_id) ?? null : null,
        sort_order: built.sort_order,
        customer_name: built.customer_name,
        description: built.description,
        role: built.role,
        quantity: built.quantity,
        quantity_display_label: built.quantity_display_label,
        quantity_source_label: built.quantity_source_label,
        unit: built.unit,
        customer_unit_price_cents: built.customer_unit_price_cents,
        customer_line_total_cents: built.customer_line_total_cents,
        pricing_status: built.pricing_status,
        visible_to_customer: built.visible_to_customer,
        measurement_quantity_key: built.measurement_quantity_key,
      };
      assertLineInsertRowCustomerSafe(insertRow);

      const { error: lineError } = await supabase.from("proposal_line_items").insert(insertRow);
      if (lineError) {
        throw new ProposalRecordStoreError(lineError.message ?? "Failed to insert line item.");
      }
    }

    const internalInput =
      instantiateInput.internalSummaryByTemplateOptionId[option.source_template_option_id];
    if (internalInput) {
      pushWriteStep(writeSteps, "proposal_internal_summaries.insert");
      const policyEchoJson = buildInternalPolicyEchoJson({
        policy,
        pricingPolicyId,
        source: "company",
      });

      const { error: summaryError } = await supabase.from("proposal_internal_summaries").insert({
        company_id: companyId,
        proposal_option_id: runtimeOptionId,
        internal_cost_cents: internalInput.internal_cost_cents,
        internal_profit_cents: internalInput.internal_profit_cents,
        effective_margin_pct: sanitizeEffectiveMarginPct(internalInput.effective_margin_pct),
        policy_echo_json: policyEchoJson,
        computed_at: instantiateInput.computedAt ?? new Date().toISOString(),
      });

      if (summaryError) {
        throw new ProposalRecordStoreError(
          summaryError.message ?? "Failed to insert internal summary."
        );
      }
    }
  }

  if (!selectedRuntimeOptionId && templateOptionIdToRuntimeOptionId.size > 0) {
    selectedRuntimeOptionId = [...templateOptionIdToRuntimeOptionId.values()][0] ?? null;
  }

  // --- 7. update proposal pointers ---
  pushWriteStep(writeSteps, "proposals.update_pointers");
  const { error: pointerError } = await supabase
    .from("proposals")
    .update({
      current_draft_version_id: versionId,
      selected_option_id: selectedRuntimeOptionId,
    })
    .eq("id", proposalId)
    .eq("company_id", companyId);

  if (pointerError) {
    throw new ProposalRecordStoreError(pointerError.message ?? "Failed to update proposal pointers.");
  }

  // --- 8. created event ---
  pushWriteStep(writeSteps, "proposal_events.insert");
  await appendProposalEvent(
    {
      company_id: companyId,
      proposal_id: proposalId,
      proposal_version_id: versionId,
      event_type: "created",
      actor_user_id: input.created_by ?? null,
      payload_json: { template_id: templateId, job_id: jobId },
    },
    deps
  );

  // --- 9. jobs.active_proposal_id ---
  pushWriteStep(writeSteps, "jobs.update_active_proposal");
  const { error: jobError } = await supabase
    .from("jobs")
    .update({ active_proposal_id: proposalId })
    .eq("id", jobId)
    .eq("company_id", companyId);

  if (jobError) {
    throw new ProposalRecordStoreError(
      jobError.message ?? "Failed to update jobs.active_proposal_id."
    );
  }

  const refreshed = await getProposalById(companyId, proposalId, deps);
  if (!refreshed) {
    throw new ProposalRecordStoreError("Proposal created but could not be re-read.");
  }

  return {
    proposal: refreshed,
    versionId,
    selectedOptionId: selectedRuntimeOptionId,
    writeSteps,
  };
}

// ---------------------------------------------------------------------------
// Refresh draft pricing (options/lines/summaries only)
// ---------------------------------------------------------------------------

export async function refreshDraftPricing(
  companyId: string,
  proposalId: string,
  input: RefreshDraftPricingInput = {},
  deps?: ProposalRecordStoreDeps
): Promise<ProposalDraftGraph | null> {
  const d = resolveDeps(deps);
  const supabase = d.getSupabase();
  const cid = normalizeCompanyId(companyId);
  const pid = (proposalId ?? "").trim();
  if (!supabase || !cid || !isUuidLike(pid)) return null;

  const { data: proposalData, error: proposalError } = await supabase
    .from("proposals")
    .select(PROPOSAL_SELECT)
    .eq("id", pid)
    .eq("company_id", cid)
    .maybeSingle();

  if (proposalError || !proposalData) return null;
  const proposal = proposalData as ProposalRow;
  const version = await loadDraftVersionOrThrow(supabase, cid, proposal);

  const policyResolution = await d.getResolvedPolicy(cid);
  assertConfiguredPolicyForPersistence({
    configured: policyResolution.configured,
    source: policyResolution.source === "company" ? "company" : policyResolution.source,
    policy: policyResolution.policy,
    pricingPolicyId: proposal.pricing_policy_id,
    requirePricingPolicyId: true,
  });

  const policy = policyResolution.policy!;
  const templateId = proposal.template_id;
  if (!templateId) {
    throw new ProposalRecordStoreError("Proposal has no template_id.");
  }

  const graph = await d.getTemplateGraph(templateId, { companyId: cid });
  if (!graph) {
    throw new ProposalRecordStoreError("Template graph not found.");
  }

  const catalogItems = await d.getCatalogItems(cid);
  const actorRole = input.actor_role ?? BUILDER_PREVIEW_ACTOR_ROLE;
  const quantityContext = input.quantity_context ?? null;

  const selectedTemplateOptionId = await resolveSelectedTemplateOptionId(
    supabase,
    cid,
    proposal,
    graph
  );
  const preview = buildProposalBuilderPricingPreview({
    graph,
    catalogItems,
    quantityContext,
    selectedOptionId: selectedTemplateOptionId,
    policy,
    actorRole,
  });

  const scopeDecisionRows = await getScopeDecisionsForDraftGraph(cid, version.id, deps);
  const { data: optionPointerRows } = await supabase
    .from("proposal_options")
    .select("id, source_template_option_id")
    .eq("company_id", cid)
    .eq("proposal_version_id", version.id);

  const proposalOptionById = new Map(
    (
      (optionPointerRows ?? []) as Array<{
        id: string;
        source_template_option_id: string | null;
      }>
    ).map((row) => [row.id, row] as const)
  );

  const scopeDecisionsByTemplateOptionId = groupScopeDecisionsByTemplateOptionId(
    scopeDecisionRows,
    proposalOptionById
  );

  const instantiateInput = hasAnyActiveScopeDecisions(scopeDecisionsByTemplateOptionId)
    ? buildDraftInstantiateInputWithScopeDecisions({
        companyId: cid,
        graph,
        catalogItems,
        quantityContext,
        preview,
        policy,
        pricingPolicyId: proposal.pricing_policy_id!,
        context: {
          job_id: proposal.job_id ?? "",
          template_id: templateId,
        },
        selectedTemplateOptionId,
        scopeDecisionsByTemplateOptionId,
      }).input
    : buildDraftInstantiateInputFromPreview({
        companyId: cid,
        graph,
        catalogItems,
        quantityContext,
        preview,
        policy,
        pricingPolicyId: proposal.pricing_policy_id!,
        context: {
          job_id: proposal.job_id ?? "",
          template_id: templateId,
        },
        selectedTemplateOptionId,
      });

  const payload = buildDraftInstantiatePayload(instantiateInput);

  const { data: existingOptions } = await supabase
    .from("proposal_options")
    .select("*")
    .eq("company_id", cid)
    .eq("proposal_version_id", version.id);

  const options = (existingOptions ?? []) as ProposalOptionRow[];
  const pageIdBySection = buildPageIdByTemplateSectionId(
    (
      await supabase
        .from("proposal_pages")
        .select("id, source_template_section_id")
        .eq("company_id", cid)
        .eq("proposal_version_id", version.id)
    ).data ?? []
  );

  for (const optionPayload of payload.options) {
    const existing = options.find(
      (o) => o.source_template_option_id === optionPayload.source_template_option_id
    );
    if (!existing) continue;

    await supabase
      .from("proposal_options")
      .update({
        customer_subtotal_cents: optionPayload.customer_subtotal_cents,
        discount_cents: optionPayload.discount_cents,
        sales_tax_cents: optionPayload.sales_tax_cents,
        customer_total_cents: optionPayload.customer_total_cents,
        pricing_complete: optionPayload.pricing_complete,
        blocking_line_count: optionPayload.blocking_line_count,
        guardrail_outcome: optionPayload.guardrail_outcome,
      })
      .eq("id", existing.id)
      .eq("company_id", cid);

    await supabase
      .from("proposal_line_items")
      .delete()
      .eq("company_id", cid)
      .eq("proposal_option_id", existing.id);

    await supabase
      .from("proposal_internal_summaries")
      .delete()
      .eq("company_id", cid)
      .eq("proposal_option_id", existing.id);

    const linesForOption =
      instantiateInput.lineItemsByTemplateOptionId[optionPayload.source_template_option_id] ?? [];

    const builtLines = buildLineItemSnapshots({
      company_id: cid,
      proposal_option_id: existing.id,
      lines: linesForOption,
    });

    for (const built of builtLines) {
      const insertRow = {
        company_id: cid,
        proposal_option_id: existing.id,
        source_template_item_id: built.source_template_item_id,
        catalog_item_id: built.catalog_item_id,
        catalog_seed_key: built.catalog_seed_key,
        section_id: built.section_id,
        page_id: built.section_id ? pageIdBySection.get(built.section_id) ?? null : null,
        sort_order: built.sort_order,
        customer_name: built.customer_name,
        description: built.description,
        role: built.role,
        quantity: built.quantity,
        quantity_display_label: built.quantity_display_label,
        quantity_source_label: built.quantity_source_label,
        unit: built.unit,
        customer_unit_price_cents: built.customer_unit_price_cents,
        customer_line_total_cents: built.customer_line_total_cents,
        pricing_status: built.pricing_status,
        visible_to_customer: built.visible_to_customer,
        measurement_quantity_key: built.measurement_quantity_key,
      };
      assertLineInsertRowCustomerSafe(insertRow);
      await supabase.from("proposal_line_items").insert(insertRow);
    }

    const internalInput =
      instantiateInput.internalSummaryByTemplateOptionId[optionPayload.source_template_option_id];
    if (internalInput) {
      await supabase.from("proposal_internal_summaries").insert({
        company_id: cid,
        proposal_option_id: existing.id,
        internal_cost_cents: internalInput.internal_cost_cents,
        internal_profit_cents: internalInput.internal_profit_cents,
        effective_margin_pct: sanitizeEffectiveMarginPct(internalInput.effective_margin_pct),
        policy_echo_json: buildInternalPolicyEchoJson({
          policy,
          pricingPolicyId: proposal.pricing_policy_id,
          source: "company",
        }),
        computed_at: new Date().toISOString(),
      });
    }
  }

  // Re-stamp the snapshot measurement context so stale detection clears. Merge
  // onto the existing context_echo — never wipe the rest of the customer-safe
  // job/customer/company context captured at create time.
  const stampMeasurementId = input.measurement_record_id !== undefined;
  const stampMeasurementDisplay = input.measurement_quantities_display !== undefined;
  if (stampMeasurementId || stampMeasurementDisplay) {
    const existingContext =
      version.context_echo && typeof version.context_echo === "object"
        ? (version.context_echo as Record<string, unknown>)
        : {};
    const nextContext: Record<string, unknown> = {
      ...existingContext,
      ...(stampMeasurementId
        ? { measurement_record_id: input.measurement_record_id ?? null }
        : {}),
      ...(stampMeasurementDisplay
        ? { measurement_quantities_display: input.measurement_quantities_display ?? null }
        : {}),
    };
    await supabase
      .from("proposal_versions")
      .update({ context_echo: nextContext })
      .eq("id", version.id)
      .eq("company_id", cid);

    if (stampMeasurementId) {
      await supabase
        .from("proposals")
        .update({ measurement_record_id: input.measurement_record_id ?? null })
        .eq("id", pid)
        .eq("company_id", cid);
    }
  }

  await appendProposalEvent(
    {
      company_id: cid,
      proposal_id: pid,
      proposal_version_id: version.id,
      event_type: "draft_saved",
      payload_json: { reason: "refresh_draft_pricing" },
    },
    deps
  );

  return getDraftGraph(cid, pid, deps);
}

async function resolveSelectedTemplateOptionId(
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>,
  companyId: string,
  proposal: ProposalRow,
  graph: ProposalTemplateGraph
): Promise<string | null> {
  if (proposal.selected_option_id) {
    const { data } = await supabase
      .from("proposal_options")
      .select("source_template_option_id")
      .eq("id", proposal.selected_option_id)
      .eq("company_id", companyId)
      .maybeSingle();

    const templateOptionId = (data?.source_template_option_id as string | null) ?? null;
    if (templateOptionId) return templateOptionId;
  }
  return getDefaultSelectedOptionId(graph);
}

// ---------------------------------------------------------------------------
// Update selected option (draft only)
// ---------------------------------------------------------------------------

export async function updateDraftSelectedOption(
  companyId: string,
  proposalId: string,
  optionId: string,
  deps?: ProposalRecordStoreDeps
): Promise<ProposalRecord | null> {
  const { getSupabase } = resolveDeps(deps);
  const supabase = getSupabase();
  const cid = normalizeCompanyId(companyId);
  const pid = (proposalId ?? "").trim();
  const oid = (optionId ?? "").trim();
  if (!supabase || !cid || !isUuidLike(pid) || !isUuidLike(oid)) return null;

  const { data: proposalData, error: proposalError } = await supabase
    .from("proposals")
    .select(PROPOSAL_SELECT)
    .eq("id", pid)
    .eq("company_id", cid)
    .maybeSingle();

  if (proposalError || !proposalData) return null;
  const proposal = proposalData as ProposalRow;
  if ((proposal.status as ProposalStatus) !== "draft") {
    throw new ProposalRecordStoreError("Proposal is not in draft status.");
  }

  const version = await loadDraftVersionOrThrow(supabase, cid, proposal);

  const { data: optionRow, error: optionError } = await supabase
    .from("proposal_options")
    .select("id, proposal_version_id")
    .eq("id", oid)
    .eq("company_id", cid)
    .eq("proposal_version_id", version.id)
    .maybeSingle();

  if (optionError || !optionRow) {
    throw new ProposalRecordStoreError(
      "Option does not belong to the current draft version and company."
    );
  }

  const now = new Date().toISOString();

  const { error: updateError } = await supabase
    .from("proposals")
    .update({ selected_option_id: oid })
    .eq("id", pid)
    .eq("company_id", cid);

  if (updateError) {
    throw new ProposalRecordStoreError(updateError.message ?? "Failed to update selected option.");
  }

  await supabase
    .from("proposal_options")
    .update({ selected_at: null })
    .eq("company_id", cid)
    .eq("proposal_version_id", version.id);

  await supabase
    .from("proposal_options")
    .update({ selected_at: now })
    .eq("id", oid)
    .eq("company_id", cid);

  await appendProposalEvent(
    {
      company_id: cid,
      proposal_id: pid,
      proposal_version_id: version.id,
      event_type: "draft_saved",
      payload_json: { selected_option_id: oid },
    },
    deps
  );

  return getProposalById(cid, pid, deps);
}

// ---------------------------------------------------------------------------
// Update draft proposal page content (body_markdown only)
// ---------------------------------------------------------------------------

export async function updateDraftProposalPageContent(
  companyId: string,
  proposalId: string,
  pageId: string,
  bodyMarkdown: string,
  deps?: ProposalRecordStoreDeps
): Promise<ProposalDraftGraph | null> {
  const { getSupabase } = resolveDeps(deps);
  const supabase = getSupabase();
  const cid = normalizeCompanyId(companyId);
  const pid = (proposalId ?? "").trim();
  const pgId = (pageId ?? "").trim();
  if (!supabase || !cid || !isUuidLike(pid) || !isUuidLike(pgId)) return null;

  const { data: proposalData, error: proposalError } = await supabase
    .from("proposals")
    .select(PROPOSAL_SELECT)
    .eq("id", pid)
    .eq("company_id", cid)
    .maybeSingle();

  if (proposalError || !proposalData) return null;
  const proposal = proposalData as ProposalRow;
  if ((proposal.status as ProposalStatus) !== "draft") {
    throw new ProposalRecordStoreError("Proposal is not in draft status.");
  }

  const version = await loadDraftVersionOrThrow(supabase, cid, proposal);
  const draftVersionId = (proposal.current_draft_version_id ?? "").trim();
  if (!draftVersionId || version.id !== draftVersionId) {
    throw new ProposalRecordStoreError("Proposal draft version is not mutable.");
  }

  const { data: pageData, error: pageError } = await supabase
    .from("proposal_pages")
    .select("*")
    .eq("id", pgId)
    .eq("company_id", cid)
    .eq("proposal_version_id", version.id)
    .maybeSingle();

  if (pageError || !pageData) {
    throw new ProposalRecordStoreError("Proposal page not found for this draft.");
  }

  const page = pageData as ProposalPageRow;
  if (!isEditableProposalPageType(page.page_type)) {
    throw new ProposalRecordStoreError("Proposal page type is not editable.");
  }

  const nextContent = mergeProposalPageBodyMarkdown(page.content_json, bodyMarkdown);
  const now = new Date().toISOString();

  const { error: updateError } = await supabase
    .from("proposal_pages")
    .update({
      content_json: nextContent,
      updated_at: now,
    })
    .eq("id", pgId)
    .eq("company_id", cid)
    .eq("proposal_version_id", version.id);

  if (updateError) {
    throw new ProposalRecordStoreError(
      updateError.message ?? "Failed to update proposal page content."
    );
  }

  await appendProposalEvent(
    {
      company_id: cid,
      proposal_id: pid,
      proposal_version_id: version.id,
      event_type: "draft_saved",
      payload_json: { page_id: pgId, field: "body_markdown" },
    },
    deps
  );

  return getDraftGraph(cid, pid, deps);
}

// ---------------------------------------------------------------------------
// Update draft proposal page visibility (visible_to_customer only)
// ---------------------------------------------------------------------------

export async function updateDraftProposalPageVisibility(
  companyId: string,
  proposalId: string,
  pageId: string,
  visibleToCustomer: boolean,
  deps?: ProposalRecordStoreDeps
): Promise<ProposalDraftGraph | null> {
  const { getSupabase } = resolveDeps(deps);
  const supabase = getSupabase();
  const cid = normalizeCompanyId(companyId);
  const pid = (proposalId ?? "").trim();
  const pgId = (pageId ?? "").trim();
  if (!supabase || !cid || !isUuidLike(pid) || !isUuidLike(pgId)) return null;

  const { data: proposalData, error: proposalError } = await supabase
    .from("proposals")
    .select(PROPOSAL_SELECT)
    .eq("id", pid)
    .eq("company_id", cid)
    .maybeSingle();

  if (proposalError || !proposalData) return null;
  const proposal = proposalData as ProposalRow;
  if ((proposal.status as ProposalStatus) !== "draft") {
    throw new ProposalRecordStoreError("Proposal is not in draft status.");
  }

  const version = await loadDraftVersionOrThrow(supabase, cid, proposal);
  const draftVersionId = (proposal.current_draft_version_id ?? "").trim();
  if (!draftVersionId || version.id !== draftVersionId) {
    throw new ProposalRecordStoreError("Proposal draft version is not mutable.");
  }

  const { data: pageData, error: pageError } = await supabase
    .from("proposal_pages")
    .select("*")
    .eq("id", pgId)
    .eq("company_id", cid)
    .eq("proposal_version_id", version.id)
    .maybeSingle();

  if (pageError || !pageData) {
    throw new ProposalRecordStoreError("Proposal page not found for this draft.");
  }

  const page = pageData as ProposalPageRow;
  if (!canToggleProposalPageVisibility(page.page_type)) {
    throw new ProposalRecordStoreError("Proposal page type visibility is not toggleable.");
  }

  const nextVisible = Boolean(visibleToCustomer);
  if (page.visible_to_customer === nextVisible) {
    return getDraftGraph(cid, pid, deps);
  }

  const now = new Date().toISOString();

  const { error: updateError } = await supabase
    .from("proposal_pages")
    .update({
      visible_to_customer: nextVisible,
      updated_at: now,
    })
    .eq("id", pgId)
    .eq("company_id", cid)
    .eq("proposal_version_id", version.id);

  if (updateError) {
    throw new ProposalRecordStoreError(
      updateError.message ?? "Failed to update proposal page visibility."
    );
  }

  await appendProposalEvent(
    {
      company_id: cid,
      proposal_id: pid,
      proposal_version_id: version.id,
      event_type: "draft_saved",
      payload_json: {
        page_id: pgId,
        field: "visible_to_customer",
        value: nextVisible,
      },
    },
    deps
  );

  return getDraftGraph(cid, pid, deps);
}
