/**
 * V2F2 — Contractor sent-record Preview mode.
 *
 * Default Preview stays the current mutable draft.
 * view=sent&version=<uuid> loads that exact frozen version and never
 * falls back to the draft graph.
 */

import { isUuidLike } from "@/app/lib/jobStore";
import { formatJobCardSentAtLabel } from "@/app/lib/proposalJobCardSentHistory";
import type {
  ProposalDraftGraph,
  ProposalVersionGraph,
} from "@/app/lib/proposalRecordStore";

export const PREVIEW_SENT_RECORD_VIEW = "sent" as const;
export const PREVIEW_SENT_RECORD_STATUS_LABEL = "Sent proposal" as const;
export const PREVIEW_SENT_RECORD_BACK_LABEL = "Back to Job Card" as const;
export const PREVIEW_SENT_RECORD_MISSING_VERSION =
  "This sent proposal could not be opened." as const;
export const PREVIEW_SENT_RECORD_NOT_FROZEN =
  "This sent proposal is not available as a frozen record." as const;
export const PREVIEW_SENT_RECORD_JOB_MISMATCH =
  "This sent proposal does not belong to the job in the URL." as const;

export type ProposalPreviewSentRecordRequest =
  | { mode: "draft" }
  | { mode: "sent_record"; versionId: string }
  | { mode: "sent_record_invalid"; reason: string };

export type ProposalPreviewSentRecordChrome = {
  statusLabel: typeof PREVIEW_SENT_RECORD_STATUS_LABEL;
  sentAtLabel: string | null;
  deliveryLabel: string | null;
};

export function parseProposalPreviewSentRecordRequest(input: {
  view?: string | null;
  version?: string | null;
}): ProposalPreviewSentRecordRequest {
  const view = (input.view ?? "").trim().toLowerCase();
  if (view !== PREVIEW_SENT_RECORD_VIEW) {
    return { mode: "draft" };
  }
  const versionId = (input.version ?? "").trim();
  if (!isUuidLike(versionId)) {
    return {
      mode: "sent_record_invalid",
      reason: PREVIEW_SENT_RECORD_MISSING_VERSION,
    };
  }
  return { mode: "sent_record", versionId };
}

export function buildProposalPreviewSentHref(
  jobId: string,
  proposalId: string,
  versionId: string
): string {
  const job = (jobId ?? "").trim();
  const proposal = (proposalId ?? "").trim();
  const version = (versionId ?? "").trim();
  if (!isUuidLike(job) || !isUuidLike(proposal) || !isUuidLike(version)) {
    return `/tools/roofing?entry=job-card&job=${encodeURIComponent(job)}&tab=proposals`;
  }
  return (
    `/tools/roofing/proposals/preview?job=${encodeURIComponent(job)}` +
    `&proposal=${encodeURIComponent(proposal)}` +
    `&view=${PREVIEW_SENT_RECORD_VIEW}` +
    `&version=${encodeURIComponent(version)}`
  );
}

export function resolveSentRecordVersionId(input: {
  latestSentVersionId?: string | null;
  signedVersionId?: string | null;
}): string | null {
  const signed = (input.signedVersionId ?? "").trim();
  if (isUuidLike(signed)) return signed;
  const latest = (input.latestSentVersionId ?? "").trim();
  return isUuidLike(latest) ? latest : null;
}

export function validateProposalSentRecordGraph(input: {
  graph: ProposalVersionGraph | null;
  jobId: string;
  proposalId: string;
  versionId: string;
}): { ok: true; graph: ProposalVersionGraph } | { ok: false; reason: string } {
  const graph = input.graph;
  if (!graph) {
    return { ok: false, reason: PREVIEW_SENT_RECORD_MISSING_VERSION };
  }
  const jobId = (input.jobId ?? "").trim();
  const proposalId = (input.proposalId ?? "").trim();
  const versionId = (input.versionId ?? "").trim();
  if (graph.proposal.id !== proposalId || graph.version.proposal_id !== proposalId) {
    return { ok: false, reason: PREVIEW_SENT_RECORD_MISSING_VERSION };
  }
  if (graph.version.id !== versionId) {
    return { ok: false, reason: PREVIEW_SENT_RECORD_MISSING_VERSION };
  }
  if ((graph.proposal.job_id ?? "").trim() !== jobId) {
    return { ok: false, reason: PREVIEW_SENT_RECORD_JOB_MISMATCH };
  }
  if (!(graph.version.frozen_at ?? "").trim()) {
    return { ok: false, reason: PREVIEW_SENT_RECORD_NOT_FROZEN };
  }
  return { ok: true, graph };
}

/** Presenter reuse only — empty draft-only collections, no draft version swap. */
export function asCustomerPreviewGraphFromSentRecord(
  graph: ProposalVersionGraph
): ProposalDraftGraph {
  return {
    proposal: graph.proposal,
    version: graph.version,
    pages: graph.pages,
    options: graph.options,
    lineItems: graph.lineItems,
    internalSummaries: graph.internalSummaries,
    scopeDecisions: [],
    upgradeChoices: [],
  };
}

export function buildProposalPreviewSentRecordChrome(input: {
  frozenAt?: string | null;
  deliveryLabel?: string | null;
}): ProposalPreviewSentRecordChrome {
  const sentAt = formatJobCardSentAtLabel(input.frozenAt);
  return {
    statusLabel: PREVIEW_SENT_RECORD_STATUS_LABEL,
    sentAtLabel: sentAt ? `Sent ${sentAt}` : null,
    deliveryLabel: (input.deliveryLabel ?? "").trim() || null,
  };
}
