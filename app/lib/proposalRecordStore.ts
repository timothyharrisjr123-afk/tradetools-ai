/**
 * FieldDive Proposal Record Store (3J2B3).
 *
 * First DB-writing proposal layer — draft create, read, pricing refresh,
 * selected-option update, and append-only events.
 *
 * Uses getSupabaseClient() + RLS (same pattern as jobStore / catalogStore).
 *
 * refreshDraftPricing calculation stays in TypeScript; persistence uses transactional
 * RPC `persist_draft_pricing_refresh_v1` by default (see proposalDraftPricingRefreshPersistence).
 * Sequential Supabase writes are available only via USE_REFRESH_DRAFT_PRICING_SEQUENTIAL=1
 * (test/dev escape hatch — non-atomic, partial failure may corrupt the graph).
 *
 * createDraftProposal calculation stays in TypeScript; persistence uses transactional
 * RPC `persist_draft_proposal_create_v1` by default (see proposalDraftCreatePersistence).
 * Sequential Supabase writes are available only via USE_CREATE_DRAFT_PROPOSAL_SEQUENTIAL=1
 * (test/dev escape hatch — non-atomic, partial failure may corrupt the graph).
 *
 * freezeDraftToSentSnapshot uses transactional RPC `persist_proposal_send_freeze_v1` only when
 * USE_PROPOSAL_SEND_FREEZE_RPC=1 (default OFF — see proposalSendFreezeRpcPersistence).
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
import {
  buildFullProposalIdentityEchoSnapshot,
  diffProposalIdentityEcho,
  mergeProposalIdentityEchoIntoContextEcho,
  pickProposalIdentityEchoSnapshot,
  type ProposalIdentityEchoDiff,
  type ProposalIdentityEchoKey,
  type ProposalIdentityEchoSnapshot,
  type ProposalIdentityEchoValue,
} from "@/app/lib/proposalIdentityEcho";
import type { LoadLiveProposalIdentityEchoInput } from "@/app/lib/proposalIdentityEchoLive";
import { composeLiveProposalIdentityEchoFromSources } from "@/app/lib/proposalIdentityEchoLive";
import {
  alignQuantityResolutionEchoToPersistedQuantity,
  resolveProposalLineQuantityViaAdapter,
} from "@/app/lib/proposalQuantityResolutionAdapter";
import {
  buildDraftInstantiateInputWithScopeDecisions,
  groupScopeDecisionsByTemplateOptionId,
  hasAnyActiveScopeDecisions,
} from "@/app/lib/proposalScopeDecisionMerge";
import type { ProposalScopeDecision } from "@/app/lib/proposalScopeDecisionTypes";
import { getScopeDecisionsForDraftGraph } from "@/app/lib/proposalScopeDecisionStore";
import {
  buildDraftPricingRefreshPersistPayload,
  isRefreshDraftPricingSequentialEnabled,
  persistDraftPricingRefreshSequential,
  persistDraftPricingRefreshViaRpc,
  ProposalDraftPricingRefreshPersistenceError,
} from "@/app/lib/proposalDraftPricingRefreshPersistence";
import {
  assertDraftProposalCreateGraphInvariants,
  buildDraftProposalCreatePersistPayload,
  isCreateDraftProposalSequentialEnabled,
  persistDraftProposalCreateSequential,
  persistDraftProposalCreateViaRpc,
  PERSIST_DRAFT_PROPOSAL_CREATE_RPC_V1,
  ProposalDraftCreatePersistenceError,
} from "@/app/lib/proposalDraftCreatePersistence";
import {
  buildProposalSendFreezePersistPayload,
  validateProposalSendFreezePersistPayload,
  validateSendFreezeGraphIntegrity,
} from "@/app/lib/proposalSendFreezePersistence";
import type { ProposalSendFreezeReadiness } from "@/app/lib/proposalSendFreezeReadiness";
import { deriveProposalSendFreezeReadiness } from "@/app/lib/proposalSendFreezeReadiness";
import {
  isProposalSendFreezeRpcEnabled,
  PERSIST_PROPOSAL_SEND_FREEZE_RPC_V1,
  persistProposalSendFreezeViaRpc,
  ProposalSendFreezeRpcPersistenceError,
} from "@/app/lib/proposalSendFreezeRpcPersistence";
import {
  isEditableProposalPageType,
  mergeProposalPageBodyMarkdown,
} from "@/app/lib/proposalPageContentEditing";
import {
  canEditProposalPageEstimateSettings,
  estimatePageSettingsChanged,
  mergeProposalPageSettingsJson,
} from "@/app/lib/proposalPageEstimateSettingsEditing";
import { canToggleProposalPageVisibility } from "@/app/lib/proposalPageVisibilityEditing";
import type { ProposalPageSettings } from "@/app/lib/proposalPageTypes";
import {
  validateEstimatePageSettingsPatch,
  type EstimatePageSettingsPatch,
} from "@/app/lib/proposalTemplateEstimateSettings";
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

/** RPC persist step label when create uses transactional RPC (default path). */
export const CREATE_DRAFT_RPC_PERSIST_STEP = PERSIST_DRAFT_PROPOSAL_CREATE_RPC_V1;

/** RPC persist step label when send-freeze uses transactional RPC (opt-in only). */
export const PROPOSAL_SEND_FREEZE_RPC_PERSIST_STEP = PERSIST_PROPOSAL_SEND_FREEZE_RPC_V1;

export type CreateDraftWriteStep =
  | (typeof CREATE_DRAFT_WRITE_STEPS)[number]
  | typeof CREATE_DRAFT_RPC_PERSIST_STEP;

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
  /**
   * Quantity-resolution audit echo (DB jsonb). Internal row awareness only.
   * Populated by draft create/refresh when quantity resolution stamps an echo.
   * Not customer-facing; customer/public DTOs omit this field.
   */
  quantity_resolution_echo?: Record<string, unknown> | null;
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

/** Explicit-version graph read shape (R18C1) — no scope decisions on sent/signed snapshots. */
export type ProposalVersionGraph = {
  proposal: ProposalRecord;
  version: ProposalVersionRow;
  pages: ProposalPageRow[];
  options: ProposalOptionRow[];
  lineItems: ProposalLineItemRow[];
  internalSummaries: ProposalInternalSummaryRow[];
};

export type GetProposalVersionGraphOptions = {
  /** When true, only `sent` and `signed` versions are allowed (public customer planning). */
  requireSentVersion?: boolean;
  /** When false (default), internal summaries are omitted from the graph. */
  includeInternalSummaries?: boolean;
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
  "id, job_id, status, title, proposal_number, template_id, selected_option_id, latest_sent_version_id, signed_version_id, created_at, updated_at";

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
  loadLiveProposalIdentityEcho?: (
    input: LoadLiveProposalIdentityEchoInput,
    storeDeps?: ProposalRecordStoreDeps
  ) => Promise<Record<ProposalIdentityEchoKey, ProposalIdentityEchoValue>>;
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
    loadLiveProposalIdentityEcho:
      deps?.loadLiveProposalIdentityEcho ?? loadLiveProposalIdentityEchoForDraftProposal,
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
    selected_option_id: row.selected_option_id ?? null,
    latest_sent_version_id: row.latest_sent_version_id,
    signed_version_id: row.signed_version_id,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at,
  };
}

/**
 * Light read for Job Card draft-open summary — package/option label only.
 * Does not load graph, pricing, or pages.
 */
export async function getProposalOptionLabel(
  companyId: string,
  optionId: string,
  deps?: ProposalRecordStoreDeps
): Promise<string | null> {
  const cid = normalizeCompanyId(companyId);
  const oid = typeof optionId === "string" ? optionId.trim() : "";
  if (!cid || !isUuidLike(oid)) return null;
  const { getSupabase } = resolveDeps(deps);
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("proposal_options")
    .select("name, customer_label")
    .eq("company_id", cid)
    .eq("id", oid)
    .maybeSingle();
  if (error || !data) return null;
  const customerLabel =
    typeof data.customer_label === "string" ? data.customer_label.trim() : "";
  const name = typeof data.name === "string" ? data.name.trim() : "";
  return customerLabel || name || null;
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

  const brandingResult = await getCompanyBrandingProfileResult(companyId, supabase);
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
  | "company_email"
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
    company_email: overrides?.company_email ?? stamped.company_email,
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
      const qtyResolved = resolveProposalLineQuantityViaAdapter(
        {
          measurementHandoff: params.quantityContext?.measurementHandoff ?? null,
          quantityMap: params.quantityContext?.quantityMap ?? null,
          catalogItem: catalog ?? null,
          templateItem,
        },
        { wasteModel: params.policy.wasteModel }
      );
      const qtyPreview = qtyResolved.preview;
      const quantityResolutionEcho = alignQuantityResolutionEchoToPersistedQuantity(
        qtyResolved.quantityResolutionEcho,
        line.quantity
      );

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
          quantityResolutionEcho,
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

const PUBLIC_CUSTOMER_PROPOSAL_VERSION_KINDS: readonly ProposalVersionKind[] = [
  "sent",
  "signed",
] as const;

function isPublicCustomerProposalVersionKind(kind: ProposalVersionKind): boolean {
  return (PUBLIC_CUSTOMER_PROPOSAL_VERSION_KINDS as readonly string[]).includes(kind);
}

async function loadProposalVersionRow(
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>,
  companyId: string,
  proposalId: string,
  versionId: string,
  options: GetProposalVersionGraphOptions = {}
): Promise<ProposalVersionRow | null> {
  const { data, error } = await supabase
    .from("proposal_versions")
    .select("*")
    .eq("id", versionId)
    .eq("company_id", companyId)
    .eq("proposal_id", proposalId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const version = data as ProposalVersionRow;
  const kind = version.version_kind as ProposalVersionKind;

  if (options.requireSentVersion && !isPublicCustomerProposalVersionKind(kind)) {
    throw new ProposalRecordStoreError(
      `Version ${versionId} is not a sent/signed snapshot (kind=${version.version_kind}).`
    );
  }

  return version;
}

async function loadProposalVersionChildRows(
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>,
  companyId: string,
  versionId: string,
  includeInternalSummaries: boolean
): Promise<{
  pages: ProposalPageRow[];
  options: ProposalOptionRow[];
  lineItems: ProposalLineItemRow[];
  internalSummaries: ProposalInternalSummaryRow[];
}> {
  const [pagesRes, optionsRes] = await Promise.all([
    supabase
      .from("proposal_pages")
      .select("*")
      .eq("company_id", companyId)
      .eq("proposal_version_id", versionId)
      .order("sort_order"),
    supabase
      .from("proposal_options")
      .select("*")
      .eq("company_id", companyId)
      .eq("proposal_version_id", versionId)
      .order("sort_order"),
  ]);

  const options = (optionsRes.data ?? []) as ProposalOptionRow[];
  const optionIds = options.map((o) => o.id);

  let lineItems: ProposalLineItemRow[] = [];
  let internalSummaries: ProposalInternalSummaryRow[] = [];

  if (optionIds.length > 0) {
    const lineItemsPromise = supabase
      .from("proposal_line_items")
      .select("*")
      .eq("company_id", companyId)
      .in("proposal_option_id", optionIds)
      .order("sort_order");

    if (includeInternalSummaries) {
      const [linesRes, summariesRes] = await Promise.all([
        lineItemsPromise,
        supabase
          .from("proposal_internal_summaries")
          .select("*")
          .eq("company_id", companyId)
          .in("proposal_option_id", optionIds),
      ]);
      lineItems = (linesRes.data ?? []) as ProposalLineItemRow[];
      internalSummaries = (summariesRes.data ?? []) as ProposalInternalSummaryRow[];
    } else {
      const { data: linesData } = await lineItemsPromise;
      lineItems = (linesData ?? []) as ProposalLineItemRow[];
    }
  }

  return {
    pages: (pagesRes.data ?? []) as ProposalPageRow[],
    options,
    lineItems,
    internalSummaries,
  };
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

    const { pages, options, lineItems, internalSummaries } = await loadProposalVersionChildRows(
      supabase,
      cid,
      versionId,
      true
    );

    const scopeDecisions = await getScopeDecisionsForDraftGraph(cid, versionId, deps);

    return {
      proposal: rowToProposalRecord(proposal),
      version,
      pages,
      options,
      lineItems,
      internalSummaries,
      scopeDecisions,
    };
  } catch {
    return null;
  }
}

/**
 * Read-only explicit proposal version graph (R18C1).
 * Never falls back to current_draft_version_id; never loads scope decisions.
 */
export async function getProposalVersionGraph(
  companyId: string,
  proposalId: string,
  versionId: string,
  options: GetProposalVersionGraphOptions = {},
  deps?: ProposalRecordStoreDeps
): Promise<ProposalVersionGraph | null> {
  const { getSupabase } = resolveDeps(deps);
  const supabase = getSupabase();
  const cid = normalizeCompanyId(companyId);
  const pid = (proposalId ?? "").trim();
  const vid = (versionId ?? "").trim();
  if (!supabase || !cid || !isUuidLike(pid) || !isUuidLike(vid)) return null;

  try {
    const { data: proposalData, error: proposalError } = await supabase
      .from("proposals")
      .select(PROPOSAL_SELECT)
      .eq("id", pid)
      .eq("company_id", cid)
      .maybeSingle();

    if (proposalError || !proposalData) return null;

    const version = await loadProposalVersionRow(supabase, cid, pid, vid, options);
    if (!version) return null;
    const includeInternalSummaries = options.includeInternalSummaries === true;
    const { pages, options: optionRows, lineItems, internalSummaries } =
      await loadProposalVersionChildRows(supabase, cid, vid, includeInternalSummaries);

    return {
      proposal: rowToProposalRecord(proposalData as ProposalRow),
      version,
      pages,
      options: optionRows,
      lineItems,
      internalSummaries,
    };
  } catch (error) {
    if (error instanceof ProposalRecordStoreError) throw error;
    return null;
  }
}

/**
 * Convenience read of proposals.latest_sent_version_id via explicit version loader.
 * Not for public token routes without token-bound version validation (R18C+).
 */
export async function getLatestSentProposalVersionGraph(
  companyId: string,
  proposalId: string,
  options: GetProposalVersionGraphOptions = {},
  deps?: ProposalRecordStoreDeps
): Promise<ProposalVersionGraph | null> {
  const proposal = await getProposalById(companyId, proposalId, deps);
  const sentVersionId = (proposal?.latest_sent_version_id ?? "").trim();
  if (!proposal || !sentVersionId || !isUuidLike(sentVersionId)) return null;

  return getProposalVersionGraph(companyId, proposalId, sentVersionId, options, deps);
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
  const resolvedTitle = input.title ?? graph.template.name;

  const persistPayload = buildDraftProposalCreatePersistPayload({
    companyId,
    jobId,
    customerId: resolvedCustomerId,
    templateId,
    measurementRecordId: input.measurement_record_id ?? null,
    pricingPolicyId,
    title: resolvedTitle,
    createdBy: input.created_by ?? null,
    instantiatePayload: payload,
    instantiateInput,
    policy,
  });

  try {
    assertDraftProposalCreateGraphInvariants(persistPayload);
  } catch (error) {
    if (error instanceof ProposalDraftCreatePersistenceError) {
      throw new ProposalRecordStoreError(error.message);
    }
    throw error;
  }

  let persistResult;
  let writeSteps: CreateDraftWriteStep[];

  if (isCreateDraftProposalSequentialEnabled()) {
    try {
      persistResult = await persistDraftProposalCreateSequential(supabase, persistPayload);
    } catch (error) {
      if (error instanceof ProposalDraftCreatePersistenceError) {
        throw new ProposalRecordStoreError(error.message);
      }
      throw error;
    }
    writeSteps = [...CREATE_DRAFT_WRITE_STEPS];
  } else {
    try {
      persistResult = await persistDraftProposalCreateViaRpc(supabase, persistPayload);
    } catch (error) {
      if (error instanceof ProposalDraftCreatePersistenceError) {
        throw new ProposalRecordStoreError(error.message);
      }
      throw error;
    }
    writeSteps = [CREATE_DRAFT_RPC_PERSIST_STEP];
  }

  const refreshed = await getProposalById(companyId, persistResult.proposal_id, deps);
  if (!refreshed) {
    throw new ProposalRecordStoreError("Proposal created but could not be re-read.");
  }

  return {
    proposal: refreshed,
    versionId: persistResult.proposal_version_id,
    selectedOptionId: persistResult.selected_option_id,
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

  const stampMeasurementId = input.measurement_record_id !== undefined;
  const stampMeasurementDisplay = input.measurement_quantities_display !== undefined;
  const measurementStamp =
    stampMeasurementId || stampMeasurementDisplay
      ? {
          ...(stampMeasurementId
            ? { measurement_record_id: input.measurement_record_id ?? null }
            : {}),
          ...(stampMeasurementDisplay
            ? { measurement_quantities_display: input.measurement_quantities_display ?? null }
            : {}),
          context_echo: {
            ...(version.context_echo && typeof version.context_echo === "object"
              ? (version.context_echo as Record<string, unknown>)
              : {}),
            ...(stampMeasurementId
              ? { measurement_record_id: input.measurement_record_id ?? null }
              : {}),
            ...(stampMeasurementDisplay
              ? {
                  measurement_quantities_display:
                    input.measurement_quantities_display ?? null,
                }
              : {}),
          },
        }
      : null;

  const persistPayload = buildDraftPricingRefreshPersistPayload({
    companyId: cid,
    proposalId: pid,
    proposalVersionId: version.id,
    instantiatePayload: payload,
    instantiateInput,
    existingOptions: options.map((row) => ({
      id: row.id,
      source_template_option_id: row.source_template_option_id,
    })),
    pageIdBySection,
    policy,
    pricingPolicyId: proposal.pricing_policy_id!,
    measurementStamp,
  });

  try {
    if (isRefreshDraftPricingSequentialEnabled()) {
      await persistDraftPricingRefreshSequential(supabase, persistPayload);
    } else {
      await persistDraftPricingRefreshViaRpc(supabase, persistPayload);
    }
  } catch (error) {
    if (error instanceof ProposalDraftPricingRefreshPersistenceError) {
      throw new ProposalRecordStoreError(error.message);
    }
    throw error;
  }

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

// ---------------------------------------------------------------------------
// Update draft proposal estimate page display settings (settings_json only)
// ---------------------------------------------------------------------------

export async function updateDraftProposalPageSettings(
  companyId: string,
  proposalId: string,
  pageId: string,
  settingsPatch: EstimatePageSettingsPatch,
  deps?: ProposalRecordStoreDeps
): Promise<ProposalDraftGraph | null> {
  const validation = validateEstimatePageSettingsPatch(settingsPatch);
  if (!validation.valid) {
    throw new ProposalRecordStoreError(validation.reason);
  }

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
  if (!canEditProposalPageEstimateSettings(page.page_type)) {
    throw new ProposalRecordStoreError("Proposal page type does not support estimate display settings.");
  }

  if (!estimatePageSettingsChanged(page.settings_json, settingsPatch)) {
    return getDraftGraph(cid, pid, deps);
  }

  const nextSettings = mergeProposalPageSettingsJson(page.settings_json, settingsPatch);
  const now = new Date().toISOString();

  const { error: updateError } = await supabase
    .from("proposal_pages")
    .update({
      settings_json: nextSettings as ProposalPageSettings,
      updated_at: now,
    })
    .eq("id", pgId)
    .eq("company_id", cid)
    .eq("proposal_version_id", version.id);

  if (updateError) {
    throw new ProposalRecordStoreError(
      updateError.message ?? "Failed to update proposal page settings."
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
        field: "settings_json",
        patch: settingsPatch,
      },
    },
    deps
  );

  return getDraftGraph(cid, pid, deps);
}

const PROPOSAL_IDENTITY_ECHO_SELECT =
  "id, company_id, job_id, customer_id, template_id, signed_version_id, proposal_number, title, current_draft_version_id";

export async function loadLiveProposalIdentityEchoForDraftProposal(
  input: LoadLiveProposalIdentityEchoInput,
  deps?: ProposalRecordStoreDeps
): Promise<Record<ProposalIdentityEchoKey, ProposalIdentityEchoValue>> {
  const d = resolveDeps(deps);
  const supabase = d.getSupabase();
  const companyId = normalizeCompanyId(input.companyId);
  const proposalId = (input.proposalId ?? "").trim();

  if (!supabase || !companyId || !isUuidLike(proposalId)) {
    throw new ProposalRecordStoreError("company_id and proposal_id are required UUIDs.");
  }

  const { data: proposalRow, error: proposalError } = await supabase
    .from("proposals")
    .select(PROPOSAL_IDENTITY_ECHO_SELECT)
    .eq("id", proposalId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (proposalError || !proposalRow) {
    throw new ProposalRecordStoreError("Proposal not found.");
  }

  const jobId = (input.jobId ?? (proposalRow.job_id as string | null) ?? "").trim();
  if (!jobId || !isUuidLike(jobId)) {
    throw new ProposalRecordStoreError("job_id is required.");
  }

  const jobEcho = await validateJobBelongsToCompany(supabase, companyId, jobId);

  const companySource = await d.loadProposalCompanyContext(companyId, supabase);
  const mergedCompanyProfile = mergeCompanyBrandingProfile(
    companySource.core,
    companySource.branding ?? {}
  );
  const companyEcho = buildProposalCompanyContextEchoFromProfile(mergedCompanyProfile);

  const proposalCustomerId = (proposalRow.customer_id as string | null) ?? null;
  const resolvedCustomerId = proposalCustomerId ?? jobEcho.customer_id;
  const customerEcho = await d.loadProposalCustomerContext(
    companyId,
    resolvedCustomerId,
    supabase
  );

  const templateId = (proposalRow.template_id as string | null) ?? null;
  let templateName: string | null = null;
  if (templateId) {
    const graph = await d.getTemplateGraph(templateId, { companyId });
    templateName = (graph?.template.name ?? "").trim() || null;
  }

  const proposalNumber = ((proposalRow.proposal_number as string | null) ?? "").trim() || null;
  const proposalTitle = ((proposalRow.title as string | null) ?? "").trim() || null;

  return composeLiveProposalIdentityEchoFromSources({
    companyEcho,
    customerEcho,
    jobName: jobEcho.job_name,
    addressFormatted: jobEcho.address_formatted,
    templateName,
    proposalNumber,
    proposalTitle,
  });
}

/** Alias matching Stage B planning name. */
export const buildLiveProposalIdentityEchoForDraftProposal =
  loadLiveProposalIdentityEchoForDraftProposal;

// ---------------------------------------------------------------------------
// Restamp draft identity echo (Stage B — identity/contact/project display)
// ---------------------------------------------------------------------------

export type RestampDraftProposalIdentityEchoInput = {
  /** When provided, skips live DB load — for tests and explicit caller control. */
  liveIdentity?: ProposalIdentityEchoSnapshot;
  jobId?: string | null;
};

export type RestampDraftProposalIdentityEchoResult = {
  restamped: boolean;
  skipped: boolean;
  skipReason?: "signed_snapshot";
  changedFields: ProposalIdentityEchoDiff[];
  before: ProposalIdentityEchoSnapshot;
  after: ProposalIdentityEchoSnapshot;
  proposalUpdatedAt: string | null;
};

export async function restampDraftProposalIdentityEcho(
  companyId: string,
  proposalId: string,
  input: RestampDraftProposalIdentityEchoInput = {},
  deps?: ProposalRecordStoreDeps
): Promise<RestampDraftProposalIdentityEchoResult> {
  const d = resolveDeps(deps);
  const supabase = d.getSupabase();
  const cid = normalizeCompanyId(companyId);
  const pid = (proposalId ?? "").trim();

  if (!supabase || !cid || !isUuidLike(pid)) {
    throw new ProposalRecordStoreError("company_id and proposal_id are required UUIDs.");
  }

  const { data: proposalData, error: proposalError } = await supabase
    .from("proposals")
    .select(PROPOSAL_SELECT)
    .eq("id", pid)
    .eq("company_id", cid)
    .maybeSingle();

  if (proposalError || !proposalData) {
    throw new ProposalRecordStoreError("Proposal not found.");
  }

  const proposal = proposalData as ProposalRow;
  const signedVersionId = (proposal.signed_version_id ?? "").trim();
  if (signedVersionId.length > 0 && isUuidLike(signedVersionId)) {
    const before = pickProposalIdentityEchoSnapshot(
      (await loadDraftVersionOrThrow(supabase, cid, proposal)).context_echo
    );
    return {
      restamped: false,
      skipped: true,
      skipReason: "signed_snapshot",
      changedFields: [],
      before,
      after: before,
      proposalUpdatedAt: proposal.updated_at ?? null,
    };
  }

  const version = await loadDraftVersionOrThrow(supabase, cid, proposal);
  const before = pickProposalIdentityEchoSnapshot(version.context_echo);

  const liveIdentity =
    input.liveIdentity != null
      ? buildFullProposalIdentityEchoSnapshot(input.liveIdentity)
      : await d.loadLiveProposalIdentityEcho(
          {
            companyId: cid,
            proposalId: pid,
            jobId: input.jobId ?? proposal.job_id ?? null,
          },
          deps
        );

  const staleness = diffProposalIdentityEcho(version.context_echo, liveIdentity);
  if (!staleness.isStale) {
    return {
      restamped: false,
      skipped: false,
      changedFields: [],
      before,
      after: before,
      proposalUpdatedAt: proposal.updated_at ?? null,
    };
  }

  const mergedContextEcho = mergeProposalIdentityEchoIntoContextEcho(
    version.context_echo,
    liveIdentity
  );
  const after = pickProposalIdentityEchoSnapshot(mergedContextEcho);
  const restampedAt = new Date().toISOString();

  const { error: versionError } = await supabase
    .from("proposal_versions")
    .update({ context_echo: mergedContextEcho })
    .eq("id", version.id)
    .eq("company_id", cid)
    .eq("proposal_id", pid);

  if (versionError) {
    throw new ProposalRecordStoreError(
      versionError.message ?? "Failed to update draft context_echo identity fields."
    );
  }

  const { error: proposalUpdateError } = await supabase
    .from("proposals")
    .update({ updated_at: restampedAt })
    .eq("id", pid)
    .eq("company_id", cid);

  if (proposalUpdateError) {
    throw new ProposalRecordStoreError(
      proposalUpdateError.message ?? "Failed to touch proposal updated_at after identity restamp."
    );
  }

  return {
    restamped: true,
    skipped: false,
    changedFields: staleness.changedFields,
    before,
    after,
    proposalUpdatedAt: restampedAt,
  };
}

// ---------------------------------------------------------------------------
// Send-freeze draft → sent snapshot (opt-in RPC only)
// ---------------------------------------------------------------------------

export type FreezeDraftToSentSnapshotInput = {
  /** When true, adds readiness warning only (does not block). */
  pricingStale?: boolean;
  frozenAt?: string;
  sentVersionId?: string;
};

export type FreezeDraftToSentSnapshotResult = {
  proposalId: string;
  draftVersionId: string;
  sentVersionId: string;
  versionNumber: number;
  pageCount: number;
  optionCount: number;
  latestSentVersionId: string;
  readiness: ProposalSendFreezeReadiness;
  writeSteps: [typeof PROPOSAL_SEND_FREEZE_RPC_PERSIST_STEP];
};

async function loadProposalVersionNumbers(
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>,
  companyId: string,
  proposalId: string
): Promise<number[]> {
  const { data, error } = await supabase
    .from("proposal_versions")
    .select("version_number")
    .eq("company_id", companyId)
    .eq("proposal_id", proposalId);

  if (error) {
    throw new ProposalRecordStoreError(
      error.message ?? "Failed to load proposal version numbers."
    );
  }

  return ((data ?? []) as Array<{ version_number: number }>)
    .map((row) => row.version_number)
    .filter((n) => Number.isFinite(n));
}

/**
 * Persists an immutable sent snapshot from the current draft graph via RPC.
 * Requires USE_PROPOSAL_SEND_FREEZE_RPC=1. Does not enable Send, public route, or lifecycle UI.
 */
export async function freezeDraftToSentSnapshot(
  companyId: string,
  proposalId: string,
  input: FreezeDraftToSentSnapshotInput = {},
  deps?: ProposalRecordStoreDeps
): Promise<FreezeDraftToSentSnapshotResult> {
  if (!isProposalSendFreezeRpcEnabled()) {
    throw new ProposalRecordStoreError("Proposal send-freeze RPC is not enabled.");
  }

  const { getSupabase } = resolveDeps(deps);
  const supabase = getSupabase();
  const cid = normalizeCompanyId(companyId);
  const pid = (proposalId ?? "").trim();

  if (!supabase) {
    throw new ProposalRecordStoreError("Supabase client unavailable.");
  }
  if (!cid || !isUuidLike(pid)) {
    throw new ProposalRecordStoreError("company_id and proposal_id are required UUIDs.");
  }

  const graph = await getDraftGraph(cid, pid, deps);
  if (!graph) {
    throw new ProposalRecordStoreError("Proposal draft graph not found.");
  }

  const readiness = deriveProposalSendFreezeReadiness({
    graph,
    pricingStale: input.pricingStale,
  });

  if (!readiness.ready) {
    throw new ProposalRecordStoreError(
      `Send-freeze blocked: ${readiness.blockingReasons.join(" ")}`
    );
  }

  const statusBefore = graph.proposal.status;
  const draftVersionIdBefore = graph.proposal.current_draft_version_id;

  const existingVersionNumbers = await loadProposalVersionNumbers(supabase, cid, pid);

  const payload = buildProposalSendFreezePersistPayload(graph, {
    existingVersionNumbers,
    frozenAt: input.frozenAt,
    sentVersionId: input.sentVersionId,
  });

  validateProposalSendFreezePersistPayload(payload);

  const integrityViolations = validateSendFreezeGraphIntegrity(payload);
  if (integrityViolations.length > 0) {
    throw new ProposalRecordStoreError(integrityViolations[0]!.message);
  }

  let rpcResult;
  try {
    rpcResult = await persistProposalSendFreezeViaRpc(supabase, payload);
  } catch (error) {
    if (error instanceof ProposalSendFreezeRpcPersistenceError) {
      throw new ProposalRecordStoreError(error.message);
    }
    throw error;
  }

  const refreshed = await getProposalById(cid, pid, deps);
  if (!refreshed) {
    throw new ProposalRecordStoreError("Proposal not found after send-freeze RPC.");
  }

  if (refreshed.latest_sent_version_id !== rpcResult.sent_version_id) {
    throw new ProposalRecordStoreError(
      "Send-freeze RPC succeeded but latest_sent_version_id was not updated."
    );
  }

  if (refreshed.current_draft_version_id !== draftVersionIdBefore) {
    throw new ProposalRecordStoreError(
      "Send-freeze RPC must not change current_draft_version_id."
    );
  }

  if (refreshed.status === "sent") {
    throw new ProposalRecordStoreError(
      "Send-freeze RPC must not set proposal status to sent."
    );
  }

  if (refreshed.status !== statusBefore) {
    throw new ProposalRecordStoreError("Send-freeze RPC must not change proposal status.");
  }

  return {
    proposalId: rpcResult.proposal_id,
    draftVersionId: rpcResult.draft_version_id,
    sentVersionId: rpcResult.sent_version_id,
    versionNumber: rpcResult.version_number,
    pageCount: rpcResult.page_count,
    optionCount: rpcResult.option_count,
    latestSentVersionId: rpcResult.latest_sent_version_id,
    readiness,
    writeSteps: [PROPOSAL_SEND_FREEZE_RPC_PERSIST_STEP],
  };
}
