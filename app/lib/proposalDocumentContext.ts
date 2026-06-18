/**
 * FieldDive Proposal Document Context builder (R13).
 *
 * Builds a frozen read-only DTO from persisted proposal draft graph rows only.
 * No Supabase, stores, pricing engine, or live Settings/customers/jobs reads.
 */

import type { ProposalDocumentContext } from "@/app/lib/proposalDocumentTokenTypes";
import {
  readProposalCompanyContextFromEcho,
  readProposalCustomerContextFromEcho,
} from "@/app/lib/proposalDraftGraphAdapter";
import type {
  ProposalDraftGraph,
  ProposalOptionRow,
} from "@/app/lib/proposalRecordStore";

function trimOrNull(value: string | null | undefined): string | null {
  const v = (value ?? "").trim();
  return v ? v : null;
}

function readContextEchoString(
  contextEcho: ProposalDraftGraph["version"]["context_echo"] | null | undefined,
  key: string
): string | null {
  if (!contextEcho || typeof contextEcho !== "object") return null;
  const value = (contextEcho as Record<string, unknown>)[key];
  return typeof value === "string" ? trimOrNull(value) : null;
}

/**
 * Resolve the selected runtime option using persisted selection semantics:
 *   1. proposals.selected_option_id
 *   2. is_default option
 *   3. first option by sort_order
 */
export function resolveSelectedRuntimeOptionFromGraph(
  graph: ProposalDraftGraph
): ProposalOptionRow | null {
  const options = [...graph.options].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
  );

  const selectedRuntimeId = (graph.proposal.selected_option_id ?? "").trim();
  if (selectedRuntimeId) {
    const selected = options.find((o) => o.id === selectedRuntimeId);
    if (selected) return selected;
  }

  const defaultOpt = options.find((o) => o.is_default);
  return defaultOpt ?? options[0] ?? null;
}

function resolveSelectedPackageName(option: ProposalOptionRow | null): string | null {
  if (!option) return null;
  return trimOrNull(option.customer_label) ?? trimOrNull(option.name);
}

/**
 * Assemble frozen document context from a persisted proposal draft graph.
 */
export function buildProposalDocumentContextFromDraftGraph(
  graph: ProposalDraftGraph
): ProposalDocumentContext {
  const contextEcho = graph.version.context_echo;
  const selectedOption = resolveSelectedRuntimeOptionFromGraph(graph);

  return {
    company: readProposalCompanyContextFromEcho(contextEcho),
    customer: readProposalCustomerContextFromEcho(contextEcho),
    jobName: readContextEchoString(contextEcho, "job_name"),
    jobAddress: readContextEchoString(contextEcho, "address_formatted"),
    measurementSummary: readContextEchoString(contextEcho, "measurement_quantities_display"),
    proposalNumber: trimOrNull(graph.proposal.proposal_number),
    proposalTitle: trimOrNull(graph.proposal.title),
    templateName: readContextEchoString(contextEcho, "template_name"),
    proposalCreatedDateIso: trimOrNull(graph.version.created_at),
    selectedPackage: {
      runtimeOptionId: selectedOption ? trimOrNull(selectedOption.id) : null,
      packageName: resolveSelectedPackageName(selectedOption),
      customerTotalCents: selectedOption?.customer_total_cents ?? null,
    },
  };
}
