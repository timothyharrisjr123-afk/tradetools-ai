/**
 * R2A — Transactional draft pricing refresh persistence foundation.
 *
 * TypeScript pricing/snapshot math stays in proposalRecordStore + snapshot builder.
 * This module prepares the persist payload and defines graph integrity invariants.
 *
 * Live refresh still uses sequential Supabase writes until migration
 * `persist_draft_pricing_refresh_v1` is applied and RPC mode is enabled.
 */

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

export const PERSIST_DRAFT_PRICING_REFRESH_RPC_V1 = "persist_draft_pricing_refresh_v1";

/**
 * Tables that must commit together for a pricing refresh graph to stay consistent.
 * The RPC wraps this bundle in a single Postgres transaction.
 */
export const DRAFT_PRICING_REFRESH_ATOMIC_TABLES = [
  "proposal_options",
  "proposal_line_items",
  "proposal_internal_summaries",
  "proposal_versions",
  "proposals",
  "proposal_events",
] as const;

/**
 * Current sequential (non-atomic) write order per option before RPC is live.
 * Documented for failure-injection tests and migration review.
 */
export const REFRESH_DRAFT_PRICING_SEQUENTIAL_STEPS_PER_OPTION = [
  "proposal_options.update",
  "proposal_line_items.delete",
  "proposal_internal_summaries.delete",
  "proposal_line_items.insert",
  "proposal_internal_summaries.insert",
] as const;

export type RefreshDraftPricingSequentialStep =
  (typeof REFRESH_DRAFT_PRICING_SEQUENTIAL_STEPS_PER_OPTION)[number];

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class ProposalDraftPricingRefreshPersistenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProposalDraftPricingRefreshPersistenceError";
  }
}

// ---------------------------------------------------------------------------
// Payload shapes (RPC + sequential persist)
// ---------------------------------------------------------------------------

export type DraftPricingRefreshLinePersistRow = {
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
};

export type DraftPricingRefreshOptionPricingFields = {
  customer_subtotal_cents: number | null;
  discount_cents: number | null;
  sales_tax_cents: number | null;
  customer_total_cents: number | null;
  pricing_complete: boolean;
  blocking_line_count: number;
  guardrail_outcome: string;
};

export type DraftPricingRefreshInternalSummaryPersist = {
  internal_cost_cents: number | null;
  internal_profit_cents: number | null;
  effective_margin_pct: number | null;
  policy_echo_json: Record<string, unknown>;
  computed_at: string;
};

export type DraftPricingRefreshOptionPersistPayload = {
  proposal_option_id: string;
  source_template_option_id: string;
  pricing: DraftPricingRefreshOptionPricingFields;
  line_items: DraftPricingRefreshLinePersistRow[];
  internal_summary: DraftPricingRefreshInternalSummaryPersist | null;
};

export type DraftPricingRefreshMeasurementStamp = {
  measurement_record_id?: string | null;
  measurement_quantities_display?: string | null;
  context_echo: Record<string, unknown>;
};

export type DraftPricingRefreshEventPersist = {
  event_type: "draft_saved";
  payload_json: Record<string, unknown>;
};

export type DraftPricingRefreshPersistPayload = {
  company_id: string;
  proposal_id: string;
  proposal_version_id: string;
  options: DraftPricingRefreshOptionPersistPayload[];
  measurement_stamp: DraftPricingRefreshMeasurementStamp | null;
  event: DraftPricingRefreshEventPersist;
};

// ---------------------------------------------------------------------------
// Graph integrity invariants
// ---------------------------------------------------------------------------

export type DraftPricingRefreshOptionGraphSnapshot = {
  proposal_option_id: string;
  pricing_complete: boolean;
  blocking_line_count: number;
  customer_subtotal_cents: number | null;
  customer_total_cents: number | null;
  line_count: number;
  priced_line_count: number;
  has_internal_summary: boolean;
};

export type DraftPricingRefreshGraphIntegrityViolation = {
  code:
    | "option_totals_without_lines"
    | "priced_subtotal_without_priced_lines"
    | "pricing_complete_without_lines"
    | "lines_without_internal_summary";
  proposal_option_id: string;
  message: string;
};

const MARGIN_DB_MAX = 99.9999;

function sanitizeEffectiveMarginPct(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  if (value < 0) {
    throw new ProposalDraftPricingRefreshPersistenceError(
      "effective_margin_pct cannot be negative."
    );
  }
  if (value >= 100) {
    return MARGIN_DB_MAX;
  }
  return value;
}

export function assertPersistLineRowCustomerSafe(row: Record<string, unknown>): void {
  for (const key of PROPOSAL_LINE_CUSTOMER_FORBIDDEN_KEYS) {
    if (key in row) {
      throw new ProposalDraftPricingRefreshPersistenceError(
        `Forbidden internal key on customer line row: ${key}`
      );
    }
  }
}

/**
 * Validates that option pricing snapshots and derived line rows are internally consistent.
 * Used by failure-injection tests to document non-atomic corruption and by RPC post-checks.
 */
export function validateDraftPricingRefreshGraphIntegrity(
  options: DraftPricingRefreshOptionGraphSnapshot[]
): DraftPricingRefreshGraphIntegrityViolation[] {
  const violations: DraftPricingRefreshGraphIntegrityViolation[] = [];

  for (const option of options) {
    const subtotal = option.customer_subtotal_cents ?? 0;

    if (subtotal > 0 && option.line_count === 0) {
      violations.push({
        code: "option_totals_without_lines",
        proposal_option_id: option.proposal_option_id,
        message:
          "Option customer subtotal is positive but no line items exist — partial refresh corruption.",
      });
    }

    if (subtotal > 0 && option.priced_line_count === 0) {
      violations.push({
        code: "priced_subtotal_without_priced_lines",
        proposal_option_id: option.proposal_option_id,
        message:
          "Option customer subtotal is positive but no priced line items exist.",
      });
    }

    if (
      option.pricing_complete &&
      option.blocking_line_count === 0 &&
      option.line_count === 0 &&
      subtotal > 0
    ) {
      violations.push({
        code: "pricing_complete_without_lines",
        proposal_option_id: option.proposal_option_id,
        message:
          "Option marked pricing_complete with positive total but zero line items.",
      });
    }

    if (
      option.pricing_complete &&
      option.blocking_line_count === 0 &&
      option.line_count > 0 &&
      !option.has_internal_summary
    ) {
      violations.push({
        code: "lines_without_internal_summary",
        proposal_option_id: option.proposal_option_id,
        message:
          "Option has priced lines but internal summary is missing after refresh.",
      });
    }
  }

  return violations;
}

export function assertDraftPricingRefreshGraphIntegrity(
  options: DraftPricingRefreshOptionGraphSnapshot[]
): void {
  const violations = validateDraftPricingRefreshGraphIntegrity(options);
  if (violations.length > 0) {
    throw new ProposalDraftPricingRefreshPersistenceError(violations[0]!.message);
  }
}

export function buildDraftPricingRefreshGraphSnapshotFromTables(input: {
  options: Array<Record<string, unknown>>;
  lineItems: Array<Record<string, unknown>>;
  internalSummaries: Array<Record<string, unknown>>;
}): DraftPricingRefreshOptionGraphSnapshot[] {
  return input.options.map((option) => {
    const optionId = String(option.id ?? "");
    const lines = input.lineItems.filter(
      (line) => String(line.proposal_option_id ?? "") === optionId
    );
    const pricedLines = lines.filter((line) => line.pricing_status === "priced");
    const hasSummary = input.internalSummaries.some(
      (summary) => String(summary.proposal_option_id ?? "") === optionId
    );

    return {
      proposal_option_id: optionId,
      pricing_complete: Boolean(option.pricing_complete),
      blocking_line_count: Number(option.blocking_line_count ?? 0),
      customer_subtotal_cents:
        option.customer_subtotal_cents == null
          ? null
          : Number(option.customer_subtotal_cents),
      customer_total_cents:
        option.customer_total_cents == null
          ? null
          : Number(option.customer_total_cents),
      line_count: lines.length,
      priced_line_count: pricedLines.length,
      has_internal_summary: hasSummary,
    };
  });
}

// ---------------------------------------------------------------------------
// Payload preparation (pure — no DB)
// ---------------------------------------------------------------------------

export type BuildDraftPricingRefreshPersistPayloadInput = {
  companyId: string;
  proposalId: string;
  proposalVersionId: string;
  instantiatePayload: DraftInstantiatePayload;
  instantiateInput: DraftInstantiateInput;
  existingOptions: Array<{
    id: string;
    source_template_option_id: string | null;
  }>;
  pageIdBySection: Map<string, string>;
  policy: PricingPolicy;
  pricingPolicyId: string;
  measurementStamp: DraftPricingRefreshMeasurementStamp | null;
};

export function buildDraftPricingRefreshPersistPayload(
  input: BuildDraftPricingRefreshPersistPayloadInput
): DraftPricingRefreshPersistPayload {
  const companyId = input.companyId.trim();
  const proposalId = input.proposalId.trim();
  const proposalVersionId = input.proposalVersionId.trim();

  const options: DraftPricingRefreshOptionPersistPayload[] = [];

  for (const optionPayload of input.instantiatePayload.options) {
    const existing = input.existingOptions.find(
      (row) => row.source_template_option_id === optionPayload.source_template_option_id
    );
    if (!existing) continue;

    const linesForOption =
      input.instantiateInput.lineItemsByTemplateOptionId[
        optionPayload.source_template_option_id
      ] ?? [];

    const builtLines = buildLineItemSnapshots({
      company_id: companyId,
      proposal_option_id: existing.id,
      lines: linesForOption,
    });

    const line_items: DraftPricingRefreshLinePersistRow[] = builtLines.map((built) => {
      const row: DraftPricingRefreshLinePersistRow = {
        source_template_item_id: built.source_template_item_id,
        catalog_item_id: built.catalog_item_id,
        catalog_seed_key: built.catalog_seed_key,
        section_id: built.section_id,
        page_id: built.section_id
          ? input.pageIdBySection.get(built.section_id) ?? null
          : null,
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
      assertPersistLineRowCustomerSafe(row as unknown as Record<string, unknown>);
      return row;
    });

    const internalInput =
      input.instantiateInput.internalSummaryByTemplateOptionId[
        optionPayload.source_template_option_id
      ];

    const internal_summary: DraftPricingRefreshInternalSummaryPersist | null = internalInput
      ? {
          internal_cost_cents: internalInput.internal_cost_cents,
          internal_profit_cents: internalInput.internal_profit_cents,
          effective_margin_pct: sanitizeEffectiveMarginPct(internalInput.effective_margin_pct),
          policy_echo_json: buildInternalPolicyEchoJson({
            policy: input.policy,
            pricingPolicyId: input.pricingPolicyId,
            source: "company",
          }),
          computed_at: input.instantiateInput.computedAt ?? new Date().toISOString(),
        }
      : null;

    options.push({
      proposal_option_id: existing.id,
      source_template_option_id: optionPayload.source_template_option_id,
      pricing: {
        customer_subtotal_cents: optionPayload.customer_subtotal_cents,
        discount_cents: optionPayload.discount_cents,
        sales_tax_cents: optionPayload.sales_tax_cents,
        customer_total_cents: optionPayload.customer_total_cents,
        pricing_complete: optionPayload.pricing_complete,
        blocking_line_count: optionPayload.blocking_line_count,
        guardrail_outcome: optionPayload.guardrail_outcome,
      },
      line_items,
      internal_summary,
    });
  }

  return {
    company_id: companyId,
    proposal_id: proposalId,
    proposal_version_id: proposalVersionId,
    options,
    measurement_stamp: input.measurementStamp,
    event: {
      event_type: "draft_saved",
      payload_json: { reason: "refresh_draft_pricing" },
    },
  };
}

// ---------------------------------------------------------------------------
// RPC mode gate
// ---------------------------------------------------------------------------

export function isRefreshDraftPricingRpcEnabled(): boolean {
  return (
    process.env.USE_REFRESH_DRAFT_PRICING_RPC === "1" ||
    process.env.NEXT_PUBLIC_USE_REFRESH_DRAFT_PRICING_RPC === "1"
  );
}

type SupabaseClient = NonNullable<ReturnType<typeof getSupabaseClient>>;

export async function persistDraftPricingRefreshViaRpc(
  supabase: SupabaseClient,
  payload: DraftPricingRefreshPersistPayload
): Promise<void> {
  const { error } = await supabase.rpc(PERSIST_DRAFT_PRICING_REFRESH_RPC_V1, {
    p_payload: payload,
  });

  if (error) {
    throw new ProposalDraftPricingRefreshPersistenceError(
      error.message ?? "persist_draft_pricing_refresh_v1 RPC failed."
    );
  }
}

// ---------------------------------------------------------------------------
// Sequential persist (legacy path — non-atomic until RPC is live)
// ---------------------------------------------------------------------------

export async function persistDraftPricingRefreshSequential(
  supabase: SupabaseClient,
  payload: DraftPricingRefreshPersistPayload
): Promise<void> {
  const companyId = payload.company_id;

  for (const option of payload.options) {
    const { error: optionError } = await supabase
      .from("proposal_options")
      .update(option.pricing)
      .eq("id", option.proposal_option_id)
      .eq("company_id", companyId);

    if (optionError) {
      throw new ProposalDraftPricingRefreshPersistenceError(
        optionError.message ?? "Failed to update proposal option pricing."
      );
    }

    const { error: lineDeleteError } = await supabase
      .from("proposal_line_items")
      .delete()
      .eq("company_id", companyId)
      .eq("proposal_option_id", option.proposal_option_id);

    if (lineDeleteError) {
      throw new ProposalDraftPricingRefreshPersistenceError(
        lineDeleteError.message ?? "Failed to delete proposal line items."
      );
    }

    const { error: summaryDeleteError } = await supabase
      .from("proposal_internal_summaries")
      .delete()
      .eq("company_id", companyId)
      .eq("proposal_option_id", option.proposal_option_id);

    if (summaryDeleteError) {
      throw new ProposalDraftPricingRefreshPersistenceError(
        summaryDeleteError.message ?? "Failed to delete internal summaries."
      );
    }

    for (const line of option.line_items) {
      const { error: lineInsertError } = await supabase.from("proposal_line_items").insert({
        company_id: companyId,
        proposal_option_id: option.proposal_option_id,
        ...line,
      });

      if (lineInsertError) {
        throw new ProposalDraftPricingRefreshPersistenceError(
          lineInsertError.message ?? "Failed to insert proposal line item."
        );
      }
    }

    if (option.internal_summary) {
      const { error: summaryInsertError } = await supabase
        .from("proposal_internal_summaries")
        .insert({
          company_id: companyId,
          proposal_option_id: option.proposal_option_id,
          ...option.internal_summary,
        });

      if (summaryInsertError) {
        throw new ProposalDraftPricingRefreshPersistenceError(
          summaryInsertError.message ?? "Failed to insert internal summary."
        );
      }
    }
  }

  if (payload.measurement_stamp) {
    const stamp = payload.measurement_stamp;
    const { error: versionError } = await supabase
      .from("proposal_versions")
      .update({ context_echo: stamp.context_echo })
      .eq("id", payload.proposal_version_id)
      .eq("company_id", companyId);

    if (versionError) {
      throw new ProposalDraftPricingRefreshPersistenceError(
        versionError.message ?? "Failed to update version context_echo."
      );
    }

    if (stamp.measurement_record_id !== undefined) {
      const { error: proposalError } = await supabase
        .from("proposals")
        .update({ measurement_record_id: stamp.measurement_record_id ?? null })
        .eq("id", payload.proposal_id)
        .eq("company_id", companyId);

      if (proposalError) {
        throw new ProposalDraftPricingRefreshPersistenceError(
          proposalError.message ?? "Failed to update proposal measurement_record_id."
        );
      }
    }
  }

  const { error: eventError } = await supabase.from("proposal_events").insert({
    company_id: companyId,
    proposal_id: payload.proposal_id,
    proposal_version_id: payload.proposal_version_id,
    event_type: payload.event.event_type,
    actor_user_id: null,
    payload_json: payload.event.payload_json,
  });

  if (eventError) {
    throw new ProposalDraftPricingRefreshPersistenceError(
      eventError.message ?? "Failed to append proposal refresh event."
    );
  }
}
