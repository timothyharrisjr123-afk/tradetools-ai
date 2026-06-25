/**
 * R18B1 — Pure send-freeze readiness for immutable sent snapshot foundation.
 *
 * Validates a persisted draft graph is ready to freeze into a sent version.
 * No Supabase, refresh pricing, RPC, routes, or lifecycle mutation.
 */

import { resolveSelectedTemplateOptionIdFromGraph } from "@/app/lib/proposalDraftGraphAdapter";
import { readEstimatePageSettingsFromProposalPage } from "@/app/lib/proposalCustomerEstimateDisplayPolicy";
import { getCustomerPreviewPages } from "@/app/lib/proposalPageVisibilityEditing";
import type { ProposalDraftGraph } from "@/app/lib/proposalRecordStore";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ProposalSendFreezeScopeSummary = {
  hiddenLineCount: number;
  excludedLineCount: number;
  hiddenPageCount: number;
};

export type ProposalSendFreezeReadinessSummary = {
  scopeSummary: ProposalSendFreezeScopeSummary;
  selectedTemplateOptionId: string | null;
  pricingComplete: boolean;
  blockingLineCount: number;
  estimatePagePresent: boolean;
  customerVisiblePageCount: number;
  hasLatestSentVersion: boolean;
  displaySettingsResolvable: boolean;
};

export type ProposalSendFreezeReadiness = {
  ready: boolean;
  blockingReasons: string[];
  warnings: string[];
  summary: ProposalSendFreezeReadinessSummary;
};

export type DeriveProposalSendFreezeReadinessInput = {
  graph: ProposalDraftGraph;
  /** When true, adds a warning (does not block) — mirrors Preview staleness semantics. */
  pricingStale?: boolean;
};

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function readContextEchoString(
  echo: ProposalDraftGraph["version"]["context_echo"],
  key: string
): string | null {
  if (echo == null || typeof echo !== "object" || Array.isArray(echo)) return null;
  const value = (echo as Record<string, unknown>)[key];
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

function computeScopeSummary(graph: ProposalDraftGraph): ProposalSendFreezeScopeSummary {
  const hiddenLineCount = graph.lineItems.filter((line) => line.visible_to_customer !== true).length;
  const excludedLineCount = graph.lineItems.filter((line) => line.pricing_status === "omitted").length;
  const hiddenPageCount = graph.pages.filter((page) => page.visible_to_customer !== true).length;
  return { hiddenLineCount, excludedLineCount, hiddenPageCount };
}

function customerRelevantOptions(graph: ProposalDraftGraph) {
  const visible = graph.options.filter((option) => option.visible_to_customer === true);
  return visible.length > 0 ? visible : graph.options;
}

// ---------------------------------------------------------------------------
// Readiness
// ---------------------------------------------------------------------------

/**
 * Pure readiness gate for future send-freeze (R18B+). Does not mutate input.
 */
export function deriveProposalSendFreezeReadiness(
  input: DeriveProposalSendFreezeReadinessInput
): ProposalSendFreezeReadiness {
  const { graph } = input;
  const blockingReasons: string[] = [];
  const warnings: string[] = [];

  const draftVersionId = (graph.proposal.current_draft_version_id ?? "").trim();
  if (!draftVersionId) {
    blockingReasons.push("Proposal has no current draft version.");
  } else if (graph.version.id !== draftVersionId) {
    blockingReasons.push("Graph version does not match proposal current_draft_version_id.");
  }

  if (graph.version.version_kind !== "draft") {
    blockingReasons.push(
      `Send-freeze requires a draft version; got version_kind="${graph.version.version_kind}".`
    );
  }

  if (graph.version.frozen_at != null) {
    blockingReasons.push("Draft version is already frozen.");
  }

  if (graph.proposal.signed_version_id != null) {
    warnings.push(
      "Proposal already has a signed version; a new send-freeze creates a separate sent snapshot."
    );
  }

  const selectedTemplateOptionId = resolveSelectedTemplateOptionIdFromGraph(graph);
  if (!selectedTemplateOptionId) {
    blockingReasons.push("Selected template option could not be resolved.");
  }

  const relevantOptions = customerRelevantOptions(graph);
  if (relevantOptions.length === 0) {
    blockingReasons.push("Proposal has no options to freeze.");
  }

  let pricingComplete = true;
  let blockingLineCount = 0;

  for (const option of relevantOptions) {
    if (!option.pricing_complete) {
      pricingComplete = false;
      blockingReasons.push(`Option "${option.name}" pricing is incomplete.`);
    }
    if (option.blocking_line_count > 0) {
      blockingLineCount += option.blocking_line_count;
      blockingReasons.push(
        `Option "${option.name}" has ${option.blocking_line_count} blocking line item(s).`
      );
    }
  }

  const estimatePagePresent = graph.pages.some((page) => page.page_type === "estimate");
  if (!estimatePagePresent) {
    blockingReasons.push("Estimate page is missing from the proposal.");
  }

  const customerVisiblePages = getCustomerPreviewPages(graph.pages);
  if (customerVisiblePages.length === 0) {
    blockingReasons.push("No customer-visible pages are available to freeze.");
  }

  const customerName =
    readContextEchoString(graph.version.context_echo, "customer_name") ??
    (graph.proposal.customer_id ? `customer:${graph.proposal.customer_id}` : null);
  if (!customerName) {
    blockingReasons.push("Customer identity is missing from context_echo.");
  }

  const siteAddress =
    readContextEchoString(graph.version.context_echo, "address_formatted") ??
    readContextEchoString(graph.version.context_echo, "customer_address");
  if (!siteAddress) {
    warnings.push("Site or customer address is missing from context_echo.");
  }

  const companyName = readContextEchoString(graph.version.context_echo, "company_name");
  if (!companyName) {
    blockingReasons.push("Company identity is missing from context_echo.");
  } else {
    const companyLogo = readContextEchoString(graph.version.context_echo, "company_logo_url");
    if (!companyLogo) {
      warnings.push("Company logo is missing from context_echo; cover may use fallback branding.");
    }
  }

  const estimatePage = graph.pages.find((page) => page.page_type === "estimate");
  let displaySettingsResolvable = false;
  if (estimatePage) {
    try {
      readEstimatePageSettingsFromProposalPage(estimatePage.settings_json);
      displaySettingsResolvable = true;
    } catch {
      blockingReasons.push("Estimate page display settings could not be resolved.");
    }
  }

  const scopeSummary = computeScopeSummary(graph);
  if (scopeSummary.hiddenPageCount > 0) {
    warnings.push(
      `${scopeSummary.hiddenPageCount} page(s) hidden from customer view will remain hidden on the sent snapshot.`
    );
  }
  if (scopeSummary.hiddenLineCount > 0) {
    warnings.push(
      `${scopeSummary.hiddenLineCount} line item(s) hidden from customer remain priced in option totals.`
    );
  }
  if (scopeSummary.excludedLineCount > 0) {
    warnings.push(
      `${scopeSummary.excludedLineCount} excluded line item(s) are omitted from customer-facing lines.`
    );
  }

  if (input.pricingStale === true) {
    warnings.push(
      "Draft pricing may be stale relative to the current job measurement; refresh before send-freeze."
    );
  }

  const policyEcho = graph.version.policy_echo;
  if (
    policyEcho != null &&
    typeof policyEcho === "object" &&
    !Array.isArray(policyEcho) &&
    (policyEcho as Record<string, unknown>).configured === false
  ) {
    blockingReasons.push("Pricing policy echo is not configured.");
  }

  if (graph.proposal.pricing_policy_id == null) {
    blockingReasons.push("Proposal pricing_policy_id is missing.");
  }

  const ready = blockingReasons.length === 0;

  return {
    ready,
    blockingReasons,
    warnings,
    summary: {
      scopeSummary,
      selectedTemplateOptionId,
      pricingComplete,
      blockingLineCount,
      estimatePagePresent,
      customerVisiblePageCount: customerVisiblePages.length,
      hasLatestSentVersion: graph.proposal.latest_sent_version_id != null,
      displaySettingsResolvable,
    },
  };
}
