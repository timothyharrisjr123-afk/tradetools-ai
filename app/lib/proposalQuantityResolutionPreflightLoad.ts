/**
 * S3D8 — injectable draft quantity resolution preflight loader (metadata only).
 *
 * Composes already-available read helpers (via deps) into the S3D7 orchestrator.
 * Pure assembly / DI — no hard-wired Supabase, no DB writes, no auto-refresh,
 * no UI, no customer/public DTO exposure.
 *
 * Server wiring lives in proposalQuantityResolutionPreflight.server.ts.
 */

import type { CatalogItem } from "@/app/lib/catalogTypes";
import type { MeasurementRecord } from "@/app/lib/measurementTypes";
import {
  buildMeasurementProposalHandoff,
  deriveQuantityMapFromRecord,
} from "@/app/lib/measurementProposalHandoff";
import { resolveMeasurementWorkspaceState } from "@/app/lib/measurementReadiness";
import type { ProposalQuantityPreviewContext } from "@/app/lib/proposalBuilderPreview";
import { validateProposalDraftGraphForJob } from "@/app/lib/proposalDraftGraphAdapter";
import type { ProposalDraftGraph } from "@/app/lib/proposalRecordStore";
import {
  orchestrateDraftQuantityResolutionPreflight,
  type DraftQuantityResolutionPreflightOrchestratorResult,
  type OrchestrateDraftQuantityResolutionPreflightInput,
} from "@/app/lib/proposalQuantityResolutionPreflightOrchestrator";
import type { ProposalTemplateItem } from "@/app/lib/proposalTemplateTypes";

export type LoadDraftQuantityResolutionPreflightDeps = {
  getDraftGraph: (
    companyId: string,
    proposalId: string
  ) => Promise<ProposalDraftGraph | null>;
  getTemplateItems: (
    templateId: string,
    companyId: string
  ) => Promise<readonly ProposalTemplateItem[] | null>;
  getCatalogItems: (companyId: string) => Promise<readonly CatalogItem[]>;
  getSelectedMeasurement: (jobId: string) => Promise<MeasurementRecord | null>;
};

export type LoadDraftQuantityResolutionPreflightInput = {
  companyId: string;
  proposalId: string;
  /** Optional job cross-check; defaults to graph.proposal.job_id when omitted. */
  jobId?: string | null;
  /** Skip draft re-fetch when caller already loaded the graph. */
  draftGraph?: ProposalDraftGraph | null;
};

/**
 * Build honest quantity preview context from a persisted selected measurement.
 * Returns null when no record (unknown, not invented).
 */
export function buildProposalQuantityPreviewContextFromPersistedMeasurement(
  record: MeasurementRecord | null | undefined
): ProposalQuantityPreviewContext | null {
  if (record == null) return null;

  const workspace = resolveMeasurementWorkspaceState({
    localRecord: record,
    persistedRecord: record,
    hasUnsavedChanges: false,
  });

  return {
    measurementHandoff: buildMeasurementProposalHandoff({
      record,
      workspace,
      hasUnsavedChanges: false,
      persistedRecord: record,
    }),
    quantityMap: deriveQuantityMapFromRecord(record),
  };
}

/**
 * Load draft/template/catalog/measurement deps and assemble orchestrator input.
 * Returns null when draft graph is missing or fails draft/job validation.
 * Missing template/catalog/measurement become honest null/empty → unknown.
 */
export async function loadDraftQuantityResolutionPreflightInput(
  input: LoadDraftQuantityResolutionPreflightInput,
  deps: LoadDraftQuantityResolutionPreflightDeps
): Promise<OrchestrateDraftQuantityResolutionPreflightInput | null> {
  const companyId = (input.companyId ?? "").trim();
  const proposalId = (input.proposalId ?? "").trim();
  if (!companyId || !proposalId) return null;

  const graph =
    input.draftGraph !== undefined
      ? input.draftGraph
      : await deps.getDraftGraph(companyId, proposalId);

  const jobIdForValidation =
    (input.jobId ?? "").trim() || (graph?.proposal.job_id ?? "").trim() || null;
  const validation = validateProposalDraftGraphForJob(graph, jobIdForValidation);
  if (!validation.valid || graph == null) return null;

  const templateId = (graph.proposal.template_id ?? "").trim();
  const jobId = (graph.proposal.job_id ?? "").trim();

  const [templateItems, catalogItems, measurement] = await Promise.all([
    templateId
      ? deps.getTemplateItems(templateId, companyId)
      : Promise.resolve(null),
    deps.getCatalogItems(companyId),
    jobId ? deps.getSelectedMeasurement(jobId) : Promise.resolve(null),
  ]);

  return {
    lineItems: graph.lineItems,
    templateItems: templateItems ?? null,
    catalogItems: catalogItems ?? [],
    quantityContext: buildProposalQuantityPreviewContextFromPersistedMeasurement(
      measurement
    ),
    identity: {
      proposalId: graph.proposal.id,
      jobId: jobId || null,
      templateId: templateId || null,
    },
  };
}

/**
 * Load deps via injectable readers, then run S3D7 orchestrator.
 * Metadata only — does not write, refresh, or mutate proposals.
 */
export async function runDraftQuantityResolutionPreflight(
  input: LoadDraftQuantityResolutionPreflightInput,
  deps: LoadDraftQuantityResolutionPreflightDeps
): Promise<DraftQuantityResolutionPreflightOrchestratorResult | null> {
  const assembled = await loadDraftQuantityResolutionPreflightInput(input, deps);
  if (assembled == null) return null;
  return orchestrateDraftQuantityResolutionPreflight(assembled);
}
