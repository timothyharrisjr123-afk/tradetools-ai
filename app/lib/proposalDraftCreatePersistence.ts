/**
 * R4A — Transactional draft proposal create persistence foundation.
 *
 * TypeScript pricing/snapshot math stays in proposalRecordStore + snapshot builder.
 * This module prepares the persist payload and defines graph integrity invariants.
 *
 * Live create remains sequential until migration review/apply and Remediation 4C
 * switches createDraftProposal to RPC `persist_draft_proposal_create_v1` by default.
 * Sequential Supabase writes will remain available only via explicit test/dev escape hatch.
 */

import { isUuidLike } from "@/app/lib/jobStore";
import { PROPOSAL_LINE_CUSTOMER_FORBIDDEN_KEYS } from "@/app/lib/proposalLineSnapshotTypes";
import type { PricingPolicy } from "@/app/lib/proposalPricingTypes";
import {
  buildInternalPolicyEchoJson,
  buildLineItemSnapshots,
  type DraftInstantiateInput,
  type DraftInstantiatePayload,
} from "@/app/lib/proposalSnapshotBuilder";
import type { getSupabaseClient } from "@/app/lib/supabaseClient";

// ---------------------------------------------------------------------------
// RPC contract
// ---------------------------------------------------------------------------

export const PERSIST_DRAFT_PROPOSAL_CREATE_RPC_V1 = "persist_draft_proposal_create_v1";

/**
 * Tables that must commit together for a draft proposal create graph to stay consistent.
 * The RPC wraps this bundle in a single Postgres transaction.
 */
export const CREATE_DRAFT_PROPOSAL_ATOMIC_TABLES = [
  "proposals",
  "proposal_versions",
  "proposal_pages",
  "proposal_options",
  "proposal_line_items",
  "proposal_internal_summaries",
  "proposal_events",
  "jobs",
] as const;

/**
 * Current sequential (non-atomic) write order before RPC is live.
 * Documented for failure-injection tests and migration review.
 * Mirrors CREATE_DRAFT_WRITE_STEPS in proposalRecordStore.
 */
export const CREATE_DRAFT_PROPOSAL_SEQUENTIAL_STEPS = [
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

export type CreateDraftProposalSequentialStep =
  (typeof CREATE_DRAFT_PROPOSAL_SEQUENTIAL_STEPS)[number];

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class ProposalDraftCreatePersistenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProposalDraftCreatePersistenceError";
  }
}

// ---------------------------------------------------------------------------
// Payload shapes (RPC persist)
// ---------------------------------------------------------------------------

export type DraftProposalCreatePagePersistRow = {
  page_type: string;
  sort_order: number;
  title: string;
  customer_title: string | null;
  visible_to_customer: boolean;
  source_template_section_id: string | null;
  content_json: Record<string, unknown>;
  settings_json: Record<string, unknown>;
};

export type DraftProposalCreateLinePersistRow = {
  source_template_item_id: string | null;
  catalog_item_id: string | null;
  catalog_seed_key: string | null;
  section_id: string | null;
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
};

export type DraftProposalCreateInternalSummaryPersist = {
  internal_cost_cents: number | null;
  internal_profit_cents: number | null;
  effective_margin_pct: number | null;
  policy_echo_json: Record<string, unknown>;
  computed_at: string;
};

export type DraftProposalCreateOptionPersistPayload = {
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
  guardrail_outcome: string;
  selected_at: string | null;
  line_items: DraftProposalCreateLinePersistRow[];
  internal_summary: DraftProposalCreateInternalSummaryPersist | null;
};

export type DraftProposalCreateEventPersist = {
  event_type: "created";
  payload_json: Record<string, unknown>;
  actor_user_id: string | null;
};

export type DraftProposalCreatePersistPayload = {
  company_id: string;
  job_id: string;
  customer_id: string | null;
  template_id: string;
  measurement_record_id: string | null;
  pricing_policy_id: string;
  title: string | null;
  created_by: string | null;
  context_echo: Record<string, unknown>;
  policy_echo: Record<string, unknown>;
  pages: DraftProposalCreatePagePersistRow[];
  options: DraftProposalCreateOptionPersistPayload[];
  selected_source_template_option_id: string | null;
  event: DraftProposalCreateEventPersist;
  set_job_active_proposal: true;
};

export type DraftProposalCreateRpcResult = {
  ok: true;
  proposal_id: string;
  proposal_version_id: string;
  selected_option_id: string | null;
  page_count: number;
  option_count: number;
};

// ---------------------------------------------------------------------------
// Graph integrity invariants
// ---------------------------------------------------------------------------

export type DraftProposalCreateGraphIntegrityViolation = {
  code:
    | "missing_required_uuid"
    | "invalid_echo_object"
    | "no_pages"
    | "no_options"
    | "selected_option_not_found"
    | "duplicate_page_section_id"
    | "line_section_missing_page"
    | "forbidden_line_key"
    | "forbidden_runtime_id"
    | "template_mutation_payload"
    | "option_totals_without_lines"
    | "priced_subtotal_without_priced_lines"
    | "pricing_complete_without_lines"
    | "lines_without_internal_summary";
  message: string;
  source_template_option_id?: string;
};

const MARGIN_DB_MAX = 99.9999;

const FORBIDDEN_RUNTIME_ID_KEYS = [
  "proposal_id",
  "proposal_version_id",
  "proposal_option_id",
  "page_id",
  "id",
] as const;

const TEMPLATE_MUTATION_PAYLOAD_KEYS = [
  "template_mutations",
  "template_updates",
  "update_template",
  "mutate_template",
] as const;

function sanitizeEffectiveMarginPct(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  if (value < 0) {
    throw new ProposalDraftCreatePersistenceError(
      "effective_margin_pct cannot be negative."
    );
  }
  if (value >= 100) {
    return MARGIN_DB_MAX;
  }
  return value;
}

export function assertCreatePersistLineRowCustomerSafe(row: Record<string, unknown>): void {
  for (const key of PROPOSAL_LINE_CUSTOMER_FORBIDDEN_KEYS) {
    if (key in row) {
      throw new ProposalDraftCreatePersistenceError(
        `Forbidden internal key on customer line row: ${key}`
      );
    }
  }
  if ("policy_echo_json" in row) {
    throw new ProposalDraftCreatePersistenceError(
      "Forbidden internal key on customer line row: policy_echo_json"
    );
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function resolveSelectedTemplateOptionId(
  payload: DraftProposalCreatePersistPayload
): string | null {
  const explicit = (payload.selected_source_template_option_id ?? "").trim();
  if (explicit) {
    const match = payload.options.find(
      (option) => option.source_template_option_id === explicit
    );
    if (match) return explicit;
    return null;
  }

  const defaultOption = payload.options.find((option) => option.is_default);
  if (defaultOption) return defaultOption.source_template_option_id;

  return payload.options[0]?.source_template_option_id ?? null;
}

function assertNoForbiddenRuntimeIds(payload: DraftProposalCreatePersistPayload): void {
  const topLevelForbidden = ["proposal_id", "proposal_version_id"] as const;
  for (const key of topLevelForbidden) {
    if (key in (payload as unknown as Record<string, unknown>)) {
      throw new ProposalDraftCreatePersistenceError(
        `Create persist payload must not include runtime ${key}; RPC generates ids.`
      );
    }
  }

  for (const page of payload.pages) {
    const pageRecord = page as unknown as Record<string, unknown>;
    for (const key of FORBIDDEN_RUNTIME_ID_KEYS) {
      if (key in pageRecord && pageRecord[key] != null) {
        throw new ProposalDraftCreatePersistenceError(
          `Page payload must not include runtime ${key}; RPC generates ids.`
        );
      }
    }
  }

  for (const option of payload.options) {
    const optionRecord = option as unknown as Record<string, unknown>;
    if ("proposal_option_id" in optionRecord && optionRecord.proposal_option_id != null) {
      throw new ProposalDraftCreatePersistenceError(
        "Option payload must not include proposal_option_id; RPC generates ids."
      );
    }
    for (const line of option.line_items) {
      const lineRecord = line as unknown as Record<string, unknown>;
      for (const key of ["proposal_option_id", "page_id", "id"] as const) {
        if (key in lineRecord && lineRecord[key] != null) {
          throw new ProposalDraftCreatePersistenceError(
            `Line payload must not include runtime ${key}; RPC maps pages after insert.`
          );
        }
      }
    }
  }
}

function assertNoTemplateMutationPayload(payload: DraftProposalCreatePersistPayload): void {
  const record = payload as unknown as Record<string, unknown>;
  for (const key of TEMPLATE_MUTATION_PAYLOAD_KEYS) {
    if (key in record) {
      throw new ProposalDraftCreatePersistenceError(
        `Create persist payload must not include template mutation key: ${key}`
      );
    }
  }
}

/**
 * Validates that a create persist payload is internally consistent before RPC.
 */
export function validateDraftProposalCreateGraphInvariants(
  payload: DraftProposalCreatePersistPayload
): DraftProposalCreateGraphIntegrityViolation[] {
  const violations: DraftProposalCreateGraphIntegrityViolation[] = [];

  const requiredUuids: Array<{ field: keyof DraftProposalCreatePersistPayload; label: string }> =
    [
      { field: "company_id", label: "company_id" },
      { field: "job_id", label: "job_id" },
      { field: "template_id", label: "template_id" },
      { field: "pricing_policy_id", label: "pricing_policy_id" },
    ];

  for (const { field, label } of requiredUuids) {
    const value = String(payload[field] ?? "").trim();
    if (!isUuidLike(value)) {
      violations.push({
        code: "missing_required_uuid",
        message: `${label} is required and must be a UUID.`,
      });
    }
  }

  if (payload.customer_id != null && !isUuidLike(payload.customer_id)) {
    violations.push({
      code: "missing_required_uuid",
      message: "customer_id must be a UUID when provided.",
    });
  }

  if (!isPlainObject(payload.context_echo)) {
    violations.push({
      code: "invalid_echo_object",
      message: "context_echo must be a plain object.",
    });
  }

  if (!isPlainObject(payload.policy_echo)) {
    violations.push({
      code: "invalid_echo_object",
      message: "policy_echo must be a plain object.",
    });
  }

  if (payload.pages.length === 0) {
    violations.push({
      code: "no_pages",
      message: "Create persist payload requires at least one page.",
    });
  }

  if (payload.options.length === 0) {
    violations.push({
      code: "no_options",
      message: "Create persist payload requires at least one option.",
    });
  }

  const explicitSelected = (payload.selected_source_template_option_id ?? "").trim();
  if (explicitSelected) {
    const found = payload.options.some(
      (option) => option.source_template_option_id === explicitSelected
    );
    if (!found) {
      violations.push({
        code: "selected_option_not_found",
        message: `selected_source_template_option_id ${explicitSelected} is not in options.`,
      });
    }
  } else if (payload.options.length > 0 && !resolveSelectedTemplateOptionId(payload)) {
    violations.push({
      code: "selected_option_not_found",
      message: "Selected template option could not be resolved from payload options.",
    });
  }

  const sectionIds = new Set<string>();
  for (const page of payload.pages) {
    const sectionId = (page.source_template_section_id ?? "").trim();
    if (!sectionId) continue;
    if (sectionIds.has(sectionId)) {
      violations.push({
        code: "duplicate_page_section_id",
        message: `Duplicate source_template_section_id on pages: ${sectionId}`,
      });
    }
    sectionIds.add(sectionId);
  }

  for (const option of payload.options) {
    const templateOptionId = option.source_template_option_id;
    let pricedLineCount = 0;

    for (const line of option.line_items) {
      try {
        assertCreatePersistLineRowCustomerSafe(line as unknown as Record<string, unknown>);
      } catch (error) {
        violations.push({
          code: "forbidden_line_key",
          message: error instanceof Error ? error.message : "Forbidden line key.",
          source_template_option_id: templateOptionId,
        });
      }

      const sectionId = (line.section_id ?? "").trim();
      if (sectionId && sectionIds.size > 0 && !sectionIds.has(sectionId)) {
        violations.push({
          code: "line_section_missing_page",
          message: `Line section_id ${sectionId} does not map to any page source_template_section_id.`,
          source_template_option_id: templateOptionId,
        });
      }

      if (line.pricing_status === "priced") {
        pricedLineCount += 1;
      }
    }

    const subtotal = option.customer_subtotal_cents ?? 0;
    const lineCount = option.line_items.length;

    if (subtotal > 0 && lineCount === 0) {
      violations.push({
        code: "option_totals_without_lines",
        message: "Option customer subtotal is positive but no line items exist.",
        source_template_option_id: templateOptionId,
      });
    }

    if (subtotal > 0 && pricedLineCount === 0) {
      violations.push({
        code: "priced_subtotal_without_priced_lines",
        message: "Option customer subtotal is positive but no priced line items exist.",
        source_template_option_id: templateOptionId,
      });
    }

    if (
      option.pricing_complete &&
      option.blocking_line_count === 0 &&
      lineCount === 0 &&
      subtotal > 0
    ) {
      violations.push({
        code: "pricing_complete_without_lines",
        message: "Option marked pricing_complete with positive total but zero line items.",
        source_template_option_id: templateOptionId,
      });
    }

    if (
      option.pricing_complete &&
      option.blocking_line_count === 0 &&
      lineCount > 0 &&
      !option.internal_summary
    ) {
      violations.push({
        code: "lines_without_internal_summary",
        message: "Option has priced lines but internal summary is missing.",
        source_template_option_id: templateOptionId,
      });
    }
  }

  try {
    assertNoForbiddenRuntimeIds(payload);
  } catch (error) {
    violations.push({
      code: "forbidden_runtime_id",
      message: error instanceof Error ? error.message : "Forbidden runtime id in payload.",
    });
  }

  try {
    assertNoTemplateMutationPayload(payload);
  } catch (error) {
    violations.push({
      code: "template_mutation_payload",
      message: error instanceof Error ? error.message : "Template mutation payload forbidden.",
    });
  }

  return violations;
}

export function assertDraftProposalCreateGraphInvariants(
  payload: DraftProposalCreatePersistPayload
): void {
  const violations = validateDraftProposalCreateGraphInvariants(payload);
  if (violations.length > 0) {
    throw new ProposalDraftCreatePersistenceError(violations[0]!.message);
  }
}

// ---------------------------------------------------------------------------
// Read-only graph completeness diagnostic (no mutation)
// ---------------------------------------------------------------------------

export type DraftProposalGraphDiagnosticInput = {
  proposal: {
    id?: string;
    status?: string;
    current_draft_version_id?: string | null;
    selected_option_id?: string | null;
    job_id?: string | null;
  };
  version?: { id?: string; version_kind?: string } | null;
  pages: ReadonlyArray<{ id?: string }>;
  options: ReadonlyArray<{ id?: string; source_template_option_id?: string | null }>;
  lineItems: ReadonlyArray<{ proposal_option_id?: string; pricing_status?: string }>;
  internalSummaries: ReadonlyArray<{ proposal_option_id?: string }>;
  job?: { active_proposal_id?: string | null } | null;
};

export type DraftProposalGraphDiagnosticViolation = {
  code:
    | "missing_current_draft_version_id"
    | "draft_version_missing"
    | "version_not_draft_kind"
    | "no_pages"
    | "no_options"
    | "selected_option_missing"
    | "selected_option_not_in_version"
    | "option_missing_lines"
    | "option_missing_internal_summary"
    | "job_active_proposal_mismatch"
    | "proposal_not_draft_status";
  message: string;
};

export type DraftProposalGraphDiagnosticResult = {
  complete: boolean;
  violations: DraftProposalGraphDiagnosticViolation[];
};

/**
 * Read-only diagnostic for persisted draft graph completeness.
 * Does not mutate or repair data.
 */
export function diagnoseDraftProposalGraphCompleteness(
  input: DraftProposalGraphDiagnosticInput
): DraftProposalGraphDiagnosticResult {
  const violations: DraftProposalGraphDiagnosticViolation[] = [];

  if (input.proposal.status && input.proposal.status !== "draft") {
    violations.push({
      code: "proposal_not_draft_status",
      message: `Proposal status is ${input.proposal.status}, expected draft.`,
    });
  }

  const draftVersionId = (input.proposal.current_draft_version_id ?? "").trim();
  if (!draftVersionId) {
    violations.push({
      code: "missing_current_draft_version_id",
      message: "Proposal is missing current_draft_version_id.",
    });
  }

  if (!input.version?.id) {
    violations.push({
      code: "draft_version_missing",
      message: "Draft version row is missing.",
    });
  } else if (draftVersionId && input.version.id !== draftVersionId) {
    violations.push({
      code: "draft_version_missing",
      message: "Loaded version id does not match current_draft_version_id.",
    });
  }

  if (input.version?.version_kind && input.version.version_kind !== "draft") {
    violations.push({
      code: "version_not_draft_kind",
      message: `Version kind is ${input.version.version_kind}, expected draft.`,
    });
  }

  if (input.pages.length === 0) {
    violations.push({
      code: "no_pages",
      message: "Draft version has no pages.",
    });
  }

  if (input.options.length === 0) {
    violations.push({
      code: "no_options",
      message: "Draft version has no options.",
    });
  }

  const selectedOptionId = (input.proposal.selected_option_id ?? "").trim();
  if (!selectedOptionId) {
    violations.push({
      code: "selected_option_missing",
      message: "Proposal is missing selected_option_id.",
    });
  } else {
    const optionIds = new Set(
      input.options.map((option) => (option.id ?? "").trim()).filter(Boolean)
    );
    if (optionIds.size > 0 && !optionIds.has(selectedOptionId)) {
      violations.push({
        code: "selected_option_not_in_version",
        message: "selected_option_id does not belong to draft version options.",
      });
    }
  }

  for (const option of input.options) {
    const optionId = (option.id ?? "").trim();
    if (!optionId) continue;

    const lines = input.lineItems.filter(
      (line) => (line.proposal_option_id ?? "").trim() === optionId
    );
    const hasSummary = input.internalSummaries.some(
      (summary) => (summary.proposal_option_id ?? "").trim() === optionId
    );

    if (lines.length === 0) {
      violations.push({
        code: "option_missing_lines",
        message: `Option ${optionId} has no line items.`,
      });
      continue;
    }

    const pricedLines = lines.filter((line) => line.pricing_status === "priced");
    if (pricedLines.length > 0 && !hasSummary) {
      violations.push({
        code: "option_missing_internal_summary",
        message: `Option ${optionId} has priced lines but no internal summary.`,
      });
    }
  }

  const proposalId = (input.proposal.id ?? "").trim();
  const jobActiveId = (input.job?.active_proposal_id ?? "").trim();
  if (proposalId && jobActiveId && jobActiveId !== proposalId) {
    violations.push({
      code: "job_active_proposal_mismatch",
      message: "jobs.active_proposal_id does not match proposal id.",
    });
  }

  return {
    complete: violations.length === 0,
    violations,
  };
}

// ---------------------------------------------------------------------------
// Payload preparation (pure — no DB)
// ---------------------------------------------------------------------------

export type BuildDraftProposalCreatePersistPayloadInput = {
  companyId: string;
  jobId: string;
  customerId: string | null;
  templateId: string;
  measurementRecordId: string | null;
  pricingPolicyId: string;
  title: string | null;
  createdBy: string | null;
  instantiatePayload: DraftInstantiatePayload;
  instantiateInput: DraftInstantiateInput;
  policy: PricingPolicy;
};

export function buildDraftProposalCreatePersistPayload(
  input: BuildDraftProposalCreatePersistPayloadInput
): DraftProposalCreatePersistPayload {
  const companyId = input.companyId.trim();
  const jobId = input.jobId.trim();
  const templateId = input.templateId.trim();
  const pricingPolicyId = input.pricingPolicyId.trim();

  const pages: DraftProposalCreatePagePersistRow[] = input.instantiatePayload.pages.map(
    (page) => ({
      page_type: page.page_type,
      sort_order: page.sort_order,
      title: page.title,
      customer_title: page.customer_title,
      visible_to_customer: page.visible_to_customer,
      source_template_section_id: page.source_template_section_id,
      content_json: page.content_json as Record<string, unknown>,
      settings_json: page.settings_json as Record<string, unknown>,
    })
  );

  const options: DraftProposalCreateOptionPersistPayload[] = [];

  for (const optionPayload of input.instantiatePayload.options) {
    const linesForOption =
      input.instantiateInput.lineItemsByTemplateOptionId[
        optionPayload.source_template_option_id
      ] ?? [];

    const builtLines = buildLineItemSnapshots({
      company_id: companyId,
      lines: linesForOption,
    });

    const line_items: DraftProposalCreateLinePersistRow[] = builtLines.map((built) => {
      const row: DraftProposalCreateLinePersistRow = {
        source_template_item_id: built.source_template_item_id,
        catalog_item_id: built.catalog_item_id,
        catalog_seed_key: built.catalog_seed_key,
        section_id: built.section_id,
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
      assertCreatePersistLineRowCustomerSafe(row as unknown as Record<string, unknown>);
      return row;
    });

    const internalInput =
      input.instantiateInput.internalSummaryByTemplateOptionId[
        optionPayload.source_template_option_id
      ];

    const internal_summary: DraftProposalCreateInternalSummaryPersist | null = internalInput
      ? {
          internal_cost_cents: internalInput.internal_cost_cents,
          internal_profit_cents: internalInput.internal_profit_cents,
          effective_margin_pct: sanitizeEffectiveMarginPct(internalInput.effective_margin_pct),
          policy_echo_json: buildInternalPolicyEchoJson({
            policy: input.policy,
            pricingPolicyId,
            source: "company",
          }),
          computed_at: input.instantiateInput.computedAt ?? new Date().toISOString(),
        }
      : null;

    options.push({
      source_template_option_id: optionPayload.source_template_option_id,
      name: optionPayload.name,
      customer_label: optionPayload.customer_label,
      sort_order: optionPayload.sort_order,
      is_default: optionPayload.is_default,
      visible_to_customer: optionPayload.visible_to_customer,
      customer_subtotal_cents: optionPayload.customer_subtotal_cents,
      discount_cents: optionPayload.discount_cents,
      sales_tax_cents: optionPayload.sales_tax_cents,
      customer_total_cents: optionPayload.customer_total_cents,
      pricing_complete: optionPayload.pricing_complete,
      blocking_line_count: optionPayload.blocking_line_count,
      guardrail_outcome: optionPayload.guardrail_outcome,
      selected_at: optionPayload.selected_at,
      line_items,
      internal_summary,
    });
  }

  return {
    company_id: companyId,
    job_id: jobId,
    customer_id: input.customerId,
    template_id: templateId,
    measurement_record_id: input.measurementRecordId,
    pricing_policy_id: pricingPolicyId,
    title: input.title,
    created_by: input.createdBy,
    context_echo: input.instantiatePayload.contextEcho as Record<string, unknown>,
    policy_echo: input.instantiatePayload.policyEcho as Record<string, unknown>,
    pages,
    options,
    selected_source_template_option_id:
      input.instantiatePayload.selectedTemplateOptionId,
    event: {
      event_type: "created",
      payload_json: { template_id: templateId, job_id: jobId },
      actor_user_id: input.createdBy,
    },
    set_job_active_proposal: true,
  };
}

// ---------------------------------------------------------------------------
// Persistence path gate (RPC future default; sequential test/dev escape hatch)
// ---------------------------------------------------------------------------

/** Explicit opt-in to legacy non-atomic sequential writes — not for production. */
export function isCreateDraftProposalSequentialEnabled(): boolean {
  return process.env.USE_CREATE_DRAFT_PROPOSAL_SEQUENTIAL === "1";
}

type SupabaseClient = NonNullable<ReturnType<typeof getSupabaseClient>>;

export async function persistDraftProposalCreateViaRpc(
  supabase: SupabaseClient,
  payload: DraftProposalCreatePersistPayload
): Promise<DraftProposalCreateRpcResult> {
  const { data, error } = await supabase.rpc(PERSIST_DRAFT_PROPOSAL_CREATE_RPC_V1, {
    p_payload: payload,
  });

  if (error) {
    throw new ProposalDraftCreatePersistenceError(
      error.message ?? "persist_draft_proposal_create_v1 RPC failed."
    );
  }

  if (!data || typeof data !== "object") {
    throw new ProposalDraftCreatePersistenceError(
      "persist_draft_proposal_create_v1 RPC returned no result."
    );
  }

  const result = data as Record<string, unknown>;
  const proposalId = String(result.proposal_id ?? "").trim();
  const versionId = String(result.proposal_version_id ?? "").trim();

  if (!isUuidLike(proposalId) || !isUuidLike(versionId)) {
    throw new ProposalDraftCreatePersistenceError(
      "persist_draft_proposal_create_v1 RPC returned invalid ids."
    );
  }

  const selectedOptionRaw = result.selected_option_id;
  const selectedOptionId =
    selectedOptionRaw == null || String(selectedOptionRaw).trim() === ""
      ? null
      : String(selectedOptionRaw).trim();

  if (selectedOptionId != null && !isUuidLike(selectedOptionId)) {
    throw new ProposalDraftCreatePersistenceError(
      "persist_draft_proposal_create_v1 RPC returned invalid selected_option_id."
    );
  }

  return {
    ok: true,
    proposal_id: proposalId,
    proposal_version_id: versionId,
    selected_option_id: selectedOptionId,
    page_count: Number(result.page_count ?? payload.pages.length),
    option_count: Number(result.option_count ?? payload.options.length),
  };
}
