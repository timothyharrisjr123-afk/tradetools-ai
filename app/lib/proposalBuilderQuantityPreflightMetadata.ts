/**
 * Block A — Builder-internal quantity resolution preflight metadata.
 *
 * Pure compose over the S3D7 orchestrator from already-loaded Builder deps.
 * Invisible by default: no banner, no blocking, no auto-refresh, no DB writes,
 * no customer/public DTO exposure. Adjusted-measurement only via existing chain.
 */

import type { CatalogItem } from "@/app/lib/catalogTypes";
import type { ProposalQuantityPreviewContext } from "@/app/lib/proposalBuilderPreview";
import {
  orchestrateDraftQuantityResolutionPreflight,
  type DraftQuantityResolutionPreflightOrchestratorResult,
} from "@/app/lib/proposalQuantityResolutionPreflightOrchestrator";
import type { ProposalDraftGraph } from "@/app/lib/proposalRecordStore";
import type { ProposalTemplateItem } from "@/app/lib/proposalTemplateTypes";

export type ProposalBuilderQuantityPreflightMetadata = {
  status: "current" | "stale" | "unknown";
  staleCount: number;
  unknownCount: number;
  currentCount: number;
};

export type ResolveProposalBuilderQuantityPreflightMetadataInput = {
  draftGraph: ProposalDraftGraph | null | undefined;
  templateItems: readonly ProposalTemplateItem[] | null | undefined;
  catalogItems: readonly CatalogItem[] | null | undefined;
  quantityContext: ProposalQuantityPreviewContext | null | undefined;
};

/**
 * Strip orchestrator identity/byLineId down to Builder-internal summary fields.
 * Returns null when preflight cannot run (missing/non-draft graph).
 */
export function toProposalBuilderQuantityPreflightMetadata(
  result: DraftQuantityResolutionPreflightOrchestratorResult | null | undefined
): ProposalBuilderQuantityPreflightMetadata | null {
  if (result == null) return null;
  return {
    status: result.status,
    staleCount: result.staleCount,
    unknownCount: result.unknownCount,
    currentCount: result.currentCount,
  };
}

/**
 * Resolve Builder-internal quantity preflight from already-loaded draft deps.
 * Pure / metadata only — does not fetch, write, refresh, or mutate quantities.
 */
export function resolveProposalBuilderQuantityPreflightMetadata(
  input: ResolveProposalBuilderQuantityPreflightMetadataInput
): ProposalBuilderQuantityPreflightMetadata | null {
  const graph = input.draftGraph;
  if (graph == null) return null;
  if (graph.proposal.status !== "draft") return null;

  const result = orchestrateDraftQuantityResolutionPreflight({
    lineItems: graph.lineItems,
    templateItems: input.templateItems ?? null,
    catalogItems: input.catalogItems ?? [],
    quantityContext: input.quantityContext ?? null,
    identity: {
      proposalId: graph.proposal.id,
      jobId: graph.proposal.job_id ?? null,
      templateId: graph.proposal.template_id ?? null,
    },
  });

  return toProposalBuilderQuantityPreflightMetadata(result);
}
